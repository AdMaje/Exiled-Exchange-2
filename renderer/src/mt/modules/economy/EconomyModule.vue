<template>
  <MtPlaceholderPanel
    :title="t('modules.economy.title')"
    :body="t('modules.economy.body')"
    :phase="3"
  />
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import MtPlaceholderPanel from "../../components/MtPlaceholderPanel.vue";

const { t } = useI18n();
</script>
