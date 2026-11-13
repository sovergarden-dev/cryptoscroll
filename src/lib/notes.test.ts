import { describe, expect, it } from "vitest";
import { destructMeta, isExpired } from "./notes";
import { decryptNote, encryptNote, generateLinkKey, importLinkKey } from "./crypto";

describe("self-destruct rules", () => {
  it("'after first read' is read-once with no time limit", () => {
    expect(destructMeta("read", 0)).toEqual({ readOnce: true, expiresAt: null });
  });
  it("24h option expires exactly 24 hours later", () => {
    expect(destructMeta("24h", 0).expiresAt).toBe(24 * 3600_000);
  });
  it("note is expired once past expiry", () => {
    expect(isExpired({ expiresAt: 1000 }, 999)).toBe(false);
    expect(isExpired({ expiresAt: 1000 }, 1000)).toBe(true);
  });
});

describe("encryption", () => {
  it("round-trips with link key and passphrase, fails with wrong passphrase", async () => {
    const { encoded } = await generateLinkKey();
    const key = await importLinkKey(encoded);
    const p = await encryptNote("secret", key, "hunter2");
    expect(await decryptNote(p, key, "hunter2")).toBe("secret");
    await expect(decryptNote(p, key, "nope")).rejects.toThrow();
  });
});
