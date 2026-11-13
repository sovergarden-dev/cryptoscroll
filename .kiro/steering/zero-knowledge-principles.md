---
inclusion: always
---

# Steering: Zero-Knowledge Principles

The API must never receive plaintext, the link key or the passphrase. The full protocol and threat model live in [the product spec](../specs/cryptoscroll.md).

1. Encrypt in the browser with native WebCrypto, AES-GCM 256-bit and fresh 12-byte IVs. No JavaScript crypto package or server-side substitute.
2. Keep link keys in the fragment and transient browser memory only. Never put keys, plaintext or passphrases in cookies, localStorage, sessionStorage, logs, analytics, query caches or router history state. Focus navigation must preserve the fragment; the skip control moves focus without changing the URL.
3. Preserve PBKDF2-SHA-256's 250,000 iterations and fresh 16-byte salts. Derive verifier bytes before importing a non-extractable key. Never reuse a fixed AES-GCM IV for verification.
4. Verify read capability and passphrase proof before consumption. Public metadata must not expose ciphertext or authentication proofs.
5. Serialize burn-after-read in the per-note Durable Object, including awaited KV operations. KV get/delete alone is not atomic. Mark consumed durably before deleting and returning ciphertext; no follow-up DELETE is required.
6. Require an explicit warning and recipient action before a one-time read. GET, HEAD, prefetch, SSR and previews must not consume notes.
7. Keep errors safe and visible. A failed network read may already have consumed a one-time note; never automatically retry it or imply guaranteed recovery.
8. Render Markdown without raw HTML, remote images or unsafe links. Do not introduce analytics or error payloads that can contain secrets.
9. Distinguish passive ciphertext confidentiality from malicious frontend code, endpoint compromise and copied recipient content. Do not promise anonymity, forensic erasure or impossible universal nonce guarantees.
