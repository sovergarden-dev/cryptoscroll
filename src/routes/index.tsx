import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown, Flame, LockKeyhole, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/Shell";
import { NoteSuccess } from "@/components/NoteSuccess";
import { Button } from "@/components/ui/button";
import { createNote, getNoteCount, type CreatedNote, type ExpiryOption } from "@/lib/notes";
import { EXPIRY_OPTIONS, MAX_NOTE_BYTES } from "../../shared/protocol";

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
  const [content, setContent] = useState("");
  const [expiry, setExpiry] = useState<ExpiryOption>("read-once");
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [created, setCreated] = useState<CreatedNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [countUnavailable, setCountUnavailable] = useState(false);
  const bytes = new TextEncoder().encode(content).length;
  const disabled = !ready || busy;
  const canCreate =
    content.trim().length > 0 &&
    bytes <= MAX_NOTE_BYTES &&
    (!usePassphrase || passphrase.trim().length > 0) &&
    !disabled;

  useEffect(() => {
    setReady(true);
    const controller = new AbortController();
    void getNoteCount(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) setCount(result.data.count);
      else setCountUnavailable(true);
    });
    return () => controller.abort();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setError("");
    const result = await createNote({ content, expiry, ...(usePassphrase && { passphrase }) });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setContent("");
    setPassphrase("");
    setCreated(result.data);
  }

  return (
    <Shell>
      {created ? (
        <NoteSuccess
          note={created}
          onCreateAnother={() => {
            setCreated(null);
            setUsePassphrase(false);
            setExpiry("read-once");
          }}
        />
      ) : (
        <div className="grid items-center gap-10 lg:grid-cols-5 lg:gap-16">
          <section className="lg:col-span-2" aria-labelledby="hero-title">
            <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary-glow">
              <span className="size-1.5 rounded-full bg-primary" /> A digital dead drop
            </p>
            <h1
              id="hero-title"
              className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
            >
              Write once.
              <br />
              Read once.
              <br />
              <span className="text-primary-glow">Vanish.</span>
            </h1>
            <p className="mt-6 max-w-sm leading-relaxed text-muted-foreground">
              Some words aren't meant to stay. Seal a secret, share the link, and let the server
              copy disappear after one read.
            </p>
            <div className="mt-7 flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              <span>Your words are encrypted before they leave this browser.</span>
            </div>
            <details className="mt-6 text-sm text-muted-foreground">
              <summary className="w-fit cursor-pointer underline decoration-border underline-offset-4 hover:text-foreground">
                How does it stay private?
              </summary>
              <p className="mt-3 max-w-sm leading-relaxed">
                The key travels in the link's fragment; the server stores encrypted bytes. Add a
                separate passphrase for another layer. A recipient can still save or photograph the
                note.
              </p>
            </details>
            <div className="mt-9 border-t border-border/60 pt-5 font-mono text-xs text-muted-foreground">
              {count !== null ? (
                <>
                  <span className="text-lg font-medium text-foreground">
                    {count.toLocaleString()}
                  </span>{" "}
                  notes sealed
                </>
              ) : countUnavailable ? (
                "Note count unavailable"
              ) : (
                "Loading note count…"
              )}
            </div>
          </section>

          <form
            onSubmit={create}
            className="overflow-hidden rounded-2xl border bg-card shadow-glow lg:col-span-3"
            aria-label="Create an encrypted note"
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-6">
              <label htmlFor="note-content" className="text-sm font-semibold">
                Your secret note
              </label>
              <span className="font-mono text-xs text-muted-foreground">Markdown supported</span>
            </div>
            <div className="p-5 sm:p-6">
              <textarea
                id="note-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={10}
                maxLength={MAX_NOTE_BYTES}
                spellCheck={false}
                autoComplete="off"
                disabled={disabled}
                placeholder={"# For your eyes only\n\nWrite something worth keeping secret…"}
                aria-describedby="note-size"
                aria-invalid={bytes > MAX_NOTE_BYTES}
                className="w-full resize-y rounded-lg border border-transparent bg-background/50 p-4 font-mono text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:border-primary"
              />
              <p
                id="note-size"
                className={`mt-2 text-right font-mono text-xs ${bytes > MAX_NOTE_BYTES ? "text-danger-text" : "text-muted-foreground"}`}
              >
                {bytes.toLocaleString()} / {MAX_NOTE_BYTES.toLocaleString()} bytes
              </p>
              <fieldset disabled={disabled} className="mt-6">
                <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Flame className="size-4 text-primary-glow" aria-hidden="true" /> Self-destruct
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
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {expiry === "read-once"
                    ? "One authorized opening. Unopened notes expire after 30 days."
                    : "Can be opened again until the selected deadline."}
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
                    <LockKeyhole className="size-4 text-primary-glow" aria-hidden="true" /> Add a
                    passphrase{" "}
                    <span className="text-xs font-normal text-muted-foreground">Optional</span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 transition-transform ${usePassphrase ? "rotate-180" : ""}`}
                  />
                </button>
                {usePassphrase && (
                  <div id="passphrase-field" className="mt-4">
                    <label htmlFor="create-passphrase" className="sr-only">
                      Passphrase
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
                      placeholder="A long, memorable secret"
                      aria-describedby="passphrase-help"
                    />
                    <p id="passphrase-help" className="mt-2 text-xs text-muted-foreground">
                      Share it separately from the link. Spaces and capitalization matter.
                    </p>
                  </div>
                )}
              </div>
              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-danger-text"
                >
                  {error}
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
                {!ready
                  ? "Preparing secure editor…"
                  : busy
                    ? "Encrypting and sealing…"
                    : "Create Note"}
                {!busy && <ArrowRight aria-hidden="true" className="ml-auto" />}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Encrypted locally with AES-256-GCM
              </p>
            </div>
          </form>
        </div>
      )}
    </Shell>
  );
}
