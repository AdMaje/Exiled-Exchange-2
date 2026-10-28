<template>
  <div v-if="configWidget" class="flex max-w-md flex-col gap-4 p-2">
    <label class="block text-sm">
      {{ t("overlay.countdown.label") }}
      <input
        v-model="label"
        maxlength="32"
        class="mt-1 block w-full rounded bg-gray-900 px-2 py-1"
      />
    </label>

    <label class="block text-sm">
      {{ t("overlay.countdown.durationSeconds") }}
      <input
        :value="durationSeconds"
        type="number"
        :min="MT_COUNTDOWN_MIN_SECONDS"
        :max="MT_COUNTDOWN_MAX_SECONDS"
        step="1"
        class="mt-1 block w-32 rounded bg-gray-900 px-2 py-1"
        @change="onDurationChange"
      />
    </label>

    <ui-checkbox v-model="showProgressBar">
      {{ t("overlay.countdown.showProgress") }}
    </ui-checkbox>

    <p class="text-xs leading-5 text-gray-500">
      {{ t("overlay.countdown.hint") }}
    </p>
  </div>
</template>

<script lang="ts">
export default {
  name: "MT Countdown",
};
</script>

<script setup lang="ts">
import { computed } from "vue";
import UiCheckbox from "@/web/ui/UiCheckbox.vue";
import { configProp } from "@/web/settings/utils";
import { useMtOverlayI18n } from "./i18n";
import {
  MT_COUNTDOWN_DEFAULT_SECONDS,
  MT_COUNTDOWN_MAX_SECONDS,
  MT_COUNTDOWN_MIN_SECONDS,
  clampCountdownSeconds,
  type MtCountdownWidget,
} from "./types";

const props = defineProps(configProp<MtCountdownWidget>());
const { t } = useMtOverlayI18n();

const label = computed({
  get: () => props.configWidget?.wmTitle ?? "",
  set: (value: string) => {
    if (props.configWidget) props.configWidget.wmTitle = value;
  },
});

const durationSeconds = computed(() =>
  clampCountdownSeconds(props.configWidget?.durationSeconds),
);

const showProgressBar = computed({
  get: () => props.configWidget?.showProgressBar !== false,
  set: (value: boolean) => {
    if (props.configWidget) props.configWidget.showProgressBar = value;
  },
});

function onDurationChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const raw = target.value.trim();
  const parsed = raw === "" ? Number.NaN : Number(raw);
  const next = Number.isFinite(parsed)
    ? clampCountdownSeconds(parsed)
    : MT_COUNTDOWN_DEFAULT_SECONDS;

  if (props.configWidget) props.configWidget.durationSeconds = next;
  target.value = String(next);
}
</script>
