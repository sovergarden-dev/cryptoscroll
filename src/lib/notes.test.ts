import { afterEach, describe, expect, it, vi } from "vitest";
import { createNote, expiryToDate, prepareNoteCreation, submitNoteCreation } from "./notes";
import { CREATION_RETRY_MS } from "../../shared/protocol";

afterEach(() => vi.restoreAllMocks());

describe("note creation boundaries", () => {
  it.each([
    ["1h", 1],
    ["24h", 24],
    ["72h", 72],
    ["7d", 168],
    ["30d", 720],
  ] as const)("sets the %s deadline", (option, hours) => {
    expect(expiryToDate(option, 0)).toEqual({
      expiresAt: new Date(hours * 3600_000),
      burnAfterRead: false,
    });
  });

  it("bounds unread one-time notes to 30 days", () => {
    expect(expiryToDate("read-once", 0)).toEqual({
      expiresAt: new Date(2_592_000_000),
      burnAfterRead: true,
    });
  });

  it.each([
    ["1h", 1],
    ["24h", 24],
    ["72h", 72],
    ["7d", 168],
    ["30d", 720],
  ] as const)("sets a %s unread deadline without changing one-time access", (expiry, hours) => {
    expect(expiryToDate("read-once", 0, expiry)).toEqual({
      expiresAt: new Date(hours * 3600_000),
      burnAfterRead: true,
    });
  });

  it("reuses the exact encrypted creation after an uncertain response and stops after the window", async () => {
    const transport = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("lost response"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "a".repeat(32),
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          }),
        ),
      );
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const prepared = await prepareNoteCreation({
      content: "private recovery fixture",
      expiry: "read-once",
      unreadExpiry: "1h",
      passphrase: "separate secret fixture",
    });
    if (!prepared.ok) throw new Error("Fixture encryption failed");
    expect(await submitNoteCreation(prepared.data)).toMatchObject({
      ok: false,
      error: { code: "NETWORK" },
    });
    const success = await submitNoteCreation(prepared.data);
    expect(success.ok && success.data.url.endsWith(`#${prepared.data.encodedKey}`)).toBe(true);
    expect(transport.mock.calls[0]![1]!.body).toBe(transport.mock.calls[1]![1]!.body);
    const body = String(transport.mock.calls[0]![1]!.body);
    for (const secret of [
      "private recovery fixture",
      "separate secret fixture",
      prepared.data.encodedKey,
    ])
      expect(body).not.toContain(secret);
    vi.spyOn(Date, "now").mockReturnValue(prepared.data.retryUntil + CREATION_RETRY_MS);
    expect(await submitNoteCreation(prepared.data)).toMatchObject({
      ok: false,
      error: { code: "CREATION_EXPIRED" },
    });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(storage).not.toHaveBeenCalled();
  });

  it.each(["   ", "🔐".repeat(9000)])(
    "rejects blank or over-limit UTF-8 text before transport",
    async (content) => {
      const transport = vi.spyOn(globalThis, "fetch");
      expect(await createNote({ content, expiry: "1h" })).toMatchObject({
        ok: false,
        error: { code: "INVALID_REQUEST" },
      });
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("reports network failure without a success link or local storage fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const result = await createNote({ content: "network failure fixture", expiry: "1h" });
    expect(result).toMatchObject({ ok: false, error: { code: "NETWORK" } });
    expect(result).not.toHaveProperty("data.url");
    expect(storage).not.toHaveBeenCalled();
  });
});
