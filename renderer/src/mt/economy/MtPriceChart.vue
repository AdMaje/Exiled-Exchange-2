<template>
  <section
    class="flex flex-col rounded-lg border border-gray-800 bg-[#10151d] p-3"
  >
    <header class="mb-2 flex items-center justify-between gap-2">
      <h3 class="truncate text-sm font-semibold text-gray-200">
        {{ title ?? t("economy.chart.title") }}
      </h3>
      <span v-if="loading" class="text-xs text-gray-500">
        {{ t("common.loading") }}
      </span>
    </header>

    <div class="mb-2 flex gap-1">
      <button
        v-for="range in MT_PRICE_RANGES"
        :key="range.key"
        type="button"
        class="rounded border px-2 py-0.5 text-xs transition-colors"
        :class="
          range.key === activeRange
            ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
            : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
        "
        @click="emit('change-range', range.key)"
      >
        {{ t(`economy.chart.range.${range.key}`) }}
      </button>
    </div>

    <div
      v-if="series[0].data.length === 0"
      class="flex flex-1 items-center justify-center"
    >
      <p class="text-xs text-gray-500">{{ t("economy.chart.empty") }}</p>
    </div>

    <VueApexcharts
      v-else
      class="min-h-0 flex-1"
      type="area"
      height="100%"
      :options="options"
      :series="series"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import VueApexcharts from "vue3-apexcharts";
import {
  MT_PRICE_RANGES,
  type MtPriceRange,
  type Poe2ScoutPricePoint,
} from "./provider";

const props = defineProps<{
  points: Poe2ScoutPricePoint[];
  range: MtPriceRange;
  loading: boolean;
  title?: string | null;
}>();

const emit = defineEmits<{
  (event: "change-range", range: MtPriceRange): void;
}>();

const { t, locale } = useI18n();

const activeRange = computed(() => props.range);

// ApexCharts only reads `options` when it re-renders; a locale change needs a
// fresh options object, so keep a local copy that mirrors the props.
const chartPoints = ref<Array<[number, number]>>([]);

watch(
  () => props.points,
  (points) => {
    chartPoints.value = points.map((point) => [point.time, point.price]);
  },
  { immediate: true, deep: true },
);

const series = computed(() => [
  { name: t("economy.chart.series"), data: chartPoints.value },
]);

const priceFormat = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      maximumSignificantDigits: 4,
    }),
);
const dateFormat = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      month: "short",
      day: "numeric",
    }),
);

const options = computed(() => ({
  chart: {
    type: "area",
    background: "transparent",
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: false },
    fontFamily: "inherit",
  },
  theme: { mode: "dark" as const },
  colors: ["#f59e0b"],
  stroke: { curve: "smooth" as const, width: 2 },
  fill: {
    type: "gradient",
    gradient: { opacityFrom: 0.35, opacityTo: 0.02 },
  },
  dataLabels: { enabled: false },
  grid: { borderColor: "#1f2937", strokeDashArray: 3 },
  xaxis: {
    type: "datetime" as const,
    labels: {
      style: { colors: "#6b7280", fontSize: "10px" },
      formatter: (value: number) => dateFormat.value.format(value),
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
    tooltip: { enabled: false },
  },
  yaxis: {
    labels: {
      style: { colors: "#6b7280", fontSize: "10px" },
      formatter: (value: number) => priceFormat.value.format(value),
    },
  },
  tooltip: {
    theme: "dark" as const,
    x: { formatter: (value: number) => dateFormat.value.format(value) },
    y: {
      formatter: (value: number) => priceFormat.value.format(value),
      title: { formatter: () => "" },
    },
  },
  markers: { size: 0 },
}));
</script>
