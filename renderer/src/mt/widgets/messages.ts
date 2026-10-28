// MT: pure message lookup shared by the overlay translator and its tests.
import { mtMessages } from "@/mt/i18n";

export type MtLocale = keyof typeof mtMessages;
type Params = Record<string, string | number>;

function lookup(locale: MtLocale, key: string): string | null {
  let node: unknown = mtMessages[locale];
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : null;
}

/** Pure lookup with `{name}` interpolation; missing keys degrade to the key. */
export function translateMt(
  locale: MtLocale,
  key: string,
  params?: Params,
): string {
  const message = lookup(locale, key);
  if (message === null) return key;
  if (!params) return message;

  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
