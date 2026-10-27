import { describe, expect, it } from "vitest";
import en from "@/mt/i18n/en";
import pl from "@/mt/i18n/pl";
import { mtMessages, resolveMtLocale } from "@/mt/i18n";
import { flattenMessages } from "./helpers";

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe("mt i18n", () => {
  const enMessages = flattenMessages(en);
  const plMessages = flattenMessages(pl);

  it("ships both fork locales", () => {
    expect(Object.keys(mtMessages).sort()).toEqual(["en", "pl"]);
  });

  it("has the same keys in EN and PL", () => {
    expect([...plMessages.keys()].sort()).toEqual([...enMessages.keys()].sort());
  });

  it("has no empty strings", () => {
    for (const [key, value] of [...enMessages, ...plMessages]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("keeps interpolation placeholders in sync", () => {
    for (const [key, value] of enMessages) {
      expect(placeholders(plMessages.get(key) ?? ""), key).toEqual(
        placeholders(value),
      );
    }
  });

  it("resolves auto and explicit languages", () => {
    expect(resolveMtLocale("auto", "pl-PL")).toBe("pl");
    expect(resolveMtLocale("auto", "en-US")).toBe("en");
    expect(resolveMtLocale("auto")).toBe("en");
    expect(resolveMtLocale("en", "pl-PL")).toBe("en");
    expect(resolveMtLocale("pl", "en-US")).toBe("pl");
    expect(resolveMtLocale("fr", "en-US")).toBe("en");
  });
});
