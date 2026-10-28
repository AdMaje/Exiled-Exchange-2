// MT: user-authored Markdown guides under `multitool/guides/`.
// The hub never writes files itself; every read/write goes through these
// helpers with a strict slug whitelist, an extension allow-list and a size cap.
import { app, shell } from "electron";
import fs from "fs/promises";
import path from "path";
import {
  MT_GUIDE_MAX_BYTES,
  isMtGuideSlug,
  parseGuideSource,
} from "../../../ipc/mtGuides";

export type MtGuideErrorCode =
  | "invalid-slug"
  | "invalid-content"
  | "not-found"
  | "too-large";

export class MtGuideError extends Error {
  constructor(
    public readonly code: MtGuideErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MtGuideError";
  }
}

export interface MtUserGuideIndexEntry {
  slug: string;
  title: string;
  tags: string[];
  size: number;
  updatedAt: number;
}

export function mtGuidesDir(): string {
  return path.join(app.getPath("userData"), "multitool", "guides");
}

function guidePath(slug: string): string {
  if (!isMtGuideSlug(slug))
    throw new MtGuideError("invalid-slug", "invalid slug");
  return path.join(mtGuidesDir(), `${slug}.md`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(mtGuidesDir(), { recursive: true });
}

async function readFileCapped(file: string): Promise<string> {
  let stat;
  try {
    stat = await fs.stat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new MtGuideError("not-found", "guide not found");
    }
    throw error;
  }
  if (!stat.isFile()) throw new MtGuideError("not-found", "guide not found");
  if (stat.size > MT_GUIDE_MAX_BYTES) {
    throw new MtGuideError("too-large", "guide is too large");
  }
  return await fs.readFile(file, "utf8");
}

/** Index every readable `*.md` file; malformed files degrade to their slug. */
export async function listUserGuides(): Promise<MtUserGuideIndexEntry[]> {
  let names: string[];
  try {
    names = await fs.readdir(mtGuidesDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const entries: MtUserGuideIndexEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    const slug = name.slice(0, -3);
    if (!isMtGuideSlug(slug)) continue;

    const file = guidePath(slug);
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > MT_GUIDE_MAX_BYTES) continue;
      const source = await fs.readFile(file, "utf8");
      const parsed = parseGuideSource(source);
      entries.push({
        slug,
        title: parsed.title || slug,
        tags: parsed.tags,
        size: stat.size,
        updatedAt: stat.mtimeMs,
      });
    } catch {
      // A file removed or locked between readdir and read is not an error for
      // the hub: it simply disappears from the list.
    }
  }

  return entries.sort((a, b) => a.title.localeCompare(b.title));
}

export async function readUserGuide(slug: string): Promise<string> {
  return await readFileCapped(guidePath(slug));
}

export async function writeUserGuide(
  slug: string,
  content: unknown,
): Promise<MtUserGuideIndexEntry> {
  const file = guidePath(slug);
  if (typeof content !== "string") {
    throw new MtGuideError("invalid-content", "guide content must be text");
  }
  if (Buffer.byteLength(content, "utf8") > MT_GUIDE_MAX_BYTES) {
    throw new MtGuideError("too-large", "guide is too large");
  }

  await ensureDir();
  const tmp = `${file}.mt-tmp`;
  await fs.writeFile(tmp, content, "utf8");
  try {
    await fs.rename(tmp, file);
  } catch {
    await fs.writeFile(file, content, "utf8");
    await fs.rm(tmp, { force: true });
  }

  const stat = await fs.stat(file);
  const parsed = parseGuideSource(content);
  return {
    slug,
    title: parsed.title || slug,
    tags: parsed.tags,
    size: stat.size,
    updatedAt: stat.mtimeMs,
  };
}

/** Open the user guide folder in the OS file manager. */
export async function revealGuidesFolder(): Promise<void> {
  await ensureDir();
  const error = await shell.openPath(mtGuidesDir());
  if (error) throw new Error(error);
}

/** Reveal one guide file; the file must already exist. */
export async function revealUserGuide(slug: string): Promise<void> {
  await readFileCapped(guidePath(slug));
  shell.showItemInFolder(guidePath(slug));
}
