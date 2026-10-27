<template>
  <section class="mx-auto max-w-2xl space-y-5">
    <h2 class="text-xl font-semibold text-gray-100">
      {{ t("settings.title") }}
    </h2>

    <div class="rounded-xl border border-gray-800 bg-[#141a24] p-4">
      <h3 class="text-sm font-semibold text-gray-200">
        {{ t("settings.language.title") }}
      </h3>
      <p class="mt-1 text-xs leading-5 text-gray-500">
        {{ t("settings.language.hint") }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="option in MT_LANGUAGES"
          :key="option"
          type="button"
          :disabled="saving"
          :class="[
            'rounded-md border px-3 py-1.5 text-sm transition-colors',
            config.language === option
              ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
              : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200',
          ]"
          @click="emit('change', { language: option })"
        >
          {{ t(`settings.language.${option}`) }}
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-gray-800 bg-[#141a24] p-4">
      <h3 class="text-sm font-semibold text-gray-200">
        {{ t("settings.hotkey.title") }}
      </h3>
      <p class="mt-1 text-xs leading-5 text-gray-500">
        {{ t("settings.hotkey.hint") }}
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <HotkeyInput
          :model-value="config.hubHotkey"
          class="w-44"
          @update:model-value="onHotkey"
        />
        <button
          v-if="config.hubHotkey"
          type="button"
          :disabled="saving"
          class="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
          @click="emit('change', { hubHotkey: null })"
        >
          {{ t("settings.hotkey.clear") }}
        </button>
      </div>
      <p class="mt-2 text-xs text-gray-600">
        {{ t("settings.hotkey.localOnly") }}
      </p>
    </div>

    <div class="rounded-xl border border-gray-800 bg-[#141a24] p-4">
      <h3 class="text-sm font-semibold text-gray-200">
        {{ t("settings.storage.title") }}
      </h3>
      <p class="mt-1 text-xs leading-5 text-gray-500">
        {{ t("settings.storage.body") }}
      </p>
    </div>

    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { MT_LANGUAGES, type MtConfig } from "@ipc/mt";
import HotkeyInput from "@/web/settings/HotkeyInput.vue";

defineProps<{
  config: MtConfig;
  saving: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  (event: "change", patch: Partial<MtConfig>): void;
}>();

const { t } = useI18n();

function onHotkey(hotkey: string | null) {
  emit("change", { hubHotkey: hotkey });
}
</script>
