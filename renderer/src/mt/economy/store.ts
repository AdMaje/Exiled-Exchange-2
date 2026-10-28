/**
 * MT: economy module state.
 *
 * Offline-first: every resource is read from `multitool/cache/` first, fetched
 * only when its TTL expired or the user pressed Refresh, and the cached copy is
 * shown (with its age) when the network fails. No polling, no timers: the only
 * network activity is caused by opening the tab or an explicit refresh.
 */
import { createGlobalState } from "@vueuse/core";
import { computed, shallowRef, ref } from "vue";
import type { MtFavoriteCurrency } from "@ipc/mt";
import { readMtCache, writeMtCache } from "../api";
import {
  cacheKey,
  createEnvelope,
  isFresh,
  parseEnvelope,
  relativeAge,
  type MtCacheEnvelope,
  type MtCacheKind,
  type RelativeAge,
} from "./cache";
import {
  POE2SCOUT_HOST,
  currenciesPath,
  favoriteId,
  filterRows,
  itemHistoryPath,
  leaguesPath,
  parseCategories,
  parseCurrencyPage,
  parseItemHistory,
  parseLeagues,
  parseRealms,
  parseReferenceCurrencies,
  categoriesPath,
  pickLeague,
  priceChangePercent,
  priceRangeSpec,
  referenceCurrenciesPath,
  realmsPath,
  selectPoe2Realm,
  toCurrencyRows,
  type CurrencyRow,
  type MtPriceRange,
  type Poe2ScoutCategory,
  type Poe2ScoutCurrencyPage,
  type Poe2ScoutLeague,
  type Poe2ScoutPricePoint,
  type Poe2ScoutRealm,
  type Poe2ScoutReferenceCurrency,
} from "./provider";
import { RequestQueue } from "./queue";

const PER_PAGE = 50;
const DEFAULT_CATEGORY = "currency";

function proxyUrl(path: string): string {
  return `/proxy/${POE2SCOUT_HOST}${path}`;
}

const queue = new RequestQueue(
  async (url, init) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }
  },
  { minSpacingMs: 1000, maxRetries: 3, baseBackoffMs: 2000 },
);

export interface EconomyOpenInput {
  realm: string | null;
  league: string | null;
  category: string;
  referenceCurrency: string | null;
  favorites: MtFavoriteCurrency[];
}

export interface EconomyResolved {
  realm: string | null;
  league: string | null;
  category: string;
  referenceCurrency: string | null;
}

interface ResourceSpec<T> {
  kind: MtCacheKind;
  key: string;
  realm: string | null;
  league: string | null;
  path: string;
  parse: (payload: unknown) => T;
}

interface ResourceResult<T> {
  data: T;
  savedAt: number;
  stale: boolean;
}

function parseCached<T>(
  spec: ResourceSpec<T>,
  cached: MtCacheEnvelope,
): T | null {
  try {
    return spec.parse(cached.payload);
  } catch {
    return null;
  }
}

async function loadResource<T>(
  spec: ResourceSpec<T>,
  force: boolean,
): Promise<ResourceResult<T>> {
  let cached: MtCacheEnvelope | null = null;
  try {
    cached = parseEnvelope(await readMtCache(spec.key), {
      kind: spec.kind,
      key: spec.key,
    });
  } catch {
    cached = null;
  }

  const cachedData = cached ? parseCached(spec, cached) : null;
  if (cached && cachedData !== null && !force && isFresh(cached, Date.now())) {
    return { data: cachedData, savedAt: cached.savedAt, stale: false };
  }

  try {
    const headers: Record<string, string> = { accept: "application/json" };
    if (cached?.lastModified) {
      headers["if-modified-since"] = cached.lastModified;
    }

    const response = await queue.fetch(proxyUrl(spec.path), { headers });

    if (response.status === 304 && cached && cachedData !== null) {
      const refreshed = createEnvelope({
        kind: spec.kind,
        key: spec.key,
        realm: spec.realm,
        league: spec.league,
        payload: cached.payload,
        savedAt: Date.now(),
        lastModified: cached.lastModified,
      });
      await writeMtCache(spec.key, refreshed).catch(() => undefined);
      return { data: cachedData, savedAt: refreshed.savedAt, stale: false };
    }

    const payload: unknown = await response.json();
    const data = spec.parse(payload);
    const envelope = createEnvelope({
      kind: spec.kind,
      key: spec.key,
      realm: spec.realm,
      league: spec.league,
      payload,
      savedAt: Date.now(),
      lastModified: response.headers.get("last-modified"),
    });
    await writeMtCache(spec.key, envelope).catch(() => undefined);
    return { data, savedAt: envelope.savedAt, stale: false };
  } catch (error) {
    if (cached && cachedData !== null) {
      return { data: cachedData, savedAt: cached.savedAt, stale: true };
    }
    throw error;
  }
}

export const useEconomy = createGlobalState(() => {
  const realm = shallowRef<string | null>(null);
  const league = shallowRef<string | null>(null);
  const category = shallowRef(DEFAULT_CATEGORY);
  const referenceCurrency = shallowRef<string | null>(null);
  const favorites = shallowRef<MtFavoriteCurrency[]>([]);

  const realms = shallowRef<Poe2ScoutRealm[]>([]);
  const leagues = shallowRef<Poe2ScoutLeague[]>([]);
  const categories = shallowRef<Poe2ScoutCategory[]>([]);
  const referenceCurrencies = shallowRef<Poe2ScoutReferenceCurrency[]>([]);

  const rows = shallowRef<CurrencyRow[]>([]);
  const search = ref("");
  const favoritesOnly = ref(false);
  const page = ref(1);
  const pages = ref(1);
  const total = ref(0);

  const selectedApiId = shallowRef<string | null>(null);
  const chartRange = shallowRef<MtPriceRange>("7d");
  const historyPoints = shallowRef<Poe2ScoutPricePoint[]>([]);
  const historyLoading = ref(false);

  const initialized = ref(false);
  const loading = ref(false);
  const refreshing = ref(false);
  const error = shallowRef<string | null>(null);
  const updatedAt = ref<number | null>(null);
  const offline = ref(false);

  let inflight: Promise<void> | null = null;

  const visibleRows = computed(() => {
    const filtered = filterRows(rows.value, search.value);
    if (!favoritesOnly.value) return filtered;
    const ids = new Set(favorites.value.map((entry) => entry.apiId));
    return filtered.filter((row) => ids.has(favoriteId(row.apiId)));
  });

  const selectedRow = computed(
    () => rows.value.find((row) => row.apiId === selectedApiId.value) ?? null,
  );

  const leagueName = computed(() => league.value ?? "");
  const categoryLabel = computed(
    () =>
      categories.value.find((entry) => entry.apiId === category.value)?.label ??
      category.value,
  );
  const referenceLabel = computed(() => {
    if (!referenceCurrency.value) return null;
    return (
      referenceCurrencies.value.find(
        (entry) => entry.apiId === referenceCurrency.value,
      )?.text ?? referenceCurrency.value
    );
  });

  const age = computed<RelativeAge | null>(() =>
    updatedAt.value === null
      ? null
      : relativeAge(Math.max(0, Date.now() - updatedAt.value)),
  );

  function isFavorite(apiId: string): boolean {
    const id = favoriteId(apiId);
    return favorites.value.some((entry) => entry.apiId === id);
  }

  function toggleFavorite(row: CurrencyRow): MtFavoriteCurrency[] {
    const apiId = favoriteId(row.apiId);
    const next = isFavorite(row.apiId)
      ? favorites.value.filter((entry) => entry.apiId !== apiId)
      : [...favorites.value, { apiId, name: row.text }].slice(0, 100);
    favorites.value = next;
    return next;
  }

  function resetTable(): void {
    rows.value = [];
    page.value = 1;
    pages.value = 1;
    total.value = 0;
    selectedApiId.value = null;
    historyPoints.value = [];
    chartRange.value = "7d";
  }

  async function loadBase(force: boolean): Promise<{ stale: boolean }> {
    let stale = false;

    const realmsResult = await loadResource(
      {
        kind: "realms",
        key: cacheKey("realms", []),
        realm: null,
        league: null,
        path: realmsPath(),
        parse: parseRealms,
      },
      force,
    );
    stale ||= realmsResult.stale;
    realms.value = realmsResult.data;

    const knownRealm = realm.value;
    const nextRealm =
      (knownRealm &&
        realms.value.some((entry) => entry.realmApiId === knownRealm) &&
        knownRealm) ||
      selectPoe2Realm(realms.value)?.realmApiId ||
      null;
    if (!nextRealm) throw new Error("no-poe2-realm");
    realm.value = nextRealm;

    const leaguesResult = await loadResource(
      {
        kind: "leagues",
        key: cacheKey("leagues", [nextRealm]),
        realm: nextRealm,
        league: null,
        path: leaguesPath(nextRealm),
        parse: parseLeagues,
      },
      force,
    );
    stale ||= leaguesResult.stale;
    leagues.value = leaguesResult.data;

    const selectedLeague = pickLeague(leagues.value, league.value);
    if (!selectedLeague) throw new Error("no-leagues");
    league.value = selectedLeague.value;

    const categoriesResult = await loadResource(
      {
        kind: "categories",
        key: cacheKey("categories", [nextRealm, selectedLeague.value]),
        realm: nextRealm,
        league: selectedLeague.value,
        path: categoriesPath(nextRealm, selectedLeague.value),
        parse: parseCategories,
      },
      force,
    );
    stale ||= categoriesResult.stale;
    categories.value = categoriesResult.data;
    if (
      categories.value.length > 0 &&
      !categories.value.some((entry) => entry.apiId === category.value)
    ) {
      category.value = categories.value[0].apiId;
    }

    const referenceResult = await loadResource(
      {
        kind: "reference",
        key: cacheKey("reference", [nextRealm, selectedLeague.value]),
        realm: nextRealm,
        league: selectedLeague.value,
        path: referenceCurrenciesPath(nextRealm, selectedLeague.value),
        parse: parseReferenceCurrencies,
      },
      force,
    );
    stale ||= referenceResult.stale;
    referenceCurrencies.value = referenceResult.data;
    if (
      referenceCurrency.value &&
      !referenceCurrencies.value.some(
        (entry) => entry.apiId === referenceCurrency.value,
      )
    ) {
      referenceCurrency.value = null;
    }

    return { stale };
  }

  function tableSpec(targetPage: number): ResourceSpec<Poe2ScoutCurrencyPage> {
    const currentRealm = realm.value!;
    const currentLeague = league.value!;
    return {
      kind: "currencies",
      key: cacheKey("currencies", [
        currentRealm,
        currentLeague,
        category.value,
        referenceCurrency.value,
        targetPage,
      ]),
      realm: currentRealm,
      league: currentLeague,
      path: currenciesPath(currentRealm, currentLeague, {
        category: category.value,
        page: targetPage,
        perPage: PER_PAGE,
        dataPoints: 7,
        frequencyHours: 24,
        referenceCurrency: referenceCurrency.value,
      }),
      parse: parseCurrencyPage,
    };
  }

  async function loadTable(
    force: boolean,
    append = false,
  ): Promise<{ stale: boolean }> {
    const targetPage = append ? page.value + 1 : 1;
    const result = await loadResource(tableSpec(targetPage), force);
    const nextRows = toCurrencyRows(result.data);

    rows.value = append ? [...rows.value, ...nextRows] : nextRows;
    page.value = result.data.currentPage || targetPage;
    pages.value = result.data.pages;
    total.value = result.data.total;
    updatedAt.value = result.savedAt;

    if (!selectedApiId.value && rows.value.length > 0) {
      selectCurrency(rows.value[0].apiId);
    }

    return { stale: result.stale };
  }

  async function run(force: boolean): Promise<void> {
    if (inflight) return inflight;

    const initial = !initialized.value;
    if (initial) loading.value = true;
    if (force) refreshing.value = true;
    error.value = null;

    inflight = (async () => {
      try {
        const base = await loadBase(force);
        const table = await loadTable(force);
        offline.value = base.stale || table.stale;
        initialized.value = true;
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : "unknown-error";
      } finally {
        loading.value = false;
        refreshing.value = false;
        inflight = null;
      }
    })();

    return await inflight;
  }

  /** Called when the tab opens; returns the values worth persisting. */
  async function open(input: EconomyOpenInput): Promise<EconomyResolved> {
    realm.value = input.realm;
    league.value = input.league;
    category.value = input.category || DEFAULT_CATEGORY;
    referenceCurrency.value = input.referenceCurrency;
    favorites.value = input.favorites;

    await run(false);
    return resolved();
  }

  function resolved(): EconomyResolved {
    return {
      realm: realm.value,
      league: league.value,
      category: category.value,
      referenceCurrency: referenceCurrency.value,
    };
  }

  async function refresh(): Promise<void> {
    await run(true);
  }

  async function setLeague(value: string): Promise<void> {
    if (value === league.value) return;
    league.value = value;
    resetTable();
    offline.value = false;
    await run(false);
  }

  async function setCategory(value: string): Promise<void> {
    if (value === category.value) return;
    category.value = value;
    resetTable();
    offline.value = false;
    await run(false);
  }

  async function setReferenceCurrency(value: string | null): Promise<void> {
    if (value === referenceCurrency.value) return;
    referenceCurrency.value = value;
    resetTable();
    offline.value = false;
    await run(false);
  }

  async function loadMore(): Promise<void> {
    if (loading.value || page.value >= pages.value) return;
    loading.value = true;
    try {
      const result = await loadTable(false, true);
      offline.value ||= result.stale;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "unknown-error";
    } finally {
      loading.value = false;
    }
  }

  function selectCurrency(apiId: string): void {
    selectedApiId.value = apiId;
    if (chartRange.value === "7d") {
      historyPoints.value = selectedRow.value?.history ?? [];
      return;
    }
    loadHistory().catch(() => undefined);
  }

  async function loadHistory(): Promise<void> {
    if (chartRange.value === "7d") {
      historyPoints.value = selectedRow.value?.history ?? [];
      return;
    }
    const row = selectedRow.value;
    const spec = priceRangeSpec(chartRange.value);
    if (!realm.value || !league.value || !row || spec.logCount === null) return;

    historyLoading.value = true;
    try {
      const result = await loadResource(
        {
          kind: "history",
          key: cacheKey("history", [
            realm.value,
            league.value,
            row.itemId,
            referenceCurrency.value,
            chartRange.value,
          ]),
          realm: realm.value,
          league: league.value,
          path: itemHistoryPath(
            realm.value,
            league.value,
            row.itemId,
            spec.logCount,
            referenceCurrency.value,
          ),
          parse: parseItemHistory,
        },
        false,
      );
      // A slower response must not overwrite a newer selection or range.
      if (
        selectedApiId.value === row.apiId &&
        priceRangeSpec(chartRange.value).logCount === spec.logCount
      ) {
        historyPoints.value = result.data.points;
      }
    } catch {
      historyPoints.value = row.history;
    } finally {
      historyLoading.value = false;
    }
  }

  async function setChartRange(range: MtPriceRange): Promise<void> {
    if (range === chartRange.value) return;
    chartRange.value = range;
    await loadHistory();
  }

  function changePercent(row: CurrencyRow): number | null {
    return priceChangePercent(row.history);
  }

  return {
    // selection
    realm,
    league,
    category,
    referenceCurrency,
    favorites,
    search,
    favoritesOnly,
    // data
    realms,
    leagues,
    categories,
    referenceCurrencies,
    rows,
    visibleRows,
    total,
    page,
    pages,
    selectedRow,
    selectedApiId,
    chartRange,
    historyPoints,
    historyLoading,
    leagueName,
    categoryLabel,
    referenceLabel,
    // status
    initialized,
    loading,
    refreshing,
    error,
    updatedAt,
    offline,
    age,
    // actions
    open,
    refresh,
    setLeague,
    setCategory,
    setReferenceCurrency,
    loadMore,
    selectCurrency,
    setChartRange,
    isFavorite,
    toggleFavorite,
    changePercent,
  };
});
