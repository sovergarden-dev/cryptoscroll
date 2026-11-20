import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { routeTree } from "./routeTree.gen";
import { preferredLanguage } from "./lib/language";

const documentLanguage = createIsomorphicFn()
  .server(() => preferredLanguage(getRequestHeader("accept-language") ?? ""))
  .client(() => (document.documentElement.lang === "vi" ? ("vi" as const) : ("en" as const)));

const documentNonce = createIsomorphicFn()
  .server(() => getRequestHeader("x-cryptoscroll-nonce"))
  .client(() => document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content);

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = new QueryClient();
  const nonce = documentNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient, initialLanguage: documentLanguage() },
    ssr: nonce ? { nonce } : {},
    scrollRestoration: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
