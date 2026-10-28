<template>
  <div v-if="configWidget" class="flex max-w-md flex-col gap-4 p-2">
    <ui-checkbox v-model="showAreaLevel">
      {{ t("overlay.zone.showAreaLevel") }}
    </ui-checkbox>
    <ui-checkbox v-model="showPlayerLevel">
      {{ t("overlay.zone.showPlayerLevel") }}
    </ui-checkbox>

    <p class="text-xs leading-5 text-gray-500">
      {{ t("overlay.zone.settingsHint") }}
    </p>
    <p class="text-xs leading-5 text-gray-500">
      {{ t("overlay.zone.lastNonTown") }}
    </p>
  </div>
</template>

<script lang="ts">
export default {
  name: "MT Zone Tracker",
};
</script>

<script setup lang="ts">
import { computed } from "vue";
import UiCheckbox from "@/web/ui/UiCheckbox.vue";
import { configProp } from "@/web/settings/utils";
import { useMtOverlayI18n } from "./i18n";
import type { MtZoneTrackerWidget } from "./types";

const props = defineProps(configProp<MtZoneTrackerWidget>());
const { t } = useMtOverlayI18n();

const showAreaLevel = computed({
  get: () => props.configWidget?.showAreaLevel !== false,
  set: (value: boolean) => {
    if (props.configWidget) props.configWidget.showAreaLevel = value;
  },
});

const showPlayerLevel = computed({
  get: () => props.configWidget?.showPlayerLevel !== false,
  set: (value: boolean) => {
    if (props.configWidget) props.configWidget.showPlayerLevel = value;
  },
});
</script>
