import { CreateNoteSchema, MAX_LIFETIME_MS, NOTE_ID, ReadNoteSchema } from "../shared/protocol";
import type { Env } from "./env";
import { failure, json, readJson } from "./http";
import { admitCreation, hasCreationLimiter } from "./creation-limit";

export { NoteVault } from "./note-vault";
export { NoteCounter } from "./note-counter";
export type { Env } from "./env";

const METHODS = "GET, POST, DELETE, OPTIONS";
const EXPIRY_CLOCK_TOLERANCE_MS = 5 * 60_000;

function counter(env: Env): DurableObjectStub {
  return env.NOTE_COUNTER.get(env.NOTE_COUNTER.idFromName("created"));
}

async function route(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/health" && request.method === "GET") {
    const checks = await Promise.allSettled([
      env.NOTES_KV.get("stats:created"),
      counter(env).fetch("https://counter/count"),
      env.NOTE_VAULT.get(env.NOTE_VAULT.idFromName("health-probe")).fetch("https://vault/health"),
      hasCreationLimiter(env)
        ? env.CREATION_LIMITER.limit({ key: "health" })
        : Promise.resolve(null),
    ]);
    const healthy =
      checks[0]?.status === "fulfilled" &&
      checks[1]?.status === "fulfilled" &&
      checks[1].value.ok &&
      checks[2]?.status === "fulfilled" &&
      checks[2].value.status === 404 &&
      checks[3]?.status === "fulfilled" &&
      checks[3].value !== null &&
      typeof checks[3].value.success === "boolean";
    return json(
      { status: healthy ? "ok" : "degraded", service: "CryptoScroll Worker", protocol: 1 },
      healthy ? 200 : 503,
    );
  }
  if (pathname === "/api/stats" && request.method === "GET")
    return counter(env).fetch("https://counter/count");
  if (pathname === "/api/notes" && request.method === "POST") {
    const denied = await admitCreation(request, env);
    if (denied) return denied;
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const parsed = CreateNoteSchema.safeParse(body.data);
    if (!parsed.success)
      return failure("INVALID_REQUEST", "The encrypted note envelope is invalid.", 400);
    const now = Date.now();
    const requestedExpiry = Date.parse(parsed.data.expiresAt);
    const lifetime = requestedExpiry - now;
    if (lifetime < 60_000 || lifetime > MAX_LIFETIME_MS + EXPIRY_CLOCK_TOLERANCE_MS) {
      return failure(
        "INVALID_REQUEST",
        "Expiry must be between one minute and 30 days from now.",
        400,
      );
    }
    const envelope = {
      ...parsed.data,
      expiresAt: new Date(Math.min(requestedExpiry, now + MAX_LIFETIME_MS)).toISOString(),
    };
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const response = await env.NOTE_VAULT.get(env.NOTE_VAULT.idFromName(id)).fetch(
      `https://vault/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(envelope),
      },
    );
    if (response.ok) {
      context.waitUntil(
        counter(env)
          .fetch("https://counter/count", { method: "POST" })
          .then((result) => {
            if (!result.ok) console.error("Aggregate note count update failed.");
          })
          .catch(() => console.error("Aggregate note count update unavailable.")),
      );
    }
    return response;
  }

  const match = pathname.match(/^\/api\/notes\/([^/]+)(\/read)?$/);
  const id = match?.[1];
  if (!id || !NOTE_ID.test(id)) return failure("NOT_FOUND", "This endpoint does not exist.", 404);
  const reading = match?.[2] === "/read";
  if (
    (request.method === "GET" && reading) ||
    (request.method === "POST" && !reading) ||
    !["GET", "POST", "DELETE"].includes(request.method) ||
    (request.method === "DELETE" && reading)
  ) {
    const response = failure("INVALID_REQUEST", "This method is not supported.", 405);
    response.headers.set("Allow", reading ? "POST, OPTIONS" : "GET, DELETE, OPTIONS");
    return response;
  }
  const stub = env.NOTE_VAULT.get(env.NOTE_VAULT.idFromName(id));
  if (request.method === "GET") return stub.fetch(`https://vault/${id}`);

  let proof: unknown;
  if (request.method === "DELETE") {
    const passphraseVerifier = request.headers.get("X-Passphrase-Proof");
    proof = {
      readToken: request.headers.get("Authorization")?.replace(/^Bearer /, ""),
      ...(passphraseVerifier !== null && { passphraseVerifier }),
    };
  } else {
    const body = await readJson(request);
    if (!body.ok) return body.response;
    proof = body.data;
  }
  const parsed = ReadNoteSchema.safeParse(proof);
  if (!parsed.success) return failure("INVALID_LINK", "A valid link capability is required.", 403);
  return stub.fetch(`https://vault/${id}`, {
    method: request.method,
    body: JSON.stringify(parsed.data),
  });
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim());
    if (origin && !allowed.includes(origin))
      return failure("INVALID_REQUEST", "This origin is not allowed.", 403);
    let response: Response;
    try {
      response =
        request.method === "OPTIONS"
          ? new Response(null, { status: 204 })
          : await route(request, env, context);
    } catch {
      response = failure(
        "UNAVAILABLE",
        "The note service is temporarily unavailable." +
          (new URL(request.url).pathname.endsWith("/read")
            ? " This read may already have consumed a one-time note."
            : ""),
        503,
      );
    }
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("Vary", "Origin");
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", METHODS);
      headers.set("Access-Control-Expose-Headers", "Retry-After");
      headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Passphrase-Proof",
      );
    }
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
