<template>
  <div class="overflow-hidden rounded-lg border border-gray-800">
    <table class="w-full table-fixed text-sm">
      <thead class="bg-[#10151d] text-xs uppercase tracking-wide text-gray-500">
        <tr>
          <th class="w-8 px-2 py-2" />
          <th class="px-2 py-2 text-left font-medium">
            {{ t("economy.table.item") }}
          </th>
          <th class="w-32 px-2 py-2 text-right font-medium">
            {{ t("economy.table.price", { currency: referenceLabel }) }}
          </th>
          <th class="w-24 px-2 py-2 text-right font-medium">
            {{ t("economy.table.change") }}
          </th>
          <th class="w-24 px-2 py-2 text-right font-medium">
            {{ t("economy.table.stock") }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.apiId"
          class="cursor-pointer border-t border-gray-800/70 transition-colors hover:bg-gray-800/40"
          :class="{
            'bg-amber-500/10': row.apiId === selectedApiId,
          }"
          @click="emit('select', row.apiId)"
        >
          <td class="px-2 py-1.5">
            <button
              type="button"
              class="w-5 text-center transition-colors"
              :class="
                isFavorite(row.apiId)
                  ? 'text-amber-300'
                  : 'text-gray-600 hover:text-gray-300'
              "
              :title="
                isFavorite(row.apiId)
                  ? t('economy.favorites.remove')
                  : t('economy.favorites.add')
              "
              @click.stop="emit('toggle-favorite', row)"
            >
              <i
                :class="
                  isFavorite(row.apiId)
                    ? 'fa-solid fa-star'
                    : 'fa-regular fa-star'
                "
                aria-hidden="true"
              />
            </button>
          </td>
          <td class="truncate px-2 py-1.5">
            <div class="flex min-w-0 items-center gap-2">
              <img
                v-if="row.icon"
                :src="row.icon"
                :alt="row.text"
                class="h-6 w-6 shrink-0 object-contain"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <span class="truncate text-gray-200">{{ row.text }}</span>
            </div>
          </td>
          <td class="px-2 py-1.5 text-right font-mono text-gray-100">
            {{ formatPrice(row.price) }}
          </td>
          <td
            class="px-2 py-1.5 text-right font-mono"
            :class="changeClass(row)"
          >
            {{ formatChange(row) }}
          </td>
          <td class="px-2 py-1.5 text-right font-mono text-gray-500">
            {{ row.quantity === null ? "—" : formatInt(row.quantity) }}
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="5" class="px-2 py-6 text-center text-gray-500">
            {{ t("economy.table.empty") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import { priceChangePercent, type CurrencyRow } from "./provider";

defineProps<{
  rows: CurrencyRow[];
  selectedApiId: string | null;
  referenceLabel: string | null;
  isFavorite: (apiId: string) => boolean;
}>();

const emit = defineEmits<{
  (event: "select", apiId: string): void;
  (event: "toggle-favorite", row: CurrencyRow): void;
}>();

const { t, locale } = useI18n();

const priceFormat = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      maximumSignificantDigits: 4,
      notation: "standard",
    }),
);
const intFormat = computed(() => new Intl.NumberFormat(locale.value));

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return priceFormat.value.format(value);
}

function formatInt(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return intFormat.value.format(value);
}

function changeClass(row: CurrencyRow): string {
  const change = priceChangePercent(row.history);
  if (change === null || Math.abs(change) < 0.5) return "text-gray-500";
  return change > 0 ? "text-emerald-400" : "text-red-400";
}

function formatChange(row: CurrencyRow): string {
  const change = priceChangePercent(row.history);
  if (change === null) return "—";
  const rounded =
    Math.abs(change) < 10 ? change.toFixed(1) : Math.round(change);
  return `${Number(rounded) > 0 ? "+" : ""}${rounded}%`;
}
</script>
