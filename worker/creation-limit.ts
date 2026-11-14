import { base64ToBytes, bytesToBase64 } from "../shared/encoding";
import type { Env } from "./env";
import { failure } from "./http";

type CreationEnv = Pick<Env, "CREATION_LIMITER" | "CREATION_LIMIT_SALT">;

function configuredSecret(env: CreationEnv): Uint8Array<ArrayBuffer> | null {
  if (
    typeof env.CREATION_LIMITER?.limit !== "function" ||
    typeof env.CREATION_LIMIT_SALT !== "string"
  )
    return null;
  try {
    const bytes = base64ToBytes(env.CREATION_LIMIT_SALT);
    return bytes.length === 32 && bytesToBase64(bytes) === env.CREATION_LIMIT_SALT ? bytes : null;
  } catch {
    return null;
  }
}

export function hasCreationLimiter(env: CreationEnv): boolean {
  const secret = configuredSecret(env);
  if (!secret) return false;
  secret.fill(0);
  return true;
}

export async function admitCreation(request: Request, env: CreationEnv): Promise<Response | null> {
  const secret = configuredSecret(env);
  if (!secret)
    return failure(
      "UNAVAILABLE",
      "Creating notes is temporarily unavailable. Try again later.",
      503,
    );
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      secret,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const day = new Date().toISOString().slice(0, 10);
    const address = request.headers.get("CF-Connecting-IP") || "unknown";
    const tag = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${day}:${address}`),
    );
    const result = await env.CREATION_LIMITER.limit({
      key: `create:${bytesToBase64(new Uint8Array(tag))}`,
    });
    if (result.success) return null;
    const response = failure(
      "RATE_LIMITED",
      "Too many note-creation requests from this network. Try again in about a minute.",
      429,
    );
    response.headers.set("Retry-After", "60");
    return response;
  } catch {
    return failure(
      "UNAVAILABLE",
      "Creating notes is temporarily unavailable. Try again later.",
      503,
    );
  } finally {
    secret.fill(0);
  }
}
