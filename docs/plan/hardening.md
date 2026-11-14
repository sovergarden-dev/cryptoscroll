# Hardening and acceptance

Started 2026-11-14 at `088d052`. Owner authorization: “đồng ý tất cả và tiếp tục” and “tôi không gấp muốn hoàn hảo nhất có thể”. This accepts the six recommendations in the preceding review. The production baseline remains the verified runtime `bbbf4ca` until the next checked deployment.

## Accepted work

- [ ] Add anonymous creation throttling at the Worker boundary, a useful 429 response and isolated tests. Preserve read authorization and one-time serialization.
- [ ] Enforce a nonce-based CSP on production HTML, with the actual API origin permitted and no note content, fragment keys or passphrases in diagnostics.
- [ ] Add authenticated revocation to the sharing screen with explicit confirmation and correct handling of wrong passphrases, concurrent consumption and uncertain network outcomes.
- [ ] Exercise compiled production assets in browser acceptance; cover supported browser engines, keyboard use and request failures.
- [ ] Add a deliberate post-publication smoke command and privacy-preserving health monitoring. Keep synthetic writes separate from ordinary health checks and default tests.
- [ ] Guide and record Android and iPhone/iPad acceptance. The owner confirmed both are available; physical-device results must come from those devices.

## Additional improvements within this pass

- [ ] Bound pending API requests and preserve the ambiguity of a failed one-time read; never automatically retry a destructive read.
- [ ] Inspect the lifecycle of decrypted content and fix any demonstrated stale-content or navigation defect.
- [ ] Check focus, announcement and confirmation behavior for the new controls. Capture screenshots only after hydration is complete.

## Delivery gates

Local tests use disposable isolated runtimes. Production smoke requires an explicit target and uses synthetic notes with cleanup. Each consequential change must be exercised through its public entry, including failure cases. Commit clean groups, inspect CI, deploy the Worker, publish the frontend and then verify the live flow before updating the deployment record. Preserve published Git history.

The owner subsequently chose “Tạm bỏ Kiro, tiếp tục hoàn thiện website”. Kiro and hackathon submission work are deferred; implement and verify website hardening with the existing tools. No Kiro contribution is claimed. Kiro Web sign-in was observed, but the account required a paid plan for Web. The official CLI was installed in the existing Ubuntu WSL environment; no Kiro coding session occurred.

## Local checkpoint

The compiled frontend and API now run together in an isolated browser harness. All 12 browser scenarios across Chromium, Firefox and WebKit passed. The unit/integration suite passed 38 tests. CSP, revocation, the request deadline and content-free SSR logging are implemented locally; they have not yet been published. The read-only live checker was exercised against the real local runtimes and rejected an intentionally mismatched API target. Physical-device results and production acceptance remain open.

## Follow-up candidates

Evaluate further changes against demonstrated user benefit and the account-free dead-drop purpose. Separate protocol changes, attachments, identity features and monetization from this hardening pass; they require their own design and scope decision. Record discoveries and remaining uncertainty here instead of expanding the product silently.
