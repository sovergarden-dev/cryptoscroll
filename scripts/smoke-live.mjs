import { build } from "esbuild";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { checkLive, liveTargets } from "./check-live.mjs";

process.on("uncaughtException", () => {
  console.error(
    "Live smoke failed; inspect the reported stage. No note content or capabilities are logged.",
  );
  process.exitCode = 1;
});
const { values } = parseArgs({
  options: {
    frontend: { type: "string" },
    api: { type: "string" },
    "allow-synthetic-writes": { type: "boolean" },
  },
});
const targets = liveTargets(values.frontend, values.api);
if (!values["allow-synthetic-writes"])
  throw new Error("Explicit synthetic-write consent is required");
const status = await checkLive(targets);
if (!status.ok) {
  console.error(JSON.stringify(status));
  throw new Error("Health checks failed before writing synthetic notes");
}
const base = targets.api.href.replace(/\/$/, "");
const bundle = await build({
  entryPoints: ["src/lib/crypto.ts"],
  bundle: true,
  format: "esm",
  write: false,
  target: "es2022",
});
const cryptoClient = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const created = [];
const results = {};
const origin = targets.frontend.origin;
const asBase64 = (bytes) => Buffer.from(bytes).toString("base64");

async function request(path, method = "GET", body, headers = {}) {
  return fetch(base + path, {
    method,
    headers: { Origin: origin, ...(body && { "Content-Type": "application/json" }), ...headers },
    ...(body && { body: JSON.stringify(body) }),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
}
async function create(burnAfterRead, passphrase) {
  const key = await cryptoClient.generateKey();
  const encoded = await cryptoClient.keyToBase64(key);
  const readToken = await cryptoClient.deriveReadToken(encoded);
  const readTokenHash = asBase64(
    await crypto.subtle.digest("SHA-256", Buffer.from(readToken, "base64")),
  );
  let payload = await cryptoClient.encryptNote("Synthetic live check: Tiếng Việt 🔐", key);
  let protection;
  if (passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derived = await cryptoClient.deriveKeyFromPassphrase(passphrase, salt);
    payload = await cryptoClient.encryptNote(JSON.stringify(payload), derived.key);
    protection = {
      passphraseSalt: asBase64(salt),
      passphraseVerifier: derived.verifier,
      key: derived.key,
    };
  }
  const response = await request("/notes", "POST", {
    version: 1,
    ...payload,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    burnAfterRead,
    hasPassphrase: !!protection,
    readTokenHash,
    ...(protection && {
      passphraseSalt: protection.passphraseSalt,
      passphraseVerifier: protection.passphraseVerifier,
    }),
  });
  assert.equal(response.status, 201, "create status");
  const { id } = await response.json();
  assert.match(id, /^[a-f0-9]{32}$/);
  const note = {
    id,
    key,
    protection,
    proof: { readToken, ...(protection && { passphraseVerifier: protection.passphraseVerifier }) },
  };
  created.push(note);
  return note;
}
const read = (note, proof = note.proof) => request("/notes/" + note.id + "/read", "POST", proof);
async function revoke(note) {
  return request("/notes/" + note.id, "DELETE", undefined, {
    Authorization: "Bearer " + note.proof.readToken,
    ...(note.proof.passphraseVerifier && { "X-Passphrase-Proof": note.proof.passphraseVerifier }),
  });
}

let stage = "health";
let passed = false;
try {
  const health = await request("/health");
  assert.equal(health.status, 200, "health status");
  assert.equal((await health.json()).status, "ok");
  stage = "protected-note";
  const protectedNote = await create(true, "Synthetic passphrase for live checks");
  const metadata = await request("/notes/" + protectedNote.id);
  assert.equal(metadata.status, 200);
  const meta = await metadata.json();
  assert.equal(meta.hasPassphrase, true);
  for (const property of ["ciphertext", "readTokenHash", "passphraseVerifier"])
    assert.equal(property in meta, false);
  const wrongKey = await read(protectedNote, {
    ...protectedNote.proof,
    readToken: asBase64(crypto.getRandomValues(new Uint8Array(32))),
  });
  assert.equal(wrongKey.status, 403);
  const wrongPassphrase = await read(protectedNote, {
    ...protectedNote.proof,
    passphraseVerifier: asBase64(crypto.getRandomValues(new Uint8Array(32))),
  });
  assert.equal(wrongPassphrase.status, 403);
  assert.equal((await request("/notes/" + protectedNote.id)).status, 200);
  const first = await read(protectedNote);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");
  const outer = await first.json();
  const inner = JSON.parse(await cryptoClient.decryptNote(outer, protectedNote.protection.key));
  assert.equal(
    await cryptoClient.decryptNote(inner, protectedNote.key),
    "Synthetic live check: Tiếng Việt 🔐",
  );
  assert.equal((await read(protectedNote)).status, 410);
  results.protected = "wrong key/passphrase preserve note; correct read decrypts; replay 410";
  stage = "concurrent-read";
  const raceNote = await create(true);
  const race = await Promise.all(Array.from({ length: 12 }, () => read(raceNote)));
  assert.equal(race.filter((response) => response.status === 200).length, 1);
  assert.equal(race.filter((response) => response.status === 410).length, 11);
  results.concurrentReads = { successful: 1, rejected: 11 };
  stage = "timed-note";
  const timedNote = await create(false);
  assert.equal((await read(timedNote)).status, 200);
  assert.equal((await read(timedNote)).status, 200);
  assert.equal((await revoke(timedNote)).status, 200);
  assert.equal((await request("/notes/" + timedNote.id)).status, 410);
  results.timed = "repeat reads work; authenticated revoke returns 200";
  stage = "cors";
  const forbidden = await fetch(base + "/stats", {
    headers: { Origin: "https://untrusted.invalid" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(forbidden.status, 403);
  results.cors = "unapproved origin rejected";
  passed = true;
} catch {
  console.error(JSON.stringify({ result: "FAIL", stage }));
  process.exitCode = 1;
} finally {
  const cleanup = await Promise.allSettled(created.map(revoke));
  const failed = cleanup.filter(
    (result) => result.status === "rejected" || ![200, 404, 410].includes(result.value.status),
  );
  if (failed.length) {
    console.error(
      JSON.stringify({
        result: "FAIL",
        stage: "cleanup",
        failed: failed.length,
        maximumFixtureLifetimeSeconds: 300,
      }),
    );
    process.exitCode = 1;
  } else if (passed)
    console.log(JSON.stringify({ result: "PASS", ...results, cleanup: "consumed or revoked" }));
}
