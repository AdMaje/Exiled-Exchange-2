/**
 * MT: HTTP client for user guides. All file access happens in the main process;
 * the hub never touches the user data folder directly.
 */
import { isMtGuideSlug } from "@ipc/mtGuides";
import { MtApiError } from "../api";

export interface MtUserGuideIndexEntry {
  slug: string;
  title: string;
  tags: string[];
  size: number;
  updatedAt: number;
}

function isEntry(value: unknown): value is MtUserGuideIndexEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.slug === "string" &&
    isMtGuideSlug(entry.slug) &&
    typeof entry.title === "string" &&
    Array.isArray(entry.tags) &&
    typeof entry.updatedAt === "number"
  );
}

function guideUrl(slug: string): string {
  if (!isMtGuideSlug(slug)) throw new Error("invalid guide slug");
  return `/mt/guides/${encodeURIComponent(slug)}.md`;
}

export async function fetchGuideIndex(): Promise<MtUserGuideIndexEntry[]> {
  const response = await fetch("/mt/guides/index.json", { cache: "no-store" });
  if (!response.ok) {
    throw new MtApiError(
      `MT guide index failed (${response.status})`,
      response.status,
    );
  }

  const payload = (await response.json()) as { guides?: unknown };
  if (!Array.isArray(payload.guides)) return [];

  return payload.guides.filter(isEntry).map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    tags: entry.tags.filter((tag): tag is string => typeof tag === "string"),
    size: typeof entry.size === "number" ? entry.size : 0,
    updatedAt: entry.updatedAt,
  }));
}

export async function fetchGuideContent(slug: string): Promise<string> {
  const response = await fetch(guideUrl(slug), { cache: "no-store" });
  if (!response.ok) {
    throw new MtApiError(
      `MT guide read failed: ${slug} (${response.status})`,
      response.status,
    );
  }
  return await response.text();
}

export async function saveGuideContent(
  slug: string,
  content: string,
): Promise<MtUserGuideIndexEntry> {
  const response = await fetch(guideUrl(slug), {
    method: "PUT",
    cache: "no-store",
    headers: { "content-type": "text/markdown; charset=utf-8" },
    body: content,
  });
  if (!response.ok) {
    throw new MtApiError(
      `MT guide save failed: ${slug} (${response.status})`,
      response.status,
    );
  }

  const payload = (await response.json()) as { guide?: unknown };
  return isEntry(payload.guide)
    ? payload.guide
    : {
        slug,
        title: slug,
        tags: [],
        size: content.length,
        updatedAt: Date.now(),
      };
}

async function post(url: string): Promise<void> {
  const response = await fetch(url, { method: "POST", cache: "no-store" });
  if (!response.ok) {
    throw new MtApiError(
      `MT guide action failed: ${url} (${response.status})`,
      response.status,
    );
  }
}

export async function openGuidesFolder(): Promise<void> {
  await post("/mt/guides/reveal.json");
}

export async function revealUserGuide(slug: string): Promise<void> {
  if (!isMtGuideSlug(slug)) throw new Error("invalid guide slug");
  await post(`/mt/guides/${encodeURIComponent(slug)}.md/reveal.json`);
}
