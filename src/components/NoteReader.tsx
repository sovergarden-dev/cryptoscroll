import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { EyeOff, Flame, Clock } from "lucide-react";
import { Button } from "./ui/button";
import type { NoteData } from "@/lib/notes";
import { useI18n } from "@/lib/i18n";

export function NoteReader({
  note,
  onClear,
  onExpire,
}: {
  note: NoteData;
  onClear: () => void;
  onExpire: () => void;
}) {
  const { t, formatDate } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
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
          <h1 ref={heading} tabIndex={-1} className="font-semibold">
            {t(note.burnAfterRead ? "serverDestroyed" : "noteOpen")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {note.burnAfterRead
              ? t("onlyCopy")
              : t("availableUntil", { time: formatDate(note.expiresAt) })}
          </p>
        </div>
      </div>
      <article
        aria-label={t("decryptedNote")}
        className="prose-note min-w-0 rounded-2xl border bg-card p-6 sm:p-10"
      >
        <ReactMarkdown
          skipHtml
          components={{
            img: ({ alt }) => (
              <span className="text-muted-foreground">
                [{t("imageOmitted")}
                {alt ? `: ${alt}` : ""}]
              </span>
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
        <p className="text-xs text-muted-foreground">{t("readerPrivacy")}</p>
        <Button variant="outline" onClick={onClear}>
          <EyeOff aria-hidden="true" /> {t("clearScreen")}
        </Button>
      </div>
    </section>
  );
}
