/**
 * MT: poe2scout adapter (pure functions, no network).
 *
 * Every request goes through the local proxy (`/proxy/api.poe2scout.com/...`);
 * this module only builds paths and parses payloads defensively. A payload
 * that does not look like the documented OpenAPI schema throws
 * `Poe2ScoutSchemaError` instead of rendering an empty table.
 */

export const POE2SCOUT_HOST = "api.poe2scout.com";

/** The API serves several games; MT only uses the PoE2 realm. */
export const POE2SCOUT_GAME_API_ID = "poe2";

export class Poe2ScoutSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Poe2ScoutSchemaError";
  }
}

export interface Poe2ScoutRealm {
  /** Path segment used by every other endpoint (`/Realms[].RealmApiId`). */
  realmApiId: string;
  /** Full value, e.g. "poe2/poe2". Display only. */
  value: string;
  label: string;
  gameApiId: string;
  defaultLeague: string;
}

export interface Poe2ScoutLeague {
  value: string;
  shortName: string;
  isCurrent: boolean;
  divinePrice: number | null;
  baseCurrencyApiId: string | null;
  baseCurrencyText: string;
}

export interface Poe2ScoutCategory {
  apiId: string;
  label: string;
  icon: string | null;
}

export interface Poe2ScoutReferenceCurrency {
  apiId: string | null;
  text: string;
  icon: string | null;
  relativePrice: number;
}

export interface Poe2ScoutPricePoint {
  /** Epoch milliseconds parsed from the API timestamp. */
  time: number;
  price: number;
  quantity: number;
}

export interface Poe2ScoutCurrency {
  currencyItemId: number;
  itemId: number;
  apiId: string;
  text: string;
  categoryApiId: string;
  icon: string | null;
  currentPrice: number | null;
  currentQuantity: number | null;
  priceLogs: Poe2ScoutPricePoint[];
}

export interface Poe2ScoutCurrencyPage {
  currentPage: number;
  pages: number;
  total: number;
  items: Poe2ScoutCurrency[];
}

export type MtPriceRange = "7d" | "30d" | "90d";

export interface MtPriceRangeSpec {
  key: MtPriceRange;
  /**
   * Hourly points requested from `Items/{itemId}/History`; `null` means the
   * range is already covered by the daily `PriceLogs` in the table payload.
   */
  logCount: number | null;
}

/**
 * Chart ranges. The API only accepts `dataPoints` 7 or 8 on `ByCategory`, so
 * longer ranges use the per-item history endpoint (hourly retention).
 */
export const MT_PRICE_RANGES: readonly MtPriceRangeSpec[] = [
  { key: "7d", logCount: null },
  { key: "30d", logCount: 720 },
  { key: "90d", logCount: 2160 },
];

export function priceRangeSpec(range: MtPriceRange): MtPriceRangeSpec {
  return (
    MT_PRICE_RANGES.find((entry) => entry.key === range) ?? MT_PRICE_RANGES[0]
  );
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function realmsPath(): string {
  return "/Realms";
}

export function leaguesPath(realm: string): string {
  return `/${segment(realm)}/Leagues`;
}

export function categoriesPath(realm: string, league: string): string {
  return `/${segment(realm)}/Leagues/${segment(league)}/Items/Categories`;
}

export function referenceCurrenciesPath(realm: string, league: string): string {
  return `/${segment(realm)}/Leagues/${segment(league)}/ReferenceCurrencies`;
}

export interface CurrencyQuery {
  category: string;
  page: number;
  perPage: number;
  dataPoints: number;
  frequencyHours: number;
  referenceCurrency: string | null;
}

export function currenciesPath(
  realm: string,
  league: string,
  query: CurrencyQuery,
): string {
  const params = new URLSearchParams({
    category: query.category,
    page: String(query.page),
    perPage: String(query.perPage),
    dataPoints: String(query.dataPoints),
    frequencyHours: String(query.frequencyHours),
  });
  if (query.referenceCurrency) {
    params.set("referenceCurrency", query.referenceCurrency);
  }
  return `/${segment(realm)}/Leagues/${segment(league)}/Currencies/ByCategory?${params.toString()}`;
}

/**
 * Per-item price history. `itemId` is the provider's `ItemId` (not the string
 * `ApiId`); currency items use the same endpoint as uniques.
 */
export function itemHistoryPath(
  realm: string,
  league: string,
  itemId: number,
  logCount: number,
  referenceCurrency: string | null,
): string {
  const params = new URLSearchParams({ logCount: String(logCount) });
  if (referenceCurrency) {
    params.set("referenceCurrency", referenceCurrency);
  }
  return `/${segment(realm)}/Leagues/${segment(league)}/Items/${itemId}/History?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, what: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Poe2ScoutSchemaError(`${what}: expected an object`);
  }
  return value as JsonObject;
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Poe2ScoutSchemaError(`${what}: expected an array`);
  }
  return value;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function int(value: unknown, fallback = 0): number {
  const parsed = num(value);
  return parsed === null ? fallback : Math.trunc(parsed);
}

function parseTimestamp(value: unknown): number | null {
  const text = str(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse entries and fail on a payload we cannot understand at all: a non-empty
 * array where every entry was rejected means the schema drifted.
 */
function parseList<T>(
  payload: unknown,
  what: string,
  parseEntry: (entry: JsonObject) => T | null,
): T[] {
  const entries = asArray(payload, what);
  const result: T[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const parsed = parseEntry(entry as JsonObject);
    if (parsed !== null) result.push(parsed);
  }
  if (entries.length > 0 && result.length === 0) {
    throw new Poe2ScoutSchemaError(`${what}: no usable entries`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseRealms(payload: unknown): Poe2ScoutRealm[] {
  return parseList(payload, "Realms", (entry) => {
    const realmApiId = str(entry.RealmApiId);
    const gameApiId = str(entry.GameApiId);
    const value = str(entry.Value);
    if (!realmApiId || !gameApiId || !value) return null;

    return {
      realmApiId,
      value,
      label: str(entry.Label) ?? value,
      gameApiId,
      defaultLeague: str(entry.DefaultLeagueValue) ?? "",
    };
  });
}

/** Pick the PoE2 realm; the API sends no other game we support. */
export function selectPoe2Realm(
  realms: readonly Poe2ScoutRealm[],
): Poe2ScoutRealm | null {
  return (
    realms.find((realm) => realm.gameApiId === POE2SCOUT_GAME_API_ID) ?? null
  );
}

export function parseLeagues(payload: unknown): Poe2ScoutLeague[] {
  return parseList(payload, "Leagues", (entry) => {
    const value = str(entry.Value);
    if (!value) return null;

    const defaultCurrency =
      typeof entry.DefaultCurrency === "object" &&
      entry.DefaultCurrency !== null
        ? (entry.DefaultCurrency as JsonObject)
        : null;

    return {
      value,
      shortName: str(entry.ShortName) ?? "",
      isCurrent: entry.IsCurrent === true,
      divinePrice: num(entry.DivinePrice),
      baseCurrencyApiId: str(entry.BaseCurrencyApiId),
      baseCurrencyText:
        str(entry.BaseCurrencyText) ?? str(defaultCurrency?.Text) ?? "",
    };
  });
}

/**
 * Default league: keep the stored one when the provider still lists it,
 * otherwise the first `IsCurrent` league, otherwise the first entry.
 */
export function pickLeague(
  leagues: readonly Poe2ScoutLeague[],
  preferred: string | null,
): Poe2ScoutLeague | null {
  if (preferred) {
    const stored = leagues.find((league) => league.value === preferred);
    if (stored) return stored;
  }
  return leagues.find((league) => league.isCurrent) ?? leagues[0] ?? null;
}

export function parseCategories(payload: unknown): Poe2ScoutCategory[] {
  const root = asObject(payload, "Items/Categories");
  const entries = asArray(
    root.CurrencyCategories,
    "Items/Categories.CurrencyCategories",
  );
  const result: Poe2ScoutCategory[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as JsonObject;
    const apiId = str(record.ApiId);
    if (!apiId) continue;
    result.push({
      apiId,
      label: str(record.Label) ?? apiId,
      icon: str(record.Icon),
    });
  }
  if (entries.length > 0 && result.length === 0) {
    throw new Poe2ScoutSchemaError("Items/Categories: no usable categories");
  }
  return result;
}

export function parseReferenceCurrencies(
  payload: unknown,
): Poe2ScoutReferenceCurrency[] {
  return parseList(payload, "ReferenceCurrencies", (entry) => {
    const text = str(entry.Text);
    if (!text) return null;
    return {
      apiId: str(entry.ApiId),
      text,
      icon: str(entry.IconUrl),
      relativePrice: num(entry.RelativePrice) ?? 0,
    };
  });
}

function parsePriceLogs(value: unknown): Poe2ScoutPricePoint[] {
  if (!Array.isArray(value)) return [];
  const points: Poe2ScoutPricePoint[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as JsonObject;
    const price = num(record.Price);
    const time = parseTimestamp(record.Time);
    if (price === null || time === null) continue;
    points.push({ price, time, quantity: int(record.Quantity) });
  }
  return points.sort((a, b) => a.time - b.time);
}

export function parseCurrencyPage(payload: unknown): Poe2ScoutCurrencyPage {
  const root = asObject(payload, "Currencies/ByCategory");
  const entries = asArray(root.Items, "Currencies/ByCategory.Items");

  const items: Poe2ScoutCurrency[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as JsonObject;
    const apiId = str(record.ApiId);
    const text = str(record.Text);
    if (!apiId || !text) continue;

    items.push({
      currencyItemId: int(record.CurrencyItemId),
      itemId: int(record.ItemId),
      apiId,
      text,
      categoryApiId: str(record.CategoryApiId) ?? "",
      icon: str(record.IconUrl),
      currentPrice: num(record.CurrentPrice),
      currentQuantity: num(record.CurrentQuantity),
      priceLogs: parsePriceLogs(record.PriceLogs),
    });
  }

  if (entries.length > 0 && items.length === 0) {
    throw new Poe2ScoutSchemaError(
      "Currencies/ByCategory: no usable currency entries",
    );
  }

  return {
    currentPage: int(root.CurrentPage, 1),
    pages: Math.max(1, int(root.Pages, 1)),
    total: int(root.Total, items.length),
    items,
  };
}

export interface Poe2ScoutItemHistory {
  points: Poe2ScoutPricePoint[];
  hasMore: boolean;
}

/** Parse `Items/{itemId}/History` (`PriceHistory`, hourly points). */
export function parseItemHistory(payload: unknown): Poe2ScoutItemHistory {
  const root = asObject(payload, "Items/History");
  const entries = asArray(root.PriceHistory, "Items/History.PriceHistory");
  const points = parsePriceLogs(entries);

  if (entries.length > 0 && points.length === 0) {
    throw new Poe2ScoutSchemaError("Items/History: no usable price points");
  }

  return { points, hasMore: root.HasMore === true };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export interface CurrencyRow {
  apiId: string;
  itemId: number;
  text: string;
  icon: string | null;
  categoryApiId: string;
  price: number | null;
  quantity: number | null;
  history: Poe2ScoutPricePoint[];
}

export function toCurrencyRows(page: Poe2ScoutCurrencyPage): CurrencyRow[] {
  return page.items.map((item) => ({
    apiId: item.apiId,
    itemId: item.itemId,
    text: item.text,
    icon: item.icon,
    categoryApiId: item.categoryApiId,
    price: item.currentPrice,
    quantity: item.currentQuantity,
    history: item.priceLogs,
  }));
}

/** Percentage change across a sorted price history, or null. */
export function priceChangePercent(
  history: readonly Poe2ScoutPricePoint[],
): number | null {
  if (history.length < 2) return null;
  const first = history[0].price;
  const last = history[history.length - 1].price;
  if (!Number.isFinite(first) || first <= 0) return null;
  return ((last - first) / first) * 100;
}

/** Filter rows by name or api id (case-insensitive, client side). */
export function filterRows(
  rows: readonly CurrencyRow[],
  search: string,
): CurrencyRow[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter(
    (row) =>
      row.text.toLowerCase().includes(needle) ||
      row.apiId.toLowerCase().includes(needle),
  );
}

/** poe.ninja league slug, mirrors the upstream helper (links only). */
export function ninjaLeagueSlug(league: string): string {
  const slug = league.toLowerCase().replaceAll(" ", "");
  return slug.startsWith("hc") ? `${slug.slice(2)}hc` : slug;
}

/** poe.ninja is never fetched; this is a deep link for the user's browser. */
export function ninjaCategoryUrl(
  league: string,
  categoryApiId: string,
): string {
  return `https://poe.ninja/poe2/economy/${encodeURIComponent(
    ninjaLeagueSlug(league),
  )}/${encodeURIComponent(categoryApiId)}`;
}

/**
 * Favorites persist a numeric id (config schema v2 predates string ids); a
 * stable FNV-1a hash maps the provider's string api ids onto it.
 */
export function favoriteId(apiId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < apiId.length; index += 1) {
    hash ^= apiId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
