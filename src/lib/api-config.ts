const HOSTED_API_URL = "https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getApiBase(frontendOrigin: string, configured?: string): string {
  const frontend = new URL(frontendOrigin);
  const url = new URL(
    configured || (LOOPBACK_HOSTS.has(frontend.hostname) ? "/api" : HOSTED_API_URL),
    frontend,
  );
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
