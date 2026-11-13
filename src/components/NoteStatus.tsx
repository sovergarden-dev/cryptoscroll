import { Link } from "@tanstack/react-router";
import { Skull } from "lucide-react";
import { Button } from "./ui/button";

export function NoteStatus({
  title,
  description,
  retry,
}: {
  title: string;
  description?: string | undefined;
  retry?: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-8 text-center sm:p-12">
      <div className="status-icon mx-auto">
        <Skull className="size-9 animate-ember" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-4 leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {retry && <Button onClick={retry}>Try again</Button>}
        <Button asChild variant="outline">
          <Link to="/">Write a new note</Link>
        </Button>
      </div>
    </section>
  );
}
