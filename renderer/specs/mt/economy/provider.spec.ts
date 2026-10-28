import { describe, expect, it } from "vitest";
import {
  Poe2ScoutSchemaError,
  POE2SCOUT_HOST,
  currenciesPath,
  favoriteId,
  filterRows,
  itemHistoryPath,
  ninjaCategoryUrl,
  ninjaLeagueSlug,
  parseCategories,
  parseCurrencyPage,
  parseItemHistory,
  parseLeagues,
  parseRealms,
  parseReferenceCurrencies,
  pickLeague,
  priceChangePercent,
  priceRangeSpec,
  selectPoe2Realm,
  toCurrencyRows,
} from "@/mt/economy/provider";
import realmsRaw from "./fixtures/realms.json?raw";
import leaguesRaw from "./fixtures/leagues.json?raw";
import categoriesRaw from "./fixtures/categories.json?raw";
import referenceRaw from "./fixtures/reference-currencies.json?raw";
import currencyRaw from "./fixtures/currency-page.json?raw";
import itemHistoryRaw from "./fixtures/item-history.json?raw";

/**
 * Fixtures were recorded once from the live poe2scout API on 2026-10-28 and
 * trimmed; tests never touch the network. See the sibling `.meta.json` files.
 */
function fixture(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

describe("poe2scout paths", () => {
  it("targets the documented host and realm", () => {
    expect(POE2SCOUT_HOST).toBe("api.poe2scout.com");
  });

  it("encodes league names and every query dimension", () => {
    const path = currenciesPath("poe2", "HC Forbidden Rites", {
      category: "currency",
      page: 2,
      perPage: 50,
      dataPoints: 7,
      frequencyHours: 24,
      referenceCurrency: "divine",
    });

    expect(path).toContain(
      "/poe2/Leagues/HC%20Forbidden%20Rites/Currencies/ByCategory?",
    );
    expect(path).toContain("page=2");
    expect(path).toContain("perPage=50");
    expect(path).toContain("referenceCurrency=divine");
  });

  it("omits referenceCurrency when the provider default is used", () => {
    const path = currenciesPath("poe2", "Forbidden Rites", {
      category: "currency",
      page: 1,
      perPage: 50,
      dataPoints: 7,
      frequencyHours: 24,
      referenceCurrency: null,
    });

    expect(path).not.toContain("referenceCurrency");
  });

  it("maps chart ranges to the per-item history endpoint", () => {
    expect(priceRangeSpec("7d").logCount).toBeNull();
    expect(priceRangeSpec("30d").logCount).toBe(720);
    expect(priceRangeSpec("90d").logCount).toBe(2160);
  });

  it("builds an item history path from the numeric item id", () => {
    const path = itemHistoryPath("poe2", "Forbidden Rites", 295, 720, "divine");
    expect(path).toBe(
      "/poe2/Leagues/Forbidden%20Rites/Items/295/History?logCount=720&referenceCurrency=divine",
    );
    expect(
      itemHistoryPath("poe2", "Forbidden Rites", 295, 2160, null),
    ).not.toContain("referenceCurrency");
  });
});

describe("poe2scout parsers", () => {
  it("reads realms and selects the PoE2 one", () => {
    const realms = parseRealms(fixture(realmsRaw));
    expect(realms.length).toBe(2);
    expect(realms.map((realm) => realm.realmApiId)).toContain("pc");

    const realm = selectPoe2Realm(realms);
    expect(realm).toMatchObject({
      realmApiId: "poe2",
      value: "poe2/poe2",
      gameApiId: "poe2",
      defaultLeague: "Fate of the Vaal",
    });
  });

  it("rejects a realm payload whose entries are all unusable", () => {
    expect(() => parseRealms([{ Value: "poe2/poe2" }])).toThrow(
      Poe2ScoutSchemaError,
    );
    expect(() => parseRealms({ not: "an array" })).toThrow(
      Poe2ScoutSchemaError,
    );
  });

  it("reads leagues and keeps the stored league when it still exists", () => {
    const leagues = parseLeagues(fixture(leaguesRaw));
    expect(leagues.length).toBe(3);
    expect(leagues[0]).toMatchObject({
      isCurrent: true,
      baseCurrencyApiId: "exalted",
      baseCurrencyText: "Exalted Orb",
    });

    expect(pickLeague(leagues, "Dawn of the Hunt")?.value).toBe(
      "Dawn of the Hunt",
    );
    expect(pickLeague(leagues, "removed league")?.isCurrent).toBe(true);
    expect(pickLeague(leagues, null)?.value).toBe(leagues[0].value);
    expect(pickLeague([], "anything")).toBeNull();
  });

  it("reads only currency categories and fails closed on schema drift", () => {
    const categories = parseCategories(fixture(categoriesRaw));
    expect(categories.map((entry) => entry.apiId)).toEqual([
      "currency",
      "fragments",
      "runes",
    ]);

    expect(() => parseCategories({ UniqueCategories: [] })).toThrow(
      Poe2ScoutSchemaError,
    );
    expect(() =>
      parseCategories({ CurrencyCategories: [{ Nope: 1 }] }),
    ).toThrow(Poe2ScoutSchemaError);
  });

  it("reads reference currencies with their relative prices", () => {
    const reference = parseReferenceCurrencies(fixture(referenceRaw));
    expect(reference.map((entry) => entry.apiId)).toEqual([
      "exalted",
      "chaos",
      "divine",
    ]);
    expect(reference[2].relativePrice).toBeGreaterThan(
      reference[1].relativePrice,
    );
  });

  it("reads a currency page, sorts price logs and keeps pagination", () => {
    const page = parseCurrencyPage(fixture(currencyRaw));
    expect(page).toMatchObject({ currentPage: 1, pages: 1 });
    expect(page.total).toBeGreaterThan(page.items.length);
    expect(page.items.length).toBe(3);
    expect(page.items[0].categoryApiId).toBe("currency");
    expect(page.items[0].priceLogs.length).toBe(3);

    const times = page.items[0].priceLogs.map((point) => point.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("fails instead of rendering an empty table when the schema drifts", () => {
    expect(() => parseCurrencyPage({ Items: [{ ApiId: "x" }] })).toThrow(
      Poe2ScoutSchemaError,
    );
    expect(() => parseCurrencyPage([])).toThrow(Poe2ScoutSchemaError);
  });

  it("accepts an empty page as a valid (but empty) result", () => {
    const page = parseCurrencyPage({
      CurrentPage: 1,
      Pages: 1,
      Total: 0,
      Items: [],
    });
    expect(page.items).toEqual([]);
  });

  it("reads per-item history in chronological order", () => {
    const history = parseItemHistory(fixture(itemHistoryRaw));
    expect(history.hasMore).toBe(true);
    expect(history.points.length).toBe(7);

    const times = history.points.map((point) => point.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(history.points[0].price).toBeGreaterThan(0);

    expect(() =>
      parseItemHistory({ PriceHistory: [{ Time: "nope" }] }),
    ).toThrow(Poe2ScoutSchemaError);
    expect(parseItemHistory({ PriceHistory: [] })).toEqual({
      points: [],
      hasMore: false,
    });
  });
});

describe("currency display helpers", () => {
  const rows = toCurrencyRows(parseCurrencyPage(fixture(currencyRaw)));

  it("maps provider items to rows", () => {
    expect(rows[0]).toMatchObject({
      apiId: "mirror",
      text: "Mirror of Kalandra",
      categoryApiId: "currency",
    });
    expect(rows[0].price).toBeGreaterThan(0);
    expect(rows[0].history.length).toBe(3);
  });

  it("computes the change across the recorded history", () => {
    const change = priceChangePercent(rows[0].history);
    expect(change).not.toBeNull();
    expect(priceChangePercent([])).toBeNull();
    expect(priceChangePercent([{ time: 1, price: 0, quantity: 1 }])).toBeNull();
  });

  it("filters case-insensitively by name or api id", () => {
    expect(filterRows(rows, "MIRROR").map((row) => row.apiId)).toEqual([
      "mirror",
    ]);
    expect(filterRows(rows, "fracturing")).toHaveLength(1);
    expect(filterRows(rows, "  ")).toHaveLength(rows.length);
    expect(filterRows(rows, "no-such-currency")).toHaveLength(0);
  });

  it("maps string api ids to stable numeric favorite ids", () => {
    expect(favoriteId("divine")).toBe(favoriteId("divine"));
    expect(favoriteId("divine")).not.toBe(favoriteId("exalted"));
    expect(Number.isInteger(favoriteId("divine"))).toBe(true);
    expect(favoriteId("divine")).toBeGreaterThanOrEqual(0);
  });

  it("builds poe.ninja links without ever fetching them", () => {
    expect(ninjaLeagueSlug("Forbidden Rites")).toBe("forbiddenrites");
    expect(ninjaLeagueSlug("HC Forbidden Rites")).toBe("forbiddenriteshc");
    expect(ninjaCategoryUrl("Forbidden Rites", "currency")).toBe(
      "https://poe.ninja/poe2/economy/forbiddenrites/currency",
    );
  });
});
