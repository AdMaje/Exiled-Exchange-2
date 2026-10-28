---
title: How to use this hub
tags: hub, basics
order: 1
---

# How to use this hub

PoE2 MultiTool keeps tools that do not belong in the in-game overlay in one
normal desktop window. It never sends input to Path of Exile 2 and never reads
the game process or memory.

## Tabs

- **Economy** shows currency rates from [poe2scout](https://poe2scout.com),
  with search, favorites and a price chart. Press **Refresh** when you want new
  data; nothing is polled in the background.
- **Guides** is this library. Bundled guides are read-only; guides you create
  live in the user data folder and can be edited or revealed in Explorer.
- **Widgets** lists the overlay widgets this fork adds. Widget
  settings themselves stay in the overlay's own settings window.

## Language and hotkeys

The gear button opens Settings, where you can switch the hub between English,
Polish and automatic language detection. The hub hotkey is registered only
while the game is focused, exactly like the upstream shortcuts.

## Where data lives

- Settings: the `mt` section of the app config file.
- Economy cache: the `multitool/cache` folder in the same user data directory.
- Your guides: the `multitool/guides` folder.

The hub never uses browser storage, because the local server port changes on
every start.

## Related links

- [poe2scout API](https://api.poe2scout.com/swagger)
- [poe.ninja PoE2 economy](https://poe.ninja/poe2/economy)
