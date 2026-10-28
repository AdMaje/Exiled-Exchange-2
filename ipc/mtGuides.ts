/**
 * MT: shared helpers for bundled/user Markdown guides.
 *
 * Fork-owned and dependency-free so the main process (index/title extraction)
 * and the hub renderer (search, checklist bits) behave identically. Keep this
 * module free of Node, Electron and Vue imports.
 */

/** Hard limits enforced by the main process and mirrored in the hub. */
export const MT_GUIDE_MAX_BYTES = 256 * 1024;
export const MT_GUIDE_MAX_TASKS = 50;
export const MT_GUIDE_SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/;

export interface MtGuideFields {
  title: string;
  tags: string[];
  /** Every simple `key: value` pair from the frontmatter. */
  fields: Record<string, string>;
  /** Markdown without the frontmatter block. */
  body: string;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function headingTitle(body: string): string {
  for (const line of body.split("\n")) {
    const match = /^#\s+(.+)$/.exec(line.trim());
    if (match) return match[1].trim().slice(0, 80);
  }
  return "";
}

function parseTags(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.replace(/^\[|\]$/g, "").split(",")) {
    const tag = part.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag.slice(0, 24));
    if (tags.length >= 8) break;
  }
  return tags;
}

/**
 * Tiny frontmatter parser: only a leading `---` block with `key: value` lines.
 * Anything malformed is treated as body text (no crash, no hidden content).
 */
export function parseGuideSource(raw: string): MtGuideFields {
  const text = raw.replace(/\r\n?/g, "\n");
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);

  const fields: Record<string, string> = {};
  let body = text;

  if (match) {
    body = text.slice(match[0].length).replace(/^\n+/, "");
    for (const line of match[1].split("\n")) {
      const entry = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
      if (!entry) continue;
      fields[entry[1].toLowerCase()] = unquote(entry[2]);
    }
  }

  const title = fields.title?.trim() || headingTitle(body);
  return {
    title: title.slice(0, 80),
    tags: parseTags(fields.tags),
    fields,
    body,
  };
}

/** True for the only slugs the main process will ever read or write. */
export function isMtGuideSlug(value: string): boolean {
  return MT_GUIDE_SLUG_RE.test(value);
}

/**
 * Turn a human title into a filename-safe slug. The main process validates the
 * result; collisions are resolved by the caller adding a numeric suffix.
 */
export function slugifyGuideTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "guide";
}

/** Starter Markdown for a new user guide (original content, no third party). */
export function guideStarter(title: string): string {
  const safe =
    title
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 80) || "Untitled guide";
  return `---
title: ${safe}
tags: notes
---
# ${safe}

- [ ] First step
- [ ] Second step
`;
}

function safeBits(bits: number): number {
  return Number.isSafeInteger(bits) && bits >= 0 ? bits : 0;
}

/** Checklist state is a bitmask: bit N belongs to the Nth `- [ ]` item. */
export function isTaskChecked(bits: number, index: number): boolean {
  if (!Number.isSafeInteger(bits) || bits < 0) return false;
  if (!Number.isInteger(index) || index < 0 || index >= MT_GUIDE_MAX_TASKS) {
    return false;
  }
  return Math.floor(bits / 2 ** index) % 2 === 1;
}

export function setTaskChecked(
  bits: number,
  index: number,
  checked: boolean,
): number {
  const value = safeBits(bits);
  if (!Number.isInteger(index) || index < 0 || index >= MT_GUIDE_MAX_TASKS) {
    return value;
  }
  if (isTaskChecked(value, index) === checked) return value;

  const bit = 2 ** index;
  return checked ? value + bit : value - bit;
}

/** Count top-level and nested task items in Markdown source. */
export function countGuideTasks(body: string): number {
  const matches = body.match(/^[ \t]*[-*+]\s+\[[ xX]\]\s+/gm);
  return matches ? matches.length : 0;
}
