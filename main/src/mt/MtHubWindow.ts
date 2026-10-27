// MT: normal (non-overlay) BrowserWindow that hosts the MultiTool hub.
import path from "path";
import { BrowserWindow, Menu, screen, shell } from "electron";
import type { MtHubBounds } from "../../../ipc/mt";
import type { MtConfigStore } from "./MtConfigStore";

interface WindowPlacement {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export class MtHubWindow {
  private window: BrowserWindow | null = null;

  constructor(
    private port: number,
    private store: MtConfigStore,
  ) {}

  /** Tray behaviour: hide when already visible, otherwise open. */
  async toggle(): Promise<void> {
    const win = this.window;
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide();
      return;
    }
    await this.show();
  }

  /** Shortcut behaviour: always bring the hub to the front. */
  async show(): Promise<void> {
    const win = this.window;
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return;
    }
    await this.create();
  }

  private async create(): Promise<void> {
    const mt = await this.store.load();

    const win = new BrowserWindow({
      ...this.placement(mt.hub),
      minWidth: 800,
      minHeight: 520,
      show: false,
      backgroundColor: "#0f131b",
      title: "PoE2 MultiTool",
      icon: path.join(__dirname, process.env.STATIC!, "icon.png"),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });

    win.setMenu(
      Menu.buildFromTemplate([
        { role: "editMenu" },
        { role: "reload" },
        { role: "toggleDevTools" },
      ]),
    );

    win.once("ready-to-show", () => {
      win.show();
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
      if (this.isOwnPage(url)) return;
      event.preventDefault();
      void shell.openExternal(url);
    });

    win.on("close", () => {
      void this.saveBounds(win);
    });
    win.on("closed", () => {
      this.window = null;
    });

    this.window = win;
    await win.loadURL(this.hubUrl());
  }

  private async saveBounds(win: BrowserWindow): Promise<void> {
    if (win.isDestroyed() || win.isMinimized() || win.isMaximized()) return;

    const { width, height, x, y } = win.getBounds();
    await this.store.update({ hub: { width, height, x, y } });
  }

  private placement(bounds: MtHubBounds): WindowPlacement {
    if (bounds.x === null || bounds.y === null) {
      return { width: bounds.width, height: bounds.height };
    }

    // Do not restore the window onto a monitor that is no longer connected.
    const isOnScreen = screen.getAllDisplays().some((display) => {
      const area = display.workArea;
      return (
        bounds.x! >= area.x &&
        bounds.y! >= area.y &&
        bounds.x! <= area.x + area.width - 100 &&
        bounds.y! <= area.y + area.height - 100
      );
    });

    return isOnScreen
      ? { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y }
      : { width: bounds.width, height: bounds.height };
  }

  private isOwnPage(url: string): boolean {
    try {
      return new URL(url).origin === this.origin();
    } catch {
      return false;
    }
  }

  private origin(): string {
    return new URL(this.baseUrl()).origin;
  }

  private baseUrl(): string {
    return (
      process.env.VITE_DEV_SERVER_URL ?? `http://localhost:${this.port}/`
    );
  }

  private hubUrl(): string {
    const url = new URL(
      process.env.VITE_DEV_SERVER_URL
        ? this.baseUrl()
        : `http://localhost:${this.port}/index.html`,
    );
    url.searchParams.set("mt", "hub");
    return url.toString();
  }
}
