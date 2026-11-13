import { NoteVault as ProductionNoteVault } from "../note-vault";
import type { Env } from "../env";

export { default, NoteCounter } from "../index";

export class NoteVault extends ProductionNoteVault {
  constructor(
    private readonly fixtureState: DurableObjectState,
    env: Env,
  ) {
    super(fixtureState, env);
  }

  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
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
