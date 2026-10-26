# Upstream Sync Workflow

How this fork stays mergeable with `Kvan7/Exiled-Exchange-2` while adding MultiTool modules.

- Our fork: <https://github.com/AdMaje/Exiled-Exchange-2> → remote **`origin`**
- Upstream: <https://github.com/Kvan7/Exiled-Exchange-2> → remote **`upstream`**
- Upstream base we started from: **v0.16.3** (`cca30662`)
- Integration branch: **`multitool`**
- Mirror branch: **`master`**

---

## 1. Remote & branch model

| Ref | Role |
| --- | --- |
| `origin` | our fork (`AdMaje/Exiled-Exchange-2`) — all pushes go here |
| `upstream` | `Kvan7/Exiled-Exchange-2` — read-only, fetch/merge only |
| `master` | exact mirror of `upstream/master`; **never commit fork work here** |
| `multitool` | our integration/release branch; all MT work lands here |

`master` tracks `upstream/master`. `multitool` is cut from the pinned upstream release
tag and stays based on the nearest upstream release.

### Current setup (already applied)

```powershell
git remote rename origin upstream
git remote add origin https://github.com/AdMaje/Exiled-Exchange-2.git
git fetch origin
git fetch upstream --tags
git switch -c multitool            # created from v0.16.3 / cca30662
git push -u origin multitool       # first push (do once)
```

Verify:

```powershell
git remote -v
# origin    https://github.com/AdMaje/Exiled-Exchange-2.git
# upstream  https://github.com/Kvan7/Exiled-Exchange-2.git

git branch -vv
#   master    cca30662 [upstream/master]
# * multitool cca30662
```

> Note: `git push -u origin multitool` is intentionally **not** run by automation in this
> phase. Run it once when you are ready to publish the branch.

---

## 2. Sync cadence

- **Monthly**, or before every release, and immediately for security/regression fixes.
- Track upstream **`master`** (stable, matches released builds). Do **not** track `dev`
  except for reading upcoming changes.
- Pin to a **release tag** for anything we ship: after merging, record the upstream tag
  (e.g. `v0.17.0`) in `docs/FORK_NOTES.md` §11 and in the release notes.
- Never merge an upstream commit without running the full check suite (§5).

---

## 3. Merge procedure

```powershell
# 0. Clean tree, on our branch
git switch multitool
git status --porcelain        # must be empty

# 1. Update the mirror
git switch master
git fetch upstream --tags --prune
git merge --ff-only upstream/master
git push origin master
git switch multitool

# 2. Inspect what is coming
git log --oneline --no-merges HEAD..upstream/master
git diff --stat HEAD...upstream/master

# 3. Conflict preview (git >= 2.38; we have 2.55)
git merge-tree --write-tree HEAD upstream/master   # non-zero exit = conflicts

# 4. Merge (merge, not rebase: released fork builds must keep history)
git merge --no-ff upstream/master -m "chore(sync): merge upstream master"

# 5. Checks (see §5), then push
git push origin multitool
```

If something goes wrong:

```powershell
git merge --abort          # before commit
git reset --hard HEAD@{1}  # after commit (local only; never on a published tag)
```

### Conflict policy

1. **Upstream logic wins by default.** We do not "fix" upstream during a sync.
2. Our hooks are append-only and wrapped in `// MT: BEGIN ...` / `// MT: END ...`.
   Resolve a conflict by keeping the upstream hunk **and** re-appending our block.
3. For `ipc/types.ts`, `Config.ts` and `widget-registry.ts` prefer "both sides" and
   re-order minimally; never re-sort or reformat.
4. Re-run type checks after resolution — union-type conflicts often compile but lose a
   member.
5. If an upstream change makes a hook obsolete (e.g. upstream adds a hub), remove our
   block in a **separate** commit, not inside the merge commit.
6. If a conflict is non-trivial, stop and document it in the merge commit message before
   proceeding.

### Conflict-prone files

| File | Why | Our block |
| --- | --- | --- |
| `renderer/src/main.ts` | hub bootstrap branch | `// MT: BEGIN hub-entry` |
| `renderer/src/web/Config.ts` | `mt` config subtree + host shortcuts | `// MT: BEGIN mt-config` |
| `renderer/src/web/overlay/widget-registry.ts` | MT widget registration | `// MT: BEGIN mt-widgets` |
| `renderer/src/web/settings/SettingsWindow.vue` | MT settings panels | `// MT: BEGIN mt-settings` |
| `ipc/types.ts` | `open-hub` action | `// MT: BEGIN mt-actions` |
| `main/src/main.ts` | hub/routes init | `// MT: BEGIN mt-init` |
| `main/src/shortcuts/Shortcuts.ts` | `open-hub` handling | `// MT: BEGIN mt-shortcuts` |
| `main/src/AppTray.ts` | tray menu item | `// MT: BEGIN mt-tray` |
| `main/src/server.ts` | MT routes | `// MT: BEGIN mt-routes` |
| `main/src/proxy.ts` | host whitelist + UA | `// MT: BEGIN mt-proxy` |
| `renderer/vite.config.mts` | dev proxy | `// MT: BEGIN mt-dev-proxy` |

`main/package.json`, `main/electron-builder.yml`, `README.md`,
`docs/.vitepress/config.js`, `.github/**` have no `//` comments; their edits are listed in
`docs/FORK_NOTES.md` §7 and must be additive.

---

## 4. First sync after a long pause

Large upstream jumps (new PoE2 league, new config migrations) are the riskiest. Use a
temporary worktree so the working copy is never half-merged:

```powershell
git worktree add ../poe2-tool-sync multitool
cd ../poe2-tool-sync
git merge --no-ff upstream/master
# resolve, run checks, commit
cd ../poe2-tool
git worktree remove ../poe2-tool-sync
```

Check specifically:

- `Config.configVersion` bumped upstream → our `config.mt ??= defaultMtConfig()` block must
  remain at the **end** of `upgradeConfig()`, and the new migration must not assume `mt`
  exists.
- `ShortcutAction` union changed → `open-hub` still handled.
- `widget-registry` order changed → MT widgets still last.
- `server.ts` static handler or route order changed → `addMtRoutes` still runs first.
- `vite.config.mts` proxy regex changed → `/mt` still proxied.
- i18n/data loading changed → MT i18n stays independent.

---

## 5. Required checks after every sync

> Windows: verify `git config --get core.autocrlf` returns `false` **before** syncing.
> A CRLF checkout breaks `client-log.test.ts` and the `*.index.bin` offsets; after any
> re-checkout, re-run `make-index-files` (see `FORK_NOTES.md` §2).

```powershell
cd renderer
npm.cmd ci
npm.cmd run make-index-files
npm.cmd run lint
npm.cmd run check-types
npm.cmd run test
npm.cmd run build

cd ../main
npm.cmd ci
npm.cmd run lint
npm.cmd run check-types
npm.cmd run build
```

Plus the manual QA list from `FORK_NOTES.md` §9 for any affected module. Do not sync and
change behavior in the same PR; keep merge commits free of feature edits.

---

## 6. Release flow (fork)

1. Sync with upstream and run checks.
2. Bump version in the five places enforced by `versionCheck.py`
   (`main/package.json`, `main/package-lock.json` ×2, `README.md`,
   `.github/ISSUE_TEMPLATE/bug-report.yml`, `docs/.vitepress/config.js`).
3. Update `CHANGELOG.md` (fork-owned) with upstream tag + MT changes.
4. `npm.cmd run build` in `renderer`, then `main`; `npm.cmd run package` from `main`.
5. Tag on `multitool` (`vX.Y.Z-mt.N` once rebranded) and push tag; the GitHub workflow
   publishes to **our** repository only (`publish` config is changed in Phase 6).
6. Record the upstream base tag in `FORK_NOTES.md` §11.

Keep the identity/rebrand change isolated in its own commit (Phase 6) so upstream merges
stay easy to audit.

---

## 7. Rules & guardrails

- **Never** `git push upstream`, never open PRs against Kvan7 with this code
  (upstream `AI_POLICY.md` forbids AI-generated contributions).
- **Never** rebase `multitool` after it has been pushed; use merges.
- **Never** edit `master`; it is a read-only mirror.
- **Never** change upstream files outside the documented hooks. If a hook is unavoidable,
  add it to `FORK_NOTES.md` §7 in the same commit.
- **Never** bump or replace upstream dependencies for MT work; MT-only dependencies are
  added only in MT package boundaries and justified in the commit message.
- Keep `docs/FORK_NOTES.md` §7 (touched files) and §11 (phase log) current.
- Optional CI guard (later): a weekly job that fetches `upstream/master`, reports how many
  commits behind we are, and runs `git merge-tree --write-tree` to list conflicts without
  modifying the branch.
