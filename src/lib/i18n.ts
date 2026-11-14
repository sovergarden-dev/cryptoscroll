import { createContext, useContext } from "react";
import { en, vi, type MessageKey } from "./messages";
import type { ErrorCode, Failure } from "../../shared/protocol";

export type Language = "en" | "vi";
export const LanguageContext = createContext<{
  language: Language;
  setLanguage: (value: Language) => void;
} | null>(null);
const errorKeys: Record<ErrorCode, MessageKey> = {
  NOT_FOUND: "errorNotFound",
  DESTROYED: "errorDestroyed",
  EXPIRED: "errorExpired",
  INVALID_LINK: "errorInvalidLink",
  PASSPHRASE_REQUIRED: "errorPassphraseRequired",
  WRONG_PASSPHRASE: "errorWrongPassphrase",
  INVALID_REQUEST: "errorInvalidRequest",
  TOO_LARGE: "errorTooLarge",
  RATE_LIMITED: "errorRateLimited",
  UNAVAILABLE: "errorUnavailable",
  NETWORK: "errorNetwork",
  DECRYPT_FAILED: "errorDecrypt",
  CRYPTO_UNAVAILABLE: "errorCrypto",
  CREATION_CONFLICT: "errorConflict",
  CREATION_EXPIRED: "errorRecoveryExpired",
};
export const expiryKeys = {
  "read-once": "expiryOnce",
  "1h": "expiry1h",
  "24h": "expiry24h",
  "72h": "expiry72h",
  "7d": "expiry7d",
  "30d": "expiry30d",
} as const;
export const durationKeys = {
  "1h": "duration1h",
  "24h": "duration24h",
  "72h": "duration72h",
  "7d": "duration7d",
  "30d": "duration30d",
} as const;

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is required.");
  const { language } = context;
  const locale = language === "vi" ? "vi-VN" : "en-US";
  function t(key: MessageKey, values: Record<string, string | number> = {}): string {
    return (language === "vi" ? vi[key] : en[key]).replace(/\{(\w+)\}/g, (match, name: string) =>
      String(values[name] ?? match),
    );
  }
  function errorText(error: Failure, operation?: "read" | "revoke") {
    if (operation === "revoke" && error.code === "WRONG_PASSPHRASE") return t("wrongRevoke");
    const uncertain = error.code === "NETWORK" || error.code === "UNAVAILABLE";
    return (
      t(errorKeys[error.code]) +
      (uncertain && operation
        ? ` ${t(operation === "read" ? "uncertainRead" : "uncertainRevoke")}`
        : "")
    );
  }
  return {
    ...context,
    t,
    errorText,
    locale,
    formatDate: (value: Date) => value.toLocaleString(locale),
  };
}
