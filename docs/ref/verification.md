# Local verification

Verified during 2026-11-13–14 on Windows, using Node 22.22.0, npm 11.18.0, Wrangler 4.161.0 and Chromium 158. The source baseline was `c2c5690`; implementation commit `3d528c1` passed [GitHub CI](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43474649977). The initial source-delivery evidence below predates provisioning. Later production checks are recorded separately in [deployment acceptance](deployment.md); neither record proves a completed hackathon entry.

| Check                                    | Result                                                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                               | 4 files, 27 tests passed, no skipped tests. Includes property tests and real workerd/KV/Durable Object integration.                                             |
| `npm run test:e2e`                       | 2 scenarios passed with independent browser contexts, mobile viewports and reduced motion.                                                                      |
| `npm run typecheck` / `npx tsc --noEmit` | Frontend, test harness and Worker typechecks passed.                                                                                                            |
| `npm run build`                          | Frontend client and SSR Worker built successfully.                                                                                                              |
| `npm run build:worker`                   | Dry run passed with the API's explicit Wrangler configuration, including after the frontend generated its own deployment configuration.                         |
| `npm run lint`                           | No errors. Six existing Fast Refresh export warnings remain in reusable UI primitives.                                                                          |
| Security and compliance shell hooks      | Passed through Git Bash. A separate synthetic localStorage-key leak was rejected, then its temporary fixture was removed.                                       |
| Dependency audits                        | npm root and Worker: zero vulnerabilities. Bun 1.4.4: zero vulnerabilities after migrating the canonical npm lockfile. Frozen Bun lockfile validation passed.   |
| Built frontend/configured API smoke      | Local Wrangler test harness: HTML 200, script asset 200, create 201, authorized read 200, repeat read 410; ciphertext decrypted to the expected synthetic text. |

## Behaviors exercised

- Arbitrary valid Unicode scalar text, a leading BOM, null bytes and a 10,000-character example survive AES-GCM encryption/decryption.
- Wrong keys and altered IV/tag bytes are rejected. Export/import restores decryption. Passphrase keys remain non-extractable and preserve spaces/case.
- Metadata visits, HEAD, missing capabilities, wrong link keys and incorrect or absent passphrases do not consume an active note.
- Twelve concurrent one-time reads yield one success and eleven destroyed responses. Restoring stale KV ciphertext and evicting the Durable Object does not reopen the note.
- Timed notes can be reread; request-time expiry and the alarm handler delete ciphertext. Test-only fixtures seed deadlines instead of waiting an hour. The counter's actual alarm persists its KV snapshot.
- Invalid dates, flags, encodings, plaintext-bearing envelopes and oversized bodies are rejected. Small client clock skew is clamped to the server's 30-day maximum.
- A sender and recipient with separate browser storage exchange and decrypt a protected note. Captured requests contain no plaintext, passphrase or link key. Browser storage remains empty.
- Markdown does not create script/image elements or fetch the synthetic tracking URL. Mobile layouts have no horizontal overflow. Network failure retains the sender's draft in memory and does not invent a success URL.
- Keyboard skip navigation preserves the private URL and focuses main content. This regression test first failed against the hash anchor (`#main-content` replaced the key), then passed with the focus button.
- Screenshot inspection covered desktop creation/sharing and mobile warning, reader, creation and 404 states. Clipboard feedback uses a stub; tests do not overwrite the OS clipboard.

## Packaging and remaining limits

The frontend's generated Wrangler redirect initially conflicted with commands in `worker/`; selecting `--config wrangler.toml` in every API script fixes the actual CLI path. Both builds were checked in sequence. The Lovable Vite wrapper still emits an advisory about its `vite-tsconfig-paths` plugin having a native Vite alternative; it does not prevent building or running the app.

The service's persistent format is new; the baseline had no server database to migrate. The versioned Durable Object migration creates two new classes. Existing browser-only notes were neither uploaded nor deleted. At this initial local-verification stage, deployment still required a real KV namespace and an authorized account; the placeholder has since been replaced during [production deployment](deployment.md).

At initial source delivery, production routing/storage were unverified and Cloudflare authorization lacked Workers/KV/Routes scopes. These API prerequisites were subsequently resolved. Physical-device behavior, native clipboard permissions, actual Kiro hook execution and a public video remain unverified. GitHub CI repeats local commands on Linux after source publication; its run is the source of truth for CI status. See [submission status](submission.md) for the current outstanding external steps.

## Initial source-delivery review

- S0 PASS: initial checkout clean; requested code and checks/docs included, generated output excluded.
- S1 PASS: no prior release/tag scheme; changes recorded under `Unreleased`.
- S2 PASS for changed content: source diff, secret boundaries and formatting reviewed. Existing wrapped prose in Lovable-managed instructions is preserved; remaining library warnings are listed above.
- S3 N/A for remote release: no remote provisioning or deployment performed or claimed. New local bindings, migration and state transitions were exercised; production acceptance remains pending.
- S4 PASS: changelog separates prepared functionality from production provisioning and actual Kiro evidence.
- S5 PASS: spec, steering, README and setup commands match the protocol.
- S6 PASS: tests, types, both builds and executable hooks passed; local runtimes closed.
- S7 PASS: evidence distinguishes local execution, simulated mobile dimensions, a clipboard stub and unverified external conditions.
- S8 N/A: source delivery only; no release tag or production version was minted.

The easiest check to miss was the real browser flow; it exposed pre-hydration input handling and the fragment-changing skip control. No production data path was exercised during this initial source-delivery review. Subsequent API and published-frontend acceptance are recorded in [deployment acceptance](deployment.md).

## Hosted API-origin regression

The first regression run failed because the hosted frontend selected its own `/api`, which Lovable did not route to the standalone Worker. The correction selects the deployed Worker on hosted origins, retains the local proxy on loopback hosts, and preserves the explicit `VITE_API_URL` override. All 35 tests across five files then passed, including HTTPS/configuration validation. Frontend and Worker typechecks also passed. Live API results are separate from these local checks.

The frontend build and API dry run passed again, and the compiled browser asset contains the deployed API endpoint. ESLint reported zero errors and the same six existing UI-library warnings; security and compliance checks passed. Repeating browser acceptance exposed a 90-second fixture setup timeout during cold TanStack dependency optimization on Windows. With a 180-second fixture startup budget, both browser scenarios passed in 4.6 minutes. That development run logged a hydration warning involving temporary `caret-color: transparent` styles during the mobile screenshot; all functional assertions passed.

Runtime commit `bbbf4ca` also passed [GitHub CI](https://github.com/sovergarden-dev/cryptoscroll/actions/runs/43532237699). The owner then republished in Lovable, and the real hosted UI passed creation, wrong-passphrase preservation, decryption, rejection after the one-time read and timed rereading. See [production acceptance](deployment.md) for the distinction between live browser tabs, local independent contexts and physical-device checks.
