/**
 * MT: guides module state.
 *
 * Bundled guides are compiled in; user guides are read from the main process.
 * Checklist progress is a bitmask per slug and only ever leaves the store via
 * the hub's `@change` event, which persists `mt.guides` in config.json.
 */
import { createGlobalState } from "@vueuse/core";
import { computed, ref, shallowRef } from "vue";
import {
  guideStarter,
  isTaskChecked,
  setTaskChecked,
  slugifyGuideTitle,
} from "@ipc/mtGuides";
import {
  fetchGuideContent,
  fetchGuideIndex,
  openGuidesFolder,
  revealUserGuide,
  saveGuideContent,
} from "./api";
import {
  bundledGuides,
  createGuideEntry,
  guideTaskStats,
  mergeGuides,
  searchGuides,
  sortGuides,
  type MtGuideEntry,
} from "./catalog";
import { renderGuideMarkdown } from "./markdown";

export interface GuidesOpenInput {
  progress: Record<string, number>;
  lastOpened: string | null;
}

export type GuidesError = "index" | "save" | "create" | "reveal";

export const useGuides = createGlobalState(() => {
  const entries = shallowRef<MtGuideEntry[]>([]);
  const activeSlug = ref<string | null>(null);
  const search = ref("");
  const progress = ref<Record<string, number>>({});

  const loading = ref(false);
  const saving = ref(false);
  const error = shallowRef<GuidesError | null>(null);

  const editing = ref(false);
  const draft = ref("");

  let lastInput: GuidesOpenInput = { progress: {}, lastOpened: null };

  const filtered = computed(() => searchGuides(entries.value, search.value));

  const active = computed(
    () =>
      entries.value.find((entry) => entry.slug === activeSlug.value) ?? null,
  );

  const activeBits = computed(() =>
    activeSlug.value === null ? 0 : (progress.value[activeSlug.value] ?? 0),
  );

  const stats = computed(() =>
    active.value
      ? guideTaskStats(active.value.body, activeBits.value)
      : { total: 0, checked: 0 },
  );

  const percent = computed(() => {
    if (stats.value.total === 0) return 0;
    return Math.round((stats.value.checked / stats.value.total) * 100);
  });

  const rendered = computed(() =>
    active.value
      ? renderGuideMarkdown(active.value.body, activeBits.value)
      : { html: "", total: 0 },
  );

  function bitsFor(slug: string): number {
    return progress.value[slug] ?? 0;
  }

  async function load(
    input: GuidesOpenInput,
  ): Promise<{ lastOpened: string | null }> {
    lastInput = {
      progress: { ...input.progress },
      lastOpened: input.lastOpened,
    };
    progress.value = { ...input.progress };
    loading.value = true;
    error.value = null;

    let userEntries: MtGuideEntry[] = [];
    try {
      const index = await fetchGuideIndex();
      const loaded = await Promise.all(
        index.map(async (entry) => {
          try {
            const raw = await fetchGuideContent(entry.slug);
            return createGuideEntry(entry.slug, raw, "user", entry.updatedAt);
          } catch {
            // A file removed or locked after indexing simply disappears.
            return null;
          }
        }),
      );
      userEntries = loaded.filter(
        (entry): entry is MtGuideEntry => entry !== null,
      );
    } catch {
      error.value = "index";
    }

    entries.value = mergeGuides(bundledGuides, userEntries);

    const stillKnown =
      activeSlug.value !== null &&
      entries.value.some((entry) => entry.slug === activeSlug.value);
    const lastOpened =
      input.lastOpened !== null &&
      entries.value.some((entry) => entry.slug === input.lastOpened);

    activeSlug.value = stillKnown
      ? activeSlug.value
      : lastOpened
        ? input.lastOpened
        : (entries.value[0]?.slug ?? null);

    editing.value = false;
    loading.value = false;
    return { lastOpened: activeSlug.value };
  }

  async function reload(): Promise<{ lastOpened: string | null }> {
    return await load({
      progress: progress.value,
      lastOpened: activeSlug.value ?? lastInput.lastOpened,
    });
  }

  function select(slug: string): string | null {
    if (!entries.value.some((entry) => entry.slug === slug)) {
      return activeSlug.value;
    }
    activeSlug.value = slug;
    editing.value = false;
    error.value = null;
    return slug;
  }

  function beginEdit(): void {
    const entry = active.value;
    if (!entry || entry.source !== "user") return;
    draft.value = entry.raw;
    editing.value = true;
    error.value = null;
  }

  function cancelEdit(): void {
    editing.value = false;
    draft.value = "";
  }

  async function save(): Promise<boolean> {
    const entry = active.value;
    if (!entry || entry.source !== "user" || saving.value) return false;

    saving.value = true;
    error.value = null;
    try {
      const saved = await saveGuideContent(entry.slug, draft.value);
      const next = createGuideEntry(
        entry.slug,
        draft.value,
        "user",
        saved.updatedAt,
      );
      entries.value = sortGuides(
        entries.value.map((candidate) =>
          candidate.slug === entry.slug ? next : candidate,
        ),
      );
      editing.value = false;
      return true;
    } catch {
      error.value = "save";
      return false;
    } finally {
      saving.value = false;
    }
  }

  function uniqueSlug(title: string): string {
    const base = slugifyGuideTitle(title);
    let candidate = base;
    let suffix = 2;
    while (entries.value.some((entry) => entry.slug === candidate)) {
      candidate = `${base.slice(0, 56)}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  async function create(title: string): Promise<string | null> {
    const trimmed = title.trim();
    if (!trimmed || saving.value) return null;

    const slug = uniqueSlug(trimmed);
    const raw = guideStarter(trimmed);

    saving.value = true;
    error.value = null;
    try {
      const saved = await saveGuideContent(slug, raw);
      const entry = createGuideEntry(slug, raw, "user", saved.updatedAt);
      entries.value = sortGuides([...entries.value, entry]);
      activeSlug.value = slug;
      draft.value = raw;
      editing.value = true;
      return slug;
    } catch {
      error.value = "create";
      return null;
    } finally {
      saving.value = false;
    }
  }

  /** Flip one checklist bit; returns the map to persist, or null. */
  function toggleTask(index: number): Record<string, number> | null {
    const entry = active.value;
    if (!entry) return null;

    const bits = bitsFor(entry.slug);
    const next = setTaskChecked(bits, index, !isTaskChecked(bits, index));
    progress.value = { ...progress.value, [entry.slug]: next };
    return progress.value;
  }

  async function revealFolder(): Promise<void> {
    error.value = null;
    try {
      await openGuidesFolder();
    } catch {
      error.value = "reveal";
    }
  }

  async function reveal(slug: string): Promise<void> {
    error.value = null;
    try {
      await revealUserGuide(slug);
    } catch {
      error.value = "reveal";
    }
  }

  return {
    // data
    entries,
    filtered,
    activeSlug,
    active,
    activeBits,
    progress,
    search,
    // status
    loading,
    saving,
    error,
    editing,
    draft,
    // derived
    stats,
    percent,
    rendered,
    // actions
    load,
    reload,
    select,
    beginEdit,
    cancelEdit,
    save,
    create,
    toggleTask,
    revealFolder,
    reveal,
    bitsFor,
  };
});
