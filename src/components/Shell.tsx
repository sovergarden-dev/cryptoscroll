import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Shared page frame: wordmark header + centered column. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 sm:py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link to="/" className="font-mono text-lg font-bold tracking-tight">
          <span className="text-primary animate-flicker">▲</span> CryptoScroll
        </Link>
        <span className="font-mono text-xs text-muted-foreground">AES-256-GCM · zero-knowledge</span>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-12 font-mono text-xs text-muted-foreground">
        Keys live only in the link's #fragment. Nothing readable is ever stored.
      </footer>
    </div>
  );
}
