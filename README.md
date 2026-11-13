# CryptoScroll

Build a web app called CryptoScroll — encrypted self-destructing notes.

## Core features

1. **Home page** — A clean markdown editor where users type a secret note. Options:

   - Self-destruct: "After first read" or "After X hours" (1h, 24h, 72h)

   - Optional password protection (simple passphrase)

   - A "Create Note" button

2. **Encryption** — Use the browser's native WebCrypto API (AES-GCM, 256-bit). Generate a random key in the browser. Encrypt the note content client-side. The key is NEVER sent to the server — it lives only in the URL hash fragment (#key=...).

3. **Storage** — Save only the ciphertext + metadata (expiry, read-once flag) to localStorage (for MVP, no backend needed yet). Each note gets a unique ID in the URL: `/note/{id}#{key}`

4. **Note view page** — When a user opens a note link:

   - Decrypt using the key from the URL hash

   - Display the markdown content

   - If read-once: show a warning "This note will be destroyed after you close this page", then delete from storage

   - If expired: show "This note has expired and been destroyed"

5. **Share UI** — After creating a note, show:

   - The full shareable link (copy button)

   - A QR code of the link (use qrcode.react or similar)

## Design

- Dark theme, minimal, slightly spooky — dark background (#0d0d0d), accent color deep purple (#7c3aed), monospace font for the note editor

- Mobile responsive

## Tech stack

- React + TypeScript + Vite

- Tailwind CSS

- WebCrypto API (built-in, no library needed)

- qrcode.react for QR codes

- react-markdown for rendering notes

## Important

- No backend required for MVP — use localStorage

- The encryption key must ONLY appear in the URL hash (#), never in the path or query params, so it's never sent to any server

- Keep the codebase clean and well-commented, especially the crypto functions

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0548ff0a-7c6c-49cf-8e02-f78abea146d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
