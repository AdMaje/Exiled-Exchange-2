/**
 * MT: file-cache envelope + TTL rules for the economy module.
 *
 * The main process only stores/returns JSON under `multitool/cache/`; all
 * freshness logic lives here and is covered by pure tests.
 */

export const MT_CACHE_VERSION = 1;

export const MT_CACHE_KINDS = [
  "realms",
  "leagues",
  "categories",
  "reference",
  "currencies",
  "history",
] as const;

export type MtCacheKind = (typeof MT_CACHE_KINDS)[number];

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** DATA_SOURCES.md §2.4. */
export const MT_CACHE_TTL: Record<MtCacheKind, number> = {
  realms: 24 * HOUR,
  leagues: 24 * HOUR,
  categories: 24 * HOUR,
  reference: 24 * HOUR,
  currencies: 15 * MINUTE,
  history: HOUR,
};

export interface MtCacheEnvelope<T = unknown> {
  v: number;
  kind: MtCacheKind;
  key: string;
  source: "poe2scout";
  realm: string | null;
  league: string | null;
  /** Epoch ms of the last successful validation (200 or 304). */
  savedAt: number;
  expiresAt: number;
  /** `Last-Modified` validator, when the API sent one. */
  lastModified: string | null;
  payload: T;
}

export interface CreateEnvelopeArgs<T> {
  kind: MtCacheKind;
  key: string;
  realm: string | null;
  league: string | null;
  payload: T;
  savedAt: number;
  lastModified?: string | null;
}

export function createEnvelope<T>(
  args: CreateEnvelopeArgs<T>,
): MtCacheEnvelope<T> {
  return {
    v: MT_CACHE_VERSION,
    kind: args.kind,
    key: args.key,
    source: "poe2scout",
    realm: args.realm,
    league: args.league,
    savedAt: args.savedAt,
    expiresAt: args.savedAt + MT_CACHE_TTL[args.kind],
    lastModified: args.lastModified ?? null,
    payload: args.payload,
  };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "x"
  );
}

/** FNV-1a, only used to keep cache keys unique after truncation. */
function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0").slice(0, 7);
}

/**
 * Path-safe cache key. `parts` must contain every dimension that changes the
 * payload (realm, league, category, reference currency, range, page...).
 */
export function cacheKey(
  kind: MtCacheKind,
  parts: ReadonlyArray<string | number | null>,
): string {
  const joined = parts.map((part) => String(part ?? "_")).join("|");
  return `${kind}-${slugify(joined)}-${shortHash(joined)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate a stored envelope. Returns null on version/shape/key mismatch so a
 * stale cache file from another schema is simply refetched.
 */
export function parseEnvelope(
  raw: unknown,
  expected: { kind: MtCacheKind; key: string },
): MtCacheEnvelope | null {
  if (!isObject(raw)) return null;
  if (raw.v !== MT_CACHE_VERSION) return null;
  if (raw.kind !== expected.kind) return null;
  if (raw.key !== expected.key) return null;
  if (raw.source !== "poe2scout") return null;
  if (
    typeof raw.savedAt !== "number" ||
    !Number.isFinite(raw.savedAt) ||
    typeof raw.expiresAt !== "number" ||
    !Number.isFinite(raw.expiresAt)
  ) {
    return null;
  }
  if (raw.payload === undefined) return null;

  return {
    v: MT_CACHE_VERSION,
    kind: expected.kind,
    key: expected.key,
    source: "poe2scout",
    realm: typeof raw.realm === "string" ? raw.realm : null,
    league: typeof raw.league === "string" ? raw.league : null,
    savedAt: raw.savedAt,
    expiresAt: raw.expiresAt,
    lastModified:
      typeof raw.lastModified === "string" ? raw.lastModified : null,
    payload: raw.payload,
  };
}

export function isFresh(envelope: MtCacheEnvelope, now: number): boolean {
  return envelope.expiresAt > now;
}

export function cacheAgeMs(envelope: MtCacheEnvelope, now: number): number {
  return Math.max(0, now - envelope.savedAt);
}

export interface RelativeAge {
  value: number;
  unit: "second" | "minute" | "hour" | "day";
}

/** Bucket an age for `Intl.RelativeTimeFormat` ($t with {n} placeholders). */
export function relativeAge(ageMs: number): RelativeAge {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return { value: seconds, unit: "second" };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { value: minutes, unit: "minute" };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { value: hours, unit: "hour" };
  return { value: Math.floor(hours / 24), unit: "day" };
}
