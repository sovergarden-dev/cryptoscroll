import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Log, LogLevel, Miniflare } from "miniflare";

export async function createWorkerRuntime(
  fixtures = false,
  allowedOrigin = "http://localhost:5173",
) {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL(fixtures ? "./entry.ts" : "../index.ts", import.meta.url))],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    target: "es2022",
  });
  return new Miniflare(
    convertV4MiniflareOptions({
      name: "cryptoscroll-test",
      script: bundle.outputFiles[0]!.text,
      modules: true,
      compatibilityDate: "2026-11-10",
      kvNamespaces: ["NOTES_KV"],
      durableObjects: {
        NOTE_VAULT: { className: "NoteVault", useSQLite: true },
        NOTE_COUNTER: { className: "NoteCounter", useSQLite: true },
      },
      bindings: { ALLOWED_ORIGINS: allowedOrigin, ENVIRONMENT: "test" },
      port: 0,
      cf: false,
      log: new Log(LogLevel.ERROR),
    }),
  );
}
