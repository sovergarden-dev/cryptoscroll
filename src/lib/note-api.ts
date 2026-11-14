import { z } from "zod";
import {
  CreatedNoteSchema,
  NoteContentSchema,
  NoteCountSchema,
  NoteMetadataSchema,
  type CreateNoteRequest,
  type ReadNoteRequest,
  type Result,
} from "../../shared/protocol";

const ErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "NOT_FOUND",
      "DESTROYED",
      "EXPIRED",
      "INVALID_LINK",
      "PASSPHRASE_REQUIRED",
      "WRONG_PASSPHRASE",
      "INVALID_REQUEST",
      "TOO_LARGE",
      "UNAVAILABLE",
    ]),
    message: z.string().max(300),
  }),
});

const HOSTED_API_URL = "https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function apiBase(): string {
  const frontend = new URL(window.location.origin);
  const configured =
    import.meta.env.VITE_API_URL ||
    (LOOPBACK_HOSTS.has(frontend.hostname) ? "/api" : HOSTED_API_URL);
  const url = new URL(configured, frontend);
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid API configuration");
  }
  return url.href.replace(/\/$/, "");
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<Result<T>> {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      ...init,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = ErrorSchema.safeParse(body);
      return parsed.success
        ? { ok: false, error: parsed.data.error }
        : {
            ok: false,
            error: {
              code: "UNAVAILABLE",
              message: "The note service returned an unexpected response. Try again later.",
            },
          };
    }
    const parsed = schema.safeParse(body);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : {
          ok: false,
          error: { code: "UNAVAILABLE", message: "The note service returned an invalid response." },
        };
  } catch {
    return {
      ok: false,
      error: {
        code: "NETWORK",
        message:
          "Could not reach the note service. Check your connection." +
          (path.endsWith("/read") ? " This read may already have consumed a one-time note." : ""),
      },
    };
  }
}

export function uploadNote(envelope: CreateNoteRequest) {
  return request("/notes", CreatedNoteSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
  });
}

export function getNoteMetadata(id: string, signal?: AbortSignal) {
  return request(`/notes/${encodeURIComponent(id)}`, NoteMetadataSchema, {
    ...(signal && { signal }),
  });
}

export function consumeNote(id: string, proof: ReadNoteRequest) {
  return request(`/notes/${encodeURIComponent(id)}/read`, NoteContentSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proof),
  });
}

export function getNoteCount(signal?: AbortSignal) {
  return request("/stats", NoteCountSchema, { ...(signal && { signal }) });
}
