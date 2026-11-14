# 🔥 CryptoScroll

> **Write once. Read once. Vanish.**

CryptoScroll is a browser-encrypted dead drop for sensitive Markdown notes. Write a note, optionally add a passphrase, then share a private link or QR code. The default one-time mode stops serving the encrypted server copy after one authorized opening. No account or saved plaintext drafts.

**Category:** Frankenstein, Kiroween 2026. **Project URL:** [cryptoscroll.syrin.online](https://cryptoscroll.syrin.online). The production API has passed live synthetic-note checks; frontend publication and submission evidence are tracked separately in the [deployment record](docs/ref/deployment.md) and [submission status](docs/ref/submission.md).

## Use it

1. Write up to 32 KiB of UTF-8 text. Markdown headings, lists, links, blockquotes and code blocks work.
2. Choose **After first read**, **1h**, **24h**, **72h**, **7d** or **30d**. Unopened one-time notes also expire after 30 days.
3. Optionally add a long passphrase and share that passphrase through another channel.
4. Select **Create Note**. Copy the complete URL or scan its locally generated QR code on another device.
5. The recipient sees a warning and, when needed, a passphrase field. Visiting a link does not open or destroy the note. **Read and Destroy** performs the one-time read.

After opening, the recipient can read the in-memory copy until leaving or clearing the screen. The service cannot retrieve a one-time note again, even if the response was lost in transit. Timed notes permit rereading before their deadline. A recipient can still copy or photograph anything they see.

## Run locally

Use Node.js 22.12 or newer. The canonical lockfiles are generated with npm 11.18.0. If a connected builder uses Bun, use Bun 1.4.4 or newer (`.bun-version`): older Bun releases cannot read the scoped security override in lockfile v3. The frontend is **TanStack Start + React + TypeScript**, built with Vite and Tailwind v4; its routes live in `src/routes/`.

```sh
git clone https://github.com/sovergarden-dev/cryptoscroll.git
cd cryptoscroll
npm ci
npm ci --prefix worker
```

In one terminal:

```sh
npm run dev:worker
```

In another:

```sh
npm run dev
```

Open [localhost:5173](http://localhost:5173). Vite proxies `/api` to the real local Worker runtime at port 8787. Wrangler supplies local KV and SQLite-backed Durable Objects; no Cloudflare login is needed for this mode. Local development data lives under the ignored `worker/.wrangler/` directory. Tests use isolated temporary runtimes instead.

On loopback hosts, the browser defaults to same-origin `/api`. Hosted production and Lovable previews default to `https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api`. `VITE_API_URL` overrides either default. Do not copy `.env.example` for ordinary local development, or your browser will contact production instead of the local proxy. An alternate API must use HTTPS, except for loopback development, and must allow the frontend origin in its CORS configuration.

Install the local commit checks once:

```sh
git config core.hooksPath .githooks
```

Git Bash runs the shell hooks on Windows. The equivalent portable commands are `npm run check:security` and `npm run check:compliance`.

## How encryption works

```text
Sender's browser                         Cloudflare Worker
Generate random AES-GCM 256-bit key
Encrypt UTF-8 note with random 12-byte IV
Optionally encrypt that payload again
using a PBKDF2-derived passphrase key
                    ciphertext + metadata ───> KV + per-note Durable Object
Build /note/{id}#{base64url-key}
                    fragment stays in browser

Recipient's browser
GET metadata only <────────────────────────── expiry / flags / public salt
Show warning and passphrase input
POST derived read capability + optional proof ─> verify before consumption
                                            ─> mark consumed durably
                    ciphertext <───────────── delete KV before response
Decrypt locally; display in memory
```

The optional passphrase uses **PBKDF2-SHA-256, 250,000 iterations and a random 16-byte salt**. The derived AES key is non-extractable. A SHA-256 verifier is computed from the derived bytes before import; it is not the encryption key. A separate HMAC-SHA-256 read capability proves possession of the link key without sending that key to the service. Its hash is stored by the backend.

Both proofs are checked before consuming a note. A wrong passphrase, absent passphrase, incorrect link key, page preview or metadata GET leaves the active note intact. Only the ciphertext response after an authorized read consumes a one-time note.

### Why KV needs a Durable Object

KV `get` followed by `delete` is **not atomic** and can return the same note to concurrent readers. [Cloudflare documents this limitation](https://developers.cloudflare.com/kv/concepts/how-kv-works/). Every note operation therefore goes through one Durable Object. It serializes the entire operation, including KV awaits, and persists a consumed marker before deleting the KV blob and returning it. No endpoint bypasses that state owner.

KV TTL and a Durable Object alarm clean up expired ciphertext. Every request also checks the deadline. Short-lived terminal markers distinguish expired and destroyed notes; those markers are removed after 24 hours. Physical storage deletion can propagate asynchronously, but stale KV data cannot be served through the API after consumption.

The aggregate creation counter is serialized in a separate Durable Object, with a coalesced KV snapshot. Its display can lag; if a background counter update fails, the service logs a generic operational error and does not turn a successfully created note into a failed creation.

## Security model

| Situation                       | Guarantee and limit                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passive access to API storage   | Ciphertext, salts, authorization hashes and metadata are visible. The independent link key is absent.                                                                          |
| Network observer                | HTTPS protects requests; fragments are not part of HTTP requests. Hostnames, timing and traffic sizes may still be observable.                                                 |
| Someone has only the note ID    | They can see minimal metadata but cannot retrieve or consume ciphertext without the read capability.                                                                           |
| Someone obtains the full link   | They can open an unprotected note. A protected note additionally requires its passphrase.                                                                                      |
| Wrong passphrase                | No ciphertext returned and no consumption. Weak passphrases still permit offline guessing if encrypted data/verifiers are stolen.                                              |
| Malicious server operator       | Can deny service, retain copies, alter metadata or replace frontend JavaScript. Client-side encryption does not protect secrets entered into maliciously modified client code. |
| Recipient or compromised device | Can copy content, inspect memory, read fragments, take screenshots or retain browser history/clipboard copies. Burn-after-read cannot undo those copies.                       |

“Zero-knowledge” here describes the server's lack of plaintext and decryption keys during the intended protocol; it is not a formal zero-knowledge proof, an anonymity service or a claim of external security certification. Cloudflare/network operators may retain request metadata and backups. No forensic-erasure guarantee is made.

The app does not persist notes, keys or passphrases in browser storage, send content to telemetry, or load third-party fonts. Markdown renders without raw HTML or automatic image requests. Explicit external links use safe HTTP(S) URLs, no opener and no referrer. API responses are uncached. An authentic, trusted frontend and HTTPS remain part of the security boundary.

Existing links from the old localStorage-only prototype are not automatically migrated. Its data is not uploaded or deleted by this version; recreate notes before replacing a deployment that still needs those links.

## The Frankenstein combination

| Old idea or separate medium   | What CryptoScroll combines it with                                      |
| ----------------------------- | ----------------------------------------------------------------------- |
| Spy dead drops                | Browser-generated AES-GCM keys and a fragment-only sharing channel      |
| Burn-after-reading letters    | Serialized edge access and deletion, with an explicit recipient warning |
| A separately exchanged secret | PBKDF2 and a second encryption layer                                    |
| Plain Markdown                | A safe browser reader for familiar text formatting                      |
| A physical handoff            | QR codes generated locally from the complete private link               |

AES-GCM is not a one-time pad. The novelty being demonstrated is the assembled workflow, not an invented cryptographic primitive. See the [product context](docs/biz/product.md) and [design decision](docs/research/atomic-read.md).

## Kiro workflow and provenance

The repository contains real, executable Kiro development artifacts:

| Artifact                                                         | Purpose                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [Product spec](.kiro/specs/cryptoscroll.md)                      | User stories, protocol, lifecycle, threat model and measurable acceptance criteria, prepared before this implementation. |
| [Security steering](.kiro/steering/zero-knowledge-principles.md) | Keep encryption client-side and prevent destructive or secret-leaking regressions.                                       |
| [Category steering](.kiro/steering/kiroween-category.md)         | Tie work to a concrete Frankenstein demo without unsupported claims.                                                     |
| [Security hook](.kiro/hooks/security.json)                       | Run the static security check after relevant saves.                                                                      |
| [Compliance hook](.kiro/hooks/compliance.json)                   | Check Git-commit tool calls; the installed Git hook also checks ordinary commits.                                        |

Hook definitions use the [current Kiro JSON schema](https://kiro.dev/docs/hooks/); shell files alone do not activate hooks. Static lint detects recurring risky patterns and is not a substitute for tests or a security review. The spec intentionally corrects the supplied KV atomicity and non-extractable-key examples.

**Provenance:** the initial application was built with Lovable; this implementation and the Kiro artifacts were prepared with Codex. No actual Kiro IDE/CLI/Web session has been verified for this update. Do not describe these files as evidence of Kiro-generated work. Before submission, use Kiro against the spec, retain the actual implementation/review/test evidence, and write the usage account from that evidence. See the [submission guide](docs/ref/submission.md).

## Architecture

```text
src/
  routes/                  TanStack sender and recipient pages
  components/              Shared frame, success/QR, status and Markdown reader
  lib/crypto.ts            WebCrypto primitives and proof derivation
  lib/notes.ts             Browser create/read orchestration
  lib/note-api.ts          Encrypted-envelope transport
shared/                    Versioned schemas, limits and binary encoding
worker/
  index.ts                 HTTP validation, CORS, health and routing
  note-vault.ts            Per-note lifecycle, authorization and KV cleanup
  note-counter.ts          Aggregate counter and KV snapshot
  wrangler.toml            KV, Durable Object bindings, migrations and route
  test/                    Isolated workerd harness; never bundled for deployment
e2e/                       Real browser flows with isolated contexts
.kiro/                     Specs, hooks and steering
```

## Deploy your own instance

The frontend and API are separate deployments. Pushing this repository does not provision KV, deploy the standalone Worker, complete a hackathon entry or prove a live backend is working.

### API

Authenticate Wrangler with an account that can deploy Workers, manage KV, bind Durable Objects and update the target zone's routes. A Pages-only token is insufficient.

```sh
cd worker
npx wrangler login
npx wrangler kv namespace create NOTES_KV --config wrangler.toml
```

The checked-in `worker/wrangler.toml` identifies this project's deployed account and namespace. For your own instance, replace `account_id` and the KV namespace ID with your account and the returned ID. Set `ALLOWED_ORIGINS` to your frontend's exact HTTPS origin. Change the route and zone for your domain, or remove `[[routes]]` when using only the `workers.dev` endpoint. A Cloudflare route requires a [proxied DNS record](https://developers.cloudflare.com/workers/configuration/routing/routes/). The `v1` Durable Object migration creates `NoteVault` and `NoteCounter`; retain it in deployment history. Do not remove the gate or switch the read path to direct KV access.

```sh
npm run build
npm run deploy
```

The first command is a **dry run**; only `deploy` changes Cloudflare. Worker scripts explicitly select `worker/wrangler.toml` so the frontend's generated deployment configuration cannot redirect the API commands. Verify `/api/health`, then create and open a disposable note in a second browser. Health alone is not functional proof. Wrong-passphrase and second-read checks must also pass on the target environment.

### Frontend

```sh
npm run build
```

The existing Lovable/TanStack integration emits `.output/public/` assets and a `.output/server/` SSR Worker. This is not a plain `dist/` SPA: deploy its generated Cloudflare Worker configuration or use the connected Lovable project. For another host, choose a compatible TanStack/Nitro target.

For your own instance, set `VITE_API_URL` **at build time** to your deployed HTTPS API endpoint; otherwise hosted builds use this project's Worker. Use `/api` only when you have configured a working reverse proxy or proxied Cloudflare route. Never put private credentials in a `VITE_*` variable. Use disposable notes for previews; an editor or compromised host can inspect the browser.

Lovable publishes a snapshot: Git updates reach the editor, but require **Publish → Publish changes** to update the live frontend. See [Lovable's publishing guide](https://docs.lovable.dev/features/publish).

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run build:worker
npm run lint
bash .kiro/hooks/post-save-security-lint.sh
bash .kiro/hooks/pre-commit-compliance.sh
npx playwright install chromium
npm run test:e2e
```

- `fast-check` exercises Unicode roundtrips (including a leading BOM), key serialization, wrong keys and authentication tampering. A sample of 100 encryptions checks fresh 96-bit IVs; finite tests do not prove universal nonce uniqueness.
- Worker integration tests run the actual Cloudflare `workerd` runtime with local KV/Durable Objects, including twelve simultaneous reads, stale KV after object eviction, failed proofs, expiration, alarms and counter persistence. Test-only storage fixtures advance deadlines; the production bundle has no test controls.
- Browser tests start isolated local services, transfer a link between independent contexts, check the QR and warning screens, reject a wrong passphrase, decrypt the note, check storage/network boundaries, suppress tracking images, and verify mobile/reduced-motion/error states. Clipboard feedback uses a stub so tests do not overwrite the operating-system clipboard.
- Local checks do not establish production routing, physical-device compatibility, actual Kiro use or a public video. Those remain separately recorded acceptance evidence.

## License

[MIT](LICENSE). The original [Lovable project](https://lovable.dev/projects/0548ff0a-7c6c-49cf-8e02-f78abea146d9) remains connected to this GitHub repository; preserve published Git history.
