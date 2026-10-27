<template>
  <section
    class="mx-auto mt-10 max-w-2xl rounded-xl border border-dashed border-gray-700 bg-[#141a24] p-8 text-center"
  >
    <h2 class="text-xl font-semibold text-gray-100">{{ title }}</h2>
    <p class="mt-3 text-sm leading-6 text-gray-400">{{ body }}</p>
    <p class="mt-6 text-[11px] uppercase tracking-[0.2em] text-gray-600">
      {{ t("placeholder.phase", { phase }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

defineProps<{
  title: string;
  body: string;
  phase: number;
}>();

const { t } = useI18n();
</script>
