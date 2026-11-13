// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  base64ToKey,
  decryptNote,
  deriveKeyFromPassphrase,
  deriveReadToken,
  encryptNote,
  generateKey,
  keyToBase64,
} from "./crypto";
import { base64ToBytes, bytesToBase64 } from "../../shared/encoding";

const scalar = fc
  .integer({ min: 0, max: 0x10ffff })
  .filter((value) => value < 0xd800 || value > 0xdfff);
const unicodeText = fc
  .array(scalar, { maxLength: 2500 })
  .map((values) => String.fromCodePoint(...values));

describe("CryptoScroll property-based encryption", () => {
  it("round-trips arbitrary Unicode scalar text, including empty text", async () => {
    await fc.assert(
      fc.asyncProperty(unicodeText, async (plaintext) => {
        const key = await generateKey();
        expect(await decryptNote(await encryptNote(plaintext, key), key)).toBe(plaintext);
      }),
      { numRuns: 30, examples: [["\ufeffBOM\0\r\nTiếng Việt 🔐"], ["x".repeat(10_000)]] },
    );
  });

  it("produces different ciphertext samples for different plaintexts", async () => {
    await fc.assert(
      fc.asyncProperty(unicodeText, unicodeText, async (a, b) => {
        fc.pre(a !== b);
        const key = await generateKey();
        expect((await encryptNote(a, key)).ciphertext).not.toBe(
          (await encryptNote(b, key)).ciphertext,
        );
      }),
      { numRuns: 20 },
    );
  });

  it("rejects a different key for arbitrary ciphertexts", async () => {
    await fc.assert(
      fc.asyncProperty(unicodeText, async (text) => {
        const payload = await encryptNote(text, await generateKey());
        await expect(decryptNote(payload, await generateKey())).rejects.toThrow();
      }),
      { numRuns: 20 },
    );
  });

  it("serializes a key as 43 URL-safe characters and restores decryption", async () => {
    await fc.assert(
      fc.asyncProperty(unicodeText, async (text) => {
        const key = await generateKey();
        const encoded = await keyToBase64(key);
        expect(encoded).toMatch(/^[A-Za-z0-9_-]{43}$/);
        const restored = await base64ToKey(encoded);
        expect(restored.extractable).toBe(false);
        expect(await decryptNote(await encryptNote(text, key), restored)).toBe(text);
      }),
      { numRuns: 20 },
    );
  });

  it("uses fresh 96-bit IVs across 100 encryptions of identical text", async () => {
    const key = await generateKey();
    const ivs = new Set<string>();
    for (let index = 0; index < 100; index++) {
      const encrypted = await encryptNote("same note", key);
      expect(base64ToBytes(encrypted.iv).byteLength).toBe(12);
      expect(ivs.has(encrypted.iv)).toBe(false);
      ivs.add(encrypted.iv);
    }
  });

  it("rejects authentication-tag or IV tampering", async () => {
    await fc.assert(
      fc.asyncProperty(unicodeText, fc.boolean(), async (text, changeIv) => {
        const key = await generateKey();
        const payload = await encryptNote(text, key);
        const field = changeIv ? "iv" : "ciphertext";
        const bytes = base64ToBytes(payload[field]);
        bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
        await expect(
          decryptNote({ ...payload, [field]: bytesToBase64(bytes) }, key),
        ).rejects.toThrow();
      }),
      { numRuns: 20 },
    );
  });

  it("derives reproducible non-extractable passphrase keys and independent read capabilities", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const first = await deriveKeyFromPassphrase("  tiếng Việt secret 🔐  ", salt);
    const second = await deriveKeyFromPassphrase("  tiếng Việt secret 🔐  ", salt);
    const wrong = await deriveKeyFromPassphrase("tiếng Việt secret 🔐", salt);
    expect(first.key.extractable).toBe(false);
    expect(first.verifier).toBe(second.verifier);
    expect(first.verifier).not.toBe(wrong.verifier);
    const encrypted = await encryptNote("passphrase layer", first.key);
    expect(await decryptNote(encrypted, second.key)).toBe("passphrase layer");
    await expect(decryptNote(encrypted, wrong.key)).rejects.toThrow();
    const encoded = await keyToBase64(await generateKey());
    expect(await deriveReadToken(encoded)).toBe(await deriveReadToken(encoded));
    expect(base64ToBytes(await deriveReadToken(encoded))).not.toEqual(
      base64ToBytes(encoded.replaceAll("-", "+").replaceAll("_", "/") + "="),
    );
  });
});
