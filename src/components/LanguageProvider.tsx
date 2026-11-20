import { useEffect, useState, type ReactNode } from "react";
import { useHydrated } from "@tanstack/react-router";
import { preferredLanguage } from "@/lib/language";
import { LanguageContext, type Language } from "@/lib/i18n";

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage: Language;
}) {
  const [choice, setLanguage] = useState<Language | null>(null);
  const hydrated = useHydrated();
  const language =
    choice ??
    (hydrated
      ? preferredLanguage(navigator.languages.join(",") || navigator.language)
      : initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
