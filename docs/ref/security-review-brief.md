# External security review brief

Status: prepared for review; no external reviewer has been engaged and no independent audit is claimed. This brief covers the changes after published baseline `335ec0a` on `codex/reliability-mobile-i18n`. Freeze the exact commit and dependency locks before commissioning a review. Kiro/hackathon work is outside scope. Cost alerts were withdrawn by the owner on 2026-11-14.

## Scope and invariants

| Boundary                      | Files                                                                               | Required outcome                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Encryption and capabilities   | `src/lib/crypto.ts`, `shared/encoding.ts`, `src/lib/notes.ts`                       | Random AES-GCM key/IVs, fixed version-1 KDF, distinct read capability; no plaintext, link key or passphrase sent to API/logs/storage.                                          |
| Creation recovery             | `shared/protocol.ts`, `worker/creation-recovery.ts`, `worker/note-vault.ts`         | Same token/envelope recovers the same ID within ten minutes; changed envelope conflicts; timestamp changes cannot reopen a prior ID; expiry checks precede storage allocation. |
| Partial writes                | `worker/note-vault.ts`                                                              | Persist pending fingerprint before KV write, do not serve pending state, resume only the matching envelope, clean orphaned ciphertext at expiry.                               |
| One-time lifecycle            | `worker/index.ts`, `worker/note-vault.ts`                                           | GET is metadata only; bad proofs preserve; concurrent reads yield exactly one success; stale KV, eviction, retries, expiry and tombstone cleanup never reopen consumed notes.  |
| Browser state and delivery    | `src/routes/`, `src/components/`                                                    | No saved drafts or link keys; explicit destructive read, uncertain-delivery warnings, focus transitions, navigation cleanup; locale changes preserve capabilities.             |
| Markdown, sharing and exports | `NoteReader.tsx`, `NoteSuccess.tsx`                                                 | No raw HTML or automatic external images; share only on a user action; PNG decodes to the exact fragment-bearing link; no external QR service.                                 |
| Deployment and abuse          | `src/lib/document-security.server.ts`, `worker/creation-limit.ts`, `worker/http.ts` | CSP nonces/no-referrer/no-store; strict bounded JSON/CORS; admission stays ahead of storage and never blocks existing authorized reads.                                        |

## Reproduce locally

Use only synthetic notes and an isolated local workerd runtime. `npm ci`, `npm ci --prefix worker`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:security`, `npm run check:compliance`, and `npm run test:e2e` are the starting checks. Browser installation is `npx playwright install chromium firefox webkit`. Production test controls must remain excluded from the bundle. Review failing traces and assertions rather than treating a green total as proof.

The new automated cases cover concurrent creation retries, conflicting envelopes, an injected KV write failure plus eviction, retired-note replays, stale tokens after cleanup, identical client retry bodies, actual downloaded PNG decoding, locale/focus transitions and an axe accessibility scan. Web Share and clipboard are stubbed in automation; they require separate real-device acceptance. See [verification](product-followup-verification.md) for observed outcomes and limits.

## Threat assumptions and known limits

- A trusted delivered frontend and HTTPS are required. A malicious host can replace JavaScript and steal future secrets.
- Recipients, extensions, clipboard managers, downloaded QR files and browser-history sync can retain the full capability or plaintext. One-time access is not forensic erasure.
- Weak passphrases permit guessing when encrypted payloads/verifiers are exposed. Timestamp, traffic and size metadata are not hidden.
- Client clock skew beyond the documented tolerance prevents recovery. Reloading or leaving loses an unacknowledged creation key. Recovery cannot restore a lost destructive read.
- Creation throttling is approximate per location/network bucket. The aggregate count is best-effort, not an exactly-once billing ledger.
- Provider retention, account access controls and independent cryptanalysis are not verified by local tests.
- Deployment order is API before frontend. A frontend rollback remains compatible with the new API. A Worker rollback must understand the new pending lifecycle state; prefer a forward fix over reverting to a pre-recovery Worker while pending objects may exist. KV TTL alone does not clean a Durable Object's metadata.

## Reviewer deliverable

Return the reviewed commit/dependency set, scope exclusions, reproducible findings with severity and affected invariants, and remediation/retest results. Include a negative finding if no issue is observed; do not turn it into an absolute guarantee. Route reports privately to the repository owner; do not include real notes, credentials or full live capability links. Selecting/engaging a reviewer and any paid work remain owner decisions.
