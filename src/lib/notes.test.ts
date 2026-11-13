import { afterEach, describe, expect, it, vi } from "vitest";
import { createNote, expiryToDate } from "./notes";

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
