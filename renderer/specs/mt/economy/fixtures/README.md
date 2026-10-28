# Economy fixtures

Recorded once from the live **poe2scout** API on **2026-10-28** with polite spacing
(2–3 s between requests) and the fork User-Agent
`Poe2MultiTool/dev (+https://github.com/AdMaje/Exiled-Exchange-2)`.

Tests never hit the network. Every fixture has a sibling `.meta.json` with the exact
request URL, HTTP status and collection date so schema drift is visible in review.

| File | Endpoint | Notes |
| --- | --- | --- |
| `realms.json` | `GET /Realms` | One PoE1 realm + the PoE2 realm (`RealmApiId: "poe2"`). |
| `leagues.json` | `GET /poe2/Leagues` | First three leagues; names are volatile and only used for parser tests. |
| `categories.json` | `GET /poe2/Leagues/{league}/Items/Categories` | One unique category + `currency`, `fragments`, `runes`. |
| `reference-currencies.json` | `GET .../ReferenceCurrencies` | `exalted`, `chaos`, `divine` with relative prices. |
| `currency-page.json` | `GET .../Currencies/ByCategory?category=currency` | Three rows, `PriceLogs` trimmed to first/middle/last. |
| `item-history.json` | `GET .../Items/295/History?logCount=7&referenceCurrency=divine` | Hourly points for the 30d/90d chart range. |
| `pair-history-empty.json` | `GET .../Currencies/Pairs/exalted/divine/History` | Returned `History: []` for every pair tried (string and numeric ids); not used by the app. |

The provider rejects `dataPoints` other than 7 or 8 on `ByCategory` (verified live: `"DataPoints must be 7 or 8."`), so longer chart ranges use the per-item history endpoint.

Re-record only when the provider changes, keep the payloads trimmed and remove any
personal data. Do not add fixtures that need a token or a login.
