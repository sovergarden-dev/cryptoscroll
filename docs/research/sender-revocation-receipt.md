# Sender revocation receipt

## Decision under review

The sender may keep a separate link to cancel a note after closing the sharing screen. Opening that link shows metadata and asks for confirmation. The recipient continues to receive the ordinary reading link through copy, QR or the system share sheet. A passphrase-protected note also requires its original passphrase for revocation.

The browser generates two independent 256-bit random secrets. The existing reading link and encryption remain version 1. The new receipt has the form `/revoke/{id}#<sender-secret>`. Its secret stays in the fragment and transient browser state. The browser derives a separate HMAC-SHA-256 proof with the label `cryptoscroll:revoke:v1`. Creation sends only its SHA-256 hash in the optional `revokeTokenHash` field. The creation fingerprint includes that hash, so a retry keeps the receipt tied to the original envelope. The API returns the same public metadata and ciphertext shapes as before.

| Stored note | Opening a note | Confirming revocation |
| --- | --- | --- |
| New note with a receipt | Existing read proof | Independent sender proof |
| Existing note or a creation from an older client | Existing read proof | Existing read proof |

For protected notes both columns also require the original passphrase proof. The Durable Object decides which revocation proof to accept from its stored state. The receipt uses the same retirement, cleanup and expiry paths as other authorized revocations. No endpoint returns either secret, either proof hash or the receipt link.

## Compatibility and rollout

The optional hash avoids a data migration. An older browser can still create a legacy note against the candidate Worker and read a new note with its reading link. An older Worker rejects a creation containing the new field. After review, deploy the compatible Worker first and verify legacy creation, retries, protected reading and revocation before publishing a receipt-capable frontend. An older frontend remains a compatible rollback. While any new-format note is active, keep a Worker that understands the stored revocation hash, including during rollback.

The receipt is a deletion capability. Someone who obtains it can revoke an unprotected note, and losing it after leaving the sender screen loses the sender's cancellation option. The recipient may retain material they already received. A receipt holder cannot decrypt the note with the receipt, and a link preview performs no revocation. Copying the receipt to a clipboard or keeping it outside the browser is the sender's choice.

## Review handoff

The sharing screen, receipt page and confirmation dialog display the same eight hexadecimal digits from the public note ID and the deadline with its local UTC offset. This short reference helps identify a receipt. Authorization uses the full independent secret.

The compatibility suite restores two synthetic active records captured from commit `84b5ff958bb66d7c672bf3964c7379f15f05f4b2`. Its actual browser client and local Worker created and opened a one-time Unicode note and a timed passphrase-protected note. The fixed file contains only disposable public test data. The suite advances only the stored expiry to keep the samples active on future test dates. The candidate reader and Worker open the original IDs and fragments and must return the recorded plaintext. Additional cases cover both orders of reading and revoking a one-time note and overlapping authorized requests.

Review the changes in this PR together with its locked dependencies. Check independent generation and domain separation, separation of authorization for new notes, compatible legacy behavior, simultaneous read and revoke, terminal storage cleanup, and the absence of receipt material from recipient sharing, requests and browser persistence. Confirm the legacy fallback applies only to stored notes without the new hash. Keep receipt issuance on this review branch until independent sign-off and compatibility verification. The private reporting channel is documented in [SECURITY.md](../../SECURITY.md).
