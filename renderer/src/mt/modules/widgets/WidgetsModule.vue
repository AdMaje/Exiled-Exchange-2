<template>
  <section class="mx-auto max-w-3xl space-y-4">
    <header>
      <h2 class="text-xl font-semibold text-gray-100">
        {{ t("modules.widgets.title") }}
      </h2>
      <p class="mt-1 text-sm text-gray-400">
        {{ t("modules.widgets.body") }}
      </p>
    </header>

    <div class="grid gap-3 sm:grid-cols-2">
      <article
        class="rounded-xl border border-gray-800 bg-[#141a24] p-4 text-sm text-gray-300"
      >
        <h3 class="flex items-center gap-2 font-semibold text-gray-100">
          <i
            class="fa-solid fa-hourglass-half text-amber-400"
            aria-hidden="true"
          />
          {{ t("modules.widgets.countdownTitle") }}
        </h3>
        <p class="mt-2 leading-6 text-gray-400">
          {{ t("modules.widgets.countdownBody") }}
        </p>
      </article>

      <article
        class="rounded-xl border border-gray-800 bg-[#141a24] p-4 text-sm text-gray-300"
      >
        <h3 class="flex items-center gap-2 font-semibold text-gray-100">
          <i class="fa-solid fa-location-dot text-sky-400" aria-hidden="true" />
          {{ t("modules.widgets.zoneTitle") }}
        </h3>
        <p class="mt-2 leading-6 text-gray-400">
          {{ t("modules.widgets.zoneBody") }}
        </p>
      </article>
    </div>

    <p class="text-xs leading-5 text-gray-500">
      {{ t("modules.widgets.howTo") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { MtConfig } from "@ipc/mt";

defineProps<{ config: MtConfig }>();

defineEmits<{
  (event: "change", patch: Partial<MtConfig>): void;
}>();

const { t } = useI18n();
</script>
