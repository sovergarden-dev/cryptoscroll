import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Lock, Skull } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { decryptNote, importLinkKey } from "@/lib/crypto";
import { destroyNote, isExpired, loadNote, sweepExpired, type StoredNote } from "@/lib/notes";

export const Route = createFileRoute("/note/$id")({
  head: () => ({
    meta: [
      { title: "A sealed note — CryptoScroll" },
      { name: "description", content: "Someone sent you an encrypted, self-destructing note." },
      { property: "og:title", content: "A sealed note — CryptoScroll" },
      { property: "og:description", content: "Someone sent you an encrypted, self-destructing note." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotePage,
});

type State =
  | { kind: "loading" }
  | { kind: "gone" }
  | { kind: "expired" }
  | { kind: "badkey" }
  | { kind: "needpass"; note: StoredNote; key: CryptoKey; error?: boolean }
  | { kind: "open"; text: string; readOnce: boolean; expiresAt: number | null };

function NotePage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [pass, setPass] = useState("");

  /** Decrypt; on success burn read-once notes from storage immediately. */
  async function reveal(note: StoredNote, key: CryptoKey, passphrase?: string) {
    const text = await decryptNote(note, key, passphrase);
    if (note.readOnce) destroyNote(note.id);
    setState({ kind: "open", text, readOnce: note.readOnce, expiresAt: note.expiresAt });
  }

  // Runs client-side only: the hash and localStorage don't exist on the server.
  useEffect(() => {
    (async () => {
      const note = loadNote(id);
      if (!note) return setState({ kind: "gone" });
      if (isExpired(note)) {
        destroyNote(id);
        sweepExpired();
        return setState({ kind: "expired" });
      }
      const encoded = new URLSearchParams(window.location.hash.slice(1)).get("key");
      let key: CryptoKey;
      try {
        if (!encoded) throw new Error();
        key = await importLinkKey(encoded);
      } catch {
        return setState({ kind: "badkey" });
      }
      if (note.salt) return setState({ kind: "needpass", note, key });
      try { await reveal(note, key); } catch { setState({ kind: "badkey" }); }
    })();
  }, [id]);

  async function submitPass(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "needpass") return;
    try { await reveal(state.note, state.key, pass); }
    catch { setState({ ...state, error: true }); }
  }

  return (
    <Shell>
      {state.kind === "loading" && <p className="font-mono text-muted-foreground">Unsealing…</p>}

      {(state.kind === "gone" || state.kind === "expired") && (
        <Dead title={state.kind === "expired" ? "This note has expired and been destroyed." : "This note doesn't exist or has already been destroyed."} />
      )}

      {state.kind === "badkey" && (
        <Dead title="This link's key is missing or wrong." sub="The note can't be decrypted without the full link." />
      )}

      {state.kind === "needpass" && (
        <form onSubmit={submitPass} className="rounded-lg border bg-card p-6 shadow-glow">
          <div className="flex items-center gap-2 font-semibold"><Lock className="size-4 text-primary" /> This note is passphrase-protected</div>
          <input type="password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase"
            className="mt-4 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
          {state.error && <p className="mt-2 text-sm text-destructive">Wrong passphrase.</p>}
          <Button type="submit" className="mt-4" disabled={!pass}>Unlock</Button>
        </form>
      )}

      {state.kind === "open" && (
        <>
          {state.readOnce ? (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              This note will be destroyed after you close this page.
            </div>
          ) : state.expiresAt && (
            <p className="mb-4 font-mono text-xs text-muted-foreground">
              Self-destructs {new Date(state.expiresAt).toLocaleString()}
            </p>
          )}
          <article className="prose-note rounded-lg border bg-card p-6 text-sm shadow-glow sm:p-8 break-words">
            <ReactMarkdown>{state.text}</ReactMarkdown>
          </article>
        </>
      )}
    </Shell>
  );
}

function Dead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="py-16 text-center">
      <Skull className="mx-auto size-12 text-primary animate-flicker" />
      <h1 className="mt-4 text-xl font-bold">{title}</h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
      <Button asChild variant="outline" className="mt-6"><Link to="/">Write a new note</Link></Button>
    </div>
  );
}
