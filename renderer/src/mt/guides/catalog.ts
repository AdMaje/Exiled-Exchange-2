/**
 * MT: bundled guide catalog + search/stats helpers.
 *
 * Bundled guides are compiled into the hub as raw strings (`?raw`), so they are
 * available offline and need no IPC. User guides arrive from `/mt/guides/*`.
 */
import {
  MT_GUIDE_MAX_TASKS,
  isTaskChecked,
  parseGuideSource,
} from "@ipc/mtGuides";

export type MtGuideSource = "bundled" | "user";

export interface MtGuideEntry {
  slug: string;
  title: string;
  tags: string[];
  /** Markdown without frontmatter (what the renderer shows). */
  body: string;
  /** Full file content including frontmatter (what the editor saves). */
  raw: string;
  source: MtGuideSource;
  updatedAt: number | null;
  order: number;
}

const bundledModules = import.meta.glob("../content/guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function slugFromPath(path: string): string {
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.md$/i, "");
}

function orderFrom(fields: Record<string, string>): number {
  const parsed = Number(fields.order);
  return Number.isFinite(parsed) ? parsed : 1000;
}

export function createGuideEntry(
  slug: string,
  raw: string,
  source: MtGuideSource,
  updatedAt: number | null = null,
): MtGuideEntry {
  const parsed = parseGuideSource(raw);
  return {
    slug,
    title: parsed.title || slug,
    tags: parsed.tags,
    body: parsed.body,
    raw,
    source,
    updatedAt,
    order: orderFrom(parsed.fields),
  };
}

/** Bundled guides, parsed once at module load. */
export const bundledGuides: readonly MtGuideEntry[] = Object.entries(
  bundledModules,
)
  .map(([path, raw]) => createGuideEntry(slugFromPath(path), raw, "bundled"))
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

export function sortGuides(entries: readonly MtGuideEntry[]): MtGuideEntry[] {
  return [...entries].sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title),
  );
}

/** User guides override a bundled guide with the same slug. */
export function mergeGuides(
  bundled: readonly MtGuideEntry[],
  user: readonly MtGuideEntry[],
): MtGuideEntry[] {
  const bySlug = new Map<string, MtGuideEntry>();
  for (const entry of bundled) bySlug.set(entry.slug, entry);
  for (const entry of user) bySlug.set(entry.slug, entry);
  return sortGuides([...bySlug.values()]);
}

/**
 * Search title, tags and body. Whitespace-separated terms must all match, so
 * "divine chart" narrows instead of widening the result list.
 */
export function searchGuides(
  entries: readonly MtGuideEntry[],
  search: string,
): MtGuideEntry[] {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...entries];

  return entries.filter((entry) => {
    const haystack =
      `${entry.title}\n${entry.tags.join(" ")}\n${entry.body}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export interface GuideTaskStats {
  total: number;
  checked: number;
}

/** Count checklist items and how many of their bits are set. */
export function guideTaskStats(body: string, progress: number): GuideTaskStats {
  const matches = body.match(/^[ \t]*[-*+]\s+\[[ xX]\]\s+/gm) ?? [];
  let checked = 0;
  for (let index = 0; index < matches.length; index += 1) {
    if (index < MT_GUIDE_MAX_TASKS && isTaskChecked(progress, index)) {
      checked += 1;
    }
  }
  return { total: matches.length, checked };
}
