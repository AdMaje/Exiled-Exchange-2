// MT: fork-owned HTTP routes for the MultiTool hub.
// Registered before the upstream static-file listener (see server.ts).
import type { IncomingMessage, Server, ServerResponse } from "http";
import { app } from "electron";
import { isPlainObject, MT_CONFIG_VERSION } from "../../../ipc/mt";
import { mtStore } from "./MtConfigStore";

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

    handleMtRequest(req, res, onConfigSaved).catch(() => {
      if (res.headersSent) {
        res.end();
      } else {
        sendJson(res, 500, { error: "internal-error" });
      }
    });
  });
}

async function handleMtRequest(
  req: IncomingMessage,
  res: ServerResponse,
  onConfigSaved: (contents: string) => void,
): Promise<void> {
  const pathname = req.url?.split("?")[0];
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

  sendJson(res, 404, { error: "not-found" });
}

async function readBody(req: IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
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
