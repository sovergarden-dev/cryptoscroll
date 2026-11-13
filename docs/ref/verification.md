# Local verification

Verified during 2026-11-13–14 on Windows, using Node 22.22.0, npm 11.18.0, Wrangler 4.161.0 and Chromium 158. The source baseline was `c2c5690`; the accompanying Git commit identifies the resulting change set. This records local evidence, not a production deployment or a completed hackathon entry.

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

The service's persistent format is new; the baseline had no server database to migrate. The versioned Durable Object migration creates two new classes. Existing browser-only notes were neither uploaded nor deleted. Deployment requires a real KV namespace and an authorized account; the all-zero namespace is a local-development value.

Production routing/storage, physical-device behavior, native clipboard permissions, actual Kiro hook execution and a public video remain unverified. The available Cloudflare authorization lacked Workers/KV/Routes scopes. GitHub CI repeats local commands on Linux after source publication; its run is the source of truth for CI status. See [submission status](submission.md) for the outstanding external steps.

## Source-delivery review

- S0 PASS: initial checkout clean; requested code and checks/docs included, generated output excluded.
- S1 PASS: no prior release/tag scheme; changes recorded under `Unreleased`.
- S2 PASS for changed content: source diff, secret boundaries and formatting reviewed. Existing wrapped prose in Lovable-managed instructions is preserved; remaining library warnings are listed above.
- S3 N/A for remote release: no remote provisioning or deployment performed or claimed. New local bindings, migration and state transitions were exercised; production acceptance remains pending.
- S4 PASS: changelog separates prepared functionality from production provisioning and actual Kiro evidence.
- S5 PASS: spec, steering, README and setup commands match the protocol.
- S6 PASS: tests, types, both builds and executable hooks passed; local runtimes closed.
- S7 PASS: evidence distinguishes local execution, simulated mobile dimensions, a clipboard stub and unverified external conditions.
- S8 N/A: source delivery only; no release tag or production version was minted.

The easiest check to miss was the real browser flow; it exposed pre-hydration input handling and the fragment-changing skip control. A production-only failure could still originate in credentials, routing or provisioned bindings, so local success is not reported as live acceptance. No production data path was exercised. The pending target check is a disposable protected note created and read across two actual production clients, with wrong-passphrase preservation and second-read rejection.
