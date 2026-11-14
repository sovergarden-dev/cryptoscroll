# Hardening verification

Verified 2026-11-14. Implementation `7ba3661`, merged to `main` as `aaecd33`; deployed Worker version `c477817a-6ff5-4edd-a8de-e100c63db795`.

## Local and CI

- 40 Vitest tests across six files passed, including workerd/KV/Durable Object/rate-limit integration. No tests were skipped in the full run.
- Frontend and Worker typechecks, both builds, security/compliance hooks and release checks passed.
- ESLint reported zero errors and six existing Fast Refresh warnings in UI primitives.
- All 12 compiled-application browser scenarios passed in [GitHub CI](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43557342853), covering Chromium, Firefox and WebKit. [Merge CI](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43558188756) passed too.
- An earlier Windows matrix passed all 12 scenarios. The later Windows run with admission enabled passed 11 and encountered a WebKit POST transport failure (`Send failed since rewinding of the data stream failed`). That scenario passed on an unchanged rerun; the failed trace is retained locally. This is separate from successful CI, not hidden by automatic retries.
- The read-only checker passed against the local harness and rejected a deliberately mismatched API target. The explicit synthetic smoke command passed locally and cleaned up its fixtures.

## Regression evidence

- CSP acceptance failed before the policy existed, then passed with fresh framework nonces and a parser-inserted unsigned script blocked. A privileged evaluation-based injection was discarded as an invalid CSP probe.
- A stalled-read test failed before a deadline existed, then passed with a 30-second abort, no retry and an explicit possible-consumption warning.
- A synthetic exception/cause leaked into the old SSR logger in the negative test. The updated logger passed without recording fixture secrets or exception text; the fallback page retained its matching CSP nonce.
- Creation-admission tests first returned 201 where 429/503 were required. The implementation then passed denial before KV growth, independent network buckets, continued authorized reads and fail-closed missing configuration.
- Revocation acceptance covers cancellation, keyboard focus, wrong passphrase preservation, network uncertainty without false success, successful revocation and recipient rejection.

## Production and devices

The owner republished the new frontend. Live HTTP checks and synthetic API/browser flows passed; see [deployment acceptance](deployment.md). The owner reported the requested checks passing on Android and iPhone/iPad. Hardware/browser versions and private browsing were not separately recorded; see [device acceptance](device-acceptance.md).

The live host preserved CSP, `Cache-Control: no-store` and Permissions-Policy. It returned `Referrer-Policy: strict-origin-when-cross-origin` at the HTTP layer; the page's no-referrer meta policy and explicit no-referrer API/link settings remain in effect. The live checker accepts the no-referrer document policy from the header or meta element instead of claiming the host preserved every header unchanged.

Kiro and hackathon work are deferred by the owner. No independent security certification or real Kiro coding contribution is claimed.
