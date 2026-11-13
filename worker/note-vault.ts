import { equalProofs, hashProof } from "../shared/encoding";
import {
  TOMBSTONE_MS,
  type CreateNoteRequest,
  type NoteMetadata,
  type ReadNoteRequest,
  type EncryptedPayload,
} from "../shared/protocol";
import type { Env } from "./env";
import { failure, json } from "./http";

type ActiveNote = Omit<CreateNoteRequest, "ciphertext" | "iv"> & { kind: "active"; id: string };
type RetiredNote = {
  kind: "destroyed" | "expired";
  id: string;
  forgetAt: number;
  kvDeleted: boolean;
};
type NoteState = ActiveNote | RetiredNote;

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
      if (note) return failure("INVALID_REQUEST", "The note ID is already in use.", 409);
      const id = new URL(request.url).pathname.slice(1);
      const { ciphertext, iv, ...properties } = await request.json<CreateNoteRequest>();
      const active: ActiveNote = { ...properties, kind: "active", id };
      await this.state.storage.setAlarm(Date.parse(active.expiresAt));
      await this.env.NOTES_KV.put(id, JSON.stringify({ ciphertext, iv }), {
        expiration: Math.ceil(Date.parse(active.expiresAt) / 1000),
      });
      await this.state.storage.put("note", active);
      return json({ id, expiresAt: active.expiresAt }, 201);
    }

    if (!note) return failure("NOT_FOUND", "This note doesn't exist or was already read.", 404);
    if (note.kind !== "active") return this.gone(note.kind);
    if (Date.parse(note.expiresAt) <= Date.now()) {
      await this.retire(note, "expired");
      return this.gone("expired");
    }
    if (request.method === "GET") return json(metadata(note));

    const proof = await request.json<ReadNoteRequest>();
    if (!equalProofs(await hashProof(proof.readToken), note.readTokenHash)) {
      return failure(
        "INVALID_LINK",
        "The link key is incorrect. Ask the sender for the complete link.",
        403,
      );
    }
    if (note.hasPassphrase) {
      if (!proof.passphraseVerifier)
        return failure("PASSPHRASE_REQUIRED", "Enter the passphrase shared by the sender.", 403);
      if (!equalProofs(proof.passphraseVerifier, note.passphraseVerifier!)) {
        return failure("WRONG_PASSPHRASE", "Wrong passphrase. The note has not been opened.", 403);
      }
    }

    if (request.method === "DELETE") {
      await this.retire(note, "destroyed");
      return json({ success: true });
    }

    const payload = await this.env.NOTES_KV.get<EncryptedPayload>(note.id, "json");
    if (!payload)
      return failure(
        "UNAVAILABLE",
        "Encrypted storage is temporarily unavailable. The note has not been opened.",
        503,
      );
    if (note.burnAfterRead) await this.retire(note, "destroyed");
    return json({ ...metadata(note), ...payload });
  }

  private gone(kind: RetiredNote["kind"]): Response {
    return kind === "expired"
      ? failure("EXPIRED", "This note expired and was automatically destroyed.", 410)
      : failure("DESTROYED", "This note has been permanently destroyed.", 410);
  }

  private async retire(note: ActiveNote, kind: RetiredNote["kind"]): Promise<void> {
    const retired: RetiredNote = {
      kind,
      id: note.id,
      forgetAt: Date.now() + TOMBSTONE_MS,
      kvDeleted: false,
    };
    await this.state.storage.put("note", retired);
    await this.state.storage.setAlarm(Date.now() + 1000);
    await this.finishCleanup(retired);
  }

  private async finishCleanup(note: RetiredNote): Promise<void> {
    if (!note.kvDeleted) {
      await this.env.NOTES_KV.delete(note.id);
      await this.state.storage.put("note", { ...note, kvDeleted: true });
    }
    if (note.forgetAt <= Date.now()) {
      await this.state.storage.deleteAll();
      await this.state.storage.deleteAlarm();
    } else {
      await this.state.storage.setAlarm(note.forgetAt);
    }
  }

  async alarm(): Promise<void> {
    await this.state.blockConcurrencyWhile(async () => {
      const note = await this.state.storage.get<NoteState>("note");
      if (!note) return;
      if (note.kind === "active") {
        if (Date.parse(note.expiresAt) <= Date.now()) await this.retire(note, "expired");
        else await this.state.storage.setAlarm(Date.parse(note.expiresAt));
      } else {
        if (!note.kvDeleted) await this.state.storage.setAlarm(Date.now() + 60_000);
        await this.finishCleanup(note);
      }
    });
  }
}
