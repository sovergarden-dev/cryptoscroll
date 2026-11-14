# Changelog

## [Unreleased]

### Added

- Cloudflare Worker API with KV ciphertext storage, per-note Durable Object serialization, expiration alarms and an aggregate note counter; the deployed API passed live synthetic-note checks.
- Property-based WebCrypto tests, real local Worker integration tests and isolated browser verification.
- MIT license and Kiro-compatible specs, steering, JSON hook definitions and executable compliance/security checks; actual Kiro session evidence is still required for submission.
- Seven-day and thirty-day expiry options, explicit recipient confirmation, local QR sharing, mobile layouts and reduced-motion support.

### Changed

- Replace the localStorage-only delivery path with an encrypted-envelope API client. Old prototype links are not automatically migrated.
- Document self-hosting, the Frankenstein demo, security limits and outstanding submission evidence without attributing Codex/Lovable work to Kiro.
- Update vulnerable dependencies and host Inter/JetBrains Mono font files locally.

### Fixed

- Connect hosted frontend/preview builds to the deployed HTTPS Worker instead of treating Lovable's `/api` path as the backend; preserve the local proxy and explicit self-hosting overrides.
- Prevent metadata visits, wrong link keys and incorrect or absent passphrases from consuming one-time notes.
- Persist the consumed state before returning ciphertext so concurrent reads and stale KV replicas cannot replay a note.
- Preserve a leading Unicode BOM through encryption/decryption.
- Prevent input loss before frontend hydration and tolerate small client clock differences when creating a 30-day note, without extending the server's retention limit.
- Select the API's Wrangler configuration explicitly so frontend build output does not interfere with API development or packaging.
- Keep keyboard skip navigation from replacing the encryption key in the URL fragment.

### Security

- Derive separate read capabilities; keep plaintext, passphrases and encryption keys out of API payloads and application persistence.
- Bound and validate API bodies, restrict CORS, disable response caching, remove browser error telemetry and prevent automatic Markdown image loads.
