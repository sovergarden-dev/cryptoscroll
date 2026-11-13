import { z } from "zod";

export const PROTOCOL_VERSION = 1;
export const PBKDF2_ITERATIONS = 250_000;
export const MAX_NOTE_BYTES = 32 * 1024;
export const MAX_REQUEST_BYTES = 128 * 1024;
export const MAX_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const TOMBSTONE_MS = 24 * 60 * 60 * 1000;
export const NOTE_ID = /^[a-f0-9]{32}$/;

export const EXPIRY_OPTIONS = [
  { value: "read-once", label: "After first read", hours: 720, burnAfterRead: true },
  { value: "1h", label: "1h", hours: 1, burnAfterRead: false },
  { value: "24h", label: "24h", hours: 24, burnAfterRead: false },
  { value: "72h", label: "72h", hours: 72, burnAfterRead: false },
  { value: "7d", label: "7d", hours: 168, burnAfterRead: false },
  { value: "30d", label: "30d", hours: 720, burnAfterRead: false },
] as const;

export type ExpiryOption = (typeof EXPIRY_OPTIONS)[number]["value"];

function base64(byteLength?: number) {
  return z
    .string()
    .max(90_000)
    .refine((value) => {
      try {
        const binary = atob(value);
        return (
          btoa(binary) === value &&
          (byteLength === undefined ? binary.length >= 16 : binary.length === byteLength)
        );
      } catch {
        return false;
      }
    }, "Invalid base64 payload");
}

const metadataFields = {
  version: z.literal(PROTOCOL_VERSION),
  expiresAt: z.string().datetime({ offset: true }),
  burnAfterRead: z.boolean(),
  hasPassphrase: z.boolean(),
  passphraseSalt: base64(16).optional(),
};
const payloadFields = { ciphertext: base64(), iv: base64(12) };
const validSalt = (value: { hasPassphrase: boolean; passphraseSalt?: string | undefined }) =>
  value.hasPassphrase === (value.passphraseSalt !== undefined);

export const EncryptedPayloadSchema = z.object(payloadFields).strict();
export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>;

export const NoteMetadataSchema = z
  .object(metadataFields)
  .strict()
  .refine(validSalt, "Invalid passphrase metadata");
export type NoteMetadata = z.infer<typeof NoteMetadataSchema>;

export const CreateNoteSchema = z
  .object({
    ...metadataFields,
    ...payloadFields,
    readTokenHash: base64(32),
    passphraseVerifier: base64(32).optional(),
  })
  .strict()
  .refine(validSalt, "Invalid passphrase salt")
  .refine(
    (value) => value.hasPassphrase === (value.passphraseVerifier !== undefined),
    "Invalid passphrase verifier",
  );
export type CreateNoteRequest = z.infer<typeof CreateNoteSchema>;

export const NoteContentSchema = z
  .object({ ...metadataFields, ...payloadFields })
  .strict()
  .refine(validSalt, "Invalid passphrase metadata");
export type NoteContent = z.infer<typeof NoteContentSchema>;

export const ReadNoteSchema = z
  .object({
    readToken: base64(32),
    passphraseVerifier: base64(32).optional(),
  })
  .strict();
export type ReadNoteRequest = z.infer<typeof ReadNoteSchema>;

export const CreatedNoteSchema = z
  .object({ id: z.string().regex(NOTE_ID), expiresAt: z.string().datetime({ offset: true }) })
  .strict();
export const NoteCountSchema = z.object({ count: z.number().int().nonnegative() }).strict();

export type ErrorCode =
  | "NOT_FOUND"
  | "DESTROYED"
  | "EXPIRED"
  | "INVALID_LINK"
  | "PASSPHRASE_REQUIRED"
  | "WRONG_PASSPHRASE"
  | "INVALID_REQUEST"
  | "TOO_LARGE"
  | "UNAVAILABLE"
  | "NETWORK"
  | "DECRYPT_FAILED"
  | "CRYPTO_UNAVAILABLE";
export type Failure = { code: ErrorCode; message: string };
export type Result<T> = { ok: true; data: T } | { ok: false; error: Failure };
