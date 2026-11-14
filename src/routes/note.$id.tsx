import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Flame, LockKeyhole, TriangleAlert } from "lucide-react";
import { Shell } from "@/components/Shell";
import { NoteStatus } from "@/components/NoteStatus";
import { NoteReader } from "@/components/NoteReader";
import { Button } from "@/components/ui/button";
import { base64ToKey } from "@/lib/crypto";
import { useI18n } from "@/lib/i18n";
import { getNoteMetadata, readNote, type NoteData, type NoteMetadata } from "@/lib/notes";
import type { Failure } from "../../shared/protocol";

export const Route = createFileRoute("/note/$id")({
  head: () => ({
    meta: [
      { title: "A sealed note | CryptoScroll" },
      {
        name: "description",
        content:
          "Open a private encrypted note. One-time notes require your confirmation before they are destroyed.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: NotePage,
});

type State =
  | { kind: "loading" }
  | { kind: "ready"; metadata: NoteMetadata; encodedKey: string }
  | { kind: "open"; note: NoteData }
  | { kind: "failed"; error: Failure }
  | { kind: "cleared"; burned: boolean };

function NotePage() {
  const { t, errorText, formatDate } = useI18n();
  const { id } = Route.useParams();
  const hash = useLocation({ select: (location) => location.hash });
  const [state, setState] = useState<State>({ kind: "loading" });
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const readyHeading = useRef<HTMLHeadingElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.kind === "ready") readyHeading.current?.focus();
  }, [state.kind]);
  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setState({ kind: "loading" });
    setPassphrase("");
    setError(null);
    setBusy(false);
    void (async () => {
      const result = await getNoteMetadata(id, controller.signal);
      if (controller.signal.aborted || current !== generation.current) return;
      if (!result.ok) {
        setState({ kind: "failed", error: result.error });
        return;
      }
      const encodedKey = window.location.hash.slice(1);
      try {
        await base64ToKey(encodedKey);
        if (!controller.signal.aborted && current === generation.current)
          setState({ kind: "ready", metadata: result.data, encodedKey });
      } catch {
        if (!controller.signal.aborted)
          setState({
            kind: "failed",
            error: {
              code: "INVALID_LINK",
              message:
                "This link's key is missing or invalid. Ask the sender for the complete link.",
            },
          });
      }
    })();
    return () => {
      controller.abort();
      generation.current = current + 1;
    };
  }, [id, hash, retry]);

  async function reveal(event: FormEvent) {
    event.preventDefault();
    if (state.kind !== "ready" || busy) return;
    const current = generation.current;
    setBusy(true);
    setError(null);
    const result = await readNote(
      id,
      state.encodedKey,
      state.metadata.hasPassphrase ? passphrase : undefined,
      state.metadata,
    );
    if (current !== generation.current) return;
    setBusy(false);
    setPassphrase("");
    if (result.ok) setState({ kind: "open", note: result.data });
    else if (
      [
        "WRONG_PASSPHRASE",
        "PASSPHRASE_REQUIRED",
        "NETWORK",
        "UNAVAILABLE",
        "CRYPTO_UNAVAILABLE",
      ].includes(result.error.code)
    )
      setError(result.error);
    else setState({ kind: "failed", error: result.error });
  }

  const clear = useCallback(
    () =>
      setState((previous) =>
        previous.kind === "open"
          ? { kind: "cleared", burned: previous.note.burnAfterRead }
          : previous,
      ),
    [],
  );
  const expire = useCallback(
    () =>
      setState({
        kind: "failed",
        error: { code: "EXPIRED", message: "This note expired and was automatically destroyed." },
      }),
    [],
  );

  return (
    <Shell>
      {state.kind === "loading" && (
        <p role="status" className="py-20 text-center font-mono text-sm text-muted-foreground">
          {t("checking")}
        </p>
      )}
      {state.kind === "failed" && (
        <NoteStatus
          title={errorText(state.error)}
          description={state.error.code === "DESTROYED" ? t("destroyedHelp") : undefined}
          {...(["NETWORK", "UNAVAILABLE"].includes(state.error.code) && {
            retry: () => setRetry((value) => value + 1),
          })}
        />
      )}
      {state.kind === "cleared" && (
        <NoteStatus
          title={state.burned ? t("errorDestroyed") : t("clearedTitle")}
          description={state.burned ? t("clearedBurned") : t("clearedTimed")}
        />
      )}
      {state.kind === "ready" && (
        <form
          onSubmit={reveal}
          className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-6 shadow-glow sm:p-10"
        >
          <div className="status-icon">
            <LockKeyhole className="size-8" aria-hidden="true" />
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-primary-glow">
            {t("privateHeading")}
          </p>
          <h1
            ref={readyHeading}
            tabIndex={-1}
            className="mt-2 text-2xl font-semibold tracking-tight"
          >
            {state.metadata.burnAfterRead ? t("onceTitle") : t("readyTitle")}
          </h1>
          {state.metadata.burnAfterRead && (
            <div className="mt-5 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-text">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>{t("readWarning")}</p>
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {t("availableUntil", { time: formatDate(new Date(state.metadata.expiresAt)) })}
          </p>
          {state.metadata.hasPassphrase && (
            <div className="mt-6">
              <label htmlFor="read-passphrase" className="block text-sm font-medium">
                {t("readPassphrase")}
              </label>
              <input
                id="read-passphrase"
                type="password"
                autoComplete="off"
                maxLength={1024}
                value={passphrase}
                disabled={busy}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder={t("enterPassphrase")}
                className="mt-3 w-full rounded-lg border bg-background p-3 font-mono text-sm"
                aria-describedby={
                  error ? "read-passphrase-help read-error" : "read-passphrase-help"
                }
                aria-invalid={!!error}
              />
              <p id="read-passphrase-help" className="mt-2 text-xs text-muted-foreground">
                {t("wrongPassphraseHelp")}
              </p>
            </div>
          )}
          {error && (
            <p
              id="read-error"
              ref={errorMessage}
              tabIndex={-1}
              role="alert"
              className="mt-4 text-sm leading-relaxed text-danger-text"
            >
              {errorText(error, "read")}
            </p>
          )}
          <Button
            type="submit"
            className="mt-7 h-12 w-full"
            disabled={busy || (state.metadata.hasPassphrase && !passphrase)}
            aria-busy={busy}
          >
            {state.metadata.burnAfterRead ? (
              <Flame aria-hidden="true" />
            ) : (
              <LockKeyhole aria-hidden="true" />
            )}
            {busy ? t("opening") : state.metadata.burnAfterRead ? t("readDestroy") : t("readNote")}
          </Button>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {state.metadata.burnAfterRead ? t("deliveryWarning") : t("readPrivacy")}
          </p>
        </form>
      )}
      {state.kind === "open" && <NoteReader note={state.note} onClear={clear} onExpire={expire} />}
    </Shell>
  );
}
