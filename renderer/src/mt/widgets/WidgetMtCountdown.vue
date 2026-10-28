<template>
  <Widget :config="config" move-handles="corners" :inline-edit="false">
    <div class="widget-default-style relative min-w-36 px-2 py-1 text-gray-100">
      <div class="flex items-baseline justify-between gap-3">
        <span
          v-if="config.wmTitle"
          class="max-w-40 truncate text-xs text-gray-400"
        >
          {{ config.wmTitle }}
        </span>
        <span
          class="font-mono text-2xl leading-none tabular-nums"
          :class="{
            'text-red-400': finished,
            'text-gray-400': !isRunning && !finished,
          }"
        >
          {{ formatted }}
        </span>
      </div>

      <div class="mt-1 flex items-center gap-1 text-xs">
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-gray-300 hover:bg-gray-700 hover:text-white"
          :title="
            isRunning
              ? t('overlay.countdown.pause')
              : t('overlay.countdown.start')
          "
          :aria-label="
            isRunning
              ? t('overlay.countdown.pause')
              : t('overlay.countdown.start')
          "
          @click="isRunning ? pause() : start()"
        >
          <i
            class="fas"
            :class="isRunning ? 'fa-pause' : 'fa-play'"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-gray-300 hover:bg-gray-700 hover:text-white"
          :title="t('overlay.countdown.reset')"
          :aria-label="t('overlay.countdown.reset')"
          @click="reset"
        >
          <i class="fas fa-redo" aria-hidden="true" />
        </button>
        <span v-if="finished" class="ml-1 text-red-400">
          {{ t("overlay.countdown.finished") }}
        </span>
      </div>

      <div
        v-if="showProgressBar"
        class="mt-1 h-1 overflow-hidden rounded bg-gray-700"
      >
        <div
          class="h-full bg-amber-400 transition-[width] duration-200"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>
    </div>
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from "@/web/overlay/interfaces";
import { MT_COUNTDOWN_TYPE } from "./types";

export default {
  widget: {
    type: MT_COUNTDOWN_TYPE,
    instances: "multi",
    trNameKey: "MT Countdown",
  } satisfies WidgetSpec,
};
</script>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from "vue";
import Widget from "@/web/overlay/Widget.vue";
import { AppConfig } from "@/web/Config";
import type { WidgetManager } from "@/web/overlay/interfaces";
import { useMtOverlayI18n } from "./i18n";
import {
  clampCountdownSeconds,
  countdownAnchor,
  countdownProgress,
  createMtCountdownWidget,
  formatCountdown,
  type MtCountdownWidget,
} from "./types";

const props = defineProps<{
  config: MtCountdownWidget;
}>();

const wm = inject<WidgetManager>("wm")!;
const { t } = useMtOverlayI18n();

if (props.config.wmFlags[0] === "uninitialized") {
  const slot = Math.max(
    0,
    AppConfig().widgets.filter((widget) => widget.wmType === MT_COUNTDOWN_TYPE)
      .length - 1,
  );
  Object.assign(props.config, createMtCountdownWidget(props.config.wmId, slot));
  props.config.wmTitle = t("overlay.countdown.defaultLabel");
  wm.show(props.config.wmId);
}

// Tolerate configs written before a field existed.
if (!props.config.anchor) props.config.anchor = countdownAnchor(0);
props.config.durationSeconds = clampCountdownSeconds(
  props.config.durationSeconds,
);
if (typeof props.config.showProgressBar !== "boolean") {
  props.config.showProgressBar = true;
}

const durationMs = computed(
  () => clampCountdownSeconds(props.config.durationSeconds) * 1000,
);
const remainingMs = ref(durationMs.value);
const isRunning = ref(false);

let endsAt = 0;
let timerId: ReturnType<typeof setInterval> | null = null;

const formatted = computed(() => formatCountdown(remainingMs.value));
const progress = computed(() =>
  countdownProgress(remainingMs.value, durationMs.value),
);
const finished = computed(() => remainingMs.value <= 0);
const showProgressBar = computed(() => props.config.showProgressBar !== false);

function stopTicking() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function tick() {
  if (!isRunning.value) return;
  remainingMs.value = Math.max(0, endsAt - Date.now());
  if (remainingMs.value === 0) {
    isRunning.value = false;
    stopTicking();
  }
}

function start() {
  if (remainingMs.value <= 0) remainingMs.value = durationMs.value;
  endsAt = Date.now() + remainingMs.value;
  isRunning.value = true;
  if (timerId === null) timerId = setInterval(tick, 250);
}

function pause() {
  tick();
  isRunning.value = false;
  stopTicking();
}

function reset() {
  isRunning.value = false;
  stopTicking();
  remainingMs.value = durationMs.value;
}

watch(durationMs, (next) => {
  // A running timer keeps its deadline; the new length applies on reset.
  if (!isRunning.value) remainingMs.value = next;
});

onUnmounted(stopTicking);
</script>
