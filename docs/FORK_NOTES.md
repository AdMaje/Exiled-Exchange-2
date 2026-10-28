# PoE2 MultiTool — Fork Notes

> **Status:** Phases 1–5 complete (hub, economy, guides, overlay widgets). Phase 6
> (identity/packaging) not started.
> **Last updated:** 2026-10-28.
> **Base:** `Kvan7/Exiled-Exchange-2` @ `cca30662` (v0.16.3, `master`).
> **Our branch:** `multitool`. `master` mirrors upstream releases (see [UPSTREAM_SYNC.md](./UPSTREAM_SYNC.md)).
> **Fork repo:** <https://github.com/AdMaje/Exiled-Exchange-2>

This document is the map of the upstream codebase and the rules for adding PoE2 MultiTool
(MT) modules on top of it. Read this before touching any file.

---

## 1. What we are building

A fork of Exiled Exchange 2 (which itself is a fork of Awakened PoE Trade) that **adds**:

| Phase | Module | Summary |
| --- | --- | --- |
| 2 | MultiTool Hub | Separate window with tabs, module registry, tray + hotkey entry |
| 3 | Economy | Currency rates, search, history chart, favorites, offline cache |
| 4 | Guides & checklists | Local Markdown guides, search, persisted progress |
| 5 | Overlay widgets | Countdown timers, zone/level tracker (native overlay widgets) |
| 6 | Identity | Rebrand, packaging, auto-update, attribution/disclaimer |

**Non-goals:** we do not rewrite, refactor or "improve" upstream features, and we do not
modify upstream price check, trade API handling, item parser, overlay logic or rate limiting.

---

## 2. Environment & commands

Verified on 2026-10-26 (Windows):

- Node **v24.19.0** installed. `npm` via PowerShell is blocked by execution policy
  (`npm.ps1`), so use **`npm.cmd`** (or `cmd /c npm ...`).
- Two independent npm packages, no workspaces and no root `package.json`:
  `renderer/` and `main/`. Shared types live in `ipc/`.
- `node_modules` are installed via `npm.cmd ci` in both packages (Phase 1). See §11 for
  exact versions, results and the blocked install scripts.

```powershell
# Renderer
cd renderer
npm.cmd install
npm.cmd run make-index-files   # required once (generates *.index.bin)
npm.cmd run dev                # Vite on :5173

# Main (second shell)
cd main
npm.cmd install
npm.cmd run dev                # esbuild watch + Electron

# Checks
npm.cmd run lint               # renderer: eslint --ext .ts,.vue src
npm.cmd run check-types        # renderer: tsc --noemit; main: tsc --noemit
npm.cmd run build              # renderer: vue-tsc + vite; main: tsc + esbuild --prod
npm.cmd run test               # renderer: vitest (CI runs it once)
```

**Testing without the game:** see **How to run** below. There is no mock mode for game data.
Client.log events can be replayed by pointing `clientLog` at a fixture file and replaying
`CLIENT->MAIN::re-parse-log` (upstream mechanism, used by `specs/web/FullCampaign.txt`).

**Version consistency:** `versionCheck.py` (pre-commit) requires the same version in
`README.md`, `.github/ISSUE_TEMPLATE/bug-report.yml`, `docs/.vitepress/config.js`,
`main/package.json` and `main/package-lock.json`.

**Line endings (Windows, mandatory):** this repository mixes committed line endings — most
files are CRLF in the index, but some (`renderer/specs/web/FullCampaign.txt`, several
`data/**` files) are LF. A Windows checkout with `core.autocrlf=true` converts the LF files
to CRLF, which breaks the client-log test (the parser receives a trailing `\r`) and
invalidates the byte offsets in `*.index.bin`. Set this once per clone **before** the first
`make-index-files`:

```powershell
git config --local core.autocrlf false
git config --local core.eol lf
# force re-checkout of files whose index blob is LF (only these were converted)
git ls-files --eol | Where-Object { $_ -match '^i/lf\s+w/crlf' }
```

Then re-run `npm.cmd run make-index-files` in `renderer`. CI runs on Linux (LF), so this
only affects Windows development.

### How to run

PowerShell commands for this Windows checkout. `$repo` keeps the paths copy-pasteable; set
it again in each new terminal.

Prerequisites (already done in Phase 1 — repeat after pulling or syncing):

```powershell
$repo = "E:\Projekty\poe2 tool"
cd $repo\renderer
npm.cmd ci
npm.cmd run make-index-files
cd $repo\main
npm.cmd ci
```

#### 1) Dev mode, overlay attached to PoE2

Start PoE2 first. **Terminal A** (Vite):

```powershell
$repo = "E:\Projekty\poe2 tool"
cd $repo\renderer
npm.cmd run dev
```

Wait for `VITE ... ready` and `http://localhost:5173/`.

**Terminal B** (Electron):

```powershell
$repo = "E:\Projekty\poe2 tool"
cd $repo\main
npm.cmd run dev
```

Wait for `uIOhook started`. Electron creates the overlay and attaches to the game window by
title (`config.windowTitle`, default `Path of Exile 2`). Toggle the overlay with
`Shift + Space`. Renderer edits hot-reload; main-process edits rebuild and restart Electron
automatically. This is the mode for verifying in-game attach/focus/hotkey gating.

`npm.cmd run dev` does **not** forward extra CLI arguments to Electron (the runner spawns
`electron .` with no args), so `--no-overlay` / `--listen` require recipe 2.

#### 2) Dev mode without the game (`--no-overlay`, browser)

**Terminal A:** Vite, exactly as in recipe 1.

**Terminal B:** build the dev main bundle once with the same defines as
`main/build/script.mjs`, then start Electron with flags:

```powershell
$repo = "E:\Projekty\poe2 tool"
cd $repo\main

@'
const esbuild = require("esbuild");
esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  external: ["electron", "uiohook-napi", "electron-overlay-window"],
  outfile: "dist/main.js",
  define: {
    "process.env.STATIC": '"../build/icons"',
    "process.env.VITE_DEV_SERVER_URL": '"http://localhost:5173"',
  },
}).catch((e) => { console.error(e); process.exit(1); });
'@ | node -

.\node_modules\electron\dist\electron.exe . --no-overlay --listen=127.0.0.1:8584 --no-updates
```

The app opens in your default browser at **http://localhost:5173/**. The Electron HTTP/WS
server listens on `127.0.0.1:8584`, and Vite proxies `/config`, `/uploads`, `/proxy` and
`/events` there. Keep the port at 8584 unless you also edit `renderer/vite.config.mts`.

The esbuild step is one-shot (no watcher): re-run it after changing main-process code.
Renderer changes still hot-reload in the browser.

Simpler alternative if the exact flag does not matter: run `npm.cmd run dev` in `main` (as
in recipe 1) and open `http://localhost:5173/` yourself. The extra overlay window just stays
idle without the game.

#### 3) Production build and run

Use the fork-owned script (it replaces the manual build/copy/launch sequence):

```powershell
# Overlay attached - Path of Exile 2 should be running.
.\scripts\run-prod.ps1

# No game: fixed server on 127.0.0.1:8584, prints the URLs to open.
.\scripts\run-prod.ps1 -NoGame
```

`scripts/run-prod.ps1` runs `npm.cmd run build` in `renderer`, then in `main`, copies
`renderer\dist\*` into `main\dist`, and launches
`main\node_modules\electron\dist\electron.exe .` from `main`. It resolves every path from
`$PSScriptRoot` (so the space in this repo path is fine), blocks until the app exits, and
stops with an `ERROR: …` line and exit code 1 if a build, the copy or the launch fails.

`-NoGame` adds `--no-overlay --listen=127.0.0.1:8584 --no-updates` and prints:

- hub: **http://localhost:8584/index.html?mt=hub**
- overlay: **http://localhost:8584/index.html**

Both URLs are served by the app; `/?mt=hub` works too. A true end-user test needs
`npm.cmd run package` or the installer (Phase 6).

Manual equivalent, if you need to run one step yourself:

```powershell
$repo = "E:\Projekty\poe2 tool"
cd $repo\renderer
npm.cmd run build

cd $repo\main
npm.cmd run build

# Source-tree run: put the renderer files at the app root, like electron-builder does.
Copy-Item $repo\renderer\dist\* $repo\main\dist -Recurse -Force

.\node_modules\electron\dist\electron.exe . --no-overlay --listen=127.0.0.1:8584 --no-updates
```

For overlay mode run the last command without the flags (game running): no browser opens,
the overlay attaches to PoE2 and the server picks a random port (tray → **Open in Browser**
→ `http://localhost:<port>/`).

The copy step is only for running the production build from this source tree: the static
handler serves from `main/dist`, so without `index.html` there only `/config` responds.
Packaging handles this itself.

#### Ports and URLs

| Mode | Browser URL | Internal server |
| --- | --- | --- |
| Dev + overlay | none opened; overlay window loads `http://localhost:5173/` | `127.0.0.1:8584` |
| Dev, `--no-overlay` | **http://localhost:5173/** | `127.0.0.1:8584` (Vite proxy target) |
| Prod, `run-prod.ps1` + overlay | tray → "Open in Browser" → `http://localhost:<random>/` | random port |
| Prod, `run-prod.ps1 -NoGame` | **http://localhost:8584/index.html** (hub: `?mt=hub`) | `127.0.0.1:8584` |
| Packaged app + overlay | tray → "Open in Browser" → `http://localhost:<port>/` | random port |

On this machine Vite binds `localhost` only — use `http://localhost:5173`, not
`127.0.0.1:5173`. The hub runs on the same server, no extra port:
`http://localhost:<port>/?mt=hub` (prod) or `http://localhost:5173/?mt=hub` (dev), and in
the app via tray → **MultiTool Hub** or the `open-hub` hotkey.

#### How to stop

Close the app from the tray icon → **Quit**, or press Ctrl+C in each dev terminal. The
production script blocks until that happens and then returns to the prompt. Then clear any
survivors:

```powershell
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
```

If a port is still held (Vite or a detached Electron child):

```powershell
Get-NetTCPConnection -LocalPort 5173,8584 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Only one instance can run at a time: Electron's single-instance lock is tied to the app
identity/user-data folder, and until the Phase 6 rebrand this fork shares the
`exiled-exchange-2` identity with upstream EE2. Quit the other build first.

---

## 3. Architecture map (upstream, with paths)

### 3.1 Process model

- `main/src/main.ts` — Electron entry. Creates tray, logger, config store, game window,
  overlay, shortcuts, log watcher, proxy, updater; starts the local server.
- `main/src/server.ts` — local HTTP server + WebSocket at `/events`. Serves the built
  renderer, `/config`, `/uploads`, `/proxy`. Relays typed IPC events.
  `sendEventTo("last-active")` targets the most recently connected/used WS client.
- `renderer/src/main.ts` — Vue bootstrap: config → i18n → game data → `Host.init()` (WS)
  → mount `App.vue`.
- `main/src/windowing/OverlayWindow.ts` — overlay BrowserWindow attached to the game via
  `electron-overlay-window` (`GameWindow.attach(window, windowTitle)`).
- `main/src/windowing/GameWindow.ts` — tracks game focus (`active-change` event).
- `--no-overlay` → no overlay BrowserWindow, page opened in the system browser.

### 3.2 Widgets (overlay)

| Concern | File |
| --- | --- |
| Widget registry (single list) | `renderer/src/web/overlay/widget-registry.ts` |
| Types, flags, specs | `renderer/src/web/overlay/widgets.ts`, `.../overlay/interfaces.ts` |
| Widget chrome (move/edit/hide/delete) | `renderer/src/web/overlay/Widget.vue` |
| Widget menu ("…" → add widget) | `renderer/src/web/overlay/WidgetMenu.vue` |
| Render + widget manager (`wm`) | `renderer/src/web/overlay/OverlayWindow.vue` |
| Per-feature config type | e.g. `renderer/src/web/item-search/widget.ts` |

Pattern: a component exports `widget: WidgetSpec` (`type`, `instances`, `trNameKey`,
`initInstance`/`defaultInstances`); `widget-registry.ts` pushes it. Instances, positions
(`anchor`), z-order and flags persist in `config.json` (`Config.widgets`). Adding a widget
needs **one line** in the registry — no main-process code.

### 3.3 Hotkeys

1. `renderer/src/web/Config.ts` → `getConfigForHost()` builds `HostConfig.shortcuts`.
2. `CLIENT->MAIN::update-host-config` (`ipc/types.ts`).
3. `main/src/shortcuts/Shortcuts.ts` → `updateActions()` → `globalShortcut.register()`.
4. Actions are a typed union in `ipc/types.ts` (`ShortcutAction`).

Important: shortcuts are registered **only while the PoE2 window is active**
(`GameWindow` `active-change` → register/unregister, `unregisterAll()` on blur).
Per-widget keys are stored on widget config and delivered as
`MAIN->CLIENT::widget-action`.

### 3.4 Settings

- Settings is itself an exclusive overlay widget:
  `renderer/src/web/settings/SettingsWindow.vue` (opened via the cog widget).
- Pages are registered in `menuByType()` in that file; per-widget panels map by `wmType`.
- Helpers: `renderer/src/web/settings/utils.ts` (`configProp`, `findWidget`, ...),
  `HotkeysGeneric.vue` / `HotkeyInput.vue`.

### 3.5 IPC

- Typed union: `ipc/types.ts` (`IpcEvent`, `IpcEventPayload`, `HostConfig`, `ShortcutAction`).
- Main: `onEventAnyClient`, `sendEventTo("last-active" | "broadcast")` in
  `main/src/server.ts`.
- Renderer: `renderer/src/web/background/IPC.ts` (`Host.sendEvent`, `Host.onEvent`,
  `Host.proxy`, `Host.getConfig`).

### 3.6 Config & persistence

- Main: `main/src/host-files/ConfigStore.ts` → `%APPDATA%\<app.getPath("userData")>\apt-data\config.json`
  (currently `%APPDATA%\exiled-exchange-2\...` in dev; verify the exact packaged folder in
  Phase 6 before renaming it).
- Schema/defaults/migrations: `renderer/src/web/Config.ts` (currently `configVersion: 35`).
- Renderer saves via `CLIENT->MAIN::save-config`; main broadcasts `MAIN->CLIENT::config-changed`.
- **Web storage is not usable for persistence:** production server port is random, so
  `localStorage`/IndexedDB origins change on every start. Use config or files in
  `userData/multitool/`.

### 3.7 i18n

- Runtime fetch of `renderer/public/data/<lang>/app_i18n.json`
  (`renderer/src/web/i18n.ts`), namespaced keys via `useI18nNs`.
- Locales: en, ru, cmn-Hant, ko, ja, de, es, pt, fr. **No Polish**, and adding one would
  require Polish item/stat/client-string data (`Data.loadForLang`). MT therefore has its
  own i18n layer (see §5.4).

### 3.8 Client.txt

- Main tails the file: `main/src/host-files/GameLogWatcher.ts` (`watchFile`, 450 ms) and
  broadcasts raw lines (`MAIN->CLIENT::game-log`).
- Renderer parses typed events: `renderer/src/web/client-log/client-log-parser.ts`.
- Shared state for widgets: `renderer/src/web/client-log/client-log.ts` (`zoneName`,
  `areaLevel`, `playerLevel`). **Reuse this; never add a second watcher.**

### 3.9 Network

- All third-party HTTP goes through `/proxy/<host>/<path>` → `main/src/proxy.ts`.
- Whitelist of hosts lives there; `user-agent` is forced to `app.userAgentFallback`.
- Trade rate limiting: `renderer/src/web/price-check/trade/RateLimiter.ts` (do not touch).
- poe.ninja data for price check is fetched via the upstream author's aggregator
  `api.exiledexchange2.dev` in `renderer/src/web/background/Prices.ts`. Leave it alone.

### 3.10 Tray, identity, packaging

- `main/src/AppTray.ts` (menu, "Open in Browser", config folder).
- `main/package.json` (name `exiled-exchange-2`, v0.16.3), `main/electron-builder.yml`
  (`publish: github`, NSIS, portable; no explicit `appId`).
- About page: `renderer/src/web/settings/about.vue`.
- Updater: `main/src/AppUpdater.ts` (`electron-updater`, GitHub feed from package.json).

---

## 4. Fork hygiene rules (mandatory)

1. **New code only in fork-owned paths:** `main/src/mt/`, `renderer/src/mt/`,
   `renderer/specs/mt/`, `ipc/mt.ts`, `content/**` (fork content), `docs/*`.
2. **Upstream edits are hooks only** (registration lines, one config block). No
   reformatting, renaming, refactoring or drive-by cleanups. Never change upstream
   behavior as a side effect.
3. **Append-only blocks** in upstream code files, marked:
   ```ts
   // MT: BEGIN <short purpose>
   ...
   // MT: END <short purpose>
   ```
   Marker lines are removed only when upstream absorbs an equivalent hook.
   JSON/YAML/Markdown cannot carry `//` comments — those files are listed in §7 instead,
   and edits must stay additive and minimal.
4. **Never touch** upstream business logic: `Parser.ts`, `price-check/**`, trade API and
   `RateLimiter`, `client-log-parser.ts`, `OverlayWindow.ts`, `Widget.vue`, config
   migrations unless strictly required (justified in the commit message).
5. **New dependencies require justification** in the commit + this doc. Reuse upstream
   libs first (Vue, Tailwind, VueUse, Luxon, ApexCharts, tippy, vuedraggable).
6. **Style:** follow existing Prettier/ESLint config, Composition API, `shallowRef`/
   `createGlobalState`, Tailwind utility classes, Path aliases (`@/`, `@ipc`).
7. **i18n:** MT strings live in `renderer/src/mt/i18n/{en,pl}.ts`; no edits to upstream
   locale files. Every user-facing MT string exists in EN and PL.
8. **No volatile constants:** leagues, realm, patch versions, item names and prices come
   from APIs or upstream state. Zone IDs/names are display-only and best-effort.
9. **Tests alongside code** in `renderer/specs/mt/**` using vitest + fixtures; no network
   in tests.
10. **Never push to upstream.** We only merge from it. Upstream `AI_POLICY.md` forbids
    AI-generated contributions there.

---

## 5. MultiTool Hub design (Phase 2 decision record)

### 5.1 Window

- New **separate normal BrowserWindow** (`main/src/mt/MtHubWindow.ts`), not an overlay
  widget. Standard frame, dark background, resizable, remembers bounds.
- Loads the same renderer with `?mt=hub`; `renderer/src/main.ts` mounts
  `MtHubApp.vue` instead of the overlay app.
- Works in a plain browser too (`?mt=hub`), which is our no-game QA path.
- Opened from: tray item **MultiTool Hub** (show/hide toggle) and the `open-hub` shortcut
  action through the existing upstream pipeline (game-focus gated like every other
  shortcut). While the hub itself is focused PoE2 is not, so the global shortcut is
  unregistered; the hub therefore closes via a local keydown match of the same hotkey,
  `Esc`, or the window close button. When the hub is open but another app is focused,
  the hotkey brings it back to the front.

### 5.2 No WebSocket in the hub

`server.ts` sets `lastActiveClient` on every new WS connection. A hub that connected
would hijack `MAIN->CLIENT::item-text` and break price check. Therefore the hub:

- **does not** call `Host.init()` and **does not** send `CLIENT->MAIN::used-recently`;
- talks to main over small HTTP endpoints under `/mt/*`;
- re-reads config on window focus (cheap, file-backed).

Enforced in Phase 2: the hub has its own lazy entry chunk (`renderer/src/mt/bootstrap.ts`)
that imports neither `web/background/IPC` nor `sockette`; the built chunk contains no
`/events` or `ws://` reference.

### 5.3 Config & persistence (D7)

MT settings live in an additive `mt` subtree of upstream `config.json` so hotkeys flow
through the single upstream shortcut pipeline and settings travel with the app config.
No `configVersion` bump; `upgradeConfig()` gets one idempotent block:
`config.mt ??= defaultMtConfig()`.

```jsonc
"mt": {
  "hubHotkey": null,                 // e.g. "Ctrl + Shift + H"
  "language": "auto",                // "auto" | "en" | "pl"
  "hub": { "width": 1100, "height": 760, "x": null, "y": null },
  "economy": {
    "source": "poe2scout",
    "realm": null,                   // resolved from /Realms (GameApiId === "poe2")
    "league": null,                  // resolved from /{realm}/Leagues
    "referenceCurrency": null,       // null = API default / EE2 core currency
    "favorites": [],                 // [{ "apiId": 123, "name": "Divine Orb" }]
    "lastCategory": "currency"
  },
  "guides": { "progress": {}, "lastOpened": null }
}
```

File-backed data (never in config.json, never in web storage):

- `%APPDATA%\<userData>\multitool\cache\<key>.json` — economy cache with TTL metadata.
- `%APPDATA%\<userData>\multitool\guides\*.md` — user-authored guides.

Main-side routes (new `main/src/mt/routes.ts`, registered before the static handler):

| Route | Purpose |
| --- | --- |
| `GET /mt/config` | current `mt` subtree + app version/language |
| `PUT /mt/config` | validate, merge **only** `mt`, atomic write, broadcast `config-changed` |
| `GET /mt/cache/:key` | cached payload + `savedAt` |
| `PUT /mt/cache/:key` | write payload (size-capped) |
| `GET /mt/guides/index.json` | index of user-authored guides |
| `GET/PUT /mt/guides/:slug.md` | read or write one user guide |
| `POST /mt/guides/reveal.json` | open the user guide folder |
| `POST /mt/guides/:slug.md/reveal.json` | reveal one user guide |

`PUT /mt/config` performs read-merge-write into `config.json` and then broadcasts
`MAIN->CLIENT::config-changed`, so the overlay reloads immediately. The tiny race with a
concurrent overlay save is accepted and documented; hub writes are small and infrequent.

Implementation notes (Phase 2):

- Writes are serialized inside `MtConfigStore` (one promise queue) so a hub save and a
  window-bounds save cannot lose each other. The file is replaced atomically via
  `<path>.mt-tmp` + rename, falling back to a direct write on Windows file locks.
- Only the `mt` key is touched. Every other top-level key is read from disk and written
  back unchanged (verified in the Phase 2 smoke test with a sentinel `overlayKey`).
- The broadcast is only sent when the file already was a complete upstream config
  (numeric `configVersion`). A bare `{ "mt": … }` file must not be pushed to the overlay.
- Dev caveat: upstream `ConfigStore.save` is a no-op in dev, so the first hub save creates
  a `config.json` containing only the `mt` subtree. `initConfig` merges upstream defaults
  over a partial file (`{ ...defaultConfig(), ...parsed }`), so the overlay still starts
  and the next overlay save writes a complete config including `mt`.

### 5.4 i18n (D5)

- Fork-owned: `renderer/src/mt/i18n/en.ts`, `pl.ts`, `index.ts` with `useMtI18n()`.
- Language: `mt.language` = `auto` (English today, follows app language if it ever becomes
  Polish), `en`, or `pl`, selectable in hub settings.
- Upstream UI stays in its own language; we do not add locales or touch Crowdin files.
- Missing PL keys fall back to EN at runtime (dev warning in dev builds).

### 5.5 Module registry

```ts
// renderer/src/mt/registry.ts
export interface MtModule {
  id: string;                 // "economy" | "guides" | "widgets"
  titleKey: string;           // key in mt i18n
  icon?: string;              // Font Awesome class
  component: Component;       // tab content
}
export const mtModules: MtModule[] = [ /* one entry per module */ ];
```

Adding a module = one entry + one component. Tabs are derived from this list; unknown ids
fall back to the first module. All three tabs are implemented (Phases 3–5) and their
components are lazy-loaded.

### 5.6 Economy (Phase 3)

- Provider, cache, queue and UI live in `renderer/src/mt/economy/`; no upstream price-check
  or trade code is imported.
- Realms/leagues/categories/reference currencies are discovered at runtime. Realm path is
  the provider's `RealmApiId` (`poe2`), selected by `GameApiId === "poe2"`.
- **Deviation:** the hub does not call upstream `useLeagues()`; that module imports the
  overlay config/widget registry and `sockette`. The league list comes from poe2scout and
  the selected league/EE2 league is used only as a preferred default.
- `ByCategory` only accepts `dataPoints` 7 or 8. The 7-day chart uses the daily `PriceLogs`
  from the table payload; 30/90 days use `Items/{itemId}/History` hourly points (720/2160).
- One in-flight request, ≥1 s spacing, exponential backoff, `Retry-After` honored
  (longer than 60 s aborts instead of freezing the UI). Upstream trade `RateLimiter` is
  untouched.
- All HTTP goes through `/proxy/api.poe2scout.com`; `main/src/proxy.ts` adds the host and a
  contactable UA only for that host.
- Cache is file-backed (`multitool/cache/*.json`), conditionally revalidated with
  `If-Modified-Since`, and always renders `savedAt` plus an offline/stale badge.
- Tests use recorded fixtures under `renderer/specs/mt/economy/fixtures/` and never touch
  the network.

### 5.7 Guides (Phase 4)

- User guides are `%APPDATA%\<userData>\multitool\guides\<slug>.md`; the main process
  (`main/src/mt/guides.ts`) enforces a slug whitelist (`^[a-z0-9][a-z0-9-_]{0,63}$`),
  256 KB cap, `.md` only and traversal-free paths. Writes are atomic.
- The main process only lists user guides; the renderer merges bundled guides (Vite `?raw`)
  and lets a user guide override the same slug.
- Shared frontmatter parser/bitmask helpers live in `ipc/mtGuides.ts`; checklist progress is
  one integer bitmask per slug in `mt.guides.progress` (max 50 tasks).
- `markdown-it` (HTML disabled) is the only new renderer dependency; guides/link/images are
  sanitized (`target=_blank`, `rel=noopener noreferrer`, lazy images, no referrer).
- Search covers title, tags and body; the editor and reveal/open-folder actions go through
  `/mt/guides/*` routes.

### 5.8 Overlay widgets (Phase 5)

- `renderer/src/mt/widgets/` (fork-owned) provides:
  - `mt-countdown` — multi-instance, manual local timer with label, duration, progress bar,
    start/pause/reset. It is display-only: no log trigger, no game input. Runtime progress
    is not persisted; label/duration/position are part of the widget config.
  - `mt-zone-tracker` — single-instance tracker showing the raw area id plus area/player
    level, using the existing `useClientLog()` refs. No second Client.txt watcher. When
    `readClientLog` is off it shows an enable hint.
- Registration is two `// MT:` blocks in `widget-registry.ts`; settings panels are hooked in
  `SettingsWindow.vue#menuByType`. `Config.ts#upgradeConfig` inserts the missing single
  zone-tracker widget idempotently.
- The add-menu labels are literal `trNameKey` strings ("MT Countdown", "MT Zone Tracker");
  no upstream locale file is edited. Fork widgets translate through
  `renderer/src/mt/widgets/i18n.ts`, which reads `mt.language` and the fork EN/PL messages.

---

## 6. Compliance invariants (GGG third-party policy)

Source: <https://www.pathofexile.com/developer/docs> (checked 2026-10-26).

- **Allowed input:** clipboard content after a user-triggered copy (upstream behavior),
  `Client.txt` tailing with user awareness, official/public APIs, local files.
- **Never:** read game memory, inject DLLs, hook/patch the game process, read game files
  we are not allowed to read, reverse-engineer undocumented GGG endpoints (ToU 7i).
- **No input automation.** Every new MT hotkey changes **local UI state only** (open a
  window, focus a tab). It must not send keystrokes/clicks to the game and must not
  trigger server-side actions. One user keypress still maps to at most the one action
  upstream already performs (item copy).
- **No auto-starting gameplay-adjacent actions.** Timers start/stop by user interaction;
  the zone tracker only displays log-derived state. Nothing reacts to the game by sending
  input.
- **Network:** descriptive `User-Agent` with contact, honor `Retry-After`/rate-limit
  headers, cache aggressively, serialize requests with backoff, never poll while the hub
  is closed. Do not modify or weaken upstream trade rate limiting.
- **Attribution/disclaimer** in About, README and installer:
  "This product isn't affiliated with or endorsed by Grinding Gear Games in any way."
  Plus attribution to Awakened PoE Trade and Exiled Exchange 2.

---

## 7. Touched upstream files

**Phases 2–5 touch 11 unique upstream files** — cumulative **+109/−4** lines. Phase 2 used
8 files (+79/−3). Phases 3–5 used 4 file touches (+30/−1): 17 code lines and 13
`// MT:` comments/markers, no blank lines, inside the ~40-line budget. This table is the
contract for later phases; keep it updated in the same commit as every new touch.

| # | Phase | File | Change (append-only) | Lines | Marker |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | `renderer/src/main.ts` | `?mt=hub` → dynamic MT bootstrap, returns before upstream `initConfig`/`Host.init` | +9 | `// MT:` |
| 2 | 2 | `renderer/src/web/Config.ts` | `mt?: MtConfig` + default; `config.mt ??=` in `upgradeConfig`; defaults-merge guard in `initConfig`; `mt.hubHotkey` → `open-hub` action | +20/−1 | `// MT:` |
| 3 | 2 | `ipc/types.ts` | `{ type: "open-hub" }` added to `ShortcutAction` | +4 | `// MT:` |
| 4 | 2 | `main/src/shortcuts/Shortcuts.ts` | `openHub` callback + `open-hub` branch (no game input, no clipboard) | +7 | `// MT:` |
| 5 | 2 | `main/src/main.ts` | construct `MtHubWindow(port, mtStore)`, wire tray + `open-hub` callback | +14 | `// MT:` |
| 6 | 2 | `main/src/AppTray.ts` | `openHub` field + "MultiTool Hub" menu item | +8 | `// MT:` |
| 7 | 2 | `main/src/server.ts` | `addMtRoutes(server, broadcast)` before the static listener; exclude `/mt`; `config-changed` helper | +15/−1 | `// MT:` |
| 8 | 2 | `renderer/vite.config.mts` | dev proxy `^/(config\|uploads\|proxy\|mt)` | +2/−1 | `// MT:` |
| 9 | 3 | `main/src/proxy.ts` | whitelist `api.poe2scout.com`; per-host MT User-Agent | +12/−1 | `// MT:` |
| 10 | 5 | `renderer/src/web/overlay/widget-registry.ts` | import + register the two MT widget components | +6 | `// MT:` |
| 11 | 5 | `renderer/src/web/Config.ts` | `ensureMtSingleWidgets()` import and idempotent call in `upgradeConfig` | +4 | `// MT:` |
| 12 | 5 | `renderer/src/web/settings/SettingsWindow.vue` | import MT settings panels + `menuByType` cases | +8 | `// MT:` |
| 13 | 6 | `main/package.json`, `main/package-lock.json` | name/appId/update feed (isolated identity commit) | n/a (JSON) |
| 14 | 6 | `main/electron-builder.yml` | `appId`, `productName`, artifacts, publisher | n/a (YAML) |
| 15 | 6 | `main/src/AppTray.ts` | new product name/tooltip | `// MT:` |
| 16 | 6 | `renderer/src/web/settings/about.vue` | fork name, links, attribution + GGG disclaimer | n/a (Vue template) |
| 17 | 6 | `README.md`, `docs/.vitepress/config.js`, `.github/ISSUE_TEMPLATE/bug-report.yml`, `versionCheck.py` | identity/version consistency | n/a |
| 18 | 6 | `.github/workflows/*` | fork CI only (no upstream publishing) | n/a |

Quantified budget: Phases 3–5 used **4** upstream file touches, **+30/−1** lines
(17 code + 13 comments/markers), inside the ~40-line limit. Phase 2 remains **+79/−3**;
the cumulative Phase 2–5 upstream diff is **+109/−4** across 11 unique files.

### Files we must NOT modify

`renderer/src/parser/**`, `renderer/src/web/price-check/**` (incl. `trade/**`),
`renderer/src/web/client-log/client-log-parser.ts`, `renderer/src/web/overlay/Widget.vue`,
`renderer/src/web/overlay/OverlayWindow.vue`, `main/src/windowing/OverlayWindow.ts`,
`main/src/host-files/GameLogWatcher.ts`, `main/src/host-files/ConfigStore.ts`,
`renderer/public/data/**`.

---

## 8. Licensing note

- `LICENSE`: MIT, **Copyright (c) 2020 Alexander Drozdov** (Awakened PoE Trade).
  Exiled Exchange 2 is a derivative distributed under the same license.
- **Must preserve:** the full MIT text and copyright notice in the repo and in every
  distributed build (installer). MIT requires the notice in "all copies or substantial
  portions of the Software".
- **Attribution:** README "Acknowledgments" (Awakened PoE Trade, libuiohook, RePoE,
  poeprices.info, poe.ninja) and the About page must keep upstream attribution; we add
  MT authorship/links without removing theirs.
- **Our new code:** MIT, no per-file headers (repo `LICENSE` covers it). Third-party
  notices for bundled deps go to `THIRD_PARTY_NOTICES.md` (Phase 6) and are shipped with
  the installer via electron-builder `extraResources`.
- **poe2scout data:** attribution in the Economy tab ("Data by poe2scout.com") and in
  [DATA_SOURCES.md](./DATA_SOURCES.md).
- **GGG:** include the non-affiliation disclaimer (see §6). Do not use GGG logos in a way
  that suggests endorsement.
- **Upstream `AI_POLICY.md`:** forbids agent-generated contributions upstream. Our fork is
  separate; we never open upstream PRs with this code.

---

## 9. Testing strategy

- Unit tests: `renderer/specs/mt/**` (vitest, `npm.cmd run test`).
  Providers are tested against recorded JSON fixtures; timers/backoff with fake timers;
  config merge and cache TTL logic pure-function tests.
- No network in tests. Fixtures must be trimmed (< 2 MB, pre-commit limit) and contain no
  account names or tokens.
- Manual QA per phase (recorded in the phase commit message):
  - Hub: tray open, hotkey open, hotkey/Esc close, tabs, language switch, restart.
  - Economy: online refresh, port change/restart offline fallback, league switch, 429.
  - Guides: bundled + user guide, search, checklist survives restart.
  - Widgets: move/edit/delete, anchors persist, no input sent to game.
- Upstream checks must stay green: renderer `lint`, `check-types`, `build`, `test`;
  main `lint`, `check-types`, `build`.

---

## 10. Known constraints & risks

1. Random prod port ⇒ no web storage persistence (see §3.6).
2. WS `last-active` hijack ⇒ hub must stay off the WS (see §5.2).
3. Hotkeys are game-focus gated; hub open/close semantics need in-game verification.
4. Adding a second BrowserWindow next to an attached overlay is untested in-game.
5. No code signing configured → SmartScreen warnings for installer and updates.
6. Running fork + EE2 side by side conflicts on identical default hotkeys and both may
   attach to the game window; for UI testing only.
7. `docs/` Pages workflow hardcodes base `/Exiled-Exchange-2/`; fix or disable in Phase 6.
8. `poe2scout` has no published rate limits; treat it conservatively and cache.
9. Zone tracker shows the raw area id from `Client.txt` (towns/hideouts are skipped by the
   shared parser) plus area/player level. There is no curated display-name map yet.
10. Countdown state is runtime-only: an overlay reload or app restart resets it to its
    configured duration. Both MT widgets are display-only and never send game input.
11. Phase 6 rebrand changes `userData`; verify real path before/after and document a
    migration/notice (no silent data move).

---

## 11. Phase log

| Phase | State | Notes |
| --- | --- | --- |
| 0 Recon | done | this doc, UPSTREAM_SYNC.md, DATA_SOURCES.md; remotes + `multitool` branch |
| 1 Baseline | done | env fixed (LF checkout), all lint/type/build checks green, 527/529 tests pass, dev + prod smoke OK; details below |
| 2 Hub | done | window, registry, tray/hotkey, `/mt` routes, settings; 25 new tests; in-game checklist pending |
| 3 Economy | done | poe2scout provider, cache, chart, favorites; 41 new tests |
| 4 Guides | done | bundled + user Markdown, search, checklist bitmask; 16 new tests |
| 5 Widgets | done | countdown + zone tracker, settings panels; 12 new tests |
| 6 Identity | not started | isolated rebrand commit, packaging, update feed |

### Phase 1 — environment & baseline (2026-10-26)

Toolchain: Windows, Node **v24.19.0**, npm **12.1.0** (via `npm.cmd`, see §2), git 2.55.0.
Electron **40.10.2** binary present (`main/node_modules/electron/dist/electron.exe`).
Install: `npm.cmd ci` in `renderer` → 377 packages; in `main` → 537 packages.
Install scripts blocked by npm (not approved, not needed): `vue-demi@0.14.10` (×2),
`unrs-resolver@1.11.1`.

| Check | Command (from) | Result |
| --- | --- | --- |
| Index files | `npm.cmd run make-index-files` (`renderer`) | exit 0 |
| Renderer lint | `npm.cmd run lint` | exit 0 |
| Renderer types | `npm.cmd run check-types` | exit 0 |
| Renderer tests | `npm.cmd run test -- --run` | **23 files, 527 passed, 2 skipped (529)**, exit 0 |
| Renderer build | `npm.cmd run build` | exit 0; `dist/index.html` + 1.35 MB JS (chunk-size warning only) |
| Main lint | `npm.cmd run lint` | exit 0 |
| Main types | `npm.cmd run check-types` | exit 0 |
| Main build | `npm.cmd run build` | exit 0; `dist/main.js` 474,884 B, `dist/vision.js` 48,554 B |

**Environment fix 1 — CRLF vs LF.** The initial test run failed with
`clientLog > Should parse full campaign client log` (`Host.sendEvent` never called). Cause:
`core.autocrlf=true` had converted the LF fixture `renderer/specs/web/FullCampaign.txt` to
CRLF; `split("\n")` left a trailing `\r`, so no log line matched the parser. This is a
Windows checkout issue, not an upstream bug (CI is Linux and passes upstream). Fix: set
`core.autocrlf=false` + `core.eol=lf` repo-local and re-checkout the 323 files whose index
blob is LF (see §2). No source or test file was modified.

**Environment fix 2 — stale index offsets.** After the line-ending fix, `*.index.bin` had
been generated from CRLF `stats.ndjson`, so `JSON.parse` failed on every stat lookup
(399 test failures). Re-running `make-index-files` after the checkout fixed it. Rule:
regenerate index files after any line-ending change or upstream data update.

**Dev-mode smoke test (no game).** `npm.cmd run dev` in `renderer` (Vite 5.4.21) and in
`main` (esbuild watch + Electron), no game running:

- `http://localhost:5173/` → 200, entry module `src/main.ts` → 200
- `http://localhost:5173/config` via the Vite dev proxy → 200 (5,444 B JSON)
- `ws://localhost:5173/events` handshake → `101 Switching Protocols`
- 6 Electron processes alive, log shows `uIOhook started`, no errors in the main log
- Note: Vite binds `localhost` on this machine; `127.0.0.1:5173` does **not** connect.

**Production-mode smoke test (no game).** `npm.cmd run build` in `renderer` and `main`,
then copy `renderer/dist/*` into `main/dist/` (packaging does this via electron-builder),
then run
`main\node_modules\electron\dist\electron.exe . --no-overlay --listen=127.0.0.1:8584 --no-updates`:

- `/index.html` → 200, `/assets/index-*.js` → 200 (1,351,770 B),
  `/data/en/app_i18n.json` → 200
- `--no-overlay` opens the app in the default browser; Electron stayed alive, no errors
- Without copying the renderer build into `main/dist`, only `/config` responds (the static
  handler serves from `__dirname`, i.e. `main/dist`). That is expected for a source-tree
  run, not a packaging bug. Copy step was temporary; `main/dist` was cleaned afterwards.

**Pre-existing warnings (left alone — upstream):**

- Vitest: `vi.mock("@/assets/client-string-loader")` in `specs/vitest.setup.ts` is not
  top-level; vitest warns it will become an error in a future version.
- Vite: `vite-tsconfig-paths` plugin is now native (`resolve.tsconfigPaths`).
- Renderer bundle > 500 kB after minification; Electron deprecation notices for
  `session.getAllExtensions` / `session.loadExtension`; `caniuse-lite` is 6 months old.

**Not verified in Phase 1:**

- In-game attach/focus/hotkey gating — no PoE2 client was running. The loaded config shows
  the default `windowTitle: "Path of Exile 2"`; actual attach must be tested in Phase 2
  (fallback QA path: browser + `?mt=hub`).
- Installer/`electron-builder` packaging — deferred to Phase 6.
- Runs read and migrate the real `%APPDATA%\exiled-exchange-2\apt-data\config.json`
  (observed `configVersion: 34` → current schema 35). Keep that in mind for manual QA.

**Decision:** baseline is green. No upstream file, test or fixture needed changes.

### Phase 2 — MultiTool Hub (2026-10-27)

Scope: hub window + module scaffold only. No Phase 3 (economy) code was started.
Roadmap for Phases 2–6 lives in [PLAN.md](./PLAN.md).

**Fork-owned files added**

| Area | Files |
| --- | --- |
| Shared model | `ipc/mt.ts` (types, defaults, sanitizer/merge, hotkey helpers) |
| Main | `main/src/mt/MtConfigStore.ts`, `main/src/mt/routes.ts`, `main/src/mt/MtHubWindow.ts` |
| Hub renderer | `renderer/src/mt/bootstrap.ts`, `MtHubApp.vue`, `registry.ts`, `api.ts`, `mt.css`, `i18n/{en,pl,index}.ts`, `components/MtPlaceholderPanel.vue`, `components/MtSettingsPanel.vue`, `modules/{economy,guides,widgets}/*.vue` |
| Tests | `renderer/specs/mt/{config,hotkey,i18n,registry}.spec.ts` + `helpers.ts` |
| Tooling | `scripts/run-prod.ps1` (build renderer + main, copy to `main\dist`, launch; `-NoGame`) |

**Behaviour implemented**

- Hub is a normal sandboxed `BrowserWindow` loading `?mt=hub`; the renderer returns before
  `initConfig()`/`Host.init()`, so it never opens `/events` and never sends `used-recently`.
  Verified in the built chunk: the `bootstrap-*.js` chunk contains no `ws://`, `/events`
  or `sockette`.
- Registry-driven tabs (`economy`, `guides`, `widgets`) with lazy module components,
  unknown-id fallback, and a gear view for settings.
- Settings: language (`auto`/`en`/`pl`), hub hotkey (reuses upstream `HotkeyInput`), window
  bounds. All persisted through `GET/PUT /mt/config`; no web storage anywhere.
- Hub hotkey flows through the upstream `Shortcuts` pipeline as an `open-hub` action
  (game-focus gated). Closing works via `Esc`, the close button, or the local keydown match.
- `/mt/config` validates and merges only the `mt` subtree (unknown keys dropped, values
  clamped) and preserves every other key in `config.json`; writes are serialized and
  atomic (`.mt-tmp` + rename). A missing file is created as `{ "mt": … }`; an unreadable,
  non-object or corrupt file is never overwritten (the route answers 500 instead).
- The hub re-reads `/mt/config` when the window regains focus, so settings changed while
  the window was hidden are picked up.

| Check | Command (from) | Result |
| --- | --- | --- |
| Renderer lint | `npm.cmd run lint` (`renderer`) | exit 0 |
| Renderer types | `npm.cmd run check-types` | exit 0 |
| Renderer tests | `npm.cmd run test -- --run` | **27 files, 552 passed, 2 skipped (554)** — +25 new MT tests |
| Renderer build | `npm.cmd run build` | exit 0; hub split into `bootstrap-*.js` (10.85 kB) + 3 module chunks + CSS |
| Main lint / types / build | `npm.cmd run lint`, `check-types`, `build` (`main`) | exit 0 |
| Prod route smoke | Electron with `--user-data-dir` temp, no game | GET defaults; PUT persists; bare `{mt}` create; sentinel `overlayKey`/`configVersion` preserved; `/?mt=hub` and `/index.html?mt=hub` → 200 HTML; 404/400 validation; invalid hotkey keeps previous |
| Dev proxy smoke | Vite 5173 + Electron 8584 | `localhost:5173/mt/config` proxied; `/?mt=hub` 200; `src/mt/bootstrap.ts` 200 |
| Prod script smoke | `.\scripts\run-prod.ps1 -NoGame` | renderer + main builds green, copy green, server on 8584; `/mt/config` 200; `/?mt=hub` and `/index.html?mt=hub` 200; Electron probe of the hub URL rendered `PoE2 MultiTool`, nav Economy/Guides/Widgets/Settings and the Economy placeholder |

**Follow-up (same phase):** `scripts/run-prod.ps1` wraps the manual build/copy/launch
sequence from §2.3 and adds `-NoGame`; no app code changed for it.

**Manual in-game checklist (pending user)**

1. Prod build with PoE2 running → tray shows **MultiTool Hub**; click opens a normal, framed,
   dark window (not transparent, not attached to the game).
2. Set a hub hotkey in Settings, focus PoE2, press it → hub opens; press it again with the
   hub focused → hub closes; `Esc` and the close button also close it.
3. Reopen from the tray → previous position/size are restored (move/resize first).
4. Copy an item in game while the hub is open → price check still shows that item
   (no WS `last-active` hijack).
5. Tabs Economy / Guides / Widgets render (Phase 2 shipped placeholders); gear opens Settings.
6. Switch EN ↔ PL → UI updates instantly; restart app → language persists.
7. Set a hotkey owned by another app → hub still opens from the tray (upstream logs the
   registration failure).
8. Close and reopen the app → `config.json` still has all upstream settings/values intact
   plus a populated `mt` subtree.
9. Open `http://localhost:<port>/?mt=hub` in a plain browser → works; DevTools Network shows
   no `/events` WebSocket; Application storage is empty.
10. With PoE2 closed → tray opens the hub; the hub hotkey does nothing (expected, upstream
    game-focus gating).

### Phase 3 — Economy (2026-10-28)

Scope: poe2scout-backed economy tab only. No guides or overlay-widget code was started.

**Fork-owned files added**

| Area | Files |
| --- | --- |
| Economy core | `renderer/src/mt/economy/{provider,cache,queue,store}.ts`, `MtCurrencyTable.vue`, `MtPriceChart.vue` |
| Main | `main/src/mt/cache.ts`; cache routes in `main/src/mt/routes.ts`; upstream proxy hook |
| Hub shell | `renderer/src/mt/api.ts` cache helpers, `MtHubApp.vue` module wiring, EN/PL strings |
| Tests + fixtures | `renderer/specs/mt/economy/{provider,cache,queue}.spec.ts`, `renderer/specs/mt/economy/fixtures/*` |
| Config | `ipc/mt.ts` economy sanitizer, `renderer/specs/mt/config.spec.ts` |

**Behaviour implemented**

- Runtime discovery of realms (`GameApiId === "poe2"` → `RealmApiId`), leagues, categories
  (`Items/Categories` → `CurrencyCategories[].ApiId`) and reference currencies. Nothing is
  hardcoded; the last selection is stored in `mt.economy`.
- Currency table with pagination, search, reference-currency switch and favorites; manual
  refresh only, no polling while the hub is closed.
- Offline/stale badge plus `savedAt` age; file cache survives restarts and port changes.
- 7d/30d/90d chart. `ByCategory` accepts only 7 or 8 `dataPoints`: 7d reads daily
  `PriceLogs` from the table, 30d/90d read hourly `Items/{itemId}/History`. Pair history was
  empty for every attempted id and is unused (see DATA_SOURCES §2.3).
- Queue: one in-flight request, ≥1 s spacing, 3 retries with 2/4/8 s backoff, `Retry-After`
  honored (values over 60 s abort). Completely separate from upstream trade `RateLimiter`.
- Conditional requests (`If-Modified-Since`) reuse the cached payload on 304.
- No upstream `useLeagues()` in the hub: it pulls in the overlay config, widget registry and
  `sockette`; leagues come from the provider instead (documented deviation).

| Check | Command (from) | Result |
| --- | --- | --- |
| Renderer lint / types / build | `npm.cmd run lint`, `check-types`, `build` | exit 0 |
| Renderer tests | `npm.cmd run test` | **30 files, 593 passed, 2 skipped (595)** — +41 tests |
| Main lint / types / build | `npm.cmd run lint`, `check-types`, `build` | exit 0 |

No network is used by the tests; fixtures were recorded once (2026-10-28) with `.meta.json`
request metadata.

### Phase 4 — Guides (2026-10-28)

Scope: local Markdown guides and persisted checklists.

**Fork-owned files added**

| Area | Files |
| --- | --- |
| Shared helpers | `ipc/mtGuides.ts` (frontmatter, slug, task bitmask, starter template) |
| Main | `main/src/mt/guides.ts`; guide routes + error mapping in `main/src/mt/routes.ts` |
| Hub renderer | `renderer/src/mt/guides/{api,catalog,markdown,store}.ts`, `modules/guides/GuidesModule.vue` |
| Content | `renderer/src/mt/content/guides/*.md` (3 original sample guides) |
| Tests | `renderer/specs/mt/guides.spec.ts` (16 new tests) |

**Behaviour implemented**

- Bundled guides are imported with Vite `?raw`; user guides are listed/read/written through
  `/mt/guides/*`. A user guide overrides a bundled guide with the same slug.
- Slug whitelist, `.md` only, 256 KB cap, atomic writes and traversal-free paths; missing or
  locked user files are skipped instead of breaking the list.
- Tiny frontmatter parser (title/tags), search over title/tags/body.
- Checklists are detected from `- [ ]` items; state is one integer bitmask per slug in
  `mt.guides.progress` (max 50 tasks, arithmetic bits, not JS bitwise).
- `markdown-it` 14.1.0 (+`@types/markdown-it`) is the only new dependency. HTML is disabled,
  links get `target=_blank rel=noopener noreferrer`, images are lazy/no-referrer. Justified
  because upstream has no Markdown renderer and hand-rolling one is riskier.
- EN/PL strings for search, editor, progress, errors and reveal actions.

| Check | Command (from) | Result |
| --- | --- | --- |
| Renderer lint / types / build | `npm.cmd run lint`, `check-types`, `build` | exit 0; guides chunk 112 kB (lazy) |
| Renderer tests | `npm.cmd run test` | **31 files, 609 passed, 2 skipped (611)** — +16 tests |
| Main lint / types / build | `npm.cmd run lint`, `check-types`, `build` | exit 0 |

### Phase 5 — Overlay widgets (2026-10-28)

Scope: two native overlay widgets and their settings panels.

**Fork-owned files added**

| Area | Files |
| --- | --- |
| Widget model + i18n | `renderer/src/mt/widgets/{types,messages,i18n}.ts` |
| Widgets | `renderer/src/mt/widgets/{WidgetMtCountdown,WidgetMtZoneTracker}.vue` |
| Settings | `renderer/src/mt/widgets/{SettingsMtCountdown,SettingsMtZoneTracker}.vue` |
| Hub tab | `renderer/src/mt/modules/widgets/WidgetsModule.vue`, EN/PL strings |
| Tests | `renderer/specs/mt/widgets.spec.ts` (12 tests) |

**Behaviour implemented**

- `mt-countdown` (multi): manual start/pause/reset, configurable label/duration, optional
  progress bar. Display-only; no log trigger and no game input. Runtime progress resets on
  overlay reload; config (label/id/duration/position) persists in the widget entry.
- `mt-zone-tracker` (single): raw area id + area level + player level from the existing
  `useClientLog()` refs; shows an enable hint when `readClientLog` is off. No second watcher.
  Towns/hideouts remain skipped by the upstream parser (documented limitation).
- Settings panels are registered through `SettingsWindow.vue#menuByType`; `Edit` on the
  widget opens them (`inline-edit=false`).
- `upgradeConfig()` inserts the missing single zone tracker idempotently; new configs get it
  from `initInstance`. The countdown is added from the overlay widget menu.
- Menu labels use literal `trNameKey` strings; no upstream locale edits.
- Upstream touches: `widget-registry.ts` (+6), `Config.ts` (+4), `SettingsWindow.vue` (+8).
  See §7 for the combined budget.

| Check | Command (from) | Result |
| --- | --- | --- |
| Renderer lint / types / build | `npm.cmd run lint`, `check-types`, `build` | exit 0 |
| Renderer tests | `npm.cmd run test` | **32 files, 621 passed, 2 skipped (623)** — +12 tests |
| Main lint / types / build | `npm.cmd run lint`, `check-types`, `build` | exit 0 |

**Manual verification pending user:** add/move/edit/delete a countdown; reload and confirm
position and label persist; start/pause/reset accuracy; enable the zone tracker and enter a
new area; confirm no keystrokes reach the game and price check still works. The consolidated
checklist is in the Phase 5 delivery message.
