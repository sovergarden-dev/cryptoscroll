# Production deployment and acceptance

Updated November 20, 2026. Every check that exercised a note used a disposable test fixture.

## Hosting

- Frontend: [cryptoscroll.syrin.online](https://cryptoscroll.syrin.online), published through the connected [Lovable project](https://lovable.dev/projects/0548ff0a-7c6c-49cf-8e02-f78abea146d9).
- API: [cryptoscroll-worker.thongdocnganhang1.workers.dev/api](https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api/health).
- Cloudflare bindings: `NOTES_KV`, `NOTE_VAULT`, `NOTE_COUNTER` and `CREATION_LIMITER`. `CREATION_LIMIT_SALT` is provisioned as a Worker secret. Account/namespace IDs are in `worker/wrangler.toml`; credential and secret values are not in the repository.
- Initial API version: `4ff79d80-b6ce-475c-a902-bce122212174`.
- Previous API version after updating the frontend/preview origin allowlist: `141e42e1-a737-42eb-b0b5-2b2e76697c09`.
- Hardened API version: `c477817a-6ff5-4edd-a8de-e100c63db795`, deployed from the implementation merged through [PR #1](https://github.com/sovergarden-dev/cryptoscroll/pull/1).
- Previous follow-up API version: `3e3695d2-1b36-42df-b204-cc0e79668a4b`. [PR #2](https://github.com/sovergarden-dev/cryptoscroll/pull/2)
- Current Worker version: `42bb97ae-e851-40bc-a1ba-0a6a93ad3079`. The Worker and Lovable frontend were deployed from `84b5ff9`. [PR #4](https://github.com/sovergarden-dev/cryptoscroll/pull/4)

The main domain currently resolves directly to Lovable. A Cloudflare Worker route requires a [proxied DNS record](https://developers.cloudflare.com/workers/configuration/routing/routes/), so `/api` on that host is not the active backend. Hosted frontend builds use the dedicated Worker endpoint. Local loopback development retains the `/api` proxy; `VITE_API_URL` overrides either default. Shared note links retain the frontend origin and fragment-only key.

## Live API acceptance

- Health reached KV and both Durable Objects successfully.
- Metadata contained no ciphertext, read-capability hash or passphrase verifier.
- Incorrect key and passphrase proofs returned 403 and preserved the note.
- A correct protected read returned 200 and decrypted to the expected Unicode text; another read returned 410.
- Twelve concurrent one-time reads produced one success and eleven destroyed responses.
- A timed note supported repeated reads, then authenticated revocation returned 200 and metadata returned 410.
- An unapproved browser origin returned 403. Responses were uncached.
- CORS preflight returned 204 and health returned 200 for the primary domain, public Lovable alias and both project preview origins, each with its exact `Access-Control-Allow-Origin` value.

All created test notes were consumed or revoked. Normal terminal markers and aggregate creation counts remain under the service's retention policy.

## Frontend publication

The owner republished the API-origin correction through **Publish → Publish changes** on 2026-11-14. Runtime source commit `bbbf4ca` passed [GitHub CI](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43532237699). [Lovable publishes snapshots](https://docs.lovable.dev/features/publish); pushing source does not update the live snapshot automatically. Later documentation-only commits do not change the verified runtime.

The corrected source passed 35 unit/integration tests, both local browser scenarios, typechecks and both builds. After publication, the actual production website was verified in separate sender and recipient browser tabs:

- The aggregate note count loaded successfully.
- A protected one-time note produced a private sharing link and a local QR code.
- A wrong passphrase showed an error and preserved the note.
- The correct passphrase decrypted the expected Vietnamese/emoji content.
- Reloading the consumed link showed the permanently destroyed state.
- A one-hour note decrypted on its first opening and again after reloading and explicitly reopening it.

The initial production checks used separate tabs in one browser session; the local browser suite additionally covered independent storage contexts and mobile dimensions. At that stage, native clipboard permissions and physical-device behavior were not yet confirmed. Later hardening acceptance is recorded below. Captures contain synthetic text only and are retained with this task's local QA artifacts.

Actual Kiro usage, a public demo video and a Devpost entry are deferred by the owner in the [submission record](submission.md).

## Hardening publication

The owner published source `aaecd33` through Lovable on 2026-11-14. Its [main CI run](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43558188756) passed, following the successful [PR run](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43557342853).

The live read-only checker passed frontend status, fresh CSP nonces, API connection allowance, backend health and CORS preflight. The opted-in live smoke passed protected-note decryption, wrong-proof preservation, twelve concurrent reads with one success, timed rereading and revocation. Its synthetic notes were consumed or revoked.

The actual published revocation UI was also exercised: cancellation kept the note available, a wrong passphrase showed an error, the correct passphrase returned the revoked state with keyboard focus on its heading, and the recipient link then showed the destroyed state. This additional synthetic browser note was revoked.

The owner subsequently confirmed the requested QR, clipboard, protected-read, timed-read, revoke and navigation/layout checks on Android and iPhone/iPad. See [device acceptance](device-acceptance.md) for the evidence scope. An hourly read-only Codex heartbeat named `Theo dõi CryptoScroll` is active, reporting only confirmed meaningful state changes. It does not create, consume or delete notes. Checks and recovery are described in [operations](operations.md).

## Follow-up publication

Source `bbf4518` ([PR #2](https://github.com/sovergarden-dev/cryptoscroll/pull/2)) passed [PR CI](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43589377381) and [main CI](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43589898896) with 52 unit/integration tests and 24 browser scenarios across Chromium, Firefox and WebKit, including `accessibility-firefox`.

Worker `3e3695d2-1b36-42df-b204-cc0e79668a4b` was deployed first and passed the opted-in live API smoke: creation recovery (`200`), changed-envelope conflict (`409`), retired-note replay (`410`), wrong-proof preservation (`403`), one success across twelve concurrent reads, timed rereading/revocation, legacy envelopes without `creationToken`, and unapproved-origin rejection (`403`).

The owner then published `bbf4518` in Lovable. Chromium exercised the published sharing, reading, revocation and creation-recovery flows on November 18. On November 20 the read-only service check passed and the public homepage served the Vietnamese editor and all five unread deadlines. [Browser and privacy observations](product-followup-verification.md#publication-and-live-acceptance) · [Device coverage](device-acceptance.md)

## Language selector update

On November 20, 2026, Lovable synced the merge `06e0c0b` and published it to `cryptoscroll.syrin.online` after main CI passed. The release covered the frontend and its build configuration. The API continued serving Worker `3e3695d2-1b36-42df-b204-cc0e79668a4b`. The public frontend and API returned HTTP 200, and the live checks passed the per-response nonce, no-referrer and CORS checks. Mobile-profile tests exercised the new startup behavior and transferred a downloaded QR in both directions on the public site. [Main CI](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/44711406531) · [Live results and timeout](product-followup-verification.md#language-selection-at-startup)
