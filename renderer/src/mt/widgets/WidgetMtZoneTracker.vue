<template>
  <Widget
    :config="config"
    move-handles="corners"
    :inline-edit="false"
    :removable="false"
  >
    <div
      class="widget-default-style flex flex-col gap-1 px-2 py-1 text-gray-100"
    >
      <div class="flex items-baseline gap-2">
        <span class="text-[10px] uppercase tracking-wider text-gray-500">
          {{ t("overlay.zone.area") }}
        </span>
        <span class="font-mono text-sm" :title="t('overlay.zone.lastNonTown')">
          {{ area }}
        </span>
        <span
          v-if="clientLogOn && config.showAreaLevel !== false"
          class="rounded bg-gray-700 px-1 text-xs"
        >
          {{ t("overlay.zone.areaLevelShort", { level: areaLevel }) }}
        </span>
        <span
          v-if="clientLogOn && config.showPlayerLevel !== false"
          class="rounded bg-gray-700 px-1 text-xs"
        >
          {{ t("overlay.zone.playerLevelShort", { level: playerLevel }) }}
        </span>
      </div>

      <div v-if="!clientLogOn" class="max-w-64 text-xs text-amber-300">
        {{ t("overlay.zone.clientLogOff") }}
      </div>
    </div>
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from "@/web/overlay/interfaces";
import { MT_ZONE_TRACKER_TYPE, createMtZoneTrackerWidget } from "./types";

export default {
  widget: {
    type: MT_ZONE_TRACKER_TYPE,
    instances: "single",
    trNameKey: "MT Zone Tracker",
    initInstance: () => createMtZoneTrackerWidget(),
  } satisfies WidgetSpec,
};
</script>

<script setup lang="ts">
import { computed } from "vue";
import Widget from "@/web/overlay/Widget.vue";
import { AppConfig } from "@/web/Config";
import { useClientLog } from "@/web/client-log/client-log";
import { useMtOverlayI18n } from "./i18n";
import { displayAreaId, type MtZoneTrackerWidget } from "./types";

defineProps<{
  config: MtZoneTrackerWidget;
}>();

const { t } = useMtOverlayI18n();
const { areaLevel, playerLevel, zoneName } = useClientLog();

const clientLogOn = computed(() => {
  try {
    return AppConfig().readClientLog === true;
  } catch {
    return false;
  }
});

const area = computed(() =>
  clientLogOn.value ? displayAreaId(zoneName.value) : "—",
);
</script>
