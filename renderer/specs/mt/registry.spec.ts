import { describe, expect, it } from "vitest";
import en from "@/mt/i18n/en";
import pl from "@/mt/i18n/pl";
import { findMtModule, mtModules } from "@/mt/registry";
import { getMessage } from "./helpers";

describe("mt module registry", () => {
  it("lists one module per planned hub tab", () => {
    expect(mtModules.map((module) => module.id)).toEqual([
      "economy",
      "guides",
      "widgets",
    ]);
  });

  it("has unique ids", () => {
    const ids = mtModules.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every module a component and an icon", () => {
    for (const module of mtModules) {
      expect(module.component, module.id).toBeTruthy();
      expect(module.icon, module.id).toMatch(/^fa-/);
    }
  });

  it("has a title in both fork locales", () => {
    for (const module of mtModules) {
      expect(typeof getMessage(en, module.titleKey), module.titleKey).toBe(
        "string",
      );
      expect(typeof getMessage(pl, module.titleKey), module.titleKey).toBe(
        "string",
      );
    }
  });

  it("falls back to the first module for unknown ids", () => {
    expect(findMtModule("economy").id).toBe("economy");
    expect(findMtModule("guides").id).toBe("guides");
    expect(findMtModule("does-not-exist")).toBe(mtModules[0]);
    expect(findMtModule(null)).toBe(mtModules[0]);
    expect(findMtModule(undefined)).toBe(mtModules[0]);
  });
});
