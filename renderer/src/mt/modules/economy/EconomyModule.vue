<template>
  <section class="mx-auto max-w-6xl space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-gray-100">
          {{ t("economy.title") }}
        </h2>
        <p class="mt-1 text-xs text-gray-500">
          {{ t("economy.attribution") }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span
          v-if="s.offline.value"
          class="rounded border border-amber-700/60 bg-amber-950/30 px-2 py-0.5 text-amber-300"
        >
          {{ t("economy.offline") }}
        </span>
        <span v-if="lastUpdated" class="text-gray-500">{{ lastUpdated }}</span>
        <button
          type="button"
          class="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100 disabled:opacity-50"
          :disabled="s.refreshing.value || s.loading.value"
          @click="refresh"
        >
          <i
            class="fa-solid fa-rotate mr-1"
            :class="{ 'fa-spin': s.refreshing.value }"
            aria-hidden="true"
          />
          {{ t("economy.refresh") }}
        </button>
      </div>
    </header>

    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <label class="block text-xs text-gray-500">
        {{ t("economy.league") }}
        <select
          class="mt-1 w-full rounded-md border border-gray-700 bg-[#10151d] px-2 py-1.5 text-sm text-gray-200 disabled:opacity-50"
          :value="s.league.value ?? ''"
          :disabled="s.loading.value || s.leagues.value.length === 0"
          @change="onLeagueChange"
        >
          <option
            v-for="entry in s.leagues.value"
            :key="entry.value"
            :value="entry.value"
          >
            {{ entry.value
            }}{{ entry.isCurrent ? ` (${t("economy.current")})` : "" }}
          </option>
        </select>
      </label>

      <label class="block text-xs text-gray-500">
        {{ t("economy.category") }}
        <select
          class="mt-1 w-full rounded-md border border-gray-700 bg-[#10151d] px-2 py-1.5 text-sm text-gray-200 disabled:opacity-50"
          :value="s.category.value"
          :disabled="s.loading.value || s.categories.value.length === 0"
          @change="onCategoryChange"
        >
          <option
            v-for="entry in s.categories.value"
            :key="entry.apiId"
            :value="entry.apiId"
          >
            {{ entry.label }}
          </option>
        </select>
      </label>

      <label class="block text-xs text-gray-500">
        {{ t("economy.reference") }}
        <select
          class="mt-1 w-full rounded-md border border-gray-700 bg-[#10151d] px-2 py-1.5 text-sm text-gray-200 disabled:opacity-50"
          :value="s.referenceCurrency.value ?? ''"
          :disabled="s.loading.value"
          @change="onReferenceChange"
        >
          <option value="">{{ t("economy.referenceDefault") }}</option>
          <option
            v-for="entry in s.referenceCurrencies.value"
            :key="entry.apiId ?? entry.text"
            :value="entry.apiId ?? ''"
            :disabled="entry.apiId === null"
          >
            {{ entry.text }}
          </option>
        </select>
      </label>

      <label class="block text-xs text-gray-500">
        {{ t("economy.search") }}
        <input
          v-model="s.search.value"
          type="search"
          class="mt-1 w-full rounded-md border border-gray-700 bg-[#10151d] px-2 py-1.5 text-sm text-gray-200"
          :placeholder="t('economy.search')"
        />
      </label>
    </div>

    <div class="flex flex-wrap items-center gap-3 text-xs">
      <label class="flex items-center gap-2 text-gray-400">
        <input
          v-model="s.favoritesOnly.value"
          type="checkbox"
          class="accent-amber-500"
        />
        {{ t("economy.favoritesOnly") }}
      </label>
      <a
        class="text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
        :href="ninjaUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t("economy.ninjaLink") }}
      </a>
    </div>

    <p
      v-if="s.error.value"
      class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200"
    >
      {{ errorText }}
    </p>

    <p
      v-if="s.loading.value && s.rows.value.length === 0"
      class="text-sm text-gray-400"
    >
      {{ t("common.loading") }}
    </p>

    <div v-else class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="min-w-0 space-y-2">
        <MtCurrencyTable
          :rows="s.visibleRows.value"
          :selected-api-id="s.selectedApiId.value"
          :reference-label="referenceLabel"
          :is-favorite="s.isFavorite"
          @select="s.selectCurrency"
          @toggle-favorite="onToggleFavorite"
        />

        <div
          class="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500"
        >
          <span>
            {{
              t("economy.showing", {
                shown: s.visibleRows.value.length,
                total: s.total.value,
              })
            }}
          </span>
          <button
            v-if="s.page.value < s.pages.value"
            type="button"
            class="rounded border border-gray-700 px-2 py-1 text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-50"
            :disabled="s.loading.value"
            @click="s.loadMore"
          >
            {{ t("economy.loadMore") }}
          </button>
        </div>
      </div>

      <MtPriceChart
        class="h-80 xl:sticky xl:top-0"
        :points="s.historyPoints.value"
        :range="s.chartRange.value"
        :loading="s.historyLoading.value"
        :title="s.selectedRow.value?.text ?? null"
        @change-range="s.setChartRange"
      />
    </div>

    <footer
      class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-2 text-xs text-gray-600"
    >
      <span>{{ t("economy.disclaimer") }}</span>
      <a
        class="underline-offset-2 hover:text-gray-400 hover:underline"
        href="https://poe2scout.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        poe2scout.com
      </a>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { MtConfig, MtEconomyConfig } from "@ipc/mt";
import { ninjaCategoryUrl, type CurrencyRow } from "../../economy/provider";
import { useEconomy } from "../../economy/store";
import MtCurrencyTable from "../../economy/MtCurrencyTable.vue";
import MtPriceChart from "../../economy/MtPriceChart.vue";

const props = defineProps<{ config: MtConfig }>();

const emit = defineEmits<{
  (event: "change", patch: Partial<MtConfig>): void;
}>();

const { t, locale } = useI18n();
const s = useEconomy();

const referenceLabel = computed(
  () => s.referenceLabel.value ?? t("economy.referenceDefault"),
);

const ninjaUrl = computed(() =>
  ninjaCategoryUrl(s.league.value ?? "", s.category.value),
);

const lastUpdated = computed(() => {
  const age = s.age.value;
  if (!age) return null;
  const formatter = new Intl.RelativeTimeFormat(locale.value, {
    numeric: "auto",
  });
  return t("economy.lastUpdated", {
    age: formatter.format(-age.value, age.unit),
  });
});

const errorText = computed(() => {
  const code = s.error.value;
  if (code === "no-poe2-realm") return t("economy.errorNoRealm");
  if (code === "no-leagues") return t("economy.errorNoLeagues");
  return t("economy.error");
});

function currentEconomy(
  overrides: Partial<MtEconomyConfig> = {},
): MtEconomyConfig {
  return {
    source: "poe2scout",
    realm: s.realm.value,
    league: s.league.value,
    referenceCurrency: s.referenceCurrency.value,
    favorites: s.favorites.value,
    lastCategory: s.category.value,
    ...overrides,
  };
}

function sameFavorites(
  left: MtEconomyConfig["favorites"],
  right: MtEconomyConfig["favorites"],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.apiId === right[index].apiId && entry.name === right[index].name,
    )
  );
}

/** Persist only what actually changed, and always the complete economy object. */
function persistEconomy(next: MtEconomyConfig): void {
  const current = props.config.economy;
  if (
    current.realm === next.realm &&
    current.league === next.league &&
    current.referenceCurrency === next.referenceCurrency &&
    current.lastCategory === next.lastCategory &&
    sameFavorites(current.favorites, next.favorites)
  ) {
    return;
  }
  emit("change", { economy: next });
}

async function open(): Promise<void> {
  const current = props.config.economy;
  await s.open({
    realm: current.realm,
    league: current.league,
    category: current.lastCategory,
    referenceCurrency: current.referenceCurrency,
    favorites: current.favorites,
  });
  persistEconomy(currentEconomy());
}

async function refresh(): Promise<void> {
  await s.refresh();
}

async function onLeagueChange(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value;
  await s.setLeague(value);
  persistEconomy(currentEconomy());
}

async function onCategoryChange(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value;
  await s.setCategory(value);
  persistEconomy(currentEconomy());
}

async function onReferenceChange(event: Event): Promise<void> {
  const value = (event.target as HTMLSelectElement).value;
  await s.setReferenceCurrency(value || null);
  persistEconomy(currentEconomy());
}

function onToggleFavorite(row: CurrencyRow): void {
  const favorites = s.toggleFavorite(row);
  persistEconomy(currentEconomy({ favorites }));
}

onMounted(() => {
  open().catch(() => undefined);
});
</script>
