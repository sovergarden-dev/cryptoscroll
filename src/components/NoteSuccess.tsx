import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Check, Copy, LockKeyhole, TriangleAlert } from "lucide-react";
import { Button } from "./ui/button";
import type { CreatedNote } from "@/lib/notes";
import { RevokeNoteDialog, type RevocationOutcome } from "./RevokeNoteDialog";

export function NoteSuccess({
  note,
  onCreateAnother,
}: {
  note: CreatedNote;
  onCreateAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [retired, setRetired] = useState<RevocationOutcome | null>(null);
  const statusTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (retired) statusTitle.current?.focus();
  }, [retired]);

  async function copy() {
    setCopied(false);
    setError("");
    try {
      await navigator.clipboard.writeText(note.url);
      setCopied(true);
      setError("");
    } catch {
      setError("Clipboard access is unavailable. Select the link and copy it manually.");
    }
  }

  if (retired)
    return (
      <section className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-glow sm:p-10">
        <div className="status-icon">
          <LockKeyhole aria-hidden="true" className="size-8" />
        </div>
        <h1 ref={statusTitle} tabIndex={-1} className="mt-6 text-2xl font-semibold">
          {retired === "revoked" ? "Note revoked." : "This note is no longer available."}
        </h1>
        <p className="mt-3 text-muted-foreground">
          This link can no longer retrieve the stored note. Copies already kept by a recipient are
          unaffected.
        </p>
        <Button onClick={onCreateAnother} className="mt-6">
          <ArrowLeft aria-hidden="true" /> Create another note
        </Button>
      </section>
    );

  return (
    <section
      className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-glow sm:p-10"
      aria-labelledby="sealed-title"
    >
      <div className="status-icon animate-seal">
        <LockKeyhole aria-hidden="true" className="size-8" />
      </div>
      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-primary-glow">
        Transmission ready
      </p>
      <h1 id="sealed-title" className="mt-2 text-3xl font-semibold tracking-tight">
        Your scroll is sealed.
      </h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Share the complete link or scan the QR code on another device.
        {note.hasPassphrase && " Send the passphrase through a separate channel."}
      </p>
      <label htmlFor="share-link" className="mt-7 block text-sm font-medium">
        Your private link
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="share-link"
          readOnly
          value={note.url}
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 rounded-lg border bg-background p-3 font-mono text-xs"
          spellCheck={false}
        />
        <Button onClick={copy} className="h-11">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>
      <p role="status" className="mt-2 min-h-5 text-xs text-success">
        {copied ? "Link copied to clipboard." : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-col items-center gap-6 rounded-xl border border-border/60 bg-background/60 p-5 sm:flex-row">
        <QRCodeSVG
          value={note.url}
          size={176}
          level="M"
          marginSize={4}
          title="QR code for this note"
          bgColor="var(--qr-background)"
          fgColor="var(--qr-foreground)"
          className="max-w-full shrink-0 rounded-lg"
        />
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">A dead drop. Anywhere.</p>
          <p>
            Scan with your recipient's camera. The QR contains the same private link, including its
            key.
          </p>
          <p>
            Expires{" "}
            <time dateTime={note.expiresAt.toISOString()}>{note.expiresAt.toLocaleString()}</time>
            {note.burnAfterRead ? ", or on the first authorized read." : "."}
          </p>
          {note.hasPassphrase && (
            <p className="flex items-center gap-2 text-primary-glow">
              <LockKeyhole className="size-4" aria-hidden="true" /> Passphrase protected
            </p>
          )}
        </div>
      </div>
      {note.burnAfterRead && (
        <div className="mt-5 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-text">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>This link can only be opened once. Share it only with the intended recipient.</p>
        </div>
      )}
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Keep this link before leaving. We cannot recover its key. Anyone with the complete link
        {note.hasPassphrase ? " and passphrase" : ""} can open the note.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onCreateAnother}>
          <ArrowLeft aria-hidden="true" /> Create another note
        </Button>
        <RevokeNoteDialog note={note} onRetired={setRetired} />
      </div>
    </section>
  );
}
