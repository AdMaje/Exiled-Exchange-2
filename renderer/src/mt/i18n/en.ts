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
