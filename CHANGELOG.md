# Changelog

## [Unreleased]

### Added

- Bounded, explicit creation recovery using a timestamped independent nonce, a per-note durable pending record and an in-memory encrypted browser request; consumed/expired notes cannot be recreated by a retry.
- Anonymous creation throttling before storage, with typed 429 responses and a daily HMAC network bucket; no raw address is stored in application data.
- Confirmed sender-side revocation with passphrase re-entry, keyboard focus and truthful network-failure feedback.
- Production CSP nonces, content-free server error logging, compiled-Worker acceptance across Chromium/Firefox/WebKit, and separate read-only/live-synthetic verification commands.
- Cloudflare Worker API with KV ciphertext storage, per-note Durable Object serialization, expiration alarms and an aggregate note counter; the deployed API passed live synthetic-note checks.
- Property-based WebCrypto tests, real local Worker integration tests and isolated browser verification.
- MIT license and Kiro-compatible specs, steering, JSON hook definitions and executable compliance/security checks; actual Kiro session evidence is still required for submission.
- Seven-day and thirty-day expiry options, explicit recipient confirmation, local QR sharing, mobile layouts and reduced-motion support.

### Changed

- Replace the localStorage-only delivery path with an encrypted-envelope API client. Old prototype links are not automatically migrated.
- Document self-hosting, the Frankenstein demo, security limits and outstanding submission evidence without attributing Codex/Lovable work to Kiro.
- Update vulnerable dependencies and host Inter/JetBrains Mono font files locally.

### Fixed

- Bound stalled API calls to 30 seconds without automatic retries of destructive reads, and preserve uncertain revocation results.
- Keep the fallback error page usable under CSP and wait for hydration before capturing acceptance screenshots.
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
