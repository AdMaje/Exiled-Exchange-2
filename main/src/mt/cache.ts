// MT: file-backed economy cache (survives restarts, not origin-scoped).
// The renderer owns the envelope/TTL logic; the main process only stores JSON.
import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import { isPlainObject } from "../../../ipc/mt";

const CACHE_KEY_RE = /^[a-z0-9][a-z0-9._-]{0,119}$/;
export const MAX_MT_CACHE_BYTES = 512 * 1024;

/** Path-safe cache key or null. Mirrors `cacheKey()` in the renderer. */
export function normalizeMtCacheKey(raw: string): string | null {
  return CACHE_KEY_RE.test(raw) ? raw : null;
}

export function mtCacheDir(): string {
  return path.join(app.getPath("userData"), "multitool", "cache");
}

function fileFor(key: string): string {
  return path.join(mtCacheDir(), `${key}.json`);
}

export async function readMtCacheEntry(key: string): Promise<unknown | null> {
  const normalized = normalizeMtCacheKey(key);
  if (!normalized) throw new Error("invalid cache key");

  let contents: string;
  try {
    contents = await fs.readFile(fileFor(normalized), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  const parsed: unknown = JSON.parse(contents);
  return isPlainObject(parsed) ? parsed : null;
}

export async function writeMtCacheEntry(
  key: string,
  value: unknown,
): Promise<void> {
  const normalized = normalizeMtCacheKey(key);
  if (!normalized) throw new Error("invalid cache key");
  if (!isPlainObject(value)) throw new Error("invalid cache payload");

  const contents = JSON.stringify(value);
  if (Buffer.byteLength(contents, "utf8") > MAX_MT_CACHE_BYTES) {
    throw new Error("cache payload too large");
  }

  const target = fileFor(normalized);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.mt-tmp`;
  await fs.writeFile(tmp, contents, "utf8");
  try {
    await fs.rename(tmp, target);
  } catch {
    await fs.writeFile(target, contents, "utf8");
    await fs.rm(tmp, { force: true });
  }
}
