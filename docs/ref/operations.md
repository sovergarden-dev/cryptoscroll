# Deployment and service checks

The application and API are deployed separately. A successful GitHub check does not publish Lovable. Use the verified source commit and Worker version in the deployment record; publish the frontend snapshot after the API is ready, then check both on their actual hosts.

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

This is an explicitly opted-in live operation, outside the default tests and routine monitor. It creates three synthetic notes, checks incorrect proof preservation, successful decryption, one success across twelve simultaneous reads, timed rereading and authenticated revocation. Cleanup consumes or revokes its own notes. Fixtures expire within five minutes if a response is lost before the script learns their ID; no unknown note is deleted. Aggregate creation counts and normal terminal markers remain.

Follow the [physical-device checklist](device-acceptance.md) after a frontend release. Use synthetic data, and record actual Android and iPhone/iPad outcomes separately from browser-engine automation.

## Recovery

If new-note creation fails while existing reads work, inspect admission configuration first. Restore a known-good Worker version if necessary; do not delete KV, remove Durable Object migrations or reset consumed state. If a new frontend fails CSP/hydration, republish the previous working Lovable snapshot and retain the stricter policy only after its compatibility is verified. Source rollback uses a new revert commit, never rewritten published history.
