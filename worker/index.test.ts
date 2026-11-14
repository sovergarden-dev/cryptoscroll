// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorkerRuntime } from "./test/runtime";
import {
  base64ToKey,
  decryptNote,
  deriveKeyFromPassphrase,
  deriveReadToken,
  encryptNote,
  generateKey,
  keyToBase64,
} from "../src/lib/crypto";
import { base64ToBytes, bytesToBase64, hashProof } from "../shared/encoding";
import {
  CreateNoteSchema,
  CreatedNoteSchema,
  NoteContentSchema,
  NoteCountSchema,
  NoteMetadataSchema,
  type CreateNoteRequest,
  type ReadNoteRequest,
} from "../shared/protocol";

let runtime: Awaited<ReturnType<typeof createWorkerRuntime>>;

async function envelope(burnAfterRead = true, passphrase?: string) {
  const key = await generateKey();
  const encoded = await keyToBase64(key);
  const readToken = await deriveReadToken(encoded);
  let payload = await encryptNote("Secret fixture: Tiếng Việt 🔐", key);
  let protection: { passphraseSalt: string; passphraseVerifier: string } | undefined;
  if (passphrase !== undefined) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derived = await deriveKeyFromPassphrase(passphrase, salt);
    payload = await encryptNote(JSON.stringify(payload), derived.key);
    protection = { passphraseSalt: bytesToBase64(salt), passphraseVerifier: derived.verifier };
  }
  const body: CreateNoteRequest = {
    version: 1,
    ...payload,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    burnAfterRead,
    hasPassphrase: !!protection,
    ...protection,
    readTokenHash: await hashProof(readToken),
  };
  return {
    body,
    encoded,
    proof: { readToken, ...(protection && { passphraseVerifier: protection.passphraseVerifier }) },
  };
}

async function create(burnAfterRead = true, passphrase?: string) {
  const fixture = await envelope(burnAfterRead, passphrase);
  const response = await runtime.dispatchFetch("https://cryptoscroll.test/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fixture.body),
  });
  expect(response.status).toBe(201);
  const { id } = CreatedNoteSchema.parse(await response.json());
  expect(id).toMatch(/^[a-f0-9]{32}$/);
  return { ...fixture, id };
}

function read(id: string, proof: ReadNoteRequest) {
  return runtime.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proof),
  });
}

async function control(id: string, action: "expire" | "forget" | "alarm") {
  const namespace = await runtime.getDurableObjectNamespace("NOTE_VAULT");
  const response = await namespace
    .get(namespace.idFromName(id))
    .fetch(`https://vault/fixture/${action}`);
  expect(response.status).toBe(204);
}

beforeAll(async () => {
  runtime = await createWorkerRuntime(true);
});
afterAll(async () => {
  await runtime?.dispose();
});

describe("Cloudflare Worker with real KV and Durable Objects", () => {
  it("denies excess creation before storage while existing reads remain authorized", async () => {
    const limited = await createWorkerRuntime(false, "http://localhost:5173", { creationLimit: 1 });
    try {
      const fixture = await envelope(true);
      const headers = { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" };
      const send = () =>
        limited.dispatchFetch("https://cryptoscroll.test/api/notes", {
          method: "POST",
          headers,
          body: JSON.stringify(fixture.body),
        });
      expect((await limited.dispatchFetch("https://cryptoscroll.test/api/health")).status).toBe(
        200,
      );
      expect((await limited.dispatchFetch("https://cryptoscroll.test/api/health")).status).toBe(
        200,
      );
      const first = await send();
      expect(first.status).toBe(201);
      const { id } = CreatedNoteSchema.parse(await first.json());
      const denied = await send();
      expect(denied.status).toBe(429);
      expect(denied.headers.get("Retry-After")).toBe("60");
      expect(await denied.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
      const kv = await limited.getKVNamespace("NOTES_KV");
      expect(
        (await kv.list()).keys.filter((entry) => /^[a-f0-9]{32}$/.test(entry.name)),
      ).toHaveLength(1);
      const read = await limited.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}/read`, {
        method: "POST",
        headers,
        body: JSON.stringify(fixture.proof),
      });
      expect(read.status).toBe(200);
      const otherNetwork = await limited.dispatchFetch("https://cryptoscroll.test/api/notes", {
        method: "POST",
        headers: { ...headers, "CF-Connecting-IP": "203.0.113.11" },
        body: JSON.stringify(fixture.body),
      });
      expect(otherNetwork.status).toBe(201);
    } finally {
      await limited.dispose();
    }
  });

  it("fails creation closed when admission is misconfigured without blocking stored notes", async () => {
    const missing = await createWorkerRuntime(false, "http://localhost:5173", { creationSalt: "" });
    try {
      const fixture = await envelope(true);
      const id = "d".repeat(32);
      const namespace = await missing.getDurableObjectNamespace("NOTE_VAULT");
      await namespace.get(namespace.idFromName(id)).fetch(`https://vault/${id}`, {
        method: "PUT",
        body: JSON.stringify(fixture.body),
      });
      const create = await missing.dispatchFetch("https://cryptoscroll.test/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fixture.body),
      });
      expect(create.status).toBe(503);
      expect((await missing.dispatchFetch("https://cryptoscroll.test/api/health")).status).toBe(
        503,
      );
      expect(
        (await missing.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}`)).status,
      ).toBe(200);
      const opened = await missing.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fixture.proof),
      });
      expect(opened.status).toBe(200);
    } finally {
      await missing.dispose();
    }
  });

  it("does not consume or expose ciphertext to metadata visits, HEAD requests or missing credentials", async () => {
    const { id, proof } = await create();
    for (let index = 0; index < 2; index++) {
      const response = await runtime.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      const body = await response.json();
      expect(NoteMetadataSchema.safeParse(body).success).toBe(true);
      expect(body).not.toHaveProperty("ciphertext");
      expect(body).not.toHaveProperty("readTokenHash");
      expect(body).not.toHaveProperty("passphraseVerifier");
    }
    expect(
      (await runtime.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}`, { method: "HEAD" }))
        .status,
    ).toBe(405);
    expect(
      (
        await runtime.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(403);
    expect((await read(id, proof)).status).toBe(200);
  });

  it("allows exactly one of twelve simultaneous reads and rejects stale KV data after eviction", async () => {
    const { id, proof } = await create();
    const kv = await runtime.getKVNamespace("NOTES_KV");
    const original = await kv.get(id);
    expect(original).not.toBeNull();
    const responses = await Promise.all(Array.from({ length: 12 }, () => read(id, proof)));
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 410)).toHaveLength(11);
    expect(await kv.get(id)).toBeNull();
    await kv.put(id, original!);
    await runtime.unsafeEvictDurableObject("cryptoscroll-test", "NoteVault", { name: id });
    const replay = await read(id, proof);
    expect(replay.status).toBe(410);
    expect(await replay.json()).toMatchObject({ error: { code: "DESTROYED" } });
    await kv.delete(id);
  });

  it("preserves a protected note through wrong key, absent passphrase and wrong passphrase attempts", async () => {
    const { id, body, encoded, proof } = await create(true, "  recipient secret phrase 🔐  ");
    expect(
      (
        await read(id, {
          ...proof,
          readToken: await deriveReadToken(await keyToBase64(await generateKey())),
        })
      ).status,
    ).toBe(403);
    const absent = await read(id, { readToken: proof.readToken });
    expect(await absent.json()).toMatchObject({ error: { code: "PASSPHRASE_REQUIRED" } });
    const wrong = await deriveKeyFromPassphrase(
      "wrong phrase",
      base64ToBytes(body.passphraseSalt!),
    );
    const rejected = await read(id, {
      readToken: proof.readToken,
      passphraseVerifier: wrong.verifier,
    });
    expect(rejected.status).toBe(403);
    expect(await rejected.json()).toMatchObject({ error: { code: "WRONG_PASSPHRASE" } });
    expect((await runtime.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}`)).status).toBe(
      200,
    );
    const accepted = await read(id, proof);
    const content = NoteContentSchema.parse(await accepted.json());
    const pass = await deriveKeyFromPassphrase(
      "  recipient secret phrase 🔐  ",
      base64ToBytes(content.passphraseSalt!),
    );
    const inner = JSON.parse(await decryptNote(content, pass.key));
    expect(await decryptNote(inner, await base64ToKey(encoded))).toBe(
      "Secret fixture: Tiếng Việt 🔐",
    );
    expect((await read(id, proof)).status).toBe(410);
  });

  it("keeps timed notes readable until expiry and removes ciphertext through the expiry alarm", async () => {
    const { id, proof } = await create(false);
    expect((await read(id, proof)).status).toBe(200);
    expect((await read(id, proof)).status).toBe(200);
    await control(id, "expire");
    await control(id, "alarm");
    expect(await (await read(id, proof)).json()).toMatchObject({ error: { code: "EXPIRED" } });
    expect(await (await runtime.getKVNamespace("NOTES_KV")).get(id)).toBeNull();
    await control(id, "forget");
    await control(id, "alarm");
    expect((await runtime.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}`)).status).toBe(
      404,
    );
  });

  it("enforces expiry on a request even before the alarm runs", async () => {
    const { id, proof } = await create();
    await control(id, "expire");
    const response = await read(id, proof);
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ error: { code: "EXPIRED" } });
    expect(await (await runtime.getKVNamespace("NOTES_KV")).get(id)).toBeNull();
  });

  it("does not consume an active note while KV is unavailable", async () => {
    const { id, proof } = await create();
    const kv = await runtime.getKVNamespace("NOTES_KV");
    const original = await kv.get(id);
    await kv.delete(id);
    expect((await read(id, proof)).status).toBe(503);
    expect((await runtime.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}`)).status).toBe(
      200,
    );
    await kv.put(id, original!);
    expect((await read(id, proof)).status).toBe(200);
  });

  it("requires authorization to revoke a note", async () => {
    const { id, proof } = await create(false, "revoke test passphrase");
    const response = await runtime.dispatchFetch(`https://cryptoscroll.test/api/notes/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${proof.readToken}`,
        "X-Passphrase-Proof": proof.passphraseVerifier!,
      },
    });
    expect(response.status).toBe(200);
    expect((await read(id, proof)).status).toBe(410);
  });

  it("rejects malformed, oversized, plaintext-bearing and expired envelopes", async () => {
    const { body } = await envelope();
    for (const invalid of [
      "{",
      JSON.stringify({ ...body, plaintext: "do not accept" }),
      JSON.stringify({ ...body, iv: "bad" }),
      JSON.stringify({ ...body, expiresAt: "invalid" }),
      JSON.stringify({ ...body, expiresAt: new Date(Date.now() - 1000).toISOString() }),
      JSON.stringify({ ...body, hasPassphrase: true }),
    ]) {
      const response = await runtime.dispatchFetch("https://cryptoscroll.test/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: invalid,
      });
      expect(response.status).toBe(400);
    }
    const large = await runtime.dispatchFetch("https://cryptoscroll.test/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext: "a".repeat(140_000) }),
    });
    expect(large.status).toBe(413);
    expect(CreateNoteSchema.safeParse({ ...body, hasPassphrase: "false" }).success).toBe(false);
  });

  it("accepts modest client clock skew but never stores a note past the server's 30-day limit", async () => {
    const { body } = await envelope();
    const before = Date.now();
    const lifetime = 30 * 24 * 3600_000;
    const response = await runtime.dispatchFetch("https://cryptoscroll.test/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        expiresAt: new Date(before + lifetime + 120_000).toISOString(),
      }),
    });
    expect(response.status).toBe(201);
    const accepted = CreatedNoteSchema.parse(await response.json());
    expect(Date.parse(accepted.expiresAt)).toBeGreaterThanOrEqual(before + lifetime);
    expect(Date.parse(accepted.expiresAt)).toBeLessThanOrEqual(Date.now() + lifetime);
    const invalid = await runtime.dispatchFetch("https://cryptoscroll.test/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        expiresAt: new Date(Date.now() + lifetime + 3600_000).toISOString(),
      }),
    });
    expect(invalid.status).toBe(400);
  });

  it("restricts CORS, checks live bindings and persists aggregate counts", async () => {
    const blocked = await runtime.dispatchFetch("https://cryptoscroll.test/api/notes", {
      method: "OPTIONS",
      headers: { Origin: "https://untrusted.test" },
    });
    expect(blocked.status).toBe(403);
    expect(blocked.headers.has("Access-Control-Allow-Origin")).toBe(false);
    const allowed = await runtime.dispatchFetch("https://cryptoscroll.test/api/notes", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    const health = await runtime.dispatchFetch("https://cryptoscroll.test/api/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok", protocol: 1 });
    const stats = NoteCountSchema.parse(
      await (await runtime.dispatchFetch("https://cryptoscroll.test/api/stats")).json(),
    );
    await Promise.all(Array.from({ length: 4 }, () => create(false)));
    await expect
      .poll(
        async () =>
          NoteCountSchema.parse(
            await (await runtime.dispatchFetch("https://cryptoscroll.test/api/stats")).json(),
          ).count,
      )
      .toBe(stats.count + 4);
    const kv = await runtime.getKVNamespace("NOTES_KV");
    await expect
      .poll(async () => Number(await kv.get("stats:created")), { timeout: 5000 })
      .toBe(stats.count + 4);
  });
});
