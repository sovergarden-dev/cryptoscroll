import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function liveTargets(frontend, api) {
  const parse = (value, path) => {
    if (!value) throw new Error("Both --frontend and --api are required");
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.replace(/\/$/, "") !== path
    ) {
      throw new Error(
        "Use an HTTPS application root and API base, without credentials, query or fragment",
      );
    }
    return url;
  };
  return { frontend: parse(frontend, ""), api: parse(api, "/api") };
}

async function read(url, init = {}) {
  return fetch(url, {
    ...init,
    redirect: "error",
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(15_000),
  });
}

export async function checkLive(targets) {
  const result = { ok: false, checkedAt: new Date().toISOString(), stage: "frontend" };
  try {
    const frontend = await read(targets.frontend);
    await frontend.body?.cancel();
    result.frontendStatus = frontend.status;
    if (frontend.status !== 200 || !frontend.headers.get("content-type")?.includes("text/html"))
      return result;
    const policy = frontend.headers.get("content-security-policy") ?? "";
    const directives = new Map(
      policy.split(";").map((part) => {
        const [name, ...values] = part.trim().split(/\s+/);
        return [name, values];
      }),
    );
    const scripts = directives.get("script-src") ?? [];
    const nonce = scripts.find((value) => /^'nonce-[A-Za-z0-9+/=]{24,}'$/.test(value));
    const connections = directives.get("connect-src") ?? [];
    result.stage = "frontend-policy";
    if (
      !nonce ||
      scripts.includes("'unsafe-inline'") ||
      scripts.includes("'unsafe-eval'") ||
      !(
        connections.includes(targets.api.origin) ||
        (targets.api.origin === targets.frontend.origin && connections.includes("'self'"))
      )
    )
      return result;
    const second = await read(targets.frontend);
    await second.body?.cancel();
    const nextPolicy = second.headers.get("content-security-policy") ?? "";
    const nextNonce = nextPolicy.match(/'nonce-[A-Za-z0-9+/=]{24,}'/)?.[0];
    if (second.status !== 200 || !nextNonce || nextNonce === nonce) return result;
    result.freshDocumentNonce = true;
    result.stage = "api-health";
    const base = targets.api.href.replace(/\/$/, "");
    const health = await read(`${base}/health`, { headers: { Origin: targets.frontend.origin } });
    result.apiStatus = health.status;
    if (
      health.status !== 200 ||
      health.headers.get("access-control-allow-origin") !== targets.frontend.origin ||
      !health.headers.get("cache-control")?.includes("no-store")
    ) {
      await health.body?.cancel();
      return result;
    }
    const body = await health.json();
    if (body.status !== "ok" || body.protocol !== 1) return result;
    result.stage = "api-preflight";
    const options = await read(`${base}/notes`, {
      method: "OPTIONS",
      headers: {
        Origin: targets.frontend.origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    await options.body?.cancel();
    if (
      options.status !== 204 ||
      options.headers.get("access-control-allow-origin") !== targets.frontend.origin ||
      !options.headers.get("access-control-allow-methods")?.split(/,\s*/).includes("POST") ||
      !options.headers
        .get("access-control-allow-headers")
        ?.toLowerCase()
        .split(/,\s*/)
        .includes("content-type")
    )
      return result;
    return { ...result, ok: true, stage: "complete" };
  } catch {
    return result;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({
      options: { frontend: { type: "string" }, api: { type: "string" } },
    });
    const result = await checkLive(liveTargets(values.frontend, values.api));
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    console.error(
      "Usage: npm run check:live -- --frontend https://your-site/ --api https://your-api/api",
    );
    process.exitCode = 2;
  }
}
