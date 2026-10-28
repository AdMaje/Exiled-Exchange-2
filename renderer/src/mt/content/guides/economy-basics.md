---
title: Reading the economy tab
tags: economy, poe2scout
order: 3
---

# Reading the economy tab

The Economy tab is a viewer for [poe2scout](https://poe2scout.com), not a trade
tool. Prices are estimates collected from public trade data, not offers you can
accept.

## Columns

- **Currency**: the item name and icon reported by the provider.
- **Price**: the current price in the selected reference currency.
- **7d**: change between the first and last daily price point. Green means the
  price rose, red means it fell, and a dash means there is not enough history.
- **Stock**: the quantity the provider observed.

## Reference currency

The provider reports prices relative to a base currency, usually the Exalted
Orb. Choosing **Divine Orb** or another reference recalculates the table and the
chart in that unit. **Provider default** keeps the base currency untouched.

## Chart ranges

- **7d** uses the daily points that arrive with the table, so it costs no extra
  request.
- **30d** and **90d** fetch hourly history for the selected currency. The
  provider currently keeps roughly two months, so **90d** may show less.
- The history cache is valid for one hour; the table cache for fifteen minutes.

## Offline behaviour

Every response is cached on disk. If poe2scout cannot be reached, the hub shows
the cached table with an **Offline — cached data** badge and the age of the last
successful update. Press **Refresh** to try again.

## Links

- [poe2scout](https://poe2scout.com)
- [poe.ninja PoE2 economy](https://poe.ninja/poe2/economy) — the hub only links
  here and never fetches from it.
