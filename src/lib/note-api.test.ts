// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNoteCount } from "./note-api";

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "http://localhost:5173" } });
  vi.stubEnv("PROD", false);
  vi.stubEnv("VITE_API_URL", undefined);
});

afterEach(() => {
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
