<template>
  <div
    class="flex h-screen w-screen flex-col overflow-hidden bg-[#0f131b] text-gray-200"
  >
    <header
      class="flex items-center justify-between border-b border-gray-800 px-4 py-3"
    >
      <div class="flex items-baseline gap-3">
        <h1 class="text-lg font-semibold tracking-wide">PoE2 MultiTool</h1>
        <span class="text-xs text-gray-500">{{ t("app.subtitle") }}</span>
      </div>
      <div class="flex items-center gap-3 text-xs text-gray-500">
        <span v-if="saved" class="text-emerald-400">{{ t("common.saved") }}</span>
        <span v-if="host">{{ t("app.version", { version: host.version }) }}</span>
        <button
          type="button"
          class="rounded border border-gray-700 px-2 py-0.5 text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
          :title="t('common.close')"
          @click="closeWindow"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <nav class="flex w-56 shrink-0 flex-col gap-1 border-r border-gray-800 p-2">
        <button
          v-for="module in mtModules"
          :key="module.id"
          type="button"
          :class="navClass(view === 'module' && activeId === module.id)"
          @click="openModule(module.id)"
        >
          <i :class="module.icon" class="w-4 text-center" aria-hidden="true"></i>
          <span>{{ t(module.titleKey) }}</span>
        </button>

        <div class="mt-auto">
          <button
            type="button"
            :class="navClass(view === 'settings')"
            @click="openSettings"
          >
            <i class="fa-solid fa-gear w-4 text-center" aria-hidden="true"></i>
            <span>{{ t("nav.settings") }}</span>
          </button>
        </div>
      </nav>

      <main class="min-w-0 flex-1 overflow-auto p-6">
        <p v-if="loading" class="text-sm text-gray-400">
          {{ t("common.loading") }}
        </p>

        <div
          v-else-if="!config"
          class="mx-auto max-w-xl rounded-xl border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-200"
        >
          <p>{{ t("common.hostUnavailable") }}</p>
          <button
            type="button"
            class="mt-4 rounded-md border border-red-700 px-3 py-1.5 text-red-100 transition-colors hover:border-red-500"
            @click="refresh()"
          >
            {{ t("common.retry") }}
          </button>
        </div>

        <MtSettingsPanel
          v-else-if="view === 'settings'"
          :config="config"
          :saving="saving"
          :error="saveError"
          @change="save"
        />

        <component :is="activeModule.component" v-else :key="activeModule.id" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { eventMatchesHotkey, type MtConfig } from "@ipc/mt";
import {
  fetchMtConfig,
  MtApiError,
  saveMtConfig,
  type MtHostState,
} from "./api";
import MtSettingsPanel from "./components/MtSettingsPanel.vue";
import { setMtLanguage } from "./i18n";
import { findMtModule, mtModules } from "./registry";

const props = defineProps<{ initialConfig: MtHostState | null }>();

const { t } = useI18n();

const host = ref<MtHostState | null>(props.initialConfig);
const loading = ref(props.initialConfig === null);
const saving = ref(false);
const saved = ref(false);
const saveError = ref<string | null>(null);
const view = ref<"module" | "settings">("module");
const activeId = ref(mtModules[0].id);

const config = computed(() => host.value?.mt ?? null);
const activeModule = computed(() => findMtModule(activeId.value));

let savedTimer: number | undefined;

async function refresh(silent = false): Promise<void> {
  if (!silent) loading.value = true;
  saveError.value = null;
  try {
    host.value = await fetchMtConfig();
    setMtLanguage(host.value.mt.language);
  } catch {
    if (!silent) host.value = null;
  } finally {
    loading.value = false;
  }
}

async function save(patch: Partial<MtConfig>): Promise<void> {
  saving.value = true;
  saveError.value = null;
  try {
    const response = await saveMtConfig(patch);
    host.value = {
      version: host.value?.version ?? "",
      configVersion: host.value?.configVersion ?? 0,
      mt: response.mt,
    };
    setMtLanguage(response.mt.language);

    saved.value = true;
    if (savedTimer !== undefined) window.clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => {
      saved.value = false;
    }, 1500);
  } catch (error) {
    const detail = error instanceof MtApiError ? ` (${error.status})` : "";
    saveError.value = `${t("settings.saveFailed")}${detail}`;
  } finally {
    saving.value = false;
  }
}

function openModule(id: string): void {
  view.value = "module";
  activeId.value = id;
}

function openSettings(): void {
  view.value = "settings";
}

function closeWindow(): void {
  window.close();
}

function navClass(active: boolean): string {
  return [
    "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
    active
      ? "bg-amber-500/10 text-amber-200"
      : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200",
  ].join(" ");
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  ) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeWindow();
    return;
  }

  if (eventMatchesHotkey(event, config.value?.hubHotkey)) {
    event.preventDefault();
    closeWindow();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  // Re-read the file-backed config when the window regains focus (§5.2).
  window.addEventListener("focus", onFocus);
  if (props.initialConfig === null) {
    refresh();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("focus", onFocus);
  if (savedTimer !== undefined) window.clearTimeout(savedTimer);
});

function onFocus(): void {
  refresh(true);
}
</script>
