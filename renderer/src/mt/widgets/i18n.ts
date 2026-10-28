// MT: fork-local translator for overlay widgets and their settings panels.
// The hub gets the same strings through vue-i18n; the overlay only needs a tiny
// lookup so the upstream locale files never have to be touched.
import { computed } from "vue";
import { resolveMtLocale } from "@/mt/i18n";
import { AppConfig } from "@/web/Config";
import { translateMt, type MtLocale } from "./messages";

type Params = Record<string, string | number>;

export function useMtOverlayI18n() {
  const locale = computed<MtLocale>(() => {
    let language = "auto";
    try {
      language = AppConfig().mt?.language ?? "auto";
    } catch {
      // The overlay config is not initialized yet; fall back to detection.
    }
    const detected =
      typeof navigator === "undefined" ? "en" : navigator.language;
    return resolveMtLocale(language, detected);
  });

  function t(key: string, params?: Params): string {
    return translateMt(locale.value, key, params);
  }

  return { t, locale };
}
