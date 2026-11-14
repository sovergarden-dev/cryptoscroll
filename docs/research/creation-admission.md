# Creation admission

Updated 2026-11-14. Scope: the anonymous `POST /api/notes` endpoint. The owner approved creation throttling and later deferred Kiro work; this implementation is prepared with Codex.

## Facts and risk sizing

- Reach: measured public endpoint with no account requirement; production traffic and unique-user count have not been measured.
- Capability: a caller can script valid encrypted envelopes. CORS does not govern non-browser clients.
- Motive: estimated storage/quota exhaustion or service disruption; no actual abuse incident has been observed in this work.
- Impact: resource usage and creation availability. Existing encrypted notes must remain readable/revocable when creation is throttled or its configuration fails.

## Decision

Apply Cloudflare's native rate-limiting binding before parsing/allocating a new note. The initial threshold is an **estimate of 30 creation attempts per 60 seconds per network bucket per Cloudflare location**, deliberately allowing ordinary short handoffs and bursts. Counts include invalid creation attempts. The namespace ID is dedicated to this project and must be changed when another deployment in the same account needs independent counters.

The bucket is an HMAC-SHA-256 tag over the UTC day and Cloudflare-provided client address. `CREATION_LIMIT_SALT` is a random 32-byte base64 secret provisioned outside Git. The application passes no raw address to the limiter and stores no address in KV or Durable Objects. A missing address shares an anonymous bucket instead of bypassing admission. Provider network metadata and retention remain outside this application's guarantee.

An account-free app has no stable authenticated user ID. A network bucket can group people behind NAT or a proxy; this is a documented fairness tradeoff, not a user identity. Rotating addresses and distributed callers can evade this protection. Cloudflare describes these counters as [approximate and local to each location](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/); this is not a global quota or billing cap.

Denied creation returns 429 with `RATE_LIMITED` and a conservative 60-second retry hint. Missing or failed admission configuration returns 503 before storage allocation. Read, metadata and revoke routes do not use the creation gate. Health checks exercise the binding through a separate `health` key and accept either valid limiter decision; ordinary monitoring never creates or reads a note payload.

## Reopen triggers and verification

Revisit thresholds after legitimate denials, material public traffic growth, provider quota warnings or observed distributed abuse. Consider a stricter aggregate budget or an adaptive challenge only with measured need and a separate UX/privacy assessment. Do not introduce accounts or persistent tracking cookies for this control.

Local integration tests use the native binding with an isolated low threshold, verify rejection before KV growth, independent network buckets, continued authorized reads and fail-closed misconfiguration. Local development uses an explicitly non-secret fixture salt; production requires its own generated secret.
