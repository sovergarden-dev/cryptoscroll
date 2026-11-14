# Creation recovery decision

- **Start time:** 2026-11-14, Asia/Bangkok.
- **Initial purpose:** Recover a lost creation acknowledgement without retaining plaintext, persisting link keys, duplicating notes, or reopening consumed notes. Baseline: `335ec0a`.
- **Strategy:** Keep the per-note Durable Object as the only lifecycle authority. Compare a separate recovery registry, permanent idempotency records, and a bounded client-generated creation token.
- **Checklist:** Trace creation and cleanup; identify crash boundaries; preserve legacy envelopes and crypto version 1; test concurrent retries, conflicting payloads, expiry, eviction and consumption.

## Result

Recovering the same creation → fewer lost handoffs → reliable private sharing. Recovery conflicts with indefinite retention, so its window is deliberately bounded. The client prepares one encrypted envelope and an independent random 128-bit nonce with an issuance timestamp. The server derives the note ID from the complete token using domain-separated SHA-256, truncated to the existing 128-bit ID format. Changing the timestamp changes the ID. Every creation attempt validates the token's ten-minute age and five-minute future-clock tolerance before accessing storage. An unchanged expired token can never recreate an ID after its tombstone is forgotten.

The Durable Object fingerprints the canonical, validated original envelope. It reserves a pending record and awaits `storage.sync()` before the KV write; same-envelope retries finish that write, while changed-envelope retries conflict. Active retries return the original ID and authoritative expiry with HTTP 200, without reuploading ciphertext or incrementing the count. First completion returns 201. Destroyed/expired state always wins. The pending record contains metadata and hashes, not ciphertext or the token; its alarm removes orphaned ciphertext. Reads cannot access a pending note. See the provider's [durable write synchronization](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#sync).

The browser keeps only the prepared envelope and key in React state while awaiting acknowledgement. Retry is an explicit user action, with the same envelope. Leaving/reloading loses recovery; no storage, replay of destructive reads, or automatic background retry is introduced. Legacy envelopes without the token still use server-random IDs. Deploy the compatible Worker before the new frontend.

### Critique and limits

- A separate registry makes recovery mapping explicit, but introduces another authority, cleanup lifecycle and cross-object failure boundary. Permanent records solve arbitrary retry windows at the cost of indefinite metadata retention.
- A timestamp-bound token is vulnerable to resurrection if validation is skipped after cleanup, or if the timestamp is not included in ID derivation. Both are required invariants and receive regression coverage.
- A crash after KV write but before activation must leave the pending fingerprint intact. A crash after activation must return the existing result, never overwrite the payload. Rate limiting still applies to retries.
- The aggregate count remains best-effort across Worker failure, as before; it is not a billing or delivery ledger. No claim of exactly-once distributed counting is introduced.
- Public creation is reachable without an account (observed). Scripting/replaying requests is cheap (estimated); tampering can cause irreversible deletion/recreation if designed incorrectly. Enforcement belongs at the Worker boundary and existing Durable Object, not client checks. Reopen this decision if recovery must survive reloads, exceed the tombstone lifetime, or support another lifecycle authority.
- Verification: implementation and tests are tracked in the [execution plan](../plan/product-followups.md); this decision alone is not test evidence. Platform reference: [Durable Object state and concurrency](https://developers.cloudflare.com/durable-objects/api/state/).

## Decision

**Action:** implement the bounded token and per-note pending state in the [product follow-ups](../plan/product-followups.md). Preserve the existing cryptographic algorithms and wire version. Cross-references: [product spec](../../.kiro/specs/cryptoscroll.md), [atomic reads](atomic-read.md), [admission control](creation-admission.md).
