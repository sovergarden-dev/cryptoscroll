import { bytesToBase64 } from "../shared/encoding";
import {
  CLOCK_TOLERANCE_MS,
  CREATION_RETRY_MS,
  type CreateNoteRequest,
  type Result,
} from "../shared/protocol";

export async function creationIdentity(
  envelope: CreateNoteRequest,
  now = Date.now(),
): Promise<Result<string>> {
  const token = envelope.creationToken;
  if (!token) {
    return { ok: true, data: hex(crypto.getRandomValues(new Uint8Array(16))) };
  }
  const age = now - Date.parse(token.issuedAt);
  if (age > CREATION_RETRY_MS || age < -CLOCK_TOLERANCE_MS) {
    return {
      ok: false,
      error: {
        code: "CREATION_EXPIRED",
        message: "The creation recovery window has ended or the device clock is incorrect.",
      },
    };
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`cryptoscroll:create:v1:${token.issuedAt}:${token.nonce}`),
  );
  return { ok: true, data: hex(new Uint8Array(digest).slice(0, 16)) };
}

export async function fingerprintCreation(envelope: CreateNoteRequest): Promise<string> {
  return bytesToBase64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(envelope))),
    ),
  );
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
