import { z } from "zod";
import { getApiBase } from "./api-config";
import {
  CreatedNoteSchema,
  NoteContentSchema,
  NoteCountSchema,
  NoteMetadataSchema,
  RevokedNoteSchema,
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
      "RATE_LIMITED",
      "CREATION_CONFLICT",
      "CREATION_EXPIRED",
      "UNAVAILABLE",
    ]),
    message: z.string().max(300),
  }),
});

function creationRetryAt(header: string | null): number {
  const now = Date.now();
  const value = header?.trim() ?? "";
  const deadline = /^\d+$/.test(value)
    ? now + Number(value) * 1000
    : /^[a-z]{3,9}[, ]/i.test(value)
      ? Date.parse(value)
      : NaN;
  return Number.isFinite(new Date(deadline).getTime()) ? Math.max(now, deadline) : now + 60_000;
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  oneTimeRead = false,
): Promise<Result<T>> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 30_000);
  try {
    const response = await fetch(
      `${getApiBase(window.location.origin, import.meta.env.VITE_API_URL)}${path}`,
      {
        ...init,
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        redirect: "error",
      },
    );
    if (response.status === 429 && path === "/notes" && init.method === "POST") {
      await response.body?.cancel();
      return {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many creation attempts.",
          retryAt: creationRetryAt(response.headers.get("Retry-After")),
        },
      };
    }
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
          (timedOut
            ? "The note service took too long to respond. Check your connection."
            : "Could not reach the note service. Check your connection.") +
          (oneTimeRead ? " This read may already have consumed a one-time note." : "") +
          (init.method === "DELETE"
            ? " Revocation may already have succeeded; its result could not be confirmed."
            : ""),
      },
    };
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
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

export function consumeNote(id: string, proof: ReadNoteRequest, oneTimeRead = true) {
  return request(
    `/notes/${encodeURIComponent(id)}/read`,
    NoteContentSchema,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proof),
    },
    oneTimeRead,
  );
}

export function getNoteCount(signal?: AbortSignal) {
  return request("/stats", NoteCountSchema, { ...(signal && { signal }) });
}

export function revokeEncryptedNote(id: string, proof: ReadNoteRequest) {
  return request(`/notes/${encodeURIComponent(id)}`, RevokedNoteSchema, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${proof.readToken}`,
      ...(proof.passphraseVerifier && { "X-Passphrase-Proof": proof.passphraseVerifier }),
    },
  });
}
