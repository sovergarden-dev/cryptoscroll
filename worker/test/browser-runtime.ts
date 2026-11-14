import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createTestHarness, type TestHarnessOptions } from "wrangler";

export async function createBrowserRuntime() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const frontend = JSON.parse(
    await readFile(new URL("../../.output/server/wrangler.json", import.meta.url), "utf8"),
  ) as { name: string; compatibility_date: string };
  const options = (origin: string): TestHarnessOptions => ({
    root,
    workers: [
      {
        config: {
          name: "cryptoscroll-browser-gateway",
          main: "worker/test/browser-gateway.ts",
          compatibility_date: frontend.compatibility_date,
          services: [
            { binding: "FRONTEND", service: frontend.name },
            { binding: "API", service: "cryptoscroll-worker" },
          ],
        },
      },
      { configPath: ".output/server/wrangler.json" },
      {
        configPath: "worker/wrangler.toml",
        prebuiltWorkerDir: "worker/dist",
        vars: { ENVIRONMENT: "test", ALLOWED_ORIGINS: origin },
        secrets: { CREATION_LIMIT_SALT: btoa("x".repeat(32)) },
      },
    ],
  });
  const harness = createTestHarness(options("http://localhost"));
  try {
    const { url } = await harness.listen();
    await harness.update(options(url.origin));
    const response = await fetch(url);
    if (!response.ok || !(await response.text()).includes("Your secret note")) {
      throw new Error("The compiled frontend did not become ready");
    }
    return { origin: url.origin, close: () => harness.close() };
  } catch (error) {
    await harness.close();
    throw error;
  }
}
