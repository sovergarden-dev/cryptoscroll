# Submission implementation

Started: 2026-11-13. Baseline: `c2c5690` on public `sovergarden-dev/cryptoscroll`.

This file records the initial implementation checkpoint. Subsequent website hardening is complete in [the hardening record](done/hardening.md); the owner has deferred Kiro and hackathon submission work.

Status on 2026-11-14: implementation, local acceptance and production deployment are complete; [verification](../ref/verification.md) records the results. Runtime source commit `bbbf4ca` was pushed and passed GitHub CI. The API and republished Lovable frontend passed live synthetic-note checks, including wrong-passphrase preservation and rejection after the one-time read. [Deployment acceptance](../ref/deployment.md) records the scope separately from genuine Kiro/video/entry evidence in [submission status](../ref/submission.md).

Execute the owner's eight tasks in order. The [product spec](../../.kiro/specs/cryptoscroll.md) is the acceptance contract; [atomic-read research](../research/atomic-read.md) explains corrections to unsafe sample code.

1. Add MIT license; verify `.kiro` visibility and public repository.
2. Create meaningful Kiro specs, steering and executable hooks without fabricated usage history.
3. Implement Worker + KV + Durable Object authorization/lifecycle, crypto and browser API client.
4. Complete sender, success/QR, metadata/passphrase/warning, reader and terminal UI states.
5. Add requested property tests plus actual Worker/browser regression coverage for destructive behavior.
6. Document self-hosting, limits, Kiro provenance and a short demo sequence.
7. Run install, tests, typechecks, build, hooks and real browser checks; fix failures.
8. Commit and push the verified work to `main`; inspect any triggered CI and distinguish source completion from production deployment and submission.

Production deployment, real Kiro session evidence and a public video require their own observed results. Keep their status explicit in the submission guide; do not mark them complete from prepared files.
