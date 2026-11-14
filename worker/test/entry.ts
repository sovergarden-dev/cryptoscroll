import { NoteVault as ProductionNoteVault } from "../note-vault";
import type { Env } from "../env";

export { default, NoteCounter } from "../index";

export class NoteVault extends ProductionNoteVault {
  constructor(
    private readonly fixtureState: DurableObjectState,
    env: Env,
  ) {
    super(fixtureState, {
      ...env,
      NOTES_KV: new Proxy(env.NOTES_KV, {
        get(target, property) {
          if (property === "put")
            return async (...args: Parameters<KVNamespace["put"]>) => {
              const fault = await fixtureState.storage.get<string>("fail-write");
              if (fault) {
                await fixtureState.storage.delete("fail-write");
                await fixtureState.storage.sync();
                if (fault === "after") await target.put(...args);
                throw new Error("Injected KV write failure");
              }
              return target.put(...args);
            };
          const value = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/fixture/fail-write" || path === "/fixture/fail-after-write") {
      await this.fixtureState.storage.put(
        "fail-write",
        path.endsWith("after-write") ? "after" : "before",
      );
      return new Response(null, { status: 204 });
    }
    if (path === "/fixture/expire" || path === "/fixture/forget") {
      const note = await this.fixtureState.storage.get<Record<string, unknown>>("note");
      if (!note) return new Response(null, { status: 404 });
      const field = path === "/fixture/expire" ? "expiresAt" : "forgetAt";
      await this.fixtureState.storage.put("note", {
        ...note,
        [field]: field === "expiresAt" ? new Date(Date.now() - 1).toISOString() : Date.now() - 1,
      });
      return new Response(null, { status: 204 });
    }
    if (path === "/fixture/alarm") {
      await this.alarm();
      return new Response(null, { status: 204 });
    }
    return super.fetch(request);
  }
}
