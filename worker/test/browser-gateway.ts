interface BrowserGatewayEnv {
  FRONTEND: { fetch(request: Request): Promise<Response> };
  API: { fetch(request: Request): Promise<Response> };
}

export default {
  fetch(request: Request, env: BrowserGatewayEnv) {
    return new URL(request.url).pathname.startsWith("/api/")
      ? env.API.fetch(request)
      : env.FRONTEND.fetch(request);
  },
};
