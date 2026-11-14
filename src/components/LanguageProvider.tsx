import { useEffect, useState, type ReactNode } from "react";
import { LanguageContext, type Language } from "@/lib/i18n";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
