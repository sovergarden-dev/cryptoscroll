# Physical-device acceptance

Status: pending. The owner has confirmed access to Android and iPhone/iPad. Run these checks after the hardening build is published; browser automation and viewport screenshots are not physical-device evidence.

Use synthetic text only, for example `Device check — tiếng Việt 🔐`. Record the device, OS version, browser/version, date and outcome. No passwords, complete private links or authentication tokens belong in this record.

1. On the computer, create a protected one-time note. Scan its QR with the Android camera and verify that opening the page shows a warning without revealing or consuming the note.
2. Enter a wrong passphrase, then the correct passphrase. Confirm the exact Vietnamese/emoji content appears. Open the same link on the iPhone/iPad: the stored copy must be unavailable.
3. Reverse the sender/recipient devices. On each phone, use **Copy link**, paste into a fresh browser tab and check that the complete fragment survives. Record any clipboard permission or manual-copy fallback.
4. Create a one-hour note and open it on both devices. Reload and explicitly open again; the content must remain readable before expiry.
5. Keep the sender's sharing screen open. Select **Revoke note**, cancel once, then confirm with the correct passphrase when protected. Reload the link on both receiving devices and verify it is unavailable.
6. Open a fresh synthetic note, then leave the reader and navigate back. Decrypted content must not reappear from the browser's back/forward cache. Repeat in the browser's private mode.
7. Check portrait/landscape layout, text enlargement, keyboard overlap on password fields and the visibility of errors and confirmation controls. A slow or lost read must never promise that a one-time note can be recovered.

## Results

| Device / browser            | QR      | Clipboard | Wrong proof / one-time read | Timed read / revoke | Navigation / layout | Date / evidence |
| --------------------------- | ------- | --------- | --------------------------- | ------------------- | ------------------- | --------------- |
| Android — owner to fill     | Pending | Pending   | Pending                     | Pending             | Pending             | Pending         |
| iPhone/iPad — owner to fill | Pending | Pending   | Pending                     | Pending             | Pending             | Pending         |

After testing, revoke any timed synthetic notes using the sender's sharing screen. If that screen was closed, note their expiry and do not treat them as cleaned up before they expire or authenticated revocation succeeds.
