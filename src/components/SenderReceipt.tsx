import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";

export function SenderReceipt({ url }: { url: string }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const [status, setStatus] = useState<"receiptCopied" | "receiptCopyFailed" | null>(null);
  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("receiptCopied");
    } catch {
      setStatus("receiptCopyFailed");
    }
  }
  return (
    <div className="mt-5 border-t border-border pt-4">
      <Button
        type="button"
        variant="outline"
        aria-expanded={shown}
        aria-controls="sender-receipt"
        onClick={() => {
          setShown(!shown);
          setStatus(null);
        }}
      >
        {t("keepReceipt")}
      </Button>
      <div id="sender-receipt" hidden={!shown}>
        {shown && (
          <>
            <label htmlFor="receipt-url" className="mt-4 block text-sm font-medium">
              {t("receiptLink")}
            </label>
            <p id="receipt-help" className="mt-2 text-sm text-muted-foreground">
              {t("receiptHelp")}
            </p>
            <input
              id="receipt-url"
              aria-describedby="receipt-help"
              readOnly
              spellCheck={false}
              autoComplete="off"
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-3 w-full rounded-lg border bg-background p-3 font-mono text-xs"
            />
            <Button type="button" className="mt-3" variant="outline" onClick={copyReceipt}>
              {t("copyReceipt")}
            </Button>
            <p role="status" className="mt-2 text-sm">
              {status && t(status)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
