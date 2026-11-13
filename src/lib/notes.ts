/**
 * Note storage (MVP: localStorage). Only ciphertext + metadata are stored —
 * never the key or plaintext.
 */
import type { EncryptedPayload } from "./crypto";

export type Destruct = "read" | "1h" | "24h" | "72h";

export interface StoredNote extends EncryptedPayload {
  id: string;
  createdAt: number;
  expiresAt: number | null; // null = no time limit (read-once only)
  readOnce: boolean;
}

const PREFIX = "cryptoscroll:note:";
const HOURS: Record<Exclude<Destruct, "read">, number> = { "1h": 1, "24h": 24, "72h": 72 };

/** Compute expiry metadata for a self-destruct option. */
export function destructMeta(option: Destruct, now = Date.now()) {
  if (option === "read") return { readOnce: true, expiresAt: null };
  return { readOnce: false, expiresAt: now + HOURS[option] * 3600_000 };
}

export function isExpired(note: Pick<StoredNote, "expiresAt">, now = Date.now()) {
  return note.expiresAt !== null && now >= note.expiresAt;
}

/** Random 128-bit note id, hex. */
export function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function saveNote(note: StoredNote) {
  localStorage.setItem(PREFIX + note.id, JSON.stringify(note));
}

export function loadNote(id: string): StoredNote | null {
  const raw = localStorage.getItem(PREFIX + id);
  return raw ? (JSON.parse(raw) as StoredNote) : null;
}

export function destroyNote(id: string) {
  localStorage.removeItem(PREFIX + id);
}

/** Remove any expired notes. */
export function sweepExpired() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    try {
      if (isExpired(JSON.parse(localStorage.getItem(k)!))) localStorage.removeItem(k);
    } catch {
      localStorage.removeItem(k);
    }
  }
}
