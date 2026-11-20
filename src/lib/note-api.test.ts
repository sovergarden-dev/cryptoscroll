// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeNote, getNoteCount } from "./note-api";
import { createNote } from "./notes";

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "http://localhost:5173" } });
  vi.stubEnv("PROD", false);
  vi.stubEnv("VITE_API_URL", undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function successfulTransport() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ count: 4 }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("API deployment selection", () => {
  it("uses the local proxy during development", async () => {
    const transport = successfulTransport();
    expect(await getNoteCount()).toEqual({ ok: true, data: { count: 4 } });
    expect(transport).toHaveBeenCalledWith(
      "http://localhost:5173/api/stats",
      expect.objectContaining({
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        redirect: "error",
      }),
    );
  });

  it("uses the deployed Worker on the hosted production origin", async () => {
    vi.stubEnv("PROD", true);
    vi.stubGlobal("window", { location: { origin: "https://cryptoscroll.syrin.online" } });
    const transport = successfulTransport();
    expect(await getNoteCount()).toEqual({ ok: true, data: { count: 4 } });
    expect(transport).toHaveBeenCalledWith(
      "https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api/stats",
      expect.any(Object),
    );
  });

  it("uses the deployed Worker in the hosted Lovable preview", async () => {
    vi.stubGlobal("window", { location: { origin: "https://preview--cryptoscroll.lovable.app" } });
    const transport = successfulTransport();
    expect(await getNoteCount()).toEqual({ ok: true, data: { count: 4 } });
    expect(transport).toHaveBeenCalledWith(
      "https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api/stats",
      expect.any(Object),
    );
  });

  it("honors a self-hosted HTTPS override", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "https://private-notes.example/api/");
    const transport = successfulTransport();
    expect(await getNoteCount()).toEqual({ ok: true, data: { count: 4 } });
    expect(transport).toHaveBeenCalledWith(
      "https://private-notes.example/api/stats",
      expect.any(Object),
    );
  });

  it.each([
    "http://remote.example/api",
    "https://service.example/api#fixture",
    "https://service.example/api?secret=fixture",
    "https://user:fixture@service.example/api",
  ])("rejects unsafe API configuration before transport: %s", async (url) => {
    vi.stubEnv("VITE_API_URL", url);
    const transport = successfulTransport();
    expect(await getNoteCount()).toMatchObject({ ok: false, error: { code: "NETWORK" } });
    expect(transport).not.toHaveBeenCalled();
  });
});

it("bounds a stalled destructive read without retrying or claiming it preserved the note", async () => {
  vi.useFakeTimers();
  let activeSignal: AbortSignal | null | undefined;
  const transport = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
    activeSignal = init?.signal;
    return new Promise((_resolve, reject) => {
      activeSignal?.addEventListener("abort", () => reject(activeSignal?.reason), { once: true });
    });
  });
  const result = consumeNote("a".repeat(32), {
    readToken: btoa("x".repeat(32)),
  });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(activeSignal?.aborted).toBe(true);
  await expect(result).resolves.toMatchObject({
    ok: false,
    error: { code: "NETWORK", message: expect.stringContaining("may already have consumed") },
  });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it.each([
  ["7", 7000],
  ["0", 0],
  ["Thu, 01 Jan 2026 00:00:12 GMT", 12000],
  ["invalid", 60000],
  [null, 60000],
] as const)("honors the creation cooldown for Retry-After %s", async (header, delay) => {
  const now = Date.UTC(2026, 0, 1);
  vi.spyOn(Date, "now").mockReturnValue(now);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("Rate limited", {
      status: 429,
      headers: header === null ? {} : { "Retry-After": header },
    }),
  );
  await expect(createNote({ content: "cooldown fixture", expiry: "1h" })).resolves.toMatchObject({
    ok: false,
    error: { code: "RATE_LIMITED", retryAt: now + delay },
  });
});

it("reports a timed read network error without suggesting the note was consumed", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  const result = await consumeNote("a".repeat(32), { readToken: btoa("x".repeat(32)) }, false);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("NETWORK");
    expect(result.error.message).not.toContain("consumed");
  }
});
