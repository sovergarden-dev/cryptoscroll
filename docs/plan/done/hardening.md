# Hardening and acceptance

Started 2026-11-14 at `088d052`. Owner authorization: “đồng ý tất cả và tiếp tục” and “tôi không gấp muốn hoàn hảo nhất có thể”. Website hardening was implemented in `7ba3661`, merged as `aaecd33`, deployed and republished. [Verification](../../ref/hardening-verification.md) records the actual results. Kiro/hackathon work was subsequently deferred by the owner.

## Accepted work

- [x] Add anonymous creation throttling at the Worker boundary, typed 429 responses and isolated tests, preserving read authorization and one-time serialization.
- [x] Enforce production CSP nonces and content-free application diagnostics; verify the published API allowance.
- [x] Add authenticated revocation with explicit confirmation, passphrase re-entry and truthful handling of terminal/network states.
- [x] Exercise compiled frontend/API assets on Chromium, Firefox and WebKit, including keyboard and failure paths.
- [x] Add separate read-only and opted-in synthetic live checks; activate hourly change-only health reporting in Codex.
- [x] Guide Android and iPhone/iPad checks and record the owner's confirmation, with evidence limits stated.

## Additional improvements within this pass

- [x] Bound pending API requests without automatic destructive retries or a false recovery promise.
- [x] Inspect decrypted-content lifecycle: existing pagehide/persisted-pageshow clearing was retained, and the owner confirmed the requested back-navigation behavior.
- [x] Check new-control focus and confirmation behavior; capture browser screenshots after hydration.

## Delivery gates

Local tests use disposable isolated runtimes. Production smoke requires an explicit target and uses synthetic notes with cleanup. Each consequential change must be exercised through its public entry, including failure cases. Commit clean groups, inspect CI, deploy the Worker, publish the frontend and then verify the live flow before updating the deployment record. Preserve published Git history.

The owner subsequently chose “Tạm bỏ Kiro, tiếp tục hoàn thiện website”. Kiro and hackathon submission work are deferred; implement and verify website hardening with the existing tools. No Kiro contribution is claimed. Kiro Web sign-in was observed, but the account required a paid plan for Web. The official CLI was installed in the existing Ubuntu WSL environment; no Kiro coding session occurred.

## Completion evidence

All 40 unit/integration tests and 12 cross-browser scenarios passed in CI. Live health/CSP/CORS and synthetic read/revoke checks passed, and their fixtures were cleaned up. The published revocation UI and owner-reported device checks passed. The Windows WebKit transport failure and unchanged successful rerun remain documented. Provider spending caps, exact physical browser versions, private-mode testing and independent security certification are not claimed.

## Follow-up candidates

The next candidates and their acceptance criteria are recorded in [product follow-ups](../product-followups.md). They are proposals, separate from this completed hardening pass.
