# CryptoScroll production hardening

This extends `cryptoscroll.md`; protocol version 1 and the existing encryption/one-time-read invariants remain authoritative. The owner approved creation throttling, CSP, revocation UI, post-publication verification, real-device acceptance and genuine Kiro evidence on 2026-11-14.

## Creation admission

An anonymous caller can script valid encrypted-envelope uploads. Each accepted upload allocates storage and a Durable Object; CORS is not an admission policy for non-browser callers. Enforce creation limits before allocation. This is creation-only protection: do not add a new gate that can consume or silently retry an existing note.

- Return HTTP 429 with `error.code = "RATE_LIMITED"`, a safe explanatory message and `Retry-After` when creation is denied.
- Preserve the current typed envelope validation, bounded request body and exact origin allowlist.
- Use a short-lived, privacy-preserving client bucket; document shared-network fairness and the limits of approximate edge counters. Do not claim a global billing cap.
- Do not log client addresses, note IDs, authorization headers, ciphertext, plaintext or fragments. Any secret salt belongs in the deployment secret store, never in Git.
- Exercise normal creation, denial before allocation and unaffected authorized reads in the existing Worker integration harness. No tests may target production by default.

## Browser protection

Every production HTML response has a fresh unpredictable nonce shared by the CSP and legitimate framework scripts. Configure the framework's nonce support; do not rewrite arbitrary script tags to make them trusted. Permit the configured API and required application assets. No third-party reporting endpoint receives private URLs or payloads. Verify a compiled production build, not only the Vite development server.

## Revocation

The sharing screen offers a deliberate revoke action. A protected note requires its passphrase again; do not retain the plaintext passphrase or derived passphrase key after creation for this feature. Use the existing authenticated DELETE endpoint. GET stays metadata-only. Wrong proof leaves the note intact. A consumed/expired note is reported as already unavailable. A network failure must not be displayed as a confirmed revocation.

## Acceptance and provenance

Record actual Kiro spec/hook/tool activity and its resulting diff/tests. Passing local browser emulation is distinct from the owner's Android and iPhone/iPad checks. A published demo must show real behavior using synthetic notes and describe the limits of server-copy deletion accurately.

The owner subsequently deferred Kiro and hackathon work on 2026-11-14 to focus on the website. No Kiro contribution is claimed for this implementation. The website acceptance requirements remain active.
