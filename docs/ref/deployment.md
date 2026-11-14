# Production deployment and acceptance

Updated 2026-11-14. All live checks below used disposable synthetic notes; no existing user note was opened or removed.

## Hosting

- Frontend: [cryptoscroll.syrin.online](https://cryptoscroll.syrin.online), published through the connected [Lovable project](https://lovable.dev/projects/0548ff0a-7c6c-49cf-8e02-f78abea146d9).
- API: [cryptoscroll-worker.thongdocnganhang1.workers.dev/api](https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api/health).
- Cloudflare bindings: `NOTES_KV`, `NOTE_VAULT` and `NOTE_COUNTER`. The real account and namespace IDs are in `worker/wrangler.toml`; OAuth credentials are not in the repository.
- Initial API version: `4ff79d80-b6ce-475c-a902-bce122212174`.
- Current API version after updating the frontend/preview origin allowlist: `141e42e1-a737-42eb-b0b5-2b2e76697c09`.

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

The owner supplied Lovable's live-publication confirmation on 2026-11-14. The API-origin correction was made afterward and requires a subsequent **Publish → Publish changes** once its Git update reaches the editor. [Lovable publishes snapshots](https://docs.lovable.dev/features/publish); pushing source does not update the live snapshot automatically.

The corrected source passed 35 unit/integration tests, both local browser scenarios, typechecks and both builds. Direct live API acceptance does not establish the published frontend's complete browser flow. After republishing, verify a protected note across independent browser contexts, wrong-passphrase preservation, one successful opening and replay rejection. Timed rereading should also pass. Native clipboard permissions and physical-device behavior remain separate manual checks.

Actual Kiro usage, a public demo video and a Devpost entry remain outstanding in the [submission record](submission.md).
