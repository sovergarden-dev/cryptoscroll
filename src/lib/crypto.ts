import { base64ToBytes, bytesToBase64 } from "../../shared/encoding";
import { PBKDF2_ITERATIONS, type EncryptedPayload } from "../../shared/protocol";

const ALGORITHM = { name: "AES-GCM", length: 256 } as const;
const encoder = new TextEncoder();

export type { EncryptedPayload } from "../../shared/protocol";

export function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(ALGORITHM, true, ["encrypt", "decrypt"]);
}

export async function keyToBase64(key: CryptoKey): Promise<string> {
  return bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function keyBytes(encoded: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error("Invalid link key");
  const value = encoded.replaceAll("-", "+").replaceAll("_", "/") + "=";
  const bytes = base64ToBytes(value);
  if (bytes.length !== 32 || bytesToBase64(bytes) !== value) throw new Error("Invalid link key");
  return bytes;
}

export function base64ToKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes(encoded), ALGORITHM, false, ["decrypt"]);
}

export async function encryptNote(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) };
}

export async function decryptNote(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext),
  );
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(plaintext);
}

export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<{ key: CryptoKey; verifier: string }> {
  if (salt.length !== 16) throw new Error("Invalid passphrase salt");
  const base = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, [
    "deriveBits",
  ]);
  const raw = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    256,
  );
  const verifier = bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)));
  const key = await crypto.subtle.importKey("raw", raw, ALGORITHM, false, ["encrypt", "decrypt"]);
  new Uint8Array(raw).fill(0);
  return { key, verifier };
}

export async function deriveReadToken(encoded: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes(encoded),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode("cryptoscroll:read:v1"))),
  );
}
