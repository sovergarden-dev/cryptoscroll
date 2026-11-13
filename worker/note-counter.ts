import type { Env } from "./env";
import { json } from "./http";

export class NoteCounter implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    return this.state.blockConcurrencyWhile(async () => {
      let count = (await this.state.storage.get<number>("count")) ?? 0;
      if (request.method === "POST") {
        count += 1;
        await this.state.storage.put("count", count);
        if ((await this.state.storage.getAlarm()) === null) {
          await this.state.storage.setAlarm(Date.now() + 1100);
        }
      }
      return json({ count });
    });
  }

  async alarm(): Promise<void> {
    await this.state.blockConcurrencyWhile(async () => {
      const count = (await this.state.storage.get<number>("count")) ?? 0;
      await this.env.NOTES_KV.put("stats:created", String(count));
    });
  }
}
