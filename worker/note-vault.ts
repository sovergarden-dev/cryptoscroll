import { equalProofs, hashProof } from "../shared/encoding";
import {
  TOMBSTONE_MS,
  MAX_LIFETIME_MS,
  CLOCK_TOLERANCE_MS,
  type CreateNoteRequest,
  type NoteMetadata,
  type ReadNoteRequest,
  type EncryptedPayload,
} from "../shared/protocol";
import type { Env } from "./env";
import { failure, json } from "./http";
import { fingerprintCreation } from "./creation-recovery";

type StoredProperties = Omit<CreateNoteRequest, "ciphertext" | "iv" | "creationToken"> & {
  id: string;
  requestHash?: string;
};
type ActiveNote = StoredProperties & { kind: "active" };
type PendingNote = StoredProperties & { kind: "pending"; requestHash: string };
type RetiredNote = {
  id: string;
  forgetAt: number;
  kvDeleted: boolean;
} & ({ kind: "destroyed" } | { kind: "expired" });
type NoteState = ActiveNote | PendingNote | RetiredNote;

function metadata(note: ActiveNote): NoteMetadata {
  return {
    version: note.version,
    expiresAt: note.expiresAt,
    burnAfterRead: note.burnAfterRead,
    hasPassphrase: note.hasPassphrase,
    ...(note.passphraseSalt !== undefined && { passphraseSalt: note.passphraseSalt }),
  };
}

export class NoteVault implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    // KV awaits must remain inside the gate; storage's input gates alone do not cover them.
    return this.state.blockConcurrencyWhile(() => this.handle(request));
  }

  private async handle(request: Request): Promise<Response> {
    const note = await this.state.storage.get<NoteState>("note");
    if (request.method === "PUT") {
      return this.create(request, note);
    }

    if (!note) return failure("NOT_FOUND", "This note doesn't exist or was already read.", 404);
    if (note.kind === "destroyed" || note.kind === "expired") return this.gone(note.kind);
    if (Date.parse(note.expiresAt) <= Date.now()) {
      await this.retire(note, "expired");
      return this.gone("expired");
    }
    if (note.kind === "pending")
      return failure("UNAVAILABLE", "Note creation has not completed.", 503);
    if (request.method === "GET") return json(metadata(note));

    const proof = await request.json<ReadNoteRequest>();
    const requiredHash =
      request.method === "DELETE"
        ? (note.revokeTokenHash ?? note.readTokenHash)
        : note.readTokenHash;
    if (!equalProofs(await hashProof(proof.readToken), requiredHash)) {
      return failure("INVALID_LINK", "This link does not authorize the requested operation.", 403);
    }
    if (note.hasPassphrase) {
      if (!proof.passphraseVerifier)
        return failure("PASSPHRASE_REQUIRED", "Enter the passphrase shared by the sender.", 403);
      if (!equalProofs(proof.passphraseVerifier, note.passphraseVerifier!)) {
        return failure("WRONG_PASSPHRASE", "Wrong passphrase. The note has not been opened.", 403);
      }
    }

    if (request.method === "DELETE") {
      return (await this.retire(note, "destroyed"))
        ? json({ success: true })
        : this.cleanupPending();
    }

    const payload = await this.env.NOTES_KV.get<EncryptedPayload>(note.id, "json");
    if (!payload)
      return failure(
        "UNAVAILABLE",
        "Encrypted storage is temporarily unavailable. The note has not been opened.",
        503,
      );
    if (note.burnAfterRead && !(await this.retire(note, "destroyed"))) return this.cleanupPending();
    return json({ ...metadata(note), ...payload });
  }

  private gone(kind: RetiredNote["kind"]): Response {
    return kind === "expired"
      ? failure("EXPIRED", "This note expired and was automatically destroyed.", 410)
      : failure("DESTROYED", "This note has been permanently destroyed.", 410);
  }

  private async create(request: Request, note: NoteState | undefined): Promise<Response> {
    if (note?.kind === "destroyed" || note?.kind === "expired") return this.gone(note.kind);
    if (note && Date.parse(note.expiresAt) <= Date.now()) {
      await this.retire(note, "expired");
      return this.gone("expired");
    }
    const envelope = await request.json<CreateNoteRequest>();
    const requestHash = await fingerprintCreation(envelope);
    if (note && (!envelope.creationToken || note.requestHash !== requestHash))
      return failure(
        "CREATION_CONFLICT",
        "This creation token belongs to a different encrypted envelope.",
        409,
      );
    if (note?.kind === "active") return json({ id: note.id, expiresAt: note.expiresAt });
    let pending = note;
    if (!pending) {
      const now = Date.now();
      const requestedExpiry = Date.parse(envelope.expiresAt);
      const lifetime = requestedExpiry - now;
      if (lifetime < 60_000 || lifetime > MAX_LIFETIME_MS + CLOCK_TOLERANCE_MS)
        return failure(
          "INVALID_REQUEST",
          "Expiry must be between one minute and 30 days from now.",
          400,
        );
      const { ciphertext: _ciphertext, iv: _iv, creationToken: _token, ...properties } = envelope;
      pending = {
        ...properties,
        kind: "pending",
        id: new URL(request.url).pathname.slice(1),
        requestHash,
        expiresAt: new Date(Math.min(requestedExpiry, now + MAX_LIFETIME_MS)).toISOString(),
      };
      await this.state.storage.setAlarm(Date.parse(pending.expiresAt));
      await this.state.storage.put("note", pending);
      await this.state.storage.sync();
    }
    await this.env.NOTES_KV.put(
      pending.id,
      JSON.stringify({ ciphertext: envelope.ciphertext, iv: envelope.iv }),
      {
        expiration: Math.ceil(Date.parse(pending.expiresAt) / 1000),
      },
    );
    await this.state.storage.put("note", { ...pending, kind: "active" });
    return json({ id: pending.id, expiresAt: pending.expiresAt }, 201);
  }

  private cleanupPending(): Response {
    return failure("UNAVAILABLE", "The note is closed. Encrypted storage cleanup is pending.", 503);
  }

  private async retire(
    note: ActiveNote | PendingNote,
    kind: RetiredNote["kind"],
  ): Promise<boolean> {
    const retired: RetiredNote = {
      kind,
      id: note.id,
      forgetAt: Date.now() + TOMBSTONE_MS,
      kvDeleted: false,
    };
    await this.state.storage.put("note", retired);
    await this.state.storage.setAlarm(Date.now() + 1000);
    // Keep retirement and its cleanup alarm durable if the following KV call throws.
    await this.state.storage.sync();
    return this.finishCleanup(retired);
  }

  private async finishCleanup(note: RetiredNote): Promise<boolean> {
    if (!note.kvDeleted) {
      try {
        await this.env.NOTES_KV.delete(note.id);
      } catch {
        // The alarm already owns the next attempt. Leave the note closed.
        return false;
      }
      await this.state.storage.put("note", { ...note, kvDeleted: true });
    }
    if (note.forgetAt <= Date.now()) {
      await this.state.storage.deleteAll();
      await this.state.storage.deleteAlarm();
    } else {
      await this.state.storage.setAlarm(note.forgetAt);
    }
    return true;
  }

  async alarm(): Promise<void> {
    await this.state.blockConcurrencyWhile(async () => {
      const note = await this.state.storage.get<NoteState>("note");
      if (!note) return;
      if (note.kind === "active" || note.kind === "pending") {
        if (Date.parse(note.expiresAt) <= Date.now()) await this.retire(note, "expired");
        else await this.state.storage.setAlarm(Date.parse(note.expiresAt));
      } else {
        if (!note.kvDeleted) {
          await this.state.storage.setAlarm(Date.now() + 60_000);
          await this.state.storage.sync();
        }
        await this.finishCleanup(note);
      }
    });
  }
}
