import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Check, Copy, Download, Share2, LockKeyhole, TriangleAlert } from "lucide-react";
import { Button } from "./ui/button";
import type { CreatedNote } from "@/lib/notes";
import { RevokeNoteDialog, type RevocationOutcome } from "./RevokeNoteDialog";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/messages";

export function NoteSuccess({
  note,
  onCreateAnother,
}: {
  note: CreatedNote;
  onCreateAnother: () => void;
}) {
  const { t, formatDate } = useI18n();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [status, setStatus] = useState<MessageKey | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const qr = useRef<HTMLCanvasElement>(null);
  const [retired, setRetired] = useState<RevocationOutcome | null>(null);
  const statusTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    statusTitle.current?.focus();
  }, [retired]);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    setCopied(false);
    setError(null);
    setStatus(null);
    try {
      await navigator.clipboard.writeText(note.url);
      setCopied(true);
      setStatus("copiedStatus");
    } catch {
      setError("clipboardError");
    }
  }

  async function share() {
    setError(null);
    setStatus(null);
    setSharing(true);
    try {
      await navigator.share({ title: "CryptoScroll", url: note.url });
      setStatus("shareOpened");
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError("shareError");
    } finally {
      setSharing(false);
    }
  }

  function saveQr() {
    setError(null);
    setStatus(null);
    const anchor = document.createElement("a");
    try {
      if (!qr.current) throw new Error("QR is not ready.");
      anchor.href = qr.current.toDataURL("image/png");
      anchor.download = "cryptoscroll-qr.png";
      document.body.append(anchor);
      anchor.click();
      setStatus("qrSaved");
    } catch {
      setError("qrError");
    } finally {
      anchor.remove();
    }
  }

  if (retired)
    return (
      <section className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-glow sm:p-10">
        <div className="status-icon">
          <LockKeyhole aria-hidden="true" className="size-8" />
        </div>
        <h1 ref={statusTitle} tabIndex={-1} className="mt-6 text-2xl font-semibold">
          {t(retired === "revoked" ? "revoked" : "noLongerAvailable")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("retiredHelp")}</p>
        <Button onClick={onCreateAnother} className="mt-6">
          <ArrowLeft aria-hidden="true" /> {t("createAnother")}
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
        {t("transmissionReady")}
      </p>
      <h1
        ref={statusTitle}
        tabIndex={-1}
        id="sealed-title"
        className="mt-2 text-3xl font-semibold tracking-tight"
      >
        {t("sealed")}
      </h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        {t("shareIntro")}
        {note.hasPassphrase && ` ${t("separatePassphrase")}`}
      </p>
      <label htmlFor="share-link" className="mt-7 block text-sm font-medium">
        {t("privateLink")}
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
          {t(copied ? "copied" : "copy")}
        </Button>
      </div>
      <p role="status" className="mt-2 min-h-5 text-xs text-success">
        {status ? t(status) : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {t(error)}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {canShare && (
          <Button variant="outline" onClick={share} disabled={sharing}>
            <Share2 aria-hidden="true" />
            {t("share")}
          </Button>
        )}
        <Button variant="outline" onClick={saveQr} aria-describedby="qr-privacy">
          <Download aria-hidden="true" />
          {t("saveQr")}
        </Button>
      </div>
      <p id="qr-privacy" className="mt-3 text-xs text-muted-foreground">
        {t("qrPrivacy")}
      </p>
      <div className="mt-5 flex flex-col items-center gap-6 rounded-xl border border-border/60 bg-background/60 p-5 sm:flex-row">
        <QRCodeCanvas
          ref={qr}
          value={note.url}
          size={512}
          level="M"
          marginSize={4}
          role="img"
          aria-label={t("qrTitle")}
          style={{ width: 176, height: 176 }}
          className="max-w-full shrink-0 rounded-lg"
        />
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("qrHeading")}</p>
          <p>{t("qrHelp")}</p>
          <p>
            {t("expires")}{" "}
            <time dateTime={note.expiresAt.toISOString()}>{formatDate(note.expiresAt)}</time>
            {note.burnAfterRead ? t("expiresOnce") : "."}
          </p>
          {note.hasPassphrase && (
            <p className="flex items-center gap-2 text-primary-glow">
              <LockKeyhole className="size-4" aria-hidden="true" /> {t("protected")}
            </p>
          )}
        </div>
      </div>
      {note.burnAfterRead && (
        <div className="mt-5 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-text">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{t("onceWarning")}</p>
        </div>
      )}
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        {t(note.hasPassphrase ? "keepProtectedLink" : "keepLink")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onCreateAnother}>
          <ArrowLeft aria-hidden="true" /> {t("createAnother")}
        </Button>
        <RevokeNoteDialog note={note} onRetired={setRetired} />
      </div>
    </section>
  );
}
