import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Flame, LockKeyhole, TriangleAlert } from "lucide-react";
import { Shell } from "@/components/Shell";
import { NoteStatus } from "@/components/NoteStatus";
import { NoteReader } from "@/components/NoteReader";
import { Button } from "@/components/ui/button";
import { base64ToKey } from "@/lib/crypto";
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
  const { id } = Route.useParams();
  const hash = useLocation({ select: (location) => location.hash });
  const [state, setState] = useState<State>({ kind: "loading" });
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setState({ kind: "loading" });
    setPassphrase("");
    setError("");
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
    setError("");
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
      setError(result.error.message);
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
          Checking the sealed note…
        </p>
      )}
      {state.kind === "failed" && (
        <NoteStatus
          title={state.error.message}
          description={
            state.error.code === "DESTROYED"
              ? "Its server copy is gone. Ask the sender for a new note if you still need it."
              : undefined
          }
          {...(["NETWORK", "UNAVAILABLE"].includes(state.error.code) && {
            retry: () => setRetry((value) => value + 1),
          })}
        />
      )}
      {state.kind === "cleared" && (
        <NoteStatus
          title={
            state.burned
              ? "This note has been permanently destroyed."
              : "The note has been cleared from this screen."
          }
          description={
            state.burned
              ? "The server copy is gone and the displayed copy has been cleared."
              : "The original link remains available until its expiry."
          }
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
            For your eyes only
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {state.metadata.burnAfterRead
              ? "This is a one-time note."
              : "A secret is waiting for you."}
          </h1>
          {state.metadata.burnAfterRead ? (
            <div className="mt-5 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-text">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>
                Once you read it, it will be permanently destroyed. Keep this page open until you
                are finished.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              This note can be opened until {new Date(state.metadata.expiresAt).toLocaleString()}.
            </p>
          )}
          {state.metadata.hasPassphrase && (
            <div className="mt-6">
              <label htmlFor="read-passphrase" className="block text-sm font-medium">
                This note is passphrase-protected
              </label>
              <input
                id="read-passphrase"
                type="password"
                autoComplete="off"
                maxLength={1024}
                autoFocus
                value={passphrase}
                disabled={busy}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Enter the passphrase"
                className="mt-3 w-full rounded-lg border bg-background p-3 font-mono text-sm"
                aria-describedby="read-passphrase-help"
                aria-invalid={!!error}
              />
              <p id="read-passphrase-help" className="mt-2 text-xs text-muted-foreground">
                A wrong passphrase will not destroy the note.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm leading-relaxed text-danger-text">
              {error}
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
            {busy
              ? "Verifying and opening…"
              : state.metadata.burnAfterRead
                ? "Read and Destroy"
                : "Read Note"}
          </Button>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {state.metadata.burnAfterRead
              ? "Opening removes the server copy before delivery. If your connection fails during that step, the note may be lost."
              : "Decryption happens in your browser. The server does not receive the key or passphrase."}
          </p>
        </form>
      )}
      {state.kind === "open" && <NoteReader note={state.note} onClear={clear} onExpire={expire} />}
    </Shell>
  );
}
