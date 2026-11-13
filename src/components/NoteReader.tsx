import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { EyeOff, Flame, Clock } from "lucide-react";
import { Button } from "./ui/button";
import type { NoteData } from "@/lib/notes";

export function NoteReader({
  note,
  onClear,
  onExpire,
}: {
  note: NoteData;
  onClear: () => void;
  onExpire: () => void;
}) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function checkExpiry() {
      const remaining = note.expiresAt.getTime() - Date.now();
      if (remaining <= 0) onExpire();
      else timer = setTimeout(checkExpiry, Math.min(remaining, 60_000));
    }
    if (!note.burnAfterRead) checkExpiry();
    return () => clearTimeout(timer);
  }, [note, onExpire]);

  useEffect(() => {
    const clearOnRestore = (event: PageTransitionEvent) => {
      if (event.persisted) onClear();
    };
    window.addEventListener("pagehide", onClear);
    window.addEventListener("pageshow", clearOnRestore);
    return () => {
      window.removeEventListener("pagehide", onClear);
      window.removeEventListener("pageshow", clearOnRestore);
    };
  }, [onClear]);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
        {note.burnAfterRead ? (
          <Flame className="size-5 shrink-0 text-warning-text" aria-hidden="true" />
        ) : (
          <Clock className="size-5 shrink-0 text-primary-glow" aria-hidden="true" />
        )}
        <div>
          <h1 className="font-semibold">
            {note.burnAfterRead ? "The server copy has been destroyed." : "Your note is open."}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {note.burnAfterRead
              ? "This is the only copy shown by this service. Keep this page open until you are finished."
              : `Available until ${note.expiresAt.toLocaleString()}.`}
          </p>
        </div>
      </div>
      <article
        aria-label="Decrypted note"
        className="prose-note min-w-0 rounded-2xl border bg-card p-6 sm:p-10"
      >
        <ReactMarkdown
          skipHtml
          components={{
            img: ({ alt }) => (
              <span className="text-muted-foreground">[Image omitted{alt ? `: ${alt}` : ""}]</span>
            ),
            a: ({ href, children }) =>
              href && /^https?:\/\//i.test(href) ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              ),
          }}
        >
          {note.content}
        </ReactMarkdown>
      </article>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Decrypted here, in your browser. Images are not loaded.
        </p>
        <Button variant="outline" onClick={onClear}>
          <EyeOff aria-hidden="true" /> Clear this screen
        </Button>
      </div>
    </section>
  );
}
