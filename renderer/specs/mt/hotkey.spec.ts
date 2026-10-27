import { describe, expect, it } from "vitest";
import {
  eventMatchesHotkey,
  keyFromCode,
  normalizeHotkey,
  type MtKeyEventLike,
} from "@ipc/mt";

function keyEvent(
  code: string,
  mods: Partial<Pick<MtKeyEventLike, "ctrlKey" | "shiftKey" | "altKey">> = {},
): MtKeyEventLike {
  return {
    code,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  };
}

describe("mt hotkey helpers", () => {
  it("maps KeyboardEvent codes to KeyToCode names", () => {
    expect(keyFromCode("KeyH")).toBe("H");
    expect(keyFromCode("Digit1")).toBe("1");
    expect(keyFromCode("Space")).toBe("Space");
    expect(keyFromCode("Numpad4")).toBe("Numpad4");
    expect(keyFromCode("Unidentified")).toBeNull();
  });

  it("normalizes modifier order and casing", () => {
    expect(normalizeHotkey("alt + ctrl + h")).toBe("Ctrl + Alt + H");
    expect(normalizeHotkey("Shift + Alt + F5")).toBe("Shift + Alt + F5");
    expect(normalizeHotkey("H")).toBe("H");
  });

  it("rejects invalid chords", () => {
    expect(normalizeHotkey("")).toBeNull();
    expect(normalizeHotkey("Ctrl + Alt")).toBeNull();
    expect(normalizeHotkey("Ctrl + H + J")).toBeNull();
    expect(normalizeHotkey("Meta + H")).toBeNull();
    expect(normalizeHotkey("Ctrl + NotAKey")).toBeNull();
  });

  it("matches a DOM keydown exactly", () => {
    const hotkey = "Ctrl + Alt + H";

    expect(
      eventMatchesHotkey(keyEvent("KeyH", { ctrlKey: true, altKey: true }), hotkey),
    ).toBe(true);
    expect(
      eventMatchesHotkey(keyEvent("KeyH", { ctrlKey: true }), hotkey),
    ).toBe(false);
    expect(
      eventMatchesHotkey(
        keyEvent("KeyH", { ctrlKey: true, altKey: true, shiftKey: true }),
        hotkey,
      ),
    ).toBe(false);
    expect(
      eventMatchesHotkey(keyEvent("KeyJ", { ctrlKey: true, altKey: true }), hotkey),
    ).toBe(false);
  });

  it("matches modifier-less and special keys", () => {
    expect(eventMatchesHotkey(keyEvent("F5"), "F5")).toBe(true);
    expect(eventMatchesHotkey(keyEvent("Escape"), "Escape")).toBe(true);
    expect(
      eventMatchesHotkey(keyEvent("Space", { ctrlKey: true }), "Ctrl + Space"),
    ).toBe(true);
  });

  it("never matches when no hub hotkey is configured", () => {
    expect(
      eventMatchesHotkey(keyEvent("KeyH", { ctrlKey: true, altKey: true }), null),
    ).toBe(false);
    expect(eventMatchesHotkey(keyEvent("KeyH"), "")).toBe(false);
  });
});
