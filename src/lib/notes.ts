import { base64ToBytes, bytesToBase64, hashProof } from "../../shared/encoding";
import {
  EncryptedPayloadSchema,
  EXPIRY_OPTIONS,
  MAX_NOTE_BYTES,
  NOTE_ID,
  PROTOCOL_VERSION,
  type ExpiryOption,
  type NoteMetadata,
  type Result,
  type ReadNoteRequest,
} from "../../shared/protocol";
import {
  base64ToKey,
  decryptNote,
  deriveKeyFromPassphrase,
  deriveReadToken,
  encryptNote,
  generateKey,
  keyToBase64,
} from "./crypto";
import { consumeNote, getNoteMetadata, revokeEncryptedNote, uploadNote } from "./note-api";

export { getNoteMetadata, getNoteCount } from "./note-api";
export type { ExpiryOption, NoteMetadata, Result } from "../../shared/protocol";

export interface CreatedNote {
  url: string;
  expiresAt: Date;
  burnAfterRead: boolean;
  hasPassphrase: boolean;
}

export interface NoteData extends Omit<CreatedNote, "url"> {
  content: string;
}

export function expiryToDate(expiry: ExpiryOption, now = Date.now()) {
  const option = EXPIRY_OPTIONS.find((entry) => entry.value === expiry);
  if (!option) throw new Error("Invalid expiry option");
  return {
    expiresAt: new Date(now + option.hours * 3600_000),
    burnAfterRead: option.burnAfterRead,
  };
}

export async function createNote(options: {
  content: string;
  expiry: ExpiryOption;
  passphrase?: string;
}): Promise<Result<CreatedNote>> {
  if (
    !options.content.trim() ||
    new TextEncoder().encode(options.content).length > MAX_NOTE_BYTES
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Write a note of up to 32 KiB before sealing it.",
      },
    };
  }
  if (
    options.passphrase !== undefined &&
    (!options.passphrase.trim() || options.passphrase.length > 1024)
  ) {
    return {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Enter a non-blank passphrase of up to 1,024 characters.",
      },
    };
  }
  try {
    const { expiresAt, burnAfterRead } = expiryToDate(options.expiry);
    const primaryKey = await generateKey();
    const encodedKey = await keyToBase64(primaryKey);
    let encrypted = await encryptNote(options.content, primaryKey);
    let protection: { passphraseSalt: string; passphraseVerifier: string } | undefined;
    if (options.passphrase !== undefined) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const { key, verifier } = await deriveKeyFromPassphrase(options.passphrase, salt);
      encrypted = await encryptNote(JSON.stringify(encrypted), key);
      protection = { passphraseSalt: bytesToBase64(salt), passphraseVerifier: verifier };
    }
    const result = await uploadNote({
      version: PROTOCOL_VERSION,
      ...encrypted,
      expiresAt: expiresAt.toISOString(),
      burnAfterRead,
      hasPassphrase: protection !== undefined,
      ...protection,
      readTokenHash: await hashProof(await deriveReadToken(encodedKey)),
    });
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        url: `${window.location.origin}${import.meta.env.BASE_URL}note/${result.data.id}#${encodedKey}`,
        expiresAt: new Date(result.data.expiresAt),
        burnAfterRead,
        hasPassphrase: protection !== undefined,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "CRYPTO_UNAVAILABLE",
        message: "Could not encrypt this note. Use an up-to-date browser over HTTPS and try again.",
      },
    };
  }
}

type NoteAccess = { primaryKey: CryptoKey; proof: ReadNoteRequest; passphraseKey?: CryptoKey };

async function prepareNoteAccess(
  id: string,
  encodedKey: string,
  passphrase?: string,
  knownMetadata?: NoteMetadata,
): Promise<Result<NoteAccess>> {
  if (!NOTE_ID.test(id))
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "This note doesn't exist or was already read." },
    };
  let primaryKey: CryptoKey;
  let readToken: string;
  try {
    primaryKey = await base64ToKey(encodedKey);
    readToken = await deriveReadToken(encodedKey);
  } catch {
    return {
      ok: false,
      error: {
        code: "INVALID_LINK",
        message: "The link key is missing or invalid. Ask the sender for the complete link.",
      },
    };
  }
  const info = knownMetadata
    ? { ok: true as const, data: knownMetadata }
    : await getNoteMetadata(id);
  if (!info.ok) return info;
  if (info.data.hasPassphrase && passphrase === undefined) {
    return {
      ok: false,
      error: { code: "PASSPHRASE_REQUIRED", message: "Enter the passphrase shared by the sender." },
    };
  }
  let protection: Awaited<ReturnType<typeof deriveKeyFromPassphrase>> | undefined;
  try {
    if (info.data.hasPassphrase)
      protection = await deriveKeyFromPassphrase(
        passphrase!,
        base64ToBytes(info.data.passphraseSalt!),
      );
  } catch {
    return {
      ok: false,
      error: {
        code: "CRYPTO_UNAVAILABLE",
        message: "Could not derive the passphrase key. The note has not been opened.",
      },
    };
  }
  return {
    ok: true,
    data: {
      primaryKey,
      proof: { readToken, ...(protection && { passphraseVerifier: protection.verifier }) },
      ...(protection && { passphraseKey: protection.key }),
    },
  };
}

export async function revokeNote(id: string, encodedKey: string, passphrase?: string) {
  const access = await prepareNoteAccess(id, encodedKey, passphrase);
  if (!access.ok) return access;
  return revokeEncryptedNote(id, access.data.proof);
}

export async function readNote(
  id: string,
  encodedKey: string,
  passphrase?: string,
  knownMetadata?: NoteMetadata,
): Promise<Result<NoteData>> {
  const access = await prepareNoteAccess(id, encodedKey, passphrase, knownMetadata);
  if (!access.ok) return access;
  const { primaryKey, passphraseKey, proof } = access.data;
  const result = await consumeNote(id, proof);
  if (!result.ok) return result;
  try {
    let encrypted = { ciphertext: result.data.ciphertext, iv: result.data.iv };
    if (passphraseKey)
      encrypted = EncryptedPayloadSchema.parse(
        JSON.parse(await decryptNote(encrypted, passphraseKey)),
      );
    const content = await decryptNote(encrypted, primaryKey);
    return {
      ok: true,
      data: {
        content,
        expiresAt: new Date(result.data.expiresAt),
        burnAfterRead: result.data.burnAfterRead,
        hasPassphrase: result.data.hasPassphrase,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "DECRYPT_FAILED",
        message:
          "The encrypted note could not be verified. If it was one-time, its server copy has already been destroyed. Ask the sender to create a new note.",
      },
    };
  }
}
