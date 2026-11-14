import "./lib/server-logging.server";
import { renderErrorPage } from "./lib/error-page";
import { createDocumentNonce, NONCE_HEADER, secureDocument } from "./lib/document-security.server";
import type { Register } from "@tanstack/react-router";
import type { RequestHandler } from "@tanstack/react-start/server";

type ServerEntry = {
  fetch: RequestHandler<Register>;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  nonce: string,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error();
  return new Response(renderErrorPage(nonce), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses at the edge; compressing here would encode responses twice.
export default {
  async fetch(request, options) {
    const nonce = createDocumentNonce();
    const headers = new Headers(request.headers);
    headers.set(NONCE_HEADER, nonce);
    const securedRequest = new Request(request, { headers });
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(securedRequest, options);
      return secureDocument(
        await normalizeCatastrophicSsrResponse(response, nonce),
        request,
        nonce,
      );
    } catch (error) {
      console.error(error);
      return secureDocument(
        new Response(renderErrorPage(nonce), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
        nonce,
      );
    }
  },
} satisfies ServerEntry;
