# Product follow-ups

Status: approved for implementation by the owner on 2026-11-14. Work is on `codex/reliability-mobile-i18n`; this plan is not a production-deployment receipt. Keep the account-free, browser-encrypted handoff as the product boundary. The owner subsequently withdrew cost alerts; no billing-alert or spending-limit change is planned.

| Priority | Proposal                                              | Benefit and constraint                                                                                                                                                                         | Acceptance before shipping                                                                                                                                                    |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Choose an unread deadline for one-time notes          | The published hardening UI fixes unopened one-time notes at 30 days. This follow-up offers a separate, shorter unread deadline while preserving old links.                                     | Correct proof consumes once; wrong proof preserves; both request-time and alarm expiry work for the selected deadline.                                                        |
| 2        | Recover safely from a lost create response            | A failed creation acknowledgement can leave the sender without the generated link. Design bounded idempotency and in-memory pending state; never retry destructive reads or persist link keys. | A retry returns the same creation within its documented window, cannot overwrite another note, and cannot resurrect a consumed note. Requires a protocol/design review first. |
| 3        | Native mobile sharing and local QR export             | Reduce clipboard friction using an explicit user action and keep the full link key in its fragment. Retain copy/manual-copy fallback; no remote QR service.                                    | Cancellation is benign, sharing preserves the fragment, and Android/iPhone testing confirms the actual OS flow.                                                               |
| 4        | English/Vietnamese UI and assistive-technology review | Improve usability with consistent error-code translations and verified screen-reader announcements. Avoid storing sensitive note state as a convenience feature.                               | Keyboard, TalkBack and VoiceOver flows cover create, warning, read, clear and revoke; language choice never changes the note key.                                             |
| 5        | Independent security review                           | Prepare a focused scope, threat model and reproducible tests for an external reviewer.                                                                                                         | Findings and remediation need a named external reviewer before claiming independent review.                                                                                   |

## Implementation checklist

- [x] Refresh the aggregate count on return to the editor, on page visibility, and through an explicit retry control.
- [x] Separate the one-time unread deadline from read policy; default new UI creations to 24 hours while preserving legacy envelopes and links.
- [x] Implement [bounded creation recovery](../research/creation-recovery.md), including durable pending state and explicit browser retry with no persisted key.
- [x] Add native share with cancellation/fallback handling and local PNG QR download.
- [x] Translate the note flow into English/Vietnamese; keep the language preference in memory and update the document language.
- [x] Focus warning, result and cleared-state headings; announce failures and operation status.
- [x] Complete local automated, browser, screenshot and security checks; record exact results and the Windows Firefox scanner limitation in [follow-up verification](../ref/product-followup-verification.md).
- [x] Obtain the owner's explicit authorization to commit/push and deploy after successful CI.
- [ ] Run the final changes through Linux CI, including its Firefox accessibility audit gate.
- [ ] Publish the compatible Worker before the frontend, then verify the changed live flows.
- [ ] Confirm new share/PNG/TalkBack/VoiceOver flows on physical devices; previous device acceptance applies to the published hardening build.
- [ ] Obtain an external review using the [review brief](../ref/security-review-brief.md).

Documentation corrections distinguish the original verification stage from current published evidence. Kiro/hackathon work remains deferred.

Prioritize actual user friction and observed failures. Attachments, user accounts, saved histories, payments and wider identity features require separate scope and threat-model decisions.
