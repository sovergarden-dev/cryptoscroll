import { useEffect, useRef, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { revokeNote, type CreatedNote } from "@/lib/notes";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import type { Failure } from "../../shared/protocol";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

export type RevocationOutcome = "revoked" | "unavailable";

export function RevokeNoteDialog({
  note,
  onRetired,
}: {
  note: CreatedNote;
  onRetired: (outcome: RevocationOutcome) => void;
}) {
  const { t, errorText } = useI18n();
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

  function changeOpen(value: boolean) {
    if (busy) return;
    setOpen(value);
    setPassphrase("");
    setError(null);
  }

  async function revoke(event: FormEvent) {
    event.preventDefault();
    if (busy || (note.hasPassphrase && !passphrase)) return;
    setBusy(true);
    setError(null);
    const url = new URL(note.url);
    const result = await revokeNote(
      url.pathname.split("/").at(-1)!,
      url.hash.slice(1),
      note.hasPassphrase ? passphrase : undefined,
    );
    setBusy(false);
    setPassphrase("");
    if (result.ok) onRetired("revoked");
    else if (["NOT_FOUND", "DESTROYED", "EXPIRED"].includes(result.error.code))
      onRetired("unavailable");
    else setError(result.error);
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-danger-text">
          <Trash2 aria-hidden="true" /> {t("revoke")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-11/12 rounded-2xl">
        <form onSubmit={revoke} className="space-y-5">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("revokeHelp")}</AlertDialogDescription>
          </AlertDialogHeader>
          {note.hasPassphrase && (
            <div>
              <label htmlFor="revoke-passphrase" className="block text-sm font-medium">
                {t("revokePassphrase")}
              </label>
              <input
                id="revoke-passphrase"
                type="password"
                autoComplete="off"
                maxLength={1024}
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                disabled={busy}
                aria-describedby="revoke-passphrase-help"
                aria-invalid={!!error}
                className="mt-2 w-full rounded-lg border bg-background p-3 font-mono text-sm"
              />
              <p id="revoke-passphrase-help" className="mt-2 text-xs text-muted-foreground">
                {t("revokePassphraseHelp")}
              </p>
            </div>
          )}
          {error && (
            <p ref={errorMessage} role="alert" tabIndex={-1} className="text-sm text-danger-text">
              {errorText(error, "revoke")}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>
              {t("keepNote")}
            </AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || (note.hasPassphrase && !passphrase)}
              aria-busy={busy}
            >
              {t(busy ? "revoking" : "revoke")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
