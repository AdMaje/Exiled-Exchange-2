/**
 * MT: fork-owned MultiTool settings model.
 *
 * Shared by the Electron main process (file-backed `mt` subtree of config.json)
 * and the hub renderer. Keep this module free of Vue, Electron and Node APIs so
 * both sides can import it (and unit tests can run it in plain Node).
 */
import { KeyToCode, isModKey } from "./KeyToCode";

export const MT_CONFIG_VERSION = 1;

export type MtLanguage = "auto" | "en" | "pl";
export const MT_LANGUAGES: readonly MtLanguage[] = ["auto", "en", "pl"];

export interface MtHubBounds {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
}

export interface MtFavoriteCurrency {
  apiId: number;
  name: string;
}

export interface MtEconomyConfig {
  source: "poe2scout";
  referenceCurrency: string | null;
  favorites: MtFavoriteCurrency[];
  lastCategory: string;
}

export interface MtGuidesConfig {
  progress: Record<string, number>;
  lastOpened: string | null;
}

export interface MtConfig {
  configVersion: number;
  hubHotkey: string | null;
  language: MtLanguage;
  hub: MtHubBounds;
  economy: MtEconomyConfig;
  guides: MtGuidesConfig;
}

const HUB_MIN_WIDTH = 800;
const HUB_MIN_HEIGHT = 520;
const HUB_MAX_WIDTH = 4096;
const HUB_MAX_HEIGHT = 4096;
const MAX_SCREEN_COORD = 20000;
const MAX_FAVORITES = 100;
const MAX_PROGRESS_ENTRIES = 500;
const MAX_TEXT = 64;

export function defaultMtConfig(): MtConfig {
  return {
    configVersion: MT_CONFIG_VERSION,
    hubHotkey: null,
    language: "auto",
    hub: { width: 1100, height: 760, x: null, y: null },
    economy: {
      source: "poe2scout",
      referenceCurrency: null,
      favorites: [],
      lastCategory: "currency",
    },
    guides: { progress: {}, lastOpened: null },
  };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge an untrusted patch into a known-good MT config. Only known keys are
 * kept, every value is type-checked and clamped, and unknown keys are dropped.
 */
export function mergeMtConfig(base: MtConfig, patch: unknown): MtConfig {
  const src = isPlainObject(patch) ? patch : {};
  return {
    configVersion: MT_CONFIG_VERSION,
    hubHotkey: sanitizeHotkey(src.hubHotkey, base.hubHotkey),
    language: sanitizeLanguage(src.language, base.language),
    hub: sanitizeBounds(src.hub, base.hub),
    economy: sanitizeEconomy(src.economy, base.economy),
    guides: sanitizeGuides(src.guides, base.guides),
  };
}

/**
 * Validate a stored `mt` subtree or an incoming PUT payload.
 * Returns `null` only when the value is not a plain object.
 */
export function sanitizeMtConfig(raw: unknown): MtConfig | null {
  if (!isPlainObject(raw)) return null;
  return mergeMtConfig(defaultMtConfig(), raw);
}

/** Normalize a HotkeyInput string (e.g. "ctrl + alt + h" -> "Ctrl + Alt + H"). */
export function normalizeHotkey(hotkey: string): string | null {
  const parts = hotkey
    .split(" + ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 1 || parts.length > 4) return null;

  let ctrl = false;
  let shift = false;
  let alt = false;
  const keys: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl") ctrl = true;
    else if (lower === "shift") shift = true;
    else if (lower === "alt") alt = true;
    else keys.push(normalizeKeyName(part));
  }

  if (keys.length !== 1) return null;

  const key = keys[0];
  if (!key || !(key in KeyToCode) || isModKey(key)) return null;

  const mods = [ctrl ? "Ctrl" : "", shift ? "Shift" : "", alt ? "Alt" : ""]
    .filter(Boolean);
  return [...mods, key].join(" + ");
}

export interface MtKeyEventLike {
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** True when a DOM keydown matches a normalized MT hotkey exactly. */
export function eventMatchesHotkey(
  event: MtKeyEventLike,
  hotkey: string | null | undefined,
): boolean {
  if (!hotkey) return false;

  const normalized = normalizeHotkey(hotkey);
  if (!normalized) return false;

  const parts = normalized.split(" + ");
  const key = parts.slice(-1)[0];
  const ctrl = parts.includes("Ctrl");
  const shift = parts.includes("Shift");
  const alt = parts.includes("Alt");

  if (event.ctrlKey !== ctrl) return false;
  if (event.shiftKey !== shift) return false;
  if (event.altKey !== alt) return false;

  return keyFromCode(event.code) === key;
}

/** Map a KeyboardEvent.code to the key name used by KeyToCode. */
export function keyFromCode(code: string): string | null {
  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }
  if (code in KeyToCode) return code;
  return null;
}

function normalizeKeyName(part: string): string {
  if (part.length === 1) return part.toUpperCase();

  const match = Object.keys(KeyToCode).find(
    (key) => key.toLowerCase() === part.toLowerCase(),
  );
  return match ?? part;
}

function sanitizeHotkey(
  value: unknown,
  fallback: string | null,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;

  const normalized = normalizeHotkey(value);
  if (normalized) return normalized;

  return value.trim() === "" ? null : fallback;
}

function sanitizeLanguage(value: unknown, fallback: MtLanguage): MtLanguage {
  return value === "auto" || value === "en" || value === "pl" ? value : fallback;
}

function sanitizeBounds(
  value: unknown,
  fallback: MtHubBounds,
): MtHubBounds {
  if (!isPlainObject(value)) return fallback;

  return {
    width: Math.round(
      clamp(numberOr(value.width, fallback.width), HUB_MIN_WIDTH, HUB_MAX_WIDTH),
    ),
    height: Math.round(
      clamp(
        numberOr(value.height, fallback.height),
        HUB_MIN_HEIGHT,
        HUB_MAX_HEIGHT,
      ),
    ),
    x: sanitizeCoord(value.x, fallback.x),
    y: sanitizeCoord(value.y, fallback.y),
  };
}

function sanitizeCoord(
  value: unknown,
  fallback: number | null,
): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  return Math.round(clamp(value, -MAX_SCREEN_COORD, MAX_SCREEN_COORD));
}

function sanitizeEconomy(
  value: unknown,
  fallback: MtEconomyConfig,
): MtEconomyConfig {
  if (!isPlainObject(value)) return fallback;

  return {
    source: "poe2scout",
    referenceCurrency:
      value.referenceCurrency === null
        ? null
        : sanitizeText(value.referenceCurrency, fallback.referenceCurrency),
    favorites: Array.isArray(value.favorites)
      ? value.favorites
          .map(sanitizeFavorite)
          .filter((entry): entry is MtFavoriteCurrency => entry !== null)
          .slice(0, MAX_FAVORITES)
      : fallback.favorites,
    lastCategory:
      sanitizeText(value.lastCategory, fallback.lastCategory) ??
      fallback.lastCategory,
  };
}

function sanitizeFavorite(value: unknown): MtFavoriteCurrency | null {
  if (!isPlainObject(value)) return null;

  const { apiId, name } = value;
  if (typeof apiId !== "number" || !Number.isInteger(apiId) || apiId < 0) {
    return null;
  }
  if (typeof name !== "string") return null;

  const trimmed = name.trim();
  if (!trimmed) return null;

  return { apiId, name: trimmed.slice(0, MAX_TEXT) };
}

function sanitizeGuides(
  value: unknown,
  fallback: MtGuidesConfig,
): MtGuidesConfig {
  if (!isPlainObject(value)) return fallback;

  const rawProgress = value.progress;
  let progress = fallback.progress;
  if (isPlainObject(rawProgress)) {
    progress = {};
    let count = 0;
    for (const [key, entry] of Object.entries(rawProgress)) {
      if (count >= MAX_PROGRESS_ENTRIES) break;
      if (!key || key.length > MAX_TEXT) continue;
      if (typeof entry !== "number" || !Number.isFinite(entry)) continue;
      progress[key] = entry;
      count += 1;
    }
  }

  return {
    progress,
    lastOpened:
      value.lastOpened === null
        ? null
        : sanitizeText(value.lastOpened, fallback.lastOpened),
  };
}

function sanitizeText(value: unknown, fallback: string | null): string | null {
  if (typeof value !== "string") return fallback;

  const text = value.trim();
  if (!text) return fallback;

  return text.slice(0, MAX_TEXT);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
