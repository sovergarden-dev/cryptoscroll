import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown, Flame, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/Shell";
import { NoteSuccess } from "@/components/NoteSuccess";
import { PendingNoteCreation } from "@/components/PendingNoteCreation";
import { Button } from "@/components/ui/button";
import {
  prepareNoteCreation,
  submitNoteCreation,
  getNoteCount,
  type PendingCreation,
  type CreatedNote,
  type ExpiryOption,
} from "@/lib/notes";
import {
  EXPIRY_OPTIONS,
  UNREAD_EXPIRY_OPTIONS,
  MAX_NOTE_BYTES,
  type Failure,
  type TimedExpiryOption,
} from "../../shared/protocol";
import { useI18n, expiryKeys, durationKeys } from "@/lib/i18n";

const title = "CryptoScroll | Write once. Read once. Vanish.";
const description =
  "Share an encrypted secret that disappears after one read. Seal a Markdown note in your browser, then share a private link or QR code.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, errorText, locale } = useI18n();
  const [content, setContent] = useState("");
  const [expiry, setExpiry] = useState<ExpiryOption>("read-once");
  const [unreadExpiry, setUnreadExpiry] = useState<TimedExpiryOption>("24h");
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [created, setCreated] = useState<CreatedNote | null>(null);
  const [pending, setPending] = useState<PendingCreation | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [countUnavailable, setCountUnavailable] = useState(false);
  const [countBusy, setCountBusy] = useState(false);
  const [countVersion, setCountVersion] = useState(0);
  const [editorVersion, setEditorVersion] = useState(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);
  const bytes = new TextEncoder().encode(content).length;
  const disabled = !ready || busy;
  const canCreate =
    content.trim().length > 0 &&
    bytes <= MAX_NOTE_BYTES &&
    (!usePassphrase || passphrase.trim().length > 0) &&
    !disabled;

  useEffect(() => {
    setReady(true);
    const invalidateRequests = () => {
      generation.current++;
    };
    const clearSecrets = () => {
      invalidateRequests();
      setContent("");
      setPassphrase("");
      setCreated(null);
      setPending(null);
      setError(null);
      setBusy(false);
    };
    window.addEventListener("pagehide", clearSecrets);
    return () => {
      invalidateRequests();
      window.removeEventListener("pagehide", clearSecrets);
    };
  }, []);

  useEffect(() => {
    if (created || pending) return;
    const controller = new AbortController();
    setCountBusy(true);
    void getNoteCount(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setCountBusy(false);
      if (result.ok) {
        setCount(result.data.count);
        setCountUnavailable(false);
      } else setCountUnavailable(true);
    });
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") setCountVersion((value) => value + 1);
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [created, pending, countVersion]);

  useEffect(() => {
    if (editorVersion > 0) editor.current?.focus();
  }, [editorVersion]);

  function startOver() {
    generation.current++;
    setCreated(null);
    setPending(null);
    setError(null);
    setContent("");
    setPassphrase("");
    setUsePassphrase(false);
    setExpiry("read-once");
    setUnreadExpiry("24h");
    setEditorVersion((value) => value + 1);
  }

  async function submitPending(prepared: PendingCreation, current: number) {
    setBusy(true);
    setError(null);
    const result = await submitNoteCreation(prepared);
    if (current !== generation.current) return;
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPending(null);
    setCreated(result.data);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    const current = generation.current;
    const result = await prepareNoteCreation({
      content,
      expiry,
      unreadExpiry,
      ...(usePassphrase && { passphrase }),
    });
    if (current !== generation.current) return;
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    setContent("");
    setPassphrase("");
    setPending(result.data);
    await submitPending(result.data, current);
  }

  return (
    <Shell>
      {created ? (
        <NoteSuccess note={created} onCreateAnother={startOver} />
      ) : pending ? (
        <PendingNoteCreation
          pending={pending}
          busy={busy}
          error={error}
          onRetry={() => {
            if (!busy) void submitPending(pending, generation.current);
          }}
          onDiscard={startOver}
        />
      ) : (
        <div className="grid items-center gap-10 lg:grid-cols-5 lg:gap-16">
          <section className="lg:col-span-2" aria-labelledby="hero-title">
            <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary-glow">
              <span className="size-1.5 rounded-full bg-primary" /> {t("deadDrop")}
            </p>
            <h1
              id="hero-title"
              className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
            >
              {t("writeOnce")}
              <br />
              {t("readOnce")}
              <br />
              <span className="text-primary-glow">{t("vanish")}</span>
            </h1>
            <p className="mt-6 max-w-sm leading-relaxed text-muted-foreground">{t("intro")}</p>
            <div className="mt-7 flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              <span>{t("encryptionPromise")}</span>
            </div>
            <details className="mt-6 text-sm text-muted-foreground">
              <summary className="w-fit cursor-pointer underline decoration-border underline-offset-4 hover:text-foreground">
                {t("privacyTitle")}
              </summary>
              <p className="mt-3 max-w-sm leading-relaxed">{t("privacyBody")}</p>
            </details>
            <div className="mt-9 border-t border-border/60 pt-5 font-mono text-xs text-muted-foreground">
              <span role="status" aria-busy={countBusy}>
                {countUnavailable ? (
                  t("countUnavailable")
                ) : count !== null ? (
                  <>
                    <span className="text-lg font-medium text-foreground">
                      {count.toLocaleString(locale)}
                    </span>{" "}
                    {t("countLabel")}
                  </>
                ) : (
                  t("countLoading")
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-2"
                disabled={countBusy}
                onClick={() => setCountVersion((value) => value + 1)}
                aria-label={t("refreshCount")}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
            </div>
          </section>

          <form
            onSubmit={create}
            className="overflow-hidden rounded-2xl border bg-card shadow-glow lg:col-span-3"
            aria-label={t("createForm")}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-6">
              <label htmlFor="note-content" className="text-sm font-semibold">
                {t("secretLabel")}
              </label>
              <span className="font-mono text-xs text-muted-foreground">{t("markdown")}</span>
            </div>
            <div className="p-5 sm:p-6">
              <textarea
                ref={editor}
                id="note-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={10}
                maxLength={MAX_NOTE_BYTES}
                spellCheck={false}
                autoComplete="off"
                disabled={disabled}
                placeholder={t("placeholder")}
                aria-describedby="note-size"
                aria-invalid={bytes > MAX_NOTE_BYTES}
                className="w-full resize-y rounded-lg border border-transparent bg-background/50 p-4 font-mono text-sm leading-relaxed placeholder:text-muted-foreground focus:border-primary"
              />
              <p
                id="note-size"
                className={`mt-2 text-right font-mono text-xs ${bytes > MAX_NOTE_BYTES ? "text-danger-text" : "text-muted-foreground"}`}
              >
                {bytes.toLocaleString(locale)} / {MAX_NOTE_BYTES.toLocaleString(locale)}{" "}
                {t("bytes")}
              </p>
              <fieldset disabled={disabled} className="mt-6">
                <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Flame className="size-4 text-primary-glow" aria-hidden="true" />{" "}
                  {t("selfDestruct")}
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {EXPIRY_OPTIONS.map((option) => (
                    <label key={option.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="expiry"
                        value={option.value}
                        checked={expiry === option.value}
                        onChange={() => setExpiry(option.value)}
                        className="peer sr-only"
                      />
                      <span className="flex min-h-11 items-center justify-center rounded-lg border px-2 py-2 text-center font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 peer-checked:border-primary peer-checked:bg-primary/15 peer-checked:text-primary-glow peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50">
                        {t(expiryKeys[option.value])}
                      </span>
                    </label>
                  ))}
                </div>
                {expiry === "read-once" && (
                  <div className="mt-4">
                    <label htmlFor="unread-expiry" className="block text-sm">
                      {t("unreadDeadline")}
                    </label>
                    <select
                      id="unread-expiry"
                      value={unreadExpiry}
                      onChange={(event) => setUnreadExpiry(event.target.value as TimedExpiryOption)}
                      className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3"
                    >
                      {UNREAD_EXPIRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(durationKeys[option.value])}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {expiry === "read-once" ? t("onceHelp") : t("timedHelp")}
                </p>
              </fieldset>
              <div className="mt-6 border-t border-border/60 pt-5">
                <button
                  type="button"
                  aria-expanded={usePassphrase}
                  aria-controls="passphrase-field"
                  disabled={disabled}
                  onClick={() => {
                    setUsePassphrase(!usePassphrase);
                    setPassphrase("");
                  }}
                  className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    <LockKeyhole className="size-4 text-primary-glow" aria-hidden="true" />{" "}
                    {t("addPassphrase")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {t("optional")}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 transition-transform ${usePassphrase ? "rotate-180" : ""}`}
                  />
                </button>
                {usePassphrase && (
                  <div id="passphrase-field" className="mt-4">
                    <label htmlFor="create-passphrase" className="sr-only">
                      {t("passphrase")}
                    </label>
                    <input
                      id="create-passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(event) => setPassphrase(event.target.value)}
                      autoComplete="new-password"
                      maxLength={1024}
                      disabled={disabled}
                      className="w-full rounded-lg border bg-background px-3 py-3 font-mono text-sm"
                      placeholder={t("passphrasePlaceholder")}
                      aria-describedby="passphrase-help"
                    />
                    <p id="passphrase-help" className="mt-2 text-xs text-muted-foreground">
                      {t("passphraseHelp")}
                    </p>
                  </div>
                )}
              </div>
              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-danger-text"
                >
                  {errorText(error)}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={!canCreate}
                className="mt-6 h-12 w-full text-sm"
                aria-busy={busy}
              >
                <LockKeyhole aria-hidden="true" />
                {!ready ? t("preparing") : busy ? t("sealing") : t("create")}
                {!busy && <ArrowRight aria-hidden="true" className="ml-auto" />}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t("localEncryption")}
              </p>
            </div>
          </form>
        </div>
      )}
    </Shell>
  );
}
