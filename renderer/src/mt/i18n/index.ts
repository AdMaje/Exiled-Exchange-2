import { createI18n } from "vue-i18n";
import en from "./en";
import pl from "./pl";

export const mtMessages = { en, pl };

/**
 * Fork-local language resolution: an explicit `en`/`pl` wins, `auto` follows the
 * browser/OS language but only ever resolves to a language we ship.
 */
export function resolveMtLocale(
  language: string,
  browserLanguage = "en",
): "en" | "pl" {
  if (language === "en" || language === "pl") return language;

  return browserLanguage.toLowerCase().startsWith("pl") ? "pl" : "en";
}

let applyLocale: ((language: string) => void) | null = null;

export function createMtI18n(language: string) {
  const detected = typeof navigator === "undefined" ? "en" : navigator.language;
  const i18n = createI18n({
    legacy: false,
    locale: resolveMtLocale(language, detected),
    fallbackLocale: "en",
    messages: mtMessages,
    missingWarn: import.meta.env.DEV,
    fallbackWarn: import.meta.env.DEV,
  });

  applyLocale = (next) => {
    i18n.global.locale.value = resolveMtLocale(next, detected);
  };

  return i18n;
}

export function setMtLanguage(language: string): void {
  applyLocale?.(language);
}
