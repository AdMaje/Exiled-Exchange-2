export default {
  app: {
    subtitle: "Fork toolkit for Exiled Exchange 2",
    version: "v{version}",
  },
  common: {
    loading: "Loading…",
    retry: "Retry",
    saved: "Saved",
    error: "Something went wrong.",
    close: "Close",
    hostUnavailable:
      "Cannot reach the MultiTool host process. Is the app still running?",
  },
  nav: {
    settings: "Settings",
  },
  modules: {
    economy: {
      title: "Economy",
      body: "Currency rates, search and price history from poe2scout are planned for Phase 3.",
    },
    guides: {
      title: "Guides",
      body: "Local Markdown guides and persisted checklists are planned for Phase 4.",
    },
    widgets: {
      title: "Widgets",
      body: "Countdown timers and a zone/level tracker inside the overlay are planned for Phase 5.",
    },
  },
  guides: {
    subtitle:
      "Bundled and local Markdown guides. Checklists are saved in the fork settings.",
    search: "Search guides",
    newPlaceholder: "New guide title",
    create: "New",
    refresh: "Reload",
    openFolder: "Open folder",
    noResults: "No guide matches the search.",
    empty: "Select a guide from the list.",
    user: "user",
    bundled: "bundled",
    edit: "Edit",
    reveal: "Show in Explorer",
    save: "Save",
    cancel: "Cancel",
    editHint:
      "Frontmatter is optional; wrap `title` and `tags` in a `---` block.",
    progress: "{checked}/{total}",
    errorIndex:
      "Could not read user guides. Bundled guides are still available.",
    errorSave: "Could not save the guide.",
    errorCreate: "Could not create the guide.",
    errorReveal: "Could not open the guide folder.",
  },
  economy: {
    title: "Currency market",
    attribution:
      "Rates by poe2scout.com. Prices are estimates, not trade offers.",
    refresh: "Refresh",
    lastUpdated: "Updated {age}",
    offline: "Offline — cached data",
    error: "Could not load economy data.",
    errorNoRealm: "poe2scout did not report a Path of Exile 2 realm.",
    errorNoLeagues: "poe2scout did not report any league for this realm.",
    league: "League",
    category: "Category",
    reference: "Reference currency",
    referenceDefault: "Provider default",
    search: "Search currencies",
    favoritesOnly: "Favorites only",
    current: "current",
    showing: "Showing {shown} of {total}",
    loadMore: "Load more",
    ninjaLink: "Open this category on poe.ninja",
    disclaimer:
      "Data is fetched from poe2scout through the local proxy and cached on disk.",
    chart: {
      title: "Price history",
      series: "Price",
      empty: "No price history for this currency yet.",
      range: {
        "7d": "7d",
        "30d": "30d",
        "90d": "90d",
      },
    },
    table: {
      item: "Currency",
      price: "Price ({currency})",
      change: "7d",
      stock: "Stock",
      empty: "No currencies match this filter.",
    },
    favorites: {
      add: "Add to favorites",
      remove: "Remove from favorites",
    },
  },
  placeholder: {
    phase: "Planned for Phase {phase}",
  },
  settings: {
    title: "Settings",
    no_key: "Click and press a key",
    language: {
      title: "Language",
      hint: "Hub language only. The overlay keeps its own upstream language setting.",
      auto: "Auto",
      en: "English",
      pl: "Polski",
    },
    hotkey: {
      title: "Hub hotkey",
      hint: "Opens the MultiTool Hub. Registered only while Path of Exile 2 is focused, like every other hotkey.",
      clear: "Clear",
      empty: "No hotkey set",
      localOnly:
        "The hub hotkey only changes local UI state; it never sends input to the game.",
    },
    storage: {
      title: "Storage",
      body: "Hub settings live in the fork-owned `mt` section of the app config file. Nothing is stored in the browser.",
    },
    saveFailed: "Could not save the setting.",
  },
};
