/**
 * CryptoScroll crypto helpers — WebCrypto only, no third-party libraries.
 *
 * Model:
 *  - A random AES-GCM 256-bit "link key" is generated in the browser.
 *  - It is exported as base64url and placed ONLY in the URL hash (#key=...).
 *    Browsers never send the hash fragment to a server.
 *  - Optional passphrase: the plaintext is first encrypted with a key derived
 *    from the passphrase (PBKDF2-SHA256, 250k iterations), then that ciphertext
 *    is encrypted again with the link key. Opening requires both.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 250_000;

/** Bytes -> base64url (URL-safe, no padding). */
export function toB64Url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url -> bytes. */
export function fromB64Url(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Generate a fresh, extractable AES-GCM 256-bit key. */
export async function generateLinkKey(): Promise<{ key: CryptoKey; encoded: string }> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { key, encoded: toB64Url(raw) };
}

/** Re-import a link key from its base64url form (read from the URL hash). */
export function importLinkKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromB64Url(encoded), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Derive an AES-GCM key from a passphrase + salt with PBKDF2. */
async function deriveFromPassphrase(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** AES-GCM encrypt with a fresh 96-bit IV. Output = iv || ciphertext. */
async function seal(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return out;
}

/** Inverse of seal(). Throws if the key is wrong or data was tampered with. */
async function open(key: CryptoKey, blob: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = blob.slice(0, 12);
  const ct = blob.slice(12);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
}

export interface EncryptedPayload {
  ciphertext: string; // base64url(iv || ct)
  salt?: string | undefined; // base64url, present only when passphrase-protected
}

/** Encrypt plaintext with the link key, optionally wrapped by a passphrase layer first. */
export async function encryptNote(
  plaintext: string,
  linkKey: CryptoKey,
  passphrase?: string,
): Promise<EncryptedPayload> {
  let data: Uint8Array<ArrayBuffer> = enc.encode(plaintext);
  let salt: Uint8Array<ArrayBuffer> | undefined;
  if (passphrase) {
    salt = crypto.getRandomValues(new Uint8Array(16));
    data = await seal(await deriveFromPassphrase(passphrase, salt), data);
  }
  const ct = await seal(linkKey, data);
  return { ciphertext: toB64Url(ct), salt: salt && toB64Url(salt) };
}

/** Decrypt a payload. Pass the passphrase if payload.salt is set. */
export async function decryptNote(
  payload: EncryptedPayload,
  linkKey: CryptoKey,
  passphrase?: string,
): Promise<string> {
  let data = await open(linkKey, fromB64Url(payload.ciphertext));
  if (payload.salt) {
    if (!passphrase) throw new Error("Passphrase required");
    data = await open(await deriveFromPassphrase(passphrase, fromB64Url(payload.salt)), data);
  }
  return dec.decode(data);
}
