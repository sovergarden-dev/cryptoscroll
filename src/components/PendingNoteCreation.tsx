import { useEffect, useRef } from "react";
import type { Failure } from "../../shared/protocol";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";

export function PendingNoteCreation({
  retryUntil,
  cooldownText,
  busy,
  error,
  onRetry,
  onDiscard,
}: {
  retryUntil: number | null;
  cooldownText: string | null;
  busy: boolean;
  error: Failure | null;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t, errorText, formatDate } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const expired = retryUntil === null;
  useEffect(() => {
    heading.current?.focus();
  }, [expired]);
  const retryable = !error || ["NETWORK", "UNAVAILABLE", "RATE_LIMITED"].includes(error.code);
  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-6 sm:p-10">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">
        {t(expired ? "recoveryEndedTitle" : "pendingTitle")}
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {t(expired ? "recoveryEnded" : "pendingHelp")}
      </p>
      {retryUntil !== null && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("pendingLifetime", { time: formatDate(new Date(retryUntil)) })}
        </p>
      )}
      {!expired && error && (
        <p role="alert" className="mt-4 text-sm text-danger-text">
          {errorText(error)}
        </p>
      )}
      <p role="status" className="mt-4 text-sm">
        {busy ? t("retryingCreation") : cooldownText}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {!expired && (
          <Button
            onClick={onRetry}
            disabled={busy || !!cooldownText || !retryable}
            aria-busy={busy}
          >
            {t("retryCreation")}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onDiscard}
          disabled={busy}
          aria-describedby={expired ? undefined : "discard-help"}
        >
          {t(expired ? "writeNew" : "discardCreation")}
        </Button>
      </div>
      {!expired && (
        <p id="discard-help" className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {t("discardHelp")}
        </p>
      )}
    </section>
  );
}
