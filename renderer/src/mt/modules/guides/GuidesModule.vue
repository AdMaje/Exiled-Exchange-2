<template>
  <section class="mx-auto max-w-6xl space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-gray-100">
          {{ t("modules.guides.title") }}
        </h2>
        <p class="mt-1 text-xs text-gray-500">{{ t("guides.subtitle") }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" :class="toolButton" @click="s.reload">
          <i class="fa-solid fa-rotate" aria-hidden="true" />
          {{ t("guides.refresh") }}
        </button>
        <button type="button" :class="toolButton" @click="s.revealFolder">
          <i class="fa-solid fa-folder-open" aria-hidden="true" />
          {{ t("guides.openFolder") }}
        </button>
      </div>
    </header>

    <div class="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside class="space-y-2">
        <input
          v-model="s.search.value"
          type="search"
          :placeholder="t('guides.search')"
          class="w-full rounded-md border border-gray-700 bg-[#10151d] px-2 py-1.5 text-sm text-gray-200"
        />

        <form class="flex gap-1" @submit.prevent="createGuide">
          <input
            v-model="newTitle"
            type="text"
            :placeholder="t('guides.newPlaceholder')"
            class="min-w-0 flex-1 rounded-md border border-gray-700 bg-[#10151d] px-2 py-1.5 text-sm text-gray-200"
          />
          <button
            type="submit"
            class="rounded-md border border-amber-600/60 bg-amber-500/10 px-2 py-1.5 text-sm text-amber-200 transition-colors hover:border-amber-400 disabled:opacity-50"
            :disabled="s.saving.value || !newTitle.trim()"
          >
            {{ t("guides.create") }}
          </button>
        </form>

        <p v-if="s.error.value" class="text-xs text-red-300">
          {{ errorText }}
        </p>

        <p v-if="s.loading.value" class="text-xs text-gray-500">
          {{ t("common.loading") }}
        </p>

        <ul v-else class="space-y-1">
          <li v-for="entry in s.filtered.value" :key="entry.slug">
            <button
              type="button"
              class="w-full rounded-md border px-2 py-1.5 text-left transition-colors"
              :class="
                entry.slug === s.activeSlug.value
                  ? 'border-amber-500/60 bg-amber-500/10'
                  : 'border-transparent hover:border-gray-700 hover:bg-gray-800/40'
              "
              @click="selectGuide(entry.slug)"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="truncate text-sm text-gray-200">
                  {{ entry.title }}
                </span>
                <span
                  v-if="entry.source === 'user'"
                  class="shrink-0 rounded bg-gray-700/60 px-1 text-[10px] uppercase tracking-wide text-gray-300"
                >
                  {{ t("guides.user") }}
                </span>
              </span>
              <span
                v-if="statsFor(entry).total > 0"
                class="mt-1 flex items-center gap-2 text-[11px] text-gray-500"
              >
                <span class="h-1 flex-1 overflow-hidden rounded bg-gray-800">
                  <span
                    class="block h-full bg-amber-500/70"
                    :style="{ width: `${percentFor(entry)}%` }"
                  />
                </span>
                {{ statsFor(entry).checked }}/{{ statsFor(entry).total }}
              </span>
            </button>
          </li>
          <li
            v-if="s.filtered.value.length === 0"
            class="px-2 py-3 text-xs text-gray-500"
          >
            {{ t("guides.noResults") }}
          </li>
        </ul>
      </aside>

      <article v-if="s.active.value" class="min-w-0 space-y-3">
        <header class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-semibold text-gray-100">
              {{ s.active.value.title }}
            </h3>
            <p
              class="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-500"
            >
              <span
                class="rounded bg-gray-800 px-1.5 py-0.5 uppercase tracking-wide"
              >
                {{
                  s.active.value.source === "user"
                    ? t("guides.user")
                    : t("guides.bundled")
                }}
              </span>
              <span
                v-for="tag in s.active.value.tags"
                :key="tag"
                class="rounded bg-gray-800/60 px-1.5 py-0.5"
              >
                {{ tag }}
              </span>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span
              v-if="s.stats.value.total > 0"
              class="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-300"
            >
              {{
                t("guides.progress", {
                  checked: s.stats.value.checked,
                  total: s.stats.value.total,
                })
              }}
            </span>
            <template
              v-if="s.active.value.source === 'user' && !s.editing.value"
            >
              <button type="button" :class="toolButton" @click="s.beginEdit">
                <i class="fa-solid fa-pen" aria-hidden="true" />
                {{ t("guides.edit") }}
              </button>
              <button
                type="button"
                :class="toolButton"
                @click="s.reveal(s.active.value.slug)"
              >
                <i class="fa-solid fa-folder-tree" aria-hidden="true" />
                {{ t("guides.reveal") }}
              </button>
            </template>
          </div>
        </header>

        <div
          v-if="s.stats.value.total > 0"
          class="h-1.5 overflow-hidden rounded bg-gray-800"
        >
          <div
            class="h-full bg-emerald-500/70 transition-[width]"
            :style="{ width: `${s.percent.value}%` }"
          />
        </div>

        <template v-if="s.editing.value">
          <textarea
            v-model="s.draft.value"
            class="h-[26rem] w-full rounded-lg border border-gray-700 bg-[#0b0f16] p-3 font-mono text-xs leading-5 text-gray-200"
            spellcheck="false"
          />
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-md border border-emerald-600/60 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200 transition-colors hover:border-emerald-400 disabled:opacity-50"
              :disabled="s.saving.value"
              @click="saveDraft"
            >
              {{ t("guides.save") }}
            </button>
            <button type="button" :class="toolButton" @click="s.cancelEdit">
              {{ t("guides.cancel") }}
            </button>
            <span class="text-xs text-gray-500">{{
              t("guides.editHint")
            }}</span>
          </div>
        </template>

        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          v-else
          class="mt-guide"
          @change="onContentChange"
          v-html="s.rendered.value.html"
        />
      </article>

      <p
        v-else-if="!s.loading.value"
        class="rounded-xl border border-dashed border-gray-700 p-8 text-center text-sm text-gray-500"
      >
        {{ t("guides.empty") }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { MtConfig } from "@ipc/mt";
import { guideTaskStats, type MtGuideEntry } from "../../guides/catalog";
import { useGuides } from "../../guides/store";

const props = defineProps<{ config: MtConfig }>();

const emit = defineEmits<{
  (event: "change", patch: Partial<MtConfig>): void;
}>();

const { t } = useI18n();
const s = useGuides();
const newTitle = ref("");

const toolButton =
  "flex items-center gap-1.5 rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-50";

const errorText = computed(() => {
  const code = s.error.value;
  if (code === "index") return t("guides.errorIndex");
  if (code === "save") return t("guides.errorSave");
  if (code === "create") return t("guides.errorCreate");
  if (code === "reveal") return t("guides.errorReveal");
  return "";
});

function sameProgress(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

/** Always persist the complete guides object; the store merges top-level keys. */
function persistGuides(
  progress: Record<string, number>,
  lastOpened: string | null,
): void {
  const current = props.config.guides;
  if (
    current.lastOpened === lastOpened &&
    sameProgress(current.progress, progress)
  ) {
    return;
  }
  emit("change", { guides: { progress, lastOpened } });
}

function statsFor(entry: MtGuideEntry) {
  return guideTaskStats(entry.body, s.bitsFor(entry.slug));
}

function percentFor(entry: MtGuideEntry): number {
  const stats = statsFor(entry);
  if (stats.total === 0) return 0;
  return Math.round((stats.checked / stats.total) * 100);
}

function selectGuide(slug: string): void {
  const next = s.select(slug);
  if (next === null) return;
  persistGuides(props.config.guides.progress, next);
}

function onContentChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
    return;
  }

  const index = Number(target.dataset.mtTask);
  if (!Number.isInteger(index)) return;

  const progress = s.toggleTask(index);
  if (progress) persistGuides(progress, s.activeSlug.value);
}

async function saveDraft(): Promise<void> {
  await s.save();
}

async function createGuide(): Promise<void> {
  const slug = await s.create(newTitle.value);
  if (slug) newTitle.value = "";
}

onMounted(() => {
  s.load(props.config.guides).catch(() => undefined);
});
</script>

<style scoped>
.mt-guide {
  color: #d1d5db;
  font-size: 0.875rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.mt-guide :deep(h1) {
  color: #f3f4f6;
  font-size: 1.375rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem;
}

.mt-guide :deep(h2) {
  color: #e5e7eb;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 1.5rem 0 0.5rem;
}

.mt-guide :deep(h3) {
  color: #e5e7eb;
  font-size: 1rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
}

.mt-guide :deep(p),
.mt-guide :deep(ul),
.mt-guide :deep(ol),
.mt-guide :deep(blockquote),
.mt-guide :deep(pre) {
  margin: 0.5rem 0;
}

.mt-guide :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
}

.mt-guide :deep(ol) {
  list-style: decimal;
  padding-left: 1.25rem;
}

.mt-guide :deep(li) {
  margin: 0.15rem 0;
}

.mt-guide :deep(a) {
  color: #fcd34d;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.mt-guide :deep(code) {
  border-radius: 0.25rem;
  background: #111827;
  padding: 0.1rem 0.3rem;
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
}

.mt-guide :deep(pre) {
  overflow-x: auto;
  border: 1px solid #1f2937;
  border-radius: 0.5rem;
  background: #0b0f16;
  padding: 0.75rem;
}

.mt-guide :deep(pre code) {
  background: transparent;
  padding: 0;
}

.mt-guide :deep(blockquote) {
  border-left: 3px solid #374151;
  padding-left: 0.75rem;
  color: #9ca3af;
}

.mt-guide :deep(table) {
  border-collapse: collapse;
  width: 100%;
}

.mt-guide :deep(th),
.mt-guide :deep(td) {
  border: 1px solid #1f2937;
  padding: 0.25rem 0.5rem;
  text-align: left;
}

.mt-guide :deep(.mt-task) {
  margin-right: 0.4rem;
  accent-color: #f59e0b;
  vertical-align: middle;
}

.mt-guide :deep(hr) {
  border-color: #1f2937;
  margin: 1.25rem 0;
}

.mt-guide :deep(img) {
  max-width: 100%;
  border-radius: 0.5rem;
}
</style>
