export default {
  app: {
    subtitle: "Zestaw narzędzi dla Exiled Exchange 2",
    version: "v{version}",
  },
  common: {
    loading: "Ładowanie…",
    retry: "Spróbuj ponownie",
    saved: "Zapisano",
    error: "Coś poszło nie tak.",
    close: "Zamknij",
    hostUnavailable:
      "Brak połączenia z procesem hosta MultiTool. Czy aplikacja nadal działa?",
  },
  nav: {
    settings: "Ustawienia",
  },
  modules: {
    economy: {
      title: "Ekonomia",
      body: "Kursy walut, wyszukiwanie i historia cen z poe2scout są planowane na etap 3.",
    },
    guides: {
      title: "Poradniki",
      body: "Lokalne poradniki Markdown i zapisywane listy zadań są planowane na etap 4.",
    },
    widgets: {
      title: "Widgety",
      body: "Liczniki czasu i tracker strefy/poziomu w overlayu są planowane na etap 5.",
    },
  },
  guides: {
    subtitle:
      "Wbudowane i lokalne poradniki Markdown. Listy zadań są zapisywane w ustawieniach forka.",
    search: "Szukaj poradników",
    newPlaceholder: "Tytuł nowego poradnika",
    create: "Nowy",
    refresh: "Odśwież",
    openFolder: "Otwórz folder",
    noResults: "Żaden poradnik nie pasuje do wyszukiwania.",
    empty: "Wybierz poradnik z listy.",
    user: "własny",
    bundled: "wbudowany",
    edit: "Edytuj",
    reveal: "Pokaż w Eksploratorze",
    save: "Zapisz",
    cancel: "Anuluj",
    editHint:
      "Nagłówek jest opcjonalny; umieść `title` i `tags` w bloku `---`.",
    progress: "{checked}/{total}",
    errorIndex:
      "Nie udało się wczytać własnych poradników. Wbudowane są nadal dostępne.",
    errorSave: "Nie udało się zapisać poradnika.",
    errorCreate: "Nie udało się utworzyć poradnika.",
    errorReveal: "Nie udało się otworzyć folderu poradników.",
  },
  economy: {
    title: "Rynek walut",
    attribution:
      "Kursy z poe2scout.com. Ceny są szacunkowe, nie są ofertami handlowymi.",
    refresh: "Odśwież",
    lastUpdated: "Zaktualizowano {age}",
    offline: "Offline — dane z pamięci podręcznej",
    error: "Nie udało się wczytać danych ekonomii.",
    errorNoRealm: "poe2scout nie zgłosił żadnego realmu Path of Exile 2.",
    errorNoLeagues: "poe2scout nie zgłosił żadnej ligii dla tego realmu.",
    league: "Liga",
    category: "Kategoria",
    reference: "Waluta odniesienia",
    referenceDefault: "Domyślna dostawcy",
    search: "Szukaj walut",
    favoritesOnly: "Tylko ulubione",
    current: "bieżąca",
    showing: "Wyświetlono {shown} z {total}",
    loadMore: "Wczytaj więcej",
    ninjaLink: "Otwórz tę kategorię na poe.ninja",
    disclaimer:
      "Dane są pobierane z poe2scout przez lokalne proxy i zapisywane w pamięci podręcznej.",
    chart: {
      title: "Historia cen",
      series: "Cena",
      empty: "Brak historii cen dla tej waluty.",
      range: {
        "7d": "7 dni",
        "30d": "30 dni",
        "90d": "90 dni",
      },
    },
    table: {
      item: "Waluta",
      price: "Cena ({currency})",
      change: "7 dni",
      stock: "Zapas",
      empty: "Żadna waluta nie pasuje do filtra.",
    },
    favorites: {
      add: "Dodaj do ulubionych",
      remove: "Usuń z ulubionych",
    },
  },
  placeholder: {
    phase: "Planowane na etap {phase}",
  },
  settings: {
    title: "Ustawienia",
    no_key: "Kliknij i naciśnij klawisz",
    language: {
      title: "Język",
      hint: "Dotyczy tylko huba. Overlay zachowuje własne ustawienie języka.",
      auto: "Automatyczny",
      en: "English",
      pl: "Polski",
    },
    hotkey: {
      title: "Skrót huba",
      hint: "Otwiera MultiTool Hub. Rejestrowany tylko gdy Path of Exile 2 jest aktywne, jak każdy inny skrót.",
      clear: "Wyczyść",
      empty: "Brak skrótu",
      localOnly:
        "Skrót huba zmienia wyłącznie lokalny interfejs; nigdy nie wysyła wejścia do gry.",
    },
    storage: {
      title: "Przechowywanie",
      body: "Ustawienia huba są zapisywane w sekcji `mt` pliku konfiguracji aplikacji. Nic nie trafia do pamięci przeglądarki.",
    },
    saveFailed: "Nie udało się zapisać ustawienia.",
  },
};
