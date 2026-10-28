<template>
  <MtPlaceholderPanel
    :title="t('modules.widgets.title')"
    :body="t('modules.widgets.body')"
    :phase="5"
  />
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { MtConfig } from "@ipc/mt";
import MtPlaceholderPanel from "../../components/MtPlaceholderPanel.vue";

defineProps<{ config: MtConfig }>();

defineEmits<{
  (event: "change", patch: Partial<MtConfig>): void;
}>();

const { t } = useI18n();
</script>
