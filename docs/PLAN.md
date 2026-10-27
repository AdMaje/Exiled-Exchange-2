# Fork roadmap — Phases 2–6

Derived from [FORK_NOTES.md](./FORK_NOTES.md) (design record, §5) and decisions D1–D7.
One phase per review cycle: implement, test, document, commit, stop.

## Global constraints (all phases)

- **Upstream stays upstream.** Fork code lives in fork-owned paths (`renderer/src/mt/**`,
  `main/src/mt/**`, `ipc/mt.ts`, `renderer/specs/mt/**`). Upstream edits are append-only
  `// MT:` hooks, counted in the "Touched upstream files" table (§7 of FORK_NOTES).
- **Never** touch `renderer/src/parser/**`, `renderer/src/web/price-check/**`,
  `main/src/host-files/ConfigStore.ts`, `renderer/public/data/**`.
- **No input automation** (GGG policy, FORK_NOTES §6). A hotkey may change local UI state
  only; one keypress = at most one local action / server request.
- **No hardcoded leagues, patches or volatile economy data.** Everything comes from an API,
  the upstream config, `Client.txt` or user input.
- **No web storage** (the production port is random). Persistence is file-backed through
  main-process routes (`/mt/*`) or upstream `config.json`.
- **No network calls in unit tests**; fixture-driven, pure-function tests preferred.
- Fork-local i18n (`renderer/src/mt/i18n/{en,pl}.ts`); upstream locales are never edited.
- Before commit: renderer lint/check-types/tests/build + main lint/check-types/build green.
- Each phase ends with a manual QA checklist for the user; Phase 6 is packaging-only.

## Phase 2 — MultiTool Hub (done)

**Goal:** a separate hub window with a module registry, tray + hotkey entry points and
fork-local settings, without touching the overlay runtime.

- Separate normal `BrowserWindow` loading `?mt=hub`; renderer branch skips `Host.init()`
  (hub never opens the event WebSocket and never sends `used-recently`).
- Module registry (`renderer/src/mt/registry.ts`) with placeholder tabs
  `economy`, `guides`, `widgets`; unknown ids fall back to the first module.
- Tray item **MultiTool Hub** + `open-hub` shortcut action through the existing
  `Shortcuts` pipeline (game-focus gated); `Esc`, close button and the hotkey (while the
  hub is focused) close it.
- Settings: hub hotkey, language (`auto`/`en`/`pl`), window bounds.
- Persistence: additive `mt` subtree of `apt-data/config.json` via `GET/PUT /mt/config`
  (read-merge-write, atomic tmp+rename, non-`mt` keys preserved, payload sanitized).

**Acceptance:** hub opens from tray and hotkey; hub never creates a `/events` WebSocket;
placeholder tabs + EN/PL switching work; MT settings survive an app restart; all checks
green; upstream diff ≤ 8 files inside the recorded budget.

## Phase 3 — Economy

**Goal:** offline-first currency economy view powered by poe2scout.

- Provider: `api.poe2scout.com` through the upstream `HttpProxy` (fork-owned provider code,
  no changes to trade/rate-limit logic). Whitelist host + MT User-Agent.
- Hub tab: category list (currency, fragments, runes, essences…), search, reference
  currency selector, favorites, league selector sourced from poe2scout (no hardcoded names).
- History chart with selectable range; poe.ninja links are deep links only (never scraped).
- Cache: `multitool/cache/<key>.json` with TTL metadata, served by `/mt/cache/:key`;
  stale-while-offline banner when the API is unreachable; manual refresh only, no polling.
- Rate limiting: serialize requests, honor `Retry-After`, backoff on 429.

**Acceptance:** works across app restarts on a different port; offline restart shows cached
data with age; league switch and reference currency work; 429 path is tested with fixtures;
no request is made while the hub is closed; attribution to poe2scout is visible.

## Phase 4 — Guides & checklists

**Goal:** local Markdown guides with persisted progress.

- Bundled read-only guides + user guides in `multitool/guides/*.md` (index via
  `/mt/guides/index.json`, content via `/mt/guides/:slug.md`).
- Search over title/headings/body; checklist state stored in `mt.guides.progress`.
- Save path is validated (no traversal, extension allow-list, size cap); user folder can be
  opened from the hub.
- No game data dependencies; unknown/removed guides degrade gracefully.

**Acceptance:** bundled and user guide both render; checklists survive restart; search finds
content; deleting a guide file does not break the hub; progress is not duplicated in
`config.json` when large.

## Phase 5 — Overlay widgets

**Goal:** countdown timers and a zone/level tracker inside the existing overlay.

- Two native widgets registered in `widget-registry.ts` (append-only hook).
- Timers are local UI timers (no game input, no server ping dependency).
- Zone tracker derives area id + area level from `Client.txt` events; display names are
  never hardcoded into the parser — optional curated map only.
- Reuse upstream notepad/stopwatch widgets; no changes to overlay/exclusive-widget logic.

**Acceptance:** widgets can be added, moved, edited and deleted; positions persist across
restarts; no keystrokes reach the game; timer accuracy verified in game; zone changes
reflect in the widget without touching price check.

## Phase 6 — Identity, packaging, distribution

**Goal:** ship a legally clean fork build.

- Rebrand: product name, `appId`, tray tooltip, README, About page, icons; keep upstream
  attribution and the MIT notice intact; add GGG non-affiliation disclaimer.
- Isolated identity commit only (no feature code), so upstream syncs stay reviewable.
- Packaging: NSIS/portable config, artifacts, GitHub release feed owned by the fork;
  `THIRD_PARTY_NOTICES.md` shipped with the installer.
- Document the `userData` path change and migration/notice (no silent data move).

**Acceptance:** installer and portable build run without the dev repo; update feed points
at the fork only; attribution/disclaimer present in README, About page and installer;
upstream sync procedure (§UPSTREAM_SYNC.md) still applies.
