import { describe, expect, it } from "vitest";
import {
  MT_CACHE_TTL,
  MT_CACHE_VERSION,
  cacheAgeMs,
  cacheKey,
  createEnvelope,
  isFresh,
  parseEnvelope,
  relativeAge,
} from "@/mt/economy/cache";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

describe("mt cache ttl", () => {
  it("matches the documented windows", () => {
    expect(MT_CACHE_TTL.realms).toBe(24 * HOUR);
    expect(MT_CACHE_TTL.leagues).toBe(24 * HOUR);
    expect(MT_CACHE_TTL.categories).toBe(24 * HOUR);
    expect(MT_CACHE_TTL.reference).toBe(24 * HOUR);
    expect(MT_CACHE_TTL.currencies).toBe(15 * MINUTE);
    expect(MT_CACHE_TTL.history).toBe(HOUR);
  });
});

describe("mt cache envelopes", () => {
  it("stamps version, source and expiry on write", () => {
    const savedAt = 1_000_000;
    const envelope = createEnvelope({
      kind: "currencies",
      key: "currencies-poe2-x",
      realm: "poe2",
      league: "Forbidden Rites",
      payload: { Items: [] },
      savedAt,
      lastModified: "Wed, 28 Oct 2026 00:00:00 GMT",
    });

    expect(envelope).toMatchObject({
      v: MT_CACHE_VERSION,
      kind: "currencies",
      key: "currencies-poe2-x",
      source: "poe2scout",
      realm: "poe2",
      league: "Forbidden Rites",
      savedAt,
      expiresAt: savedAt + 15 * MINUTE,
      lastModified: "Wed, 28 Oct 2026 00:00:00 GMT",
    });
  });

  it("round-trips a valid envelope", () => {
    const envelope = createEnvelope({
      kind: "leagues",
      key: "leagues-poe2-x",
      realm: "poe2",
      league: null,
      payload: [{ Value: "Forbidden Rites" }],
      savedAt: 5,
    });

    const parsed = parseEnvelope(JSON.parse(JSON.stringify(envelope)), {
      kind: "leagues",
      key: "leagues-poe2-x",
    });
    expect(parsed?.payload).toEqual([{ Value: "Forbidden Rites" }]);
  });

  it("rejects envelopes from another schema, kind or key", () => {
    const envelope = createEnvelope({
      kind: "leagues",
      key: "leagues-poe2-x",
      realm: "poe2",
      league: null,
      payload: [],
      savedAt: 5,
    });

    expect(
      parseEnvelope(
        { ...envelope, v: MT_CACHE_VERSION + 1 },
        {
          kind: "leagues",
          key: "leagues-poe2-x",
        },
      ),
    ).toBeNull();
    expect(
      parseEnvelope(envelope, { kind: "realms", key: "leagues-poe2-x" }),
    ).toBeNull();
    expect(
      parseEnvelope(envelope, { kind: "leagues", key: "other-key" }),
    ).toBeNull();
    expect(
      parseEnvelope(
        { ...envelope, payload: undefined },
        {
          kind: "leagues",
          key: "leagues-poe2-x",
        },
      ),
    ).toBeNull();
    expect(
      parseEnvelope(null, { kind: "leagues", key: "leagues-poe2-x" }),
    ).toBeNull();
    expect(
      parseEnvelope([], { kind: "leagues", key: "leagues-poe2-x" }),
    ).toBeNull();
  });

  it("treats the expiry instant as stale and reports the age", () => {
    const envelope = createEnvelope({
      kind: "history",
      key: "history-x",
      realm: "poe2",
      league: "Forbidden Rites",
      payload: {},
      savedAt: 10_000,
    });

    expect(isFresh(envelope, 10_000)).toBe(true);
    expect(isFresh(envelope, 10_000 + HOUR - 1)).toBe(true);
    expect(isFresh(envelope, 10_000 + HOUR)).toBe(false);
    expect(cacheAgeMs(envelope, 10_000 + 5000)).toBe(5000);
    expect(cacheAgeMs(envelope, 0)).toBe(0);
  });
});

describe("mt cache keys", () => {
  it("are path safe and stable", () => {
    const key = cacheKey("currencies", [
      "poe2",
      "Forbidden Rites",
      "currency",
      null,
    ]);
    expect(key).toBe(
      cacheKey("currencies", ["poe2", "Forbidden Rites", "currency", null]),
    );
    expect(key).toMatch(/^[a-z0-9][a-z0-9._-]{0,119}$/);
    expect(key.startsWith("currencies-")).toBe(true);
  });

  it("change whenever a cache dimension changes", () => {
    const base = cacheKey("currencies", [
      "poe2",
      "Forbidden Rites",
      "currency",
      null,
    ]);
    expect(
      cacheKey("currencies", ["poe2", "HC Forbidden Rites", "currency", null]),
    ).not.toBe(base);
    expect(
      cacheKey("currencies", ["poe2", "Forbidden Rites", "fragments", null]),
    ).not.toBe(base);
    expect(
      cacheKey("currencies", ["poe2", "Forbidden Rites", "currency", "divine"]),
    ).not.toBe(base);
    expect(
      cacheKey("history", ["poe2", "Forbidden Rites", "currency", null]),
    ).not.toBe(base);
  });

  it("stays unique for long names that only differ at the end", () => {
    const long = "league-".repeat(40);
    const first = cacheKey("leagues", [long + "alpha"]);
    const second = cacheKey("leagues", [long + "beta"]);

    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(120);
  });
});

describe("relative age buckets", () => {
  it("picks a unit Intl.RelativeTimeFormat understands", () => {
    expect(relativeAge(9_000)).toEqual({ value: 9, unit: "second" });
    expect(relativeAge(3 * MINUTE)).toEqual({ value: 3, unit: "minute" });
    expect(relativeAge(5 * HOUR)).toEqual({ value: 5, unit: "hour" });
    expect(relativeAge(3 * 24 * HOUR)).toEqual({ value: 3, unit: "day" });
  });
});
