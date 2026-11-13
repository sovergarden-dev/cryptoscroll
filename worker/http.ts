import { MAX_REQUEST_BYTES, type ErrorCode } from "../shared/protocol";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function failure(code: ErrorCode, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

export async function readJson(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim() !== "application/json") {
    return {
      ok: false,
      response: failure("INVALID_REQUEST", "Send an application/json body.", 415),
    };
  }
  const reader = request.body?.getReader();
  if (!reader)
    return { ok: false, response: failure("INVALID_REQUEST", "A JSON body is required.", 400) };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return {
          ok: false,
          response: failure("TOO_LARGE", "The encrypted note is too large.", 413),
        };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      ok: true,
      data: JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)),
    };
  } catch {
    return {
      ok: false,
      response: failure("INVALID_REQUEST", "The request body is not valid JSON.", 400),
    };
  } finally {
    reader.releaseLock();
  }
}
