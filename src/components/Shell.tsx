import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Github, ShieldCheck } from "lucide-react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col px-5 sm:px-8">
      <button
        type="button"
        onClick={() => document.getElementById("main-content")?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3"
      >
        Skip to content
      </button>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 py-6">
        <Link to="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-xl"
          >
            <span className="animate-ember">🔥</span>
          </span>
          CryptoScroll
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-5 text-xs text-muted-foreground"
        >
          <span className="hidden items-center gap-2 sm:flex">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" /> Encrypted in your
            browser
          </span>
          <a
            className="flex items-center gap-2 transition-colors hover:text-foreground"
            href="https://github.com/sovergarden-dev/cryptoscroll"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="size-4" aria-hidden="true" /> Source
          </a>
        </nav>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col justify-center py-10 sm:py-14"
      >
        {children}
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 py-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> No account. No saved drafts.
        </span>
        <a
          href="https://github.com/sovergarden-dev/cryptoscroll#security-model"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Security model & limits ↗
        </a>
      </footer>
    </div>
  );
}
