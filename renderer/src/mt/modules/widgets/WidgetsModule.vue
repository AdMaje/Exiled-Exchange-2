<template>
  <MtPlaceholderPanel
    :title="t('modules.widgets.title')"
    :body="t('modules.widgets.body')"
    :phase="5"
  />
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import MtPlaceholderPanel from "../../components/MtPlaceholderPanel.vue";

const { t } = useI18n();
</script>
