import { test as base, expect } from "@playwright/test";
import { createBrowserRuntime } from "../worker/test/browser-runtime";

export const test = base.extend<object, { appOrigin: string }>({
  appOrigin: [
    async ({ playwright: _playwright }, provide) => {
      const runtime = await createBrowserRuntime();
      try {
        await provide(runtime.origin);
      } finally {
        await runtime.close();
      }
    },
    { scope: "worker", timeout: 90_000 },
  ],
  baseURL: async ({ appOrigin }, provide) => provide(appOrigin),
});

export { expect };
