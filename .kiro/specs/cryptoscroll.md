# CryptoScroll — Product Spec

## Overview

CryptoScroll is an account-free dead drop for short, sensitive Markdown notes. A sender encrypts a note in the browser, uploads ciphertext, and shares a link or QR code. A recipient explicitly opens it. The default one-time mode removes the stored ciphertext before returning it; timed notes remain readable until their deadline. This reduces persistent copies in chat histories, without claiming to erase recipients' screenshots, clipboard contents, or provider backups.

The target experience is a small, dark, accessible tool for people handing a temporary secret to a known recipient. See [product context](../../docs/biz/product.md). The existing TanStack Start application and file-based routes remain in place.

## User Stories

- As a sender, I want browser-side encryption so that the API never receives my plaintext or encryption keys.
- As a sender, I want a one-time note so that the service stops serving its ciphertext after one authorized opening.
- As a sender, I want an optional passphrase shared separately so that possession of the full URL alone is insufficient.
- As a sender, I want a QR code generated locally so that I can transfer the full link to a second device.
- As a recipient, I want a warning before opening a one-time note so that a page visit or link preview cannot consume it.
- As a recipient, I want a wrong passphrase or wrong link key to leave the note intact so that I can retry.
- As a user, I want no account and no saved drafts so that the application does not maintain an identity or plaintext note history.
- As a sender, I want visible network failures so that I do not share a link before the encrypted note has been stored.

## Technical Requirements

### Encryption

- Generate an extractable AES-GCM 256-bit link key with browser-native `crypto.subtle.generateKey`; export its 32 raw bytes as unpadded base64url.
- Use a new cryptographically random 12-byte IV for every AES-GCM operation, including both encryption layers. The wire format carries `iv` and authenticated `ciphertext` as separate standard-base64 fields; it does not prepend a second copy of the IV.
- Encode plaintext as UTF-8. Limit notes to 32 KiB of UTF-8 text and requests to 128 KiB. AES-GCM authentication rejects tampering and incorrect keys.
- Place the link key only in the URL fragment and transient browser memory. Do not persist it in application storage, send it in HTTP, or log it. QR codes and clipboard copies contain the full capability URL at the user's request.
- Derive an independent read capability with HMAC-SHA-256 keyed by the link key over the fixed domain `cryptoscroll:read:v1`. Store only SHA-256 of that capability. Send the capability, never the link key, when opening a note. This prevents an ID-only visitor or a valid-looking wrong key from consuming the note.
- Protocol version 1 fixes algorithms, IV/salt lengths and KDF cost; reject unknown versions rather than guessing.
- Creation tolerates up to five minutes of client clock skew beyond the maximum requested deadline, but clamps stored expiry to 30 days from server time. The response carries the authoritative deadline.

### Backend

- Cloudflare Worker routes validate bounded JSON and use a random 16-byte hex note ID.
- `NOTES_KV` holds the encrypted payload with expiration at the note's deadline. Each note's Durable Object owns its metadata, authorization hashes and lifecycle. There is no public path that reads directly from KV.
- KV alone cannot perform atomic read-and-delete. The Durable Object serializes operations across awaited KV calls, durably marks a one-time note consumed, and deletes the KV blob before returning ciphertext. A stale KV value can never bypass the consumed marker.
- Only ciphertext and necessary non-content metadata cross the service boundary. Timestamps, lengths, access patterns and provider network metadata are not hidden.
- Each accepted creation increments a serialized counter; a coalesced KV snapshot avoids concurrent increments and KV's per-key write rate. The counter is an aggregate, not an identity or note-history store.

| Endpoint                   | Behavior                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/notes`          | Validate/store the encrypted envelope; return `{ id, expiresAt }` with HTTP 201.                                                            |
| `GET /api/notes/:id`       | Return metadata only: version, expiry, burn flag, passphrase flag and public salt. Never return ciphertext or verifiers, and never consume. |
| `POST /api/notes/:id/read` | Verify the read capability and optional passphrase proof, then return ciphertext and consume if one-time.                                   |
| `DELETE /api/notes/:id`    | Revoke after the same authorization checks; use headers for proofs, no unauthenticated deletion. Not a follow-up required by reading.       |
| `GET /api/stats`           | Return the aggregate creation count.                                                                                                        |
| `GET /api/health`          | Check actual KV and Durable Object access; return 503 if unavailable.                                                                       |

All API responses use `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and no-referrer. Writes require JSON. CORS accepts configured frontend origins only. Malformed IDs, unknown fields, unsupported methods, invalid dates, invalid encodings and oversized bodies fail before persistence. A storage miss while lifecycle state is active is a retryable service error, not a false claim that the note was destroyed.

### Passphrase (optional layer)

- Derive 256 bits using PBKDF2-SHA-256 with a fresh 16-byte salt and 250,000 iterations, preserving the original application's stronger-than-100k work factor.
- Import the derived bytes as a non-extractable AES-GCM key; compute SHA-256 of the derived bytes as a separate verifier. Do not export a non-extractable key and do not use an all-zero AES-GCM IV as a verifier.
- First encrypt the plaintext with the link key. Then encrypt the JSON serialization of that payload with the passphrase key and a fresh IV.
- Salt is public. The verifier stays private to the backend and is never included in metadata or content responses. The client submits a proof derived locally; the passphrase and encryption key are never sent.
- Verify both capabilities before any consume/delete operation. Wrong or missing passphrases leave ciphertext and lifecycle unchanged. Do not trim or silently normalize a non-empty passphrase.

### URL format

`https://cryptoscroll.syrin.online/note/{32-character-hex-id}#{43-character-base64url-key}`

The fragment is not part of the HTTP request. The complete URL remains sensitive: anyone who obtains it can read an unprotected note. Browser extensions, history sync, clipboard managers and recipient screenshots are outside this guarantee.

## Component Architecture

| Module/component                 | Responsibility                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `src/routes/__root.tsx`          | HTML shell, safe error state, private-page metadata and 404 handling.                  |
| `src/components/Shell.tsx`       | Responsive frame, wordmark, navigation and concise security context.                   |
| `src/routes/index.tsx`           | Sender form and its creation state.                                                    |
| `src/components/NoteSuccess.tsx` | In-memory share URL, clipboard feedback, local QR code, deadline and one-time warning. |
| `src/routes/note.$id.tsx`        | Metadata-first recipient state machine and explicit read submission.                   |
| `src/components/NoteReader.tsx`  | Safe Markdown presentation and clearing the displayed copy.                            |
| `src/components/NoteStatus.tsx`  | Loading, missing, expired, destroyed and recoverable error states.                     |
| `src/lib/crypto.ts`              | WebCrypto operations, encoding and proof derivation.                                   |
| `src/lib/notes.ts`               | Browser orchestration: encrypt, upload, authorize, decrypt.                            |
| `src/lib/note-api.ts`            | Transport of typed encrypted envelopes and sanitized API failures.                     |
| `shared/protocol.ts`             | Versioned wire types, byte limits, expiry choices and boundary validation.             |
| `worker/index.ts`                | HTTP boundary, CORS, health and routing to Durable Objects.                            |
| `worker/note-vault.ts`           | Authoritative per-note lifecycle and KV ciphertext deletion.                           |
| `worker/note-counter.ts`         | Serialized aggregate count and KV snapshot.                                            |

Existing `src/components/ui/` primitives remain available; the note flow reuses Button rather than introducing a second design system. Plaintext and share links are React component state, not router state, query caches, history state or storage.

## Security Model

A passive backend/storage compromise exposes ciphertext, salts, verifier hashes and metadata, but not the independently random link key. Knowing the passphrase verifier does not provide an AES key. A server operator can delete, deny service, retain copies or bypass access policy. An operator who can change the delivered JavaScript can steal future plaintext and fragments; browser-side encryption cannot defend against malicious client code. The product is client-side encrypted, not a formal zero-knowledge proof system or an anonymity service.

Weak passphrases permit offline guessing of the passphrase layer. Share a long passphrase through another channel. One-time access limits service retrieval, not copying by a recipient. The application never claims forensic erasure of Cloudflare backups.

Do not render raw HTML or automatically load Markdown images: an image can phone home with information embedded by the author. Markdown links are explicit clicks, restricted to safe HTTP(S) destinations with no referrer and no opener. Production pages must not add analytics, session replay or third-party scripts that can inspect secret DOM or fragments.

## Self-Destruct Logic

1. Page navigation fetches metadata without ciphertext. The recipient sees passphrase input where needed and the destructive warning before any read request.
2. Clicking the read button derives proofs in memory. The server checks expiry and both proofs before touching ciphertext.
3. For an active authorized note, the Durable Object loads its KV ciphertext. A one-time note is durably marked destroyed and its KV entry deleted before the response is sent. Concurrent callers cannot both succeed.
4. The recipient decrypts locally and can read the in-memory copy. The UI immediately says the server copy is destroyed, and provides a button to clear the displayed copy. Refreshing cannot retrieve the note again.
5. Timed notes permit repeated authorized reads until expiry. KV TTL and a Durable Object alarm remove ciphertext at expiry; every request independently enforces the deadline even if alarm delivery is delayed.
6. Terminal state retains only a short-lived ID/reason tombstone to distinguish expired from read notes. After 24 hours it becomes generic not-found. Failed cleanup is retried by the alarm without reopening access.
7. If the network fails after consumption, the note may be lost. No automatic read retry or replay copy is retained. Explain this before the destructive action and in the failure state.

## Acceptance Criteria

- Two isolated browser contexts can create and decrypt a note through the same Worker without localStorage.
- A metadata visit, absent key, wrong key, absent passphrase and wrong passphrase do not consume a note.
- Concurrent authorized reads yield exactly one successful response for a one-time note.
- Expired notes return no ciphertext; timed notes can be reread before expiry.
- Property tests exercise UTF-8 roundtrips, key serialization, wrong keys, tampering, fresh IV samples and passphrase layers. A finite random sample is not a proof of universal nonce uniqueness.
- Success view includes a locally generated QR code containing the exact share URL and accessible clipboard feedback.
- Build, frontend/Worker typechecks, tests, security/compliance hooks and real browser checks pass before commit/push.
- Kiro usage claims are supported by real sessions. Prepared files alone do not establish hackathon eligibility.
