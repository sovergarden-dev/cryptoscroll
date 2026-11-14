import { getApiBase } from "./api-config";

export const NONCE_HEADER = "x-cryptoscroll-nonce";

export function createDocumentNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes));
}

export function secureDocument(response: Response, request: Request, nonce: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  if (headers.get("Content-Type")?.includes("text/html")) {
    headers.set("Cache-Control", "no-store");
    if (import.meta.env.PROD) {
      const frontend = new URL(request.url);
      const apiOrigin = new URL(getApiBase(frontend.origin, import.meta.env.VITE_API_URL)).origin;
      const preview =
        frontend.hostname === "preview--cryptoscroll.lovable.app" ||
        frontend.hostname === "id-preview--0548ff0a-7c6c-49cf-8e02-f78abea146d9.lovable.app";
      headers.set(
        "Content-Security-Policy",
        [
          "default-src 'none'",
          `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
          "script-src-attr 'none'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          `connect-src 'self' ${apiOrigin}`,
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
          `frame-ancestors ${preview ? "https://lovable.dev" : "'none'"}`,
        ].join("; "),
      );
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
