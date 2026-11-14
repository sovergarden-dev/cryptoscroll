// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { render } = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("@tanstack/react-start/server-entry", () => ({ default: { fetch: render } }));
let originalConsoleError: typeof console.error;

beforeEach(() => {
  originalConsoleError = console.error;
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_API_URL", undefined);
  render.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  console.error = originalConsoleError;
  vi.unstubAllEnvs();
});

it("replaces a caller-supplied nonce before the renderer receives the request", async () => {
  render.mockResolvedValue(
    new Response("<main>fixture</main>", { headers: { "Content-Type": "text/html" } }),
  );
  const { default: server } = await import("./server");
  const response = await server.fetch(
    new Request("https://cryptoscroll.syrin.online/", {
      headers: { "x-cryptoscroll-nonce": "caller-controlled" },
    }),
    undefined,
  );
  const nonce = (render.mock.calls[0]![0] as Request).headers.get("x-cryptoscroll-nonce");
  expect(nonce).toMatch(/^[A-Za-z0-9+/=]{32}$/);
  expect(nonce).not.toBe("caller-controlled");
  expect(response.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
});

it("returns a CSP-compatible error page without logging request secrets or causes", async () => {
  const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
  render.mockRejectedValue(
    new Error("fixture-secret-primary-key", {
      cause: new Error("fixture-secret-passphrase"),
    }),
  );
  const { default: server } = await import("./server");
  const response = await server.fetch(new Request("https://cryptoscroll.syrin.online/"), undefined);
  expect(response.status).toBe(500);
  const nonce = response.headers.get("Content-Security-Policy")?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toMatch(/^[A-Za-z0-9+/=]{32}$/);
  const html = await response.text();
  expect(html).toContain(`<script nonce="${nonce}">`);
  expect(html).not.toContain("onclick=");
  expect(html).not.toContain("fixture-secret");
  expect(output).toHaveBeenCalled();
  expect(JSON.stringify(output.mock.calls)).not.toContain("fixture-secret");
});
