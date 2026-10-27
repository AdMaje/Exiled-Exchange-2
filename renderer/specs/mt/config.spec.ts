import { describe, expect, it } from "vitest";
import {
  MT_CONFIG_VERSION,
  defaultMtConfig,
  mergeMtConfig,
  sanitizeMtConfig,
} from "@ipc/mt";

describe("mt config", () => {
  it("starts with fork defaults and no hotkey", () => {
    const mt = defaultMtConfig();

    expect(mt.configVersion).toBe(MT_CONFIG_VERSION);
    expect(mt.hubHotkey).toBeNull();
    expect(mt.language).toBe("auto");
    expect(mt.hub).toEqual({ width: 1100, height: 760, x: null, y: null });
    expect(mt.economy.source).toBe("poe2scout");
    expect(mt.guides.progress).toEqual({});
  });

  it("rejects payloads that are not plain objects", () => {
    expect(sanitizeMtConfig(null)).toBeNull();
    expect(sanitizeMtConfig([])).toBeNull();
    expect(sanitizeMtConfig("mt")).toBeNull();
    expect(sanitizeMtConfig(42)).toBeNull();
  });

  it("merges a partial patch without resetting sibling settings", () => {
    const base = mergeMtConfig(defaultMtConfig(), {
      hubHotkey: "Ctrl + Alt + H",
      language: "pl",
    });
    const next = mergeMtConfig(base, { language: "en" });

    expect(next.hubHotkey).toBe("Ctrl + Alt + H");
    expect(next.language).toBe("en");
  });

  it("clears the hotkey on an explicit null", () => {
    const base = mergeMtConfig(defaultMtConfig(), { hubHotkey: "Ctrl + Alt + H" });
    const next = mergeMtConfig(base, { hubHotkey: null });

    expect(next.hubHotkey).toBeNull();
  });

  it("normalizes hotkey spelling and rejects modifier-only chords", () => {
    expect(
      mergeMtConfig(defaultMtConfig(), { hubHotkey: "ctrl + alt + h" }).hubHotkey,
    ).toBe("Ctrl + Alt + H");
    expect(
      mergeMtConfig(defaultMtConfig(), { hubHotkey: "Alt + Shift + F5" })
        .hubHotkey,
    ).toBe("Shift + Alt + F5");
    expect(
      mergeMtConfig(defaultMtConfig(), { hubHotkey: "Ctrl + Alt" }).hubHotkey,
    ).toBeNull();
  });

  it("drops unknown keys and clamps invalid values", () => {
    const mt = mergeMtConfig(defaultMtConfig(), {
      language: "fr",
      bogus: 1,
      hub: { width: "wide", height: 99999, x: 1e9, y: null },
    });

    expect(mt.language).toBe("auto");
    expect(mt.hub.width).toBe(1100);
    expect(mt.hub.height).toBe(4096);
    expect(mt.hub.x).toBe(20000);
    expect(mt.hub.y).toBeNull();
    expect((mt as unknown as Record<string, unknown>).bogus).toBeUndefined();
  });

  it("sanitizes economy favorites", () => {
    const mt = mergeMtConfig(defaultMtConfig(), {
      economy: {
        favorites: [
          { apiId: 1, name: "Divine Orb" },
          { apiId: -1, name: "Invalid" },
          { apiId: 2, name: "   " },
          "nope",
        ],
        lastCategory: "fragments",
      },
    });

    expect(mt.economy.favorites).toEqual([{ apiId: 1, name: "Divine Orb" }]);
    expect(mt.economy.lastCategory).toBe("fragments");
  });

  it("keeps guide progress numeric only", () => {
    const mt = mergeMtConfig(defaultMtConfig(), {
      guides: {
        progress: { "act-1": 3, broken: "3", "": 1 },
        lastOpened: "act-1",
      },
    });

    expect(mt.guides.progress).toEqual({ "act-1": 3 });
    expect(mt.guides.lastOpened).toBe("act-1");
  });

  it("sanitizing a stored subtree always pins the mt schema version", () => {
    expect(sanitizeMtConfig({ ...defaultMtConfig(), configVersion: 99 }))
      .toMatchObject({ configVersion: MT_CONFIG_VERSION });
  });
});
