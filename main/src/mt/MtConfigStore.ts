// MT: file-backed store for the fork-owned `mt` subtree of config.json.
// Only the `mt` key is ever written; every other key is read back and preserved.
import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import {
  type MtConfig,
  defaultMtConfig,
  isPlainObject,
  mergeMtConfig,
  sanitizeMtConfig,
} from "../../../ipc/mt";

export interface MtConfigUpdate {
  mt: MtConfig;
  /**
   * Serialized full config, present only when the file on disk already was a
   * complete upstream config. The hub uses it to notify the overlay.
   */
  broadcast: string | null;
}

export class MtConfigStore {
  private queue: Promise<void> = Promise.resolve();
  private resolvedPath: string | null = null;

  private get cfgPath(): string {
    this.resolvedPath ??= path.join(
      app.getPath("userData"),
      "apt-data",
      "config.json",
    );
    return this.resolvedPath;
  }

  async load(): Promise<MtConfig> {
    return this.mtFrom(await this.readFile());
  }

  /**
   * Read-merge-write the `mt` subtree. Writes are serialized so a hub save and
   * a window-bounds save cannot lose each other's changes.
   */
  async update(patch: unknown): Promise<MtConfigUpdate> {
    const run = this.queue.then(async () => await this.applyUpdate(patch));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return await run;
  }

  private async applyUpdate(patch: unknown): Promise<MtConfigUpdate> {
    const file = await this.readFile();
    const wasCompleteConfig = typeof file.configVersion === "number";
    const mt = mergeMtConfig(this.mtFrom(file), patch);
    const contents = JSON.stringify({ ...file, mt });
    await this.writeAtomic(contents);

    return { mt, broadcast: wasCompleteConfig ? contents : null };
  }

  private mtFrom(file: Record<string, unknown>): MtConfig {
    return sanitizeMtConfig(file.mt) ?? defaultMtConfig();
  }

  private async readFile(): Promise<Record<string, unknown>> {
    let contents: string;
    try {
      contents = await fs.readFile(this.cfgPath, "utf8");
    } catch (error) {
      // A missing file is normal (first run / dev); anything else must not be
      // treated as empty, or a locked file would be replaced with `{ mt }`.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }

    const parsed: unknown = JSON.parse(contents);
    if (!isPlainObject(parsed)) {
      throw new Error("config.json does not contain a JSON object");
    }
    return parsed;
  }

  private async writeAtomic(contents: string): Promise<void> {
    const target = this.cfgPath;
    await fs.mkdir(path.dirname(target), { recursive: true });

    const tmp = `${target}.mt-tmp`;
    await fs.writeFile(tmp, contents, "utf8");
    try {
      await fs.rename(tmp, target);
    } catch {
      // Windows can refuse to replace a file another process has open.
      await fs.writeFile(target, contents, "utf8");
      await fs.rm(tmp, { force: true });
    }
  }
}

export const mtStore = new MtConfigStore();
