import { useI18n } from "@/lib/i18n";

export interface ReceiptIdentity {
  id: string;
  expiresAt: Date;
  burnAfterRead: boolean;
}

export function ReceiptDetails({ id, expiresAt, burnAfterRead }: ReceiptIdentity) {
  const { t, locale } = useI18n();
  const suffix = id.slice(-8).toUpperCase();
  const expiry = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "shortOffset",
  }).format(expiresAt);
  return (
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="text-muted-foreground">{t("noteReference")}</dt>
        <dd className="font-mono text-foreground">
          <bdi dir="ltr">
            {suffix.slice(0, 4)}-{suffix.slice(4)}
          </bdi>
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">
          {t(burnAfterRead ? "receiptUnreadUntil" : "expires")}
        </dt>
        <dd className="text-foreground">
          <time dateTime={expiresAt.toISOString()}>{expiry}</time>
        </dd>
      </div>
    </dl>
  );
}
