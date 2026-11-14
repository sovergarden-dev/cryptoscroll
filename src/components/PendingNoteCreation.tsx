import { useEffect, useRef, useState } from "react";
import type { PendingCreation } from "@/lib/notes";
import type { Failure } from "../../shared/protocol";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";

export function PendingNoteCreation({
  pending,
  busy,
  error,
  onRetry,
  onDiscard,
}: {
  pending: PendingCreation;
  busy: boolean;
  error: Failure | null;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t, errorText, formatDate } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const [expired, setExpired] = useState(Date.now() > pending.retryUntil);
  useEffect(() => {
    heading.current?.focus();
    const timer = setTimeout(() => setExpired(true), Math.max(0, pending.retryUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [pending]);
  const retryable = !error || ["NETWORK", "UNAVAILABLE", "RATE_LIMITED"].includes(error.code);
  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-6 sm:p-10">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">
        {t("pendingTitle")}
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">{t("pendingHelp")}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {t("pendingLifetime", { time: formatDate(new Date(pending.retryUntil)) })}
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger-text">
          {errorText(error)}
        </p>
      )}
      <p role="status" className="mt-4 text-sm">
        {busy ? t("retryingCreation") : expired ? t("recoveryEnded") : ""}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={onRetry} disabled={busy || expired || !retryable} aria-busy={busy}>
          {t("retryCreation")}
        </Button>
        <Button
          variant="outline"
          onClick={onDiscard}
          disabled={busy}
          aria-describedby="discard-help"
        >
          {t("discardCreation")}
        </Button>
      </div>
      <p id="discard-help" className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {t("discardHelp")}
      </p>
    </section>
  );
}
