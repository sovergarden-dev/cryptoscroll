# Deployment and service checks

The application and API are deployed separately. A successful GitHub check does not publish Lovable. Use the verified source commit and Worker version in the deployment record; publish the frontend snapshot after the API is ready, then check both on their actual hosts.

The frontend uses the Cloudflare compatibility date in `nitro.config.ts`. When advancing it, check the generated `.output/server/wrangler.json` and run the compiled browser suite against the project's locked `workerd`. The API has its own compatibility date in `worker/wrangler.toml`.

## Creation admission secret

Production requires a `CREATION_LIMIT_SALT` secret containing 32 cryptographically random bytes encoded as standard base64. Provision it with Wrangler's secret input before deploying the creation limiter. Keep the value out of Git, shell history and command arguments. Each environment needs its own value. The development command's constant is a public fixture only; it is not a production secret.

The configured limit is an initial estimate of 30 creation attempts per minute per network bucket at each Cloudflare location. Shared networks can share that allowance, and distributed traffic can exceed it. See [the design and limitations](../research/creation-admission.md). Do not use this control as a billing guarantee. Check the account's Cloudflare usage/quota view after public traffic grows; this repository does not claim an account-wide spending cap or billing alert configuration.

## Read-only checks

```sh
npm run check:live -- --frontend https://cryptoscroll.syrin.online/ --api https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api
```

This checks HTTPS frontend availability, fresh CSP nonces, the expected API connection allowance, a no-referrer document policy, real backend health and CORS preflight. It does not create a note, retrieve note ciphertext or read user data. Output contains only timestamps, stages, status codes and booleans. It also rejects redirects; a login or hosting challenge is a failed availability check, not silently treated as application success.

A regular monitor should run only this command, stay quiet while healthy, and notify on a confirmed failure or recovery. When a failure is first observed, repeat the read-only check once before reporting it. Do not include response bodies or private URLs in alerts. Runtime/provider request metadata is outside these application checks; Worker observability is deliberately disabled, and frontend error messages are content-free.

## Deliberate functional smoke

```sh
npm run smoke:live -- --frontend https://cryptoscroll.syrin.online/ --api https://cryptoscroll-worker.thongdocnganhang1.workers.dev/api --allow-synthetic-writes
```

This opt-in check creates four disposable notes on the target API. It checks protected creation and recovery, a one-time read under concurrency, timed rereading and revocation, and a legacy envelope. The script requests a five-minute lifetime for each fixture and cleans up known notes. A lost creation acknowledgement can leave a fixture until expiry. Aggregate creation counts and normal terminal markers remain.

Follow the [physical-device checklist](device-acceptance.md) after a frontend release. Use synthetic data, and record actual Android and iPhone/iPad outcomes separately from browser-engine automation.

## Recovery

If new-note creation fails while existing reads work, inspect the admission configuration first. For a Worker rollback, choose a version that understands the deployed pending-creation format and preserves consumed markers. If the earlier version predates creation recovery, fix the current Worker forward. For a frontend CSP or hydration failure, republish a verified Lovable snapshot and recheck the live site. Use a new revert commit for source rollback. [Creation recovery and deployment order](../research/creation-recovery.md)
