import { useEffect, useRef, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { revokeNote, type CreatedNote } from "@/lib/notes";
import { Button } from "./ui/button";
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
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorMessage = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

  function changeOpen(value: boolean) {
    if (busy) return;
    setOpen(value);
    setPassphrase("");
    setError("");
  }

  async function revoke(event: FormEvent) {
    event.preventDefault();
    if (busy || (note.hasPassphrase && !passphrase)) return;
    setBusy(true);
    setError("");
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
    else
      setError(
        result.error.code === "WRONG_PASSPHRASE"
          ? "Wrong passphrase. Nothing was revoked by this request."
          : result.error.message,
      );
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-danger-text">
          <Trash2 aria-hidden="true" /> Revoke note
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-11/12 rounded-2xl">
        <form onSubmit={revoke} className="space-y-5">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the encrypted server copy and stops this link from opening
              it. Anyone who already opened the note may have kept their own copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {note.hasPassphrase && (
            <div>
              <label htmlFor="revoke-passphrase" className="block text-sm font-medium">
                Passphrase to revoke
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
                Enter the original passphrase again. It was not saved after creation.
              </p>
            </div>
          )}
          {error && (
            <p ref={errorMessage} role="alert" tabIndex={-1} className="text-sm text-danger-text">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>
              Keep note
            </AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || (note.hasPassphrase && !passphrase)}
              aria-busy={busy}
            >
              {busy ? "Revoking…" : "Revoke note"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
