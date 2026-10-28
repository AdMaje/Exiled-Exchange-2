// MT: fork-owned HTTP routes for the MultiTool hub.
// Registered before the upstream static-file listener (see server.ts).
import type { IncomingMessage, Server, ServerResponse } from "http";
import { app } from "electron";
import { isPlainObject, MT_CONFIG_VERSION } from "../../../ipc/mt";
import { mtStore } from "./MtConfigStore";
import {
  MAX_MT_CACHE_BYTES,
  normalizeMtCacheKey,
  readMtCacheEntry,
  writeMtCacheEntry,
} from "./cache";
import {
  MtGuideError,
  listUserGuides,
  readUserGuide,
  revealGuidesFolder,
  revealUserGuide,
  writeUserGuide,
} from "./guides";
import { MT_GUIDE_MAX_BYTES } from "../../../ipc/mtGuides";

const MAX_BODY_BYTES = 64 * 1024;

export function addMtRoutes(
  server: Server,
  onConfigSaved: (contents: string) => void,
) {
  server.addListener("request", (req, res) => {
    // MT: the upstream production static handler does not strip query strings,
    // and the hub is loaded as `/?mt=hub` or `/index.html?mt=hub`.
    if (req.url === "/" || req.url?.startsWith("/?")) {
      req.url = "/index.html";
    } else if (req.url?.startsWith("/index.html?")) {
      req.url = "/index.html";
    }

    if (!req.url?.startsWith("/mt/")) return;

    handleMtRequest(req, res, onConfigSaved).catch((error) => {
      if (res.headersSent) {
        res.end();
      } else if (error instanceof MtGuideError) {
        sendJson(res, guideStatus(error.code), { error: error.code });
      } else {
        sendJson(res, 500, { error: "internal-error" });
      }
    });
  });
}

function guideStatus(code: MtGuideError["code"]): number {
  if (code === "not-found") return 404;
  if (code === "too-large") return 413;
  return 400;
}

async function handleMtRequest(
  req: IncomingMessage,
  res: ServerResponse,
  onConfigSaved: (contents: string) => void,
): Promise<void> {
  const pathname = req.url?.split("?")[0] ?? "";
  res.setHeader("cache-control", "no-store");

  if (pathname === "/mt/config") {
    if (req.method === "GET") {
      sendJson(res, 200, {
        mt: await mtStore.load(),
        version: app.getVersion(),
        configVersion: MT_CONFIG_VERSION,
      });
      return;
    }

    if (req.method === "PUT") {
      let body: string;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 413, { error: "payload-too-large" });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        sendJson(res, 400, { error: "invalid-json" });
        return;
      }

      if (!isPlainObject(parsed)) {
        sendJson(res, 400, { error: "invalid-mt-config" });
        return;
      }

      const saved = await mtStore.update(parsed);
      if (saved.broadcast) onConfigSaved(saved.broadcast);

      sendJson(res, 200, { mt: saved.mt });
      return;
    }

    res.setHeader("allow", "GET, PUT");
    sendJson(res, 405, { error: "method-not-allowed" });
    return;
  }

  if (pathname === "/mt/guides/index.json") {
    if (req.method !== "GET") {
      res.setHeader("allow", "GET");
      sendJson(res, 405, { error: "method-not-allowed" });
      return;
    }
    sendJson(res, 200, { guides: await listUserGuides() });
    return;
  }

  if (pathname === "/mt/guides/reveal.json") {
    if (req.method !== "POST") {
      res.setHeader("allow", "POST");
      sendJson(res, 405, { error: "method-not-allowed" });
      return;
    }
    await revealGuidesFolder();
    sendJson(res, 200, { ok: true });
    return;
  }

  const guideRevealMatch =
    /^\/mt\/guides\/([a-z0-9][a-z0-9-_]{0,63})\.md\/reveal\.json$/.exec(
      pathname,
    );
  if (guideRevealMatch) {
    if (req.method !== "POST") {
      res.setHeader("allow", "POST");
      sendJson(res, 405, { error: "method-not-allowed" });
      return;
    }
    await revealUserGuide(guideRevealMatch[1]);
    sendJson(res, 200, { ok: true });
    return;
  }

  const guideFileMatch = /^\/mt\/guides\/([a-z0-9][a-z0-9-_]{0,63})\.md$/.exec(
    pathname,
  );
  if (guideFileMatch) {
    const slug = guideFileMatch[1];

    if (req.method === "GET") {
      const content = await readUserGuide(slug);
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(content);
      return;
    }

    if (req.method === "PUT") {
      let body: string;
      try {
        body = await readBody(req, MT_GUIDE_MAX_BYTES);
      } catch {
        sendJson(res, 413, { error: "payload-too-large" });
        return;
      }
      const entry = await writeUserGuide(slug, body);
      sendJson(res, 200, { guide: entry });
      return;
    }

    res.setHeader("allow", "GET, PUT");
    sendJson(res, 405, { error: "method-not-allowed" });
    return;
  }

  const cacheMatch = /^\/mt\/cache\/([^/]+)$/.exec(pathname);
  if (cacheMatch) {
    const key = normalizeMtCacheKey(decodeURIComponent(cacheMatch[1]));
    if (!key) {
      sendJson(res, 400, { error: "invalid-cache-key" });
      return;
    }

    if (req.method === "GET") {
      const entry = await readMtCacheEntry(key);
      if (entry === null) {
        sendJson(res, 404, { error: "cache-miss" });
        return;
      }
      sendJson(res, 200, entry);
      return;
    }

    if (req.method === "PUT") {
      let body: string;
      try {
        body = await readBody(req, MAX_MT_CACHE_BYTES);
      } catch {
        sendJson(res, 413, { error: "payload-too-large" });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        sendJson(res, 400, { error: "invalid-json" });
        return;
      }

      if (!isPlainObject(parsed)) {
        sendJson(res, 400, { error: "invalid-cache-payload" });
        return;
      }

      await writeMtCacheEntry(key, parsed);
      sendJson(res, 200, { ok: true });
      return;
    }

    res.setHeader("allow", "GET, PUT");
    sendJson(res, 405, { error: "method-not-allowed" });
    return;
  }

  sendJson(res, 404, { error: "not-found" });
}

async function readBody(
  req: IncomingMessage,
  limit = MAX_BODY_BYTES,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload-too-large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
