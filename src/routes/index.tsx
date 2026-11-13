import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Flame, Lock, Plus } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { encryptNote, generateLinkKey } from "@/lib/crypto";
import { destructMeta, newId, saveNote, type Destruct } from "@/lib/notes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CryptoScroll — Encrypted self-destructing notes" },
      { name: "description", content: "Write a secret note, encrypted in your browser. It burns after reading or after a set time." },
      { property: "og:title", content: "CryptoScroll — Encrypted self-destructing notes" },
      { property: "og:description", content: "Client-side AES-256 encrypted notes that self-destruct." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const OPTIONS: { value: Destruct; label: string }[] = [
  { value: "read", label: "After first read" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "72h", label: "72 hours" },
];

function Index() {
  const [text, setText] = useState("");
  const [destruct, setDestruct] = useState<Destruct>("read");
  const [usePass, setUsePass] = useState(false);
  const [pass, setPass] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    try {
      // 1. Random key, generated and kept in the browser.
      const { key, encoded } = await generateLinkKey();
      // 2. Encrypt locally; only ciphertext leaves this function.
      const payload = await encryptNote(text, key, usePass ? pass : undefined);
      const id = newId();
      saveNote({ id, createdAt: Date.now(), ...destructMeta(destruct), ...payload });
      // 3. Key goes ONLY in the hash fragment, never path or query.
      setLink(`${window.location.origin}/note/${id}#key=${encoded}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (link) {
    return (
      <Shell>
        <section className="rounded-lg border bg-card p-6 shadow-glow sm:p-8">
          <h1 className="text-2xl font-bold">Your scroll is sealed.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Share this link. Anyone holding it can open the note — {destruct === "read" ? "once" : `for ${destruct}`}.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link} onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 font-mono text-xs" />
            <Button onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</Button>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="rounded-lg bg-foreground p-4">
              <QRCodeSVG value={link} size={200} bgColor="transparent" fgColor="var(--background)" />
            </div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Note: in this version, notes are kept in this browser only, so the link opens on this device.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => { setLink(null); setText(""); setPass(""); }}>
            <Plus /> New note
          </Button>
        </section>
      </Shell>
    );
  }

  const canCreate = text.trim().length > 0 && (!usePass || pass.length > 0) && !busy;

  return (
    <Shell>
      <h1 className="text-3xl font-bold sm:text-4xl">Whisper something. <span className="text-primary">Then let it burn.</span></h1>
      <p className="mt-2 text-muted-foreground">Encrypted in your browser. Markdown supported.</p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12}
        placeholder={"# The secret\n\nType your note here…"}
        className="mt-6 w-full resize-y rounded-lg border bg-card p-4 font-mono text-sm leading-relaxed outline-none focus:border-primary focus:shadow-glow" />

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Flame className="size-4 text-primary" /> Self-destruct</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {OPTIONS.map((o) => (
            <button key={o.value} type="button" onClick={() => setDestruct(o.value)}
              className={cn("rounded-md border px-3 py-2 font-mono text-xs transition-colors",
                destruct === o.value ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground hover:border-primary/60")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={usePass} onChange={(e) => setUsePass(e.target.checked)} className="accent-primary" />
          <Lock className="size-4 text-primary" /> Protect with a passphrase
        </label>
        {usePass && (
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase"
            className="mt-2 w-full rounded-md border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
        )}
      </div>

      <Button size="lg" className="mt-8 w-full shadow-glow sm:w-auto" disabled={!canCreate} onClick={create}>
        {busy ? "Encrypting…" : "Create Note"}
      </Button>
    </Shell>
  );
}
