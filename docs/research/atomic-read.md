# Atomic read design

## Start time

2026-11-13, before implementation, baseline `c2c5690`.

## Initial purpose

Replace device-local note storage with cross-device delivery while honoring one-time reads, wrong-passphrase preservation, and browser-only decryption. These are security and data-loss requirements, not optional refinements to the owner's sample code.

## Strategy

Trace the sender/recipient flow and compare the proposed storage operations to official platform guarantees. Prefer a small addition to the requested Worker/KV stack over an unrelated backend replacement.

## Checklist

- Read all tracked source/configuration files; inspect the lockfile's 682 package records and existing routes/tests.
- Confirm repository visibility through GitHub: PUBLIC.
- Check KV consistency and Durable Object storage/alarms in official Cloudflare documentation.
- Trace sample passphrase derivation/export and the deletion-before-verification bug.
- Compare the current Kiro hook schema and hackathon requirements to the supplied examples.

## Result

### Storage and destructive access

KV is eventually consistent and cannot combine read/delete into one atomic operation. [Cloudflare's KV consistency documentation](https://developers.cloudflare.com/kv/concepts/how-kv-works/) explicitly recommends Durable Objects when stronger consistency is needed (read 2026-11-13). A per-note Durable Object can serialize authentication, payload retrieval and consumption. Its terminal marker must be durable before deletion/response and must remain authoritative even when a stale KV copy exists. [Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) provides persistent state and alarms for expiration/cleanup (read 2026-11-13).

The rejected KV-only option is cheaper and follows the supplied sketch literally, but two concurrent requests can both get the ciphertext. A fetch-then-client-DELETE variant is easy to debug but leaks a replay window. The selected design adds one state owner per note and a small aggregate counter object. Its cost is added setup and a network-response-loss case: an authorized read can consume a note before the browser receives it. The UI and spec state that limitation explicitly.

### Authentication and cryptography

Fetching/deleting ciphertext before verifying the passphrase burns the note on a typo. Public GET must be metadata-only; an explicit POST supplies a read capability derived from the link key and, where applicable, a passphrase verifier. Neither proof is an encryption key. The verifier must never be returned from the metadata API.

The sample exports a non-extractable PBKDF2 key, which fails before its sentinel fallback. Derive raw bytes, hash for verification, then import a non-extractable AES key. [WebCrypto deriveBits](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits) documents the derive-bits/import-key relationship (read 2026-11-13). Keep the existing 250,000 iterations. A new random IV belongs to each encryption; no deterministic AES-GCM sentinel.

### Kiro and submission provenance

Current [Kiro hooks](https://kiro.dev/docs/hooks/) use `.kiro/hooks/*.json` with `version: v1`, named triggers and command actions (read 2026-11-13). Shell files alone do not register automation. Add JSON definitions and a real local Git pre-commit hook.

[Kiroween requirements](https://kiroween.devpost.com/) require actual Kiro use, a public licensed repository with `.kiro`, a working app, a public video under three minutes and a usage write-up (read 2026-11-13). Creating artifacts does not prove Kiro use. No Kiro command was available on PATH during this inspection; the existing README identifies Lovable as the original builder.

## Verification

The source and official documents establish the initial failure modes. Implementation must still be proved with property tests, real local workerd integration, concurrent reads and isolated browser contexts. Cloud deployment and real-device production access are separate acceptance evidence, not implied by those local tests.

## Decision

Action: implement the [product spec](../../.kiro/specs/cryptoscroll.md) via the [plan](../plan/submission.md). Keep TanStack routes and the requested KV storage. Add per-note serialization and pre-consumption capability checks; publish accurate limitations.

Risk sizing: estimated reach is any public API caller, capability is a replayed HTTP request, motive is unauthorized disclosure or denial of access, and blast radius includes irreversible note loss. Enforce authorization/size/expiry once at the service boundary. Broader identity tracking, CAPTCHA and billing controls are outside this prototype; revisit on observed abuse or a production launch requiring usage guarantees.

Pre-mortem: bypassing the Durable Object, exposing verifiers, replacing the frontend with malicious scripts, or claiming an untested deployment would invalidate the security/demo story. Tests and documentation must cover those boundaries. Reopen the storage decision if concurrency tests return two successes, KV latency becomes unacceptable, or the hosting account cannot support Durable Objects.
