# Kiroween submission evidence

Checked against the [official event page](https://kiroween.devpost.com/) on 2026-11-13. This is a preparation checklist, not a submitted-entry receipt.

Owner update on 2026-11-14: Kiro and hackathon submission work are deferred while website hardening proceeds. The outstanding evidence below is retained for a possible later resumption.

| Requirement                      | Evidence/status                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public repository                | GitHub reports `sovergarden-dev/cryptoscroll` as PUBLIC.                                                                                                                                                                                                                                                                                                                           |
| Recognizable open-source license | Root MIT `LICENSE`.                                                                                                                                                                                                                                                                                                                                                                |
| Root `.kiro`, not ignored        | Product spec, two steering documents, executable checks and current-format JSON hook definitions. Git ignore checks run locally.                                                                                                                                                                                                                                                   |
| Working application              | The published hardening baseline passed 40 Vitest tests and 12 browser scenarios across Chromium, Firefox and WebKit. Production acceptance and owner-reported Android/iPhone checks passed. See [hardening verification](hardening-verification.md), [deployment](deployment.md) and [device acceptance](device-acceptance.md). Unpublished follow-up work is tracked separately. |
| Actual use of Kiro               | **Outstanding.** Artifacts were prepared with Codex. No verified Kiro execution record exists for this update.                                                                                                                                                                                                                                                                     |
| Public video under three minutes | **Outstanding.** No video has been recorded or uploaded by this task.                                                                                                                                                                                                                                                                                                              |
| Accurate Kiro usage write-up     | **Outstanding until real Kiro work is recorded.** Do not claim Kiro Web was the primary coding environment.                                                                                                                                                                                                                                                                        |
| Entry submission                 | **Outstanding.** No Devpost entry has been submitted by this task.                                                                                                                                                                                                                                                                                                                 |

The official page lists property-based testing among possible evidence in the Kiro write-up. It does not establish a separate PBT bonus prize. The Frankenstein narrative should demonstrate the assembled dead-drop workflow rather than claim that AES-GCM is a one-time pad or that KV supports atomic get-and-delete.

## Production status

The owner refreshed Wrangler authorization, and the API now runs on Cloudflare with a real KV namespace and both Durable Object classes. Live checks used disposable synthetic notes only. The frontend stays on Lovable and calls the dedicated HTTPS Worker; the domain's current direct Lovable DNS record does not activate the Cloudflare `/api/*` route. See the [deployment record](deployment.md) and [self-hosting guide](../../README.md#deploy-your-own-instance).

The owner republished the API-origin correction and subsequently the hardening build in Lovable. Live browser checks confirmed protected-note creation, wrong-passphrase preservation, successful decryption, rejection after the one-time read and timed rereading. The hosted checks used separate tabs; independent browser storage contexts were exercised locally. On 2026-11-14 the owner reported the requested QR, clipboard, read, revoke and navigation checks passed on Android and iPhone/iPad; device/browser versions were not supplied. See [device acceptance](device-acceptance.md). This does not cover the unpublished follow-up features or an independent security audit.

## A reproducible demo under three minutes

| Time      | What to show                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | State the problem: temporary secrets left indefinitely in ordinary message histories. Introduce the browser-encrypted dead drop.                                    |
| 0:20–0:50 | Write a disposable Markdown note, keep one-time mode and add a separately shared passphrase. Create it and show the QR/link.                                        |
| 0:50–1:25 | Open the link in a second browser/device. Show that visiting only displays a warning. Enter a wrong passphrase, then retry successfully.                            |
| 1:25–1:50 | Read the Markdown, clear it and revisit the link. Show that the server no longer serves the ciphertext.                                                             |
| 1:50–2:15 | Show the request payload containing encrypted bytes and proofs, with no plaintext or encryption key. Explain the fragment and Durable Object serialization briefly. |
| 2:15–2:45 | Show an actual Kiro session using the spec, steering and hooks, plus the property-test output. Only show steps that truly occurred.                                 |
| 2:45–2:55 | State the limit: a recipient can copy a note; a malicious frontend can compromise browser secrets. End with the public repository and app.                          |

Use synthetic secrets only. A recorded demo must not expose real passphrases, private notes, account tokens or other people's data. Publish the demo only when the owner requests publication.

## Recording real Kiro work

Open this repository in Kiro, read the product spec and steering, and have Kiro review or implement a concrete remaining acceptance task. Retain its actual output and the resulting diff/test evidence. The hooks are checked in, but actual auto-trigger execution must be observed in that session before describing it as demonstrated Kiro usage.

Useful task: independently review the metadata → authorization → consume flow against the wrong-passphrase and concurrent-read requirements, then add a regression test only for a real gap. Describe the result accurately even if the review finds no new defect. Do not invent a Kiro role, conversation or screenshot to fill a checklist.
