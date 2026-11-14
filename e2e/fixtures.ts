import { test as base, expect } from "@playwright/test";
import { createServer as createNetServer } from "node:net";
import { createServer as createViteServer } from "vite";
import { createWorkerRuntime } from "../worker/test/runtime";

async function availablePort() {
  const reservation = createNetServer();
  await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("No ephemeral test port");
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

export const test = base.extend<object, { appOrigin: string }>({
  appOrigin: [
    async ({ playwright: _playwright }, provide) => {
      const port = await availablePort();
      const origin = `http://127.0.0.1:${port}`;
      const runtime = await createWorkerRuntime(false, origin);
      let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
      try {
        const workerUrl = await runtime.ready;
        vite = await createViteServer({
          mode: "e2e",
          define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") },
          server: {
            host: "127.0.0.1",
            port,
            strictPort: true,
            proxy: { "/api": { target: workerUrl.origin, changeOrigin: true } },
          },
        });
        await vite.listen();
        const ready = await fetch(origin);
        if (!ready.ok || !(await ready.text()).includes("Your secret note")) {
          throw new Error("The frontend did not become ready");
        }
        await provide(origin);
      } finally {
        await Promise.all([vite?.close(), runtime.dispose()]);
      }
    },
    // Allow cold TanStack dependency optimization on Windows before the tests start.
    { scope: "worker", timeout: 180_000 },
  ],
  baseURL: async ({ appOrigin }, provide) => provide(appOrigin),
});

export { expect };
