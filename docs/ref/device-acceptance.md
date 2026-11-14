# Physical-device acceptance

Status: the owner reported that the published hardening build passed on both Android and iPhone/iPad on 2026-11-14. This is owner-reported physical-device evidence, distinct from browser-engine automation. Device models, OS/browser versions and private-mode results were not separately supplied.

Use synthetic text only, for example `Device check — tiếng Việt 🔐`. Record the device, OS version, browser/version, date and outcome. No passwords, complete private links or authentication tokens belong in this record.

1. On the computer, create a protected one-time note. Scan its QR with the Android camera and verify that opening the page shows a warning without revealing or consuming the note.
2. Enter a wrong passphrase, then the correct passphrase. Confirm the exact Vietnamese/emoji content appears. Open the same link on the iPhone/iPad: the stored copy must be unavailable.
3. Reverse the sender/recipient devices. On each phone, use **Copy link**, paste into a fresh browser tab and check that the complete fragment survives. Record any clipboard permission or manual-copy fallback.
4. Create a one-hour note and open it on both devices. Reload and explicitly open again; the content must remain readable before expiry.
5. Keep the sender's sharing screen open. Select **Revoke note**, cancel once, then confirm with the correct passphrase when protected. Reload the link on both receiving devices and verify it is unavailable.
6. Open a fresh synthetic note, then leave the reader and navigate back. Decrypted content must not reappear from the browser's back/forward cache. Repeat in the browser's private mode.
7. Check portrait/landscape layout, text enlargement, keyboard overlap on password fields and the visibility of errors and confirmation controls. A slow or lost read must never promise that a one-time note can be recovered.

## Results

| Device / browser                   | QR                 | Clipboard          | Wrong proof / one-time read | Timed read / revoke | Navigation / layout                                              | Date / evidence                        |
| ---------------------------------- | ------------------ | ------------------ | --------------------------- | ------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| Android — version not supplied     | Pass, owner report | Pass, owner report | Pass, owner report          | Pass, owner report  | Pass for requested back-navigation, rotation and keyboard checks | 2026-11-14, owner confirmation in chat |
| iPhone/iPad — version not supplied | Pass, owner report | Pass, owner report | Pass, owner report          | Pass, owner report  | Pass for requested back-navigation, rotation and keyboard checks | 2026-11-14, owner confirmation in chat |

After testing, revoke any timed synthetic notes using the sender's sharing screen. If that screen was closed, note their expiry and do not treat them as cleaned up before they expire or authenticated revocation succeeds.

## Follow-up build: pending physical acceptance

The results above cover the published hardening build, not the newer unpublished creation-recovery, language, share or PNG features. After the follow-up is published, record device model, OS/browser version, date and results for:

1. Switch English/Vietnamese through create, warning, read, clear and revoke. With TalkBack/VoiceOver enabled, confirm headings, warnings, field labels, errors and focus order are understandable; enlarge text and rotate the device.
2. Use Share link, cancel once, then send a synthetic link to the other device. Verify the complete key survives the chosen sharing app and the link still requires explicit reading. Unsupported sharing must retain Copy link/manual copy.
3. Save QR image, locate the PNG in the device's download/photo workflow, and scan the saved image from the other device. Confirm it opens the intended synthetic note; delete the test image after use.
4. Select a one-hour unread deadline in one-time mode. Verify the displayed expiry and wrong/right passphrase behavior. Automated local alarms cover expiry timing; do not claim a physical one-hour wait unless performed.
5. Interrupt creation connectivity, restore it and use Retry this creation in the same tab. Check that the form does not falsely claim success, that the recovered link works, and that a completed one-time read cannot be recovered by retrying creation.

Status: not yet performed for the follow-up build. Automated sharing/clipboard stubs and axe scans do not constitute OS integration or screen-reader acceptance.
