import { Link } from "@tanstack/react-router";
import { Skull } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

export function NoteStatus({
  title,
  description,
  retry,
}: {
  title: string;
  description?: string | undefined;
  retry?: () => void;
}) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-8 text-center sm:p-12">
      <div className="status-icon mx-auto">
        <Skull className="size-9 animate-ember" aria-hidden="true" />
      </div>
      <h1 ref={heading} tabIndex={-1} className="mt-6 text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      {description && <p className="mt-4 leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {retry && <Button onClick={retry}>{t("tryAgain")}</Button>}
        <Button asChild variant="outline">
          <Link to="/">{t("writeNew")}</Link>
        </Button>
      </div>
    </section>
  );
}
