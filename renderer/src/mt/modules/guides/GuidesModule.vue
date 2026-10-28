<template>
  <MtPlaceholderPanel
    :title="t('modules.guides.title')"
    :body="t('modules.guides.body')"
    :phase="4"
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
