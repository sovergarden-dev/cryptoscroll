import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { NoteStatus } from "@/components/NoteStatus";
import { ReceiptDetails } from "@/components/ReceiptDetails";
import { RevokeNoteDialog, type RevocationOutcome } from "@/components/RevokeNoteDialog";
import { deriveRevocationToken } from "@/lib/crypto";
import { getNoteMetadata, revokeNote, type NoteMetadata } from "@/lib/notes";
import { useI18n } from "@/lib/i18n";
import { NOTE_ID, type Failure } from "../../shared/protocol";

export const Route = createFileRoute("/revoke/$id")({
  head: () => ({
    meta: [
      { title: "Revocation receipt | CryptoScroll" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { id } = Route.useParams();
  const hash = useLocation({ select: (location) => location.hash });
  return (
    <Shell>
      <Receipt key={id + "#" + hash} id={id} />
    </Shell>
  );
}

type ReceiptState =
  | { kind: "loading" }
  | { kind: "ready"; secret: string; metadata: NoteMetadata }
  | { kind: "error"; error: Failure }
  | { kind: "retired"; outcome: RevocationOutcome };

function Receipt({ id }: { id: string }) {
  const { t, errorText } = useI18n();
  const [state, setState] = useState<ReceiptState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.kind === "ready") title.current?.focus();
  }, [state.kind]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    void (async () => {
      const secret = window.location.hash.slice(1);
      try {
        if (!NOTE_ID.test(id)) throw new Error("Invalid note ID");
        await deriveRevocationToken(secret);
      } catch {
        if (!controller.signal.aborted)
          setState({ kind: "error", error: { code: "INVALID_LINK", message: "Invalid receipt." } });
        return;
      }
      if (controller.signal.aborted) return;
      const result = await getNoteMetadata(id, controller.signal);
      if (controller.signal.aborted) return;
      setState(
        result.ok
          ? { kind: "ready", secret, metadata: result.data }
          : { kind: "error", error: result.error },
      );
    })();
    return () => controller.abort();
  }, [id, attempt]);

  if (state.kind === "loading")
    return (
      <p role="status" className="py-20 text-center text-sm">
        {t("checking")}
      </p>
    );
  if (state.kind === "error")
    return (
      <NoteStatus
        title={state.error.code === "INVALID_LINK" ? t("invalidReceipt") : errorText(state.error)}
        {...(["NETWORK", "UNAVAILABLE"].includes(state.error.code) && {
          retry: () => setAttempt((value) => value + 1),
        })}
      />
    );
  if (state.kind === "retired")
    return (
      <NoteStatus
        title={t(state.outcome === "revoked" ? "revoked" : "noLongerAvailable")}
        description={t("retiredHelp")}
      />
    );
  const identity = {
    id,
    expiresAt: new Date(state.metadata.expiresAt),
    burnAfterRead: state.metadata.burnAfterRead,
  };
  return (
    <section className="mx-auto w-full max-w-xl space-y-5 rounded-2xl border bg-card p-6 sm:p-10">
      <h1 ref={title} tabIndex={-1} className="text-2xl font-semibold">
        {t("receiptTitle")}
      </h1>
      <p className="my-5 text-sm text-muted-foreground">{t("receiptPurpose")}</p>
      <ReceiptDetails {...identity} />
      <RevokeNoteDialog
        identity={identity}
        hasPassphrase={state.metadata.hasPassphrase}
        onConfirm={(passphrase) =>
          revokeNote(id, state.secret, passphrase, "receipt", state.metadata)
        }
        onRetired={(outcome) => setState({ kind: "retired", outcome })}
      />
    </section>
  );
}
