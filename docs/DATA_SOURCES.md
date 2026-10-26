# Data Sources

Decisions and verified facts for every external data source used by PoE2 MultiTool modules.
Checked on **2026-10-26**. Re-verify before each release or when a provider changes.

Golden rule: **if we cannot point to a public API or a permission, we do not fetch it.**
When in doubt, link out to the site instead of scraping it.

---

## 1. Summary

| Source | Use | Method | Status |
| --- | --- | --- | --- |
| **poe2scout** (`api.poe2scout.com`) | Economy: rates, search, history, favorites | Public JSON API via local proxy | **Primary** |
| **poe.ninja** | Deep links only ("open on poe.ninja") | User browser | **No fetching** (ToS) |
| **GGG trade API** (`pathofexile.com/api/trade2`) | Price check / bulk (upstream only) | Upstream code, unchanged | Do not extend |
| **EE2 aggregator** (`api.exiledexchange2.dev`) | Upstream price-check data | Upstream code, unchanged | Do not extend |
| `Client.txt` | Zone/level tracker | Upstream `GameLogWatcher` | Reuse |
| Clipboard | Price check item text | Upstream | Reuse |
| Local files / config | Guides, checklists, cache | Ours | New |

---

## 2. poe2scout (primary economy provider)

### 2.1 Identity & terms

- Site: <https://poe2scout.com> — API: <https://api.poe2scout.com>
- Source: <https://github.com/poe2scout/poe2scout> (MIT). Independent project, not
  affiliated with Grinding Gear Games.
- API docs: <https://api.poe2scout.com/swagger> — machine-readable OpenAPI 3.1 at
  **`https://api.poe2scout.com/openapi/v1.json`** (note: `/swagger/v1/swagger.json`
  returns 404; do not rely on that path).
- Their README asks sustained users to **include a `User-Agent` with contact info**.
  We send: `Poe2MultiTool/<version> (+https://github.com/AdMaje/Exiled-Exchange-2)`.
- No published rate limits or rate-limit headers were observed on 2026-10-26. Treat the
  API as a courtesy service: cache, serialize, back off.
- They derive data from the official GGG trade API; prices are estimates, not offers.

### 2.2 Access path

The API sends **no CORS headers**, so the renderer must call it through the existing local
proxy: `Host.proxy("api.poe2scout.com/...")` → `main/src/proxy.ts`. This works both in the
Electron overlay, the hub window and the browser QA mode (the page is served by the
Electron HTTP server).

Planned Phase 3 hook in `main/src/proxy.ts`:

```ts
// MT: BEGIN mt-proxy
// allow the economy provider + send a contactable UA for that host only
// MT: END mt-proxy
```

Upstream behavior for GGG/ninja hosts stays untouched.

### 2.3 Endpoints (verified)

Base: `https://api.poe2scout.com`. `{realm}` for PoE2 is **`poe2`** (from `/Realms`:
`Value: "poe2/poe2"`, `GameApiId: "poe2"`, `TradeApiPath: "trade2"`).

| Method & path | Query | Use |
| --- | --- | --- |
| `GET /Realms` | — | Discover realms; filter `GameApiId === "poe2"` |
| `GET /{realm}/Leagues` | — | League list for the selected realm |
| `GET /{realm}/Leagues/{league}/Currencies/ByCategory` | `category`*, `page`, `perPage`, `dataPoints`, `frequencyHours`, `referenceCurrency`, `search` | Economy table / search |
| `GET /{realm}/Leagues/{league}/Currencies/{apiId}` | — | Single currency detail |
| `GET /{realm}/Leagues/{league}/Currencies/Pairs/{a}/{b}/History` | `limit`*, `endEpoch` | Rate history for a pair |
| `GET /{realm}/Leagues/{league}/ExchangeSnapshot` | — | Current exchange snapshot |
| `GET /{realm}/Leagues/{league}/SnapshotPairs` | — | All tracked pairs |
| `GET /{realm}/Leagues/{league}/SnapshotHistory` | `limit`*, `endEpoch` | Snapshot history |
| `GET /{realm}/Leagues/{league}/ReferenceCurrencies` | — | Valid `referenceCurrency` ids |
| `GET /{realm}/Leagues/{league}/Items` | — | Item index |
| `GET /{realm}/Leagues/{league}/Items/Categories` | — | Item categories |
| `GET /{realm}/Leagues/{league}/Items/{itemId}` | — | Single item |
| `GET /{realm}/Leagues/{league}/Items/{itemId}/History` | `logCount`*, `endTime`, `referenceCurrency` | Item price history |
| `GET /{realm}/Leagues/{league}/Items/{itemId}/DailyStatsHistory` | `dayCount`*, `endDate` | Daily aggregates |
| `GET /{realm}/Leagues/{league}/Items/PriceHistory` | — | Bulk price history |
| `GET /{realm}/Leagues/{league}/Uniques/ByCategory` | `category`*, `page`, `perPage`, `dataPoints`, `frequencyHours`, `referenceCurrency`, `search` | Uniques |
| `GET /Realms/{realm}/Filters`, `GET /Realms/{realm}/LandingSplashInfo` | — | Optional UI metadata |

`*` = required. Observed league response fields include `Value`, `ShortName`,
`IsCurrent`, `DivinePrice`, `ChaosDivinePrice`, `BaseCurrencyApiId`,
`BaseCurrencyText`, `BaseCurrencyIconUrl`, `ExaltedCurrencyText`, ... (full shape to be
locked by recorded fixtures in Phase 3).

Live data is volatile: on 2026-10-26 `/poe2/Leagues` returned `Forbidden Rites` as current.
**Never hardcode leagues, realms, category ids or currency ids.** Resolve them at runtime;
default to the league the user already selected in EE2 (`useLeagues()` / `Config.leagueId`)
when it exists in the provider's list, otherwise the provider's `IsCurrent` league.

### 2.4 Caching & rate policy

File-backed cache (survives restarts, not origin-scoped):

- Location: `%APPDATA%\<userData>\multitool\cache\*.json`
- Envelope: `{ v, source, realm, league, savedAt, expiresAt, payload }`
- Key: path-safe slug of source/realm/league/query.

| Data | TTL | Notes |
| --- | --- | --- |
| `/Realms` | 7 days | rarely changes |
| Leagues | 24 h | also refresh on league-selection errors |
| Reference currencies | 24 h | |
| Currency tables (`ByCategory`) | 15 min | stale-while-revalidate |
| Exchange snapshot / pairs | 5 min | |
| Pair/snapshot history | 1 h | |
| Items index / categories | 24 h | |
| Item history / daily stats | 1 h | |

Runtime rules:

- One in-flight request per provider; minimum 1 s spacing between requests.
- Honor `Retry-After` on `429`/`503`; exponential backoff (2 s, 4 s, 8 s, then stop and
  show cached data). Never retry more than 3 times per user action.
- No background polling when the hub window is closed. Refresh on open/focus or explicit
  "Refresh".
- Send conditional requests when the server provides validators (observed
  `Last-Modified`), and reuse the cached payload on `304`.
- UI always shows **"last updated"** from `savedAt` and a clear **offline/stale** badge.
- Do not bypass or modify upstream trade `RateLimiter`; this queue is separate and only
  for the economy provider.

### 2.5 Attribution

- Economy tab footer: "Data by poe2scout.com" + link.
- `docs/DATA_SOURCES.md` (this file) is linked from the hub's About/Help.
- Do not imply endorsement by poe2scout or GGG.

### 2.6 Open items for Phase 3

- Max values / accepted ranges for `perPage`, `limit`, `dayCount`, `dataPoints`
  (test conservatively: `perPage=50`, `limit=100`).
- Stable category ids (`currency` verified; confirm others) and `referenceCurrency`
  defaults per league.
- Response shapes and error format for: unknown league, private league, empty league.
- Whether `ETag` is served in addition to `Last-Modified`.
- Whether history points are ordered and what unit `endEpoch`/`endTime` expects.
- Record one fixture per endpoint, trimmed and anonymized, into
  `renderer/specs/mt/economy/fixtures/`.

---

## 3. poe.ninja (links only — no fetching)

Verified on 2026-10-26:

- `https://poe.ninja/robots.txt`: `User-agent: *` / `Disallow: /dev/` (no blanket block).
- `https://poe.ninja/poe2/api/economy/leagues` returns JSON (technically accessible).
- **Terms of Service** (<https://poe.ninja/terms>, updated 2024-09-28) grant only
  "temporary download [of] one copy of the materials ... for personal, non-commercial
  transitory viewing only" and prohibit modifying/copying the materials, using them for
  "any commercial purpose, or for any public display (commercial or non-commercial)",
  removing proprietary notices, and transferring/mirroring the materials.

Decision (D4): **do not build a poe.ninja data adapter.** Automated in-app ingestion and
local caching are not clearly permitted, and the project rule is "never scrape sites that
forbid it". We only:

- render "Open on poe.ninja" deep links, opened in the user's default browser;
- use URL patterns already used by upstream (`renderer/src/web/background/Prices.ts`),
  e.g. `https://poe.ninja/poe2/economy/{leagueSlug}/{category}/{detailsId}` — league slug
  is derived from the API-provided league name (lowercased, spaces removed), never
  hardcoded.

Upstream EE2's own price-check data path (via `api.exiledexchange2.dev`) is left exactly
as-is. We do not add traffic to it, cache it differently, or change its rate limiting.

---

## 4. Official GGG APIs

Policy: <https://www.pathofexile.com/developer/docs> (checked 2026-10-26).

- Permitted app types include "executable apps that run independently from the game";
  reading the game's log files is OK if the user is aware.
- Macro rules: manually invoked, one set function, one game action. **No automation.**
- Prohibited: interacting with the game process/files (ToU 7b/7c/7i) and
  reverse-engineering undocumented endpoints (7i).
- Any OAuth app must use `User-Agent: OAuth {clientId}/{version} (contact: ...)`. MT uses
  **no OAuth** and does not add GGG API calls.
- Rate limits are dynamic and exposed via `X-Rate-Limit-*` + `Retry-After`; upstream
  already implements this for trade. Do not weaken it.
- Third-party notice required: "This product isn't affiliated with or endorsed by
  Grinding Gear Games in any way." (About, README, installer).

What this means for MT:

- Economy data comes from poe2scout, **not** from pathofexile.com economy endpoints.
- No new GGG endpoints, no scraping of trade pages beyond what upstream already does.
- Hub/widgets never send input to the game; hotkeys change local UI state only.

---

## 5. Local data

| Data | Location | Owner |
| --- | --- | --- |
| MT settings (`mt` subtree) | `%APPDATA%\<userData>\apt-data\config.json` | shared with upstream config |
| Economy cache | `%APPDATA%\<userData>\multitool\cache\` | MT |
| User guides | `%APPDATA%\<userData>\multitool\guides\*.md` | MT (user-authored) |
| Bundled guides | `renderer/src/mt/content/guides/*.md` (build-time) | MT |
| Checklist progress | `mt.guides.progress` in config | MT |
| Zone/level state | `Client.txt` via upstream watcher (in-memory) | upstream |

Rules:

- Never write MT data into web storage (`localStorage`/IndexedDB): the production port is
  random, so the origin changes every start.
- Cache and guide writes go through main over `/mt/*` routes with size limits and
  path-traversal guards (slug whitelist `[a-z0-9-_]`, `.md` only).
- Guide content is only user-authored or original MT content. No copied third-party guide
  text; external references are links.

---

## 6. Testing & fixtures

- Providers are tested against recorded fixtures only; tests never hit the network.
- Recording is a developer action (Phase 3 script or manual save), documented in the
  provider folder. Trim to the smallest useful payload (< 2 MB, pre-commit limit).
- Remove account names, tokens, cookies and any personal data from fixtures.
- Every fixture includes the request URL, HTTP status and collection date in a sibling
  `.meta.json` so we can detect upstream shape drift.
- CI must fail on schema mismatch, not silently render empty tables.
