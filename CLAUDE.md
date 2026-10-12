# GitKrapao

A GitKraken-style Git GUI built with Tauri (Rust + TypeScript), using pnpm.

## Name
- The app is called **GitKrapao** (a pun on GitKraken and กะเพรา): `productName`, `mainBinaryName`, the window title, the page title and user-facing messages.
- The project folder is `D:\gitkrapao` (renamed from `D:\lanes`). Internal names are `gitkrapao` too: the Cargo crate (`gitkrapao`, `gitkrapao_lib`), package.json, the test hook `window.__gitkrapao` and the mock marker `.git/gitkrapao-mock` (`pnpm run mock` still accepts the old `lanes-mock`). Only two things keep the old name `lanes`, on purpose: the localStorage keys (`lanes.*`) and the Tauri `identifier` (`local.lanes.gitgraph`). Never rename them: the identifier picks the WebView data folder, so changing either loses every user's saved settings (hidden branches, solo, column widths, recent repos). ("lanes" is also the graph's own word for its columns: `--lanes`, `laneStashes`, `Layout.lanes`.)

## Goal
- The feature that must be best-in-class is the history graph of commits, branches and merges: as beautiful and easy to read as GitKraken's.
- When designing or making UI decisions, weigh graph clarity (lanes, branches, merges) first.

## Graph rendering (src/app.ts)
- Virtualized: the DOM holds only rows near the viewport (`pool`), and the graph is drawn on a viewport-sized `<canvas>`. Never go back to building DOM/SVG for every row.
- Edges are indexed in tiles of 256 rows (`buildTiles`). Per-row state (sel, dim) must be computed from the row index, not from DOM nodes.
- Layout is append-only (`layoutRows`): rows already placed never move when a new page arrives; an edge whose parent is not loaded yet waits in `open`. Any layout change must give identical values whether the history is loaded at once or page by page. (Stash rows are the one exception; see below.)
- Desktop mode uses the order from `git log --date-order` as is (narrower graph than `topoOrder`); `topoOrder` is only for logs pasted in browser mode.
- Every row ↔ pixel conversion goes through `rowOff` (ROW_H while the WIP row shows, else 0): `makeRow`, the canvas top, the `draw()` range, `placeRows` (body height, `moreRow`), `ensureVisible`, `jumpTo` centering, and both sides of `scrollAnchor`/`anchoredTop`. When the WIP row appears or goes away, `placeRows` shifts scrollTop so the same commits stay on screen.
- Lane colors come from the CSS token `--lanes` (one list per theme; the light theme uses darker shades so lines reach 3:1 on a white page). `readTheme` loads it into `PALETTE`/`ON_COL`; `applyTheme` rebuilds rows, panel and card when it changes. Text on a colored fill (node initials, checked-out label, avatars) always goes through `textOn`, which picks dark or white by WCAG contrast.
- `ROW_H` in app.ts must equal `--rowh` in app.css.
- A row shows its first label plus "+N". Hovering the Branch / tag cell (120 ms) opens `.ref-pop` over the rows below with every label, the first one in place; it closes on leave, scroll, `render` and theme change. Graph labels carry `data-g` (index in `c.groups`) so the branch menu acts on the label that was clicked.
- Canvas pixels are not bit-exact even when the same data is redrawn, so never compare layouts by pixels; compare rows (lane, color) and edges.

## WIP row (work_status)
- While the work tree has uncommitted changes, a `// WIP` row sits above row 0 (canvas row -1), joined to HEAD by a dashed line in HEAD's lane. Clicking it (or ArrowUp from row 0) shows the staged/unstaged file card; `sel` is -1 and `wipSel` is true while it is selected. When HEAD is not in the graph (solo without it, or not loaded yet) no WIP node is drawn and the row says "HEAD is not in the graph": a node in some lane would look like it belonged to that branch.
- The toolbar's branch name comes from `S.refs.headRef`, not from labels (solo can leave HEAD unlabelled).
- `work_status` runs `git status --porcelain=v2 -z` with `GIT_OPTIONAL_LOCKS=0` (does not rewrite `.git/index`) and `-c core.fsmonitor=false` (does not start a file monitor). Clean filters the user configured (e.g. git-lfs) can still run, as with any `git status`. `parse_status` has a fixture test.
- Work tree edits do not touch `.git`, so the ref fingerprint cannot see them and `.git/index` must not be added to it (any terminal `git status` rewrites the index, which would turn every poll into a sync). `loadWip` polls on its own: every 4 s, or 8× the last status time if that is longer, skipped while the window is hidden, forced on load, after a sync and on window focus.

## Stash rows in the graph
- Each stash with a loaded base commit is also a row (`stashRow`) above the commit it was made on: a gray box node and a dashed gray line (`color: -1`). They are merged in by committer time with `mergeNew` and are not part of `git log`'s output.
- This is the one exception to append-only layout: `placeStashes` redoes the layout when the set of placed stashes changes (stash list changed, full reload, or a new page brings in a stash's base); it only renames rows when just `stash@{n}` shifted.
- `layoutRows` skips stash rows, so branch lanes and colors are exactly what they would be without stashes; `laneStashes` then gives each stash the first lane right of its base that is free on every row between them. `S.maxLane` must include `S.stashLaneMax`.
- `planSync` marks stash rows as reached (they hang off refs/stash, not branches); otherwise every sync would fall back to a full reload. The toolbar count leaves stash rows out (`S.stashRows`).

## Backend (src-tauri/src/lib.rs)
- `start_history` runs a single `git log` process and reads it to the end in a background thread (so git never holds pack-file handles open on Windows). The UI asks for pages through `history_page(gen, start, count)`; an old `gen` gets `stale`.
- Records are split on byte 0x1e before UTF-8 decoding (so Thai characters are never cut in half).
- The fingerprint reads files in `.git` (HEAD, config, packed-refs, refs/, reftable/, logs/refs/stash) instead of spawning git, because each git spawn costs about 200 ms on Windows.
- In desktop mode branch/tag labels come from `list_refs` (for-each-ref + the HEAD file), not from the log's `%D`. Loading and syncing must always use the same source.

## Auto-refresh (syncRepo)
- Poll sees a new fingerprint → `sync_history` asks only for new commits (`git log --stdin`, with the old `^tip`s fed through stdin because repos with many tags exceed the Windows command-line limit) → `planSync` → `applySync`.
- `planSync` must fall back to a full reload whenever it cannot prove the result matches a fresh load: loaded commits disappeared (reset/rebase/deleting an unmerged branch), a removed tip lies deeper than what is loaded, a new commit would land below the loaded rows, or the fingerprint changed while reading.
- Any change here must be tested by comparing the synced result with a full reload (order, lanes, colors, edges, labels) on a test repo whose commits are made with plumbing (`commit-tree`, `update-ref`).
- The Refresh button and Ctrl/⌘ R always do a full reload (the escape hatch when something is wrong).
- `streamPos` is the number of records read from the stream; it differs from `S.commits.length` once commits have come in through sync.

## Fetch (src-tauri/src/fetch.rs)
- Manual only: the toolbar button and Ctrl/⌘ Shift F (no background fetch, so no surprise credential popups). One fetch or switch at a time app-wide (`opPath`, `runOp`).
- Command: `git fetch --all --prune --no-prune-tags --no-auto-maintenance --no-recurse-submodules`. Add only flags that turn behaviour off; local branches and tags must never be deleted or overwritten. Never pass `-c` overrides of `core.sshCommand` / `credential.helper` (they would override the user's global config); `GIT_TERMINAL_PROMPT=0` stays.
- Refused before git runs: a `remote.*.fetch` destination outside `refs/remotes/`, `remote.*.mirror`, any file in the legacy `.git/remotes/` or `.git/branches/` folders (`--prune` could then delete local refs).
- Trust: one `git config --show-scope --includes -z --get-regexp` call (`--includes` matters: `--local` alone misses an `include.path`). Keys from local/worktree scope that run programs (ssh/credential/askpass, `hook.*`, `filter.*` smudge/clean/process, an fsmonitor program) or redirect fetch, plus the hook files fetch or a checkout runs (`TRUST_HOOKS`), go into a native dialog (`ask_native`, Rust side, so page script cannot answer it). One gate for fetch and switch (`trust_gate`, one hash per repo): trusting a repo once covers both; only fetch also asks once about a never-fetched repo, since it contacts the remotes. Exit codes other than 0/1 refuse. Approvals and the allowlist live in `app_data_dir()/trust.json` as SHA-256 hashes (`sha2`, stable across Rust versions); `pick_repo` allowlists its folder, a repo opened from recents asks once.
- `RepoLock` per canonical common dir (`GitDirs.lock_key`, shared by linked worktrees), taken by fetch and switch from before any dialog to the end: `repo_fingerprint` returns null and `start_history`/`sync_history` return `"busy"`; the UI pauses polling, defers a refresh and syncs once when the operation ends.
- `run_limited` (also under `output_within`) kills the whole process tree on timeout (`taskkill /T`): `git` on PATH is a launcher, and a plain kill leaves the real git, ssh and remote helpers running. The 90 s limit starts when git starts, not when the dialog opens.
- Results (fetch and switch) are a `GitResult` (only "busy" is an Err) logged in the Output drawer (last 50, memory only, text via `textContent`); failures also go to the banner.
- Tests: `cargo test --lib fetch` uses temp repos with a local bare remote and an empty global config (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`); the timeout test proves the tree kill with a marker file. UI: `tests/ui/fetch.suite.mjs` with a fake `__TAURI__`.

## Switch branch (src-tauri/src/switch.rs)
- Double-click a branch in the panel or a graph label, or "Switch to …" (first item) in either right-click menu. Off for the checked-out branch and while a fetch/switch runs (`switchOff`).
- `target` is a full ref. Local: `git switch --no-guess <name>`. Remote `refs/remotes/<remote>/<name>` (longest matching remote, names may contain `/`): if no local `<name>`, `git switch -c <name> --track <full ref>`; if one exists, switch to it, then `git merge --ff-only <full ref>` only when it is merely behind (same, ahead or diverged: left as is, the summary says why). A branch already checked out is not switched again (that was a silent no-op: "develop to develop"). Names are checked with `check-ref-format --branch` and `show-ref --verify` first.
- Never `--force`, `--discard-changes` or `--merge`: uncommitted work is never lost. Changes git can carry go along; when git refuses ("would be overwritten/removed by checkout") a native dialog lists the files and offers Stash and switch (`git stash push --include-untracked -m "GitKrapao: before switching to <name>"`, then the same switch). The stash is not popped; a failure after stashing says the work is in stash@{0}.
- Same `RepoLock`, `run_limited` and Output drawer as fetch; 5 min limit (a kill can leave the work tree half updated, so the summary says to check `git status`). Before any step it passes the same `trust_gate` as fetch: hooks, filters and an fsmonitor from the repo's own config need approval; a filter set up in the user's global config (git-lfs) is theirs and is not asked about.
- Tests: `cargo test --lib switch` (temp repos: tracking branch created, behind → fast-forwarded, diverged → unmoved, carried vs. blocked changes, Cancel keeps everything, Stash includes untracked files, trust asked before a repo hook runs and shared with fetch, bad targets, timeout). UI: `tests/ui/switch.suite.mjs`.

## Column widths
- Every column is resizable at the right edge of its header (drag / double-click to reset / arrow keys when focused). Widths live in `cols` and are saved in localStorage `lanes.cols`.
- `graph: null` = wide enough for every lane, `msg: null` = fill the remaining space. If the Graph column is narrower than the lanes, the canvas is cut and fades at the edge (`graphColW()` is used instead of `S.graphW` when drawing).
- Header cells and row cells must always have the same widths; never give `.head` and `.row` different min-width/padding.

## Left panel (renderSide)
### Branches
- Lists every branch, split into LOCAL / REMOTE (grouped per remote); names containing `/` become folders. It reads `S.refs` (the same ref snapshot as the graph labels, not the loaded commits) in both modes.
- Clicking a branch → `jumpTo` selects the tip and centers it. If the tip is not loaded yet (hollow dot) it keeps calling `loadMore` until it is.
- Ahead/behind comes from `branch_tracking` (for-each-ref `%(upstream:track)`), requested separately after load/sync because it can be slow for branches that diverged long ago. The fingerprint includes `.git/config` so `git branch -u` updates the counts. Browser mode counts over the graph against the branch of the same name on origin.
- It is an ARIA tree (one tab stop, Up/Down/Left/Right, Enter). Collapsed folders are kept in `lanes.sideClosed`, the width in `lanes.sidew`; Ctrl/⌘ B shows/hides the panel (`lanes.side`). On narrow screens (≤900px) the panel floats over the graph.
- Panel classes start with `sb-`. Never use class names that collide with the graph's, e.g. `.head` (that once broke the rows).

### Hiding branches
- Eye icon on hover, the H key, "Show all", and the right-click menu (`#ctxMenu`: Hide/Show + Copy branch name on panel branches, Hide on folders/remotes, Hide + Copy on a graph branch label, which hides every ref in that label). The menu follows the eye button's rules (not the checked-out branch, not during solo). Elsewhere in desktop mode the WebView's own right-click menu is off, except in text boxes and over selected text. Saved per repo in localStorage `lanes.hidden` as full ref names or prefixes ending in `/` (a whole folder or remote).
- The backend turns them into `git log --exclude=<name> --branches --exclude=<name> --remotes --tags HEAD` (`rev_args`). `--exclude` takes names without refs/heads/, applies only to the next --branches/--remotes, and its `*` also matches `/`. Commits that a visible ref still reaches stay in the graph. The checked-out branch cannot be hidden.
- Labels and sync tips come from `visibleRefs(refs, hidden)`; the panel uses all of `S.refs`. Hiding/showing does a full reload (`hiddenGen` makes a load/sync that ran with the old list reload again). Test by comparing commit count and order with `git log` using the same `--exclude` set.
- Browser mode rebuilds a ref snapshot from `%D` (`refsFromDec`) and filters commits itself in `showBrowser`. Never overwrite `c.dec` (that once made hidden refs vanish from the panel).

### Solo
- Target icon on hover and the S key; "Exit solo" in the bar. Saved per repo in `lanes.solo` (same entry format as hidden). Solo wins over hidden; eye buttons are hidden while it is on.
- `rev_args` then walks only `--glob`s: a folder is `--glob=refs/heads/x/*`; an exact ref brackets one letter of heads/remotes (`--glob=refs/[h]eads/x`) because a glob without wildcards gets `/*` appended, and the branch name itself is never bracketed (wildmatch compares bytes, so Thai names would not match). A missing branch matches nothing instead of failing. Unit-tested against real git.
- The solo walk has no tags and no HEAD, so sync tips come only from soloed refs (`walkRefs`); labels may add tags (`labelRefs`). Using HEAD or a tag tip as `^exclude` would drop commits that a soloed branch later merges in. If no soloed ref exists any more, solo turns itself off on the next load.

### Stashes and pull requests (desktop only)
- STASHES come from `list_stashes` (`git stash list`). Clicking a stash or PR shows its card in the detail panel (`detailFor` = commit / stash / pr) and moves the graph to the related commit with `select(i, { detail: false })`, which does not replace the card. The card survives syncs and goes away when the stash is dropped or the PR leaves the list (`refreshCard`).
- The fingerprint includes `logs/refs/stash` because `git stash drop` does not touch `refs/stash`.
- PRs come from Azure DevOps through `az repos pr list` with the account signed in via `az login` (the app stores no token). origin is used first (`parse_azure_remote` handles dev.azure.com, visualstudio.com and SSH URLs). They are fetched again every 5 minutes, after a sync if older than 30 seconds, and on every Refresh. az errors are read from stdout and stderr together (az writes its questions to stdout).
- `open_url` only opens https links on dev.azure.com / *.visualstudio.com.
- The PR UI cannot be tested in the real WebView by replacing invoke (`__TAURI__` is frozen and non-configurable). Use headless Edge with a fake `__TAURI__` loaded before app.js (as `tests/ui/webview-menu.suite.mjs` does). Test real az calls with an empty `AZURE_CONFIG_DIR` so the user's account is never used.

## File diff view (file_diff)
- Clicking a file in a commit, stash or WIP card shows its diff over the graph (`.diff` inside `.center`); `#wrap` stays mounted underneath so its scroll and virtualization survive. Unified or split, changes only or full file (`lanes.diff`), J/K (or ]/[) between files, Esc back. While it is open the graph keys are off; a branch/stash/PR click, a hash link and switching repos close it.
- Backend kinds: `commit` (also stashes, `--diff-merges=first-parent` like the card), `staged`, `unstaged`, `untracked`. Always `--literal-pathspecs` (a file named `[a].txt` must not match `a.txt`), `--no-ext-diff --no-textconv --no-color`, both paths of a rename, `GIT_OPTIONAL_LOCKS=0` and `core.fsmonitor=false`. Output is capped at 4 MB without splitting a UTF-8 character (`cap_text`).
- Untracked files are read directly (`untracked_patch`) as an all-added diff: relative paths only (no `..`, no absolute, no `\` or `:`), canonicalized and checked to stay inside the repo, symlinks shown as their target and never followed, 2 MB cap, NUL in the first 8000 bytes = binary.
- Conflicted files show a message instead of a combined (`diff --cc`) diff.
- `parseDiff` handles CRLF, "\ No newline at end of file", binary files and hunk-less changes (mode only, pure rename, empty files). Paired removed/added lines get word marks from their common start and end. At most 20,000 lines are rendered. Line classes are `t-add`/`t-del`/`t-ctx`: plain `.add`/`.del` are the global +/− text colors and once turned whole lines green and red.
- Commit and stash diffs are cached (100); work tree diffs are not. While a work tree diff is open, every WIP poll re-reads it with `loadDiff(true)` (quiet: no "Loading…", errors keep what is shown, redrawn with the scroll kept only when the patch changed), because editing an already modified file does not change git status or the WIP signature. A poll never cancels a load in flight (`dfBusy`), or a slow file would keep restarting. `panelFiles` is what the card lists now; `dfKey` re-finds the open file after the card is redrawn (`markDiffRow`).
- Tests: `file_diffs_against_real_git` (cargo) and comparing the app's +/− line counts with `git --numstat` for commit, stash and WIP files.

### Syntax colors (src/highlight.ts)
- Our own small lexers (no third-party code; the CSP stays `script-src 'self'`). The language comes from the file name (`Syntax.lang`; the old side of a rename uses `oldPath`); unknown types stay plain. Families: JS/TS, JSON, C#, Java/Kotlin, Go, Rust, C/C++, Python, Ruby, PHP, shell, PowerShell, SQL, CSS/SCSS, HTML/XML (csproj, xaml, svg…), YAML, INI/TOML/.env, Markdown, Dockerfile.
- Lexers return `[start, end, class]` ranges in UTF-16 offsets, never HTML. `codeHtml` escapes every piece and only emits classes in `Syntax.CLASSES` (as `sx-*`). Word marks count code points; `unitAt` converts them so an emoji before a change does not shift the mark. Pieces are split at both token and mark edges so tags never cross.
- Lexing runs per side: one lexer over the old side (context + removed lines) and one over the new side (context + added lines), with state carried line to line (block comments, multi-line strings, open tags). Unified context lines use the new side; split view's left column uses the old side. Never lex removed and added lines as one stream: a removed line that opens a comment would color the added lines.
- In Changes mode a hunk can start inside a docstring or code fence, so `loadDiff` also fetches the whole-file diff (context 1000000, same cache key as Full file) in parallel and waits for both before rendering (a later re-render would reset the scroll). `wholeTokens` lexes it once and `highlightDiff` gives each line the colors of its old/new line number when the text matches. Added, deleted and untracked files already arrive whole and skip this. If the whole diff is truncated or over the caps, lexer state resets at every hunk instead.
- File contents are untrusted: regexes are sticky/anchored with no nested quantifiers, lines over 2,000 characters stay plain, and coloring stops after 20,000 lines or 2 M characters.
- Colors are `--sx-*` tokens (light and both dark blocks). Tests: text of every rendered line equals the patch; multi-line comment state; hunks starting inside a Markdown fence and a Python docstring; old/new side separation (unified and split); markup in a file renders as text with no elements created; C#/Python/JSON samples; a 20,000-line file in full.

## Commit details (commit_detail)
- Fetched when a commit is selected, via `git show --raw --numstat -z` (merges compared with the first parent). Always pass `--no-ext-diff --no-textconv` so a repo's config can never make it run external programs.
- `parse_detail` reads paths by position (not by content). Unit tests use real output in `src-tauri/tests/fixtures/` (`cargo test --lib`).
- The JS side waits 100 ms before fetching (for fast arrow-key browsing) and caches 300 commits.

## Test data
- Never test with the user's real work repos. Use `pnpm run mock`, which builds `.mock/demo-repo` with `git fast-import`, identical on every run: 158 commits, main/develop/feature/release/hotfix, tags, a remote with upstreams that are ahead, 2 stashes (one with untracked files), and Thai messages. The script only deletes and rebuilds a folder that has the marker `.git/gitkrapao-mock` (or the older `.git/lanes-mock`).
- Browser mode (`pnpm run web:build`, then open `dist/index.html`) uses built-in sample data and needs no git.
- UI tests: `pnpm run test:ui` (headless Edge, a fresh profile per suite) runs `tests/ui/*.suite.mjs` against a test bundle; suites marked `prodSafe` (those that do not read `window.__gitkrapao`) also run against the minified production bundle. `capture.js` is injected before the suite's setup and app.js, so an error or unhandled rejection while the page boots fails the suite. `layout.suite.mjs` compares every row (hash, lane, color) and edge of the sample and of `tests/ui/fixtures/mock-log.txt` with `fixtures/layout-baseline.json`; refresh the baseline (`-- --write-baseline`) only for an intended layout change.

## Commands
- `pnpm run dev` runs `tauri dev` through `scripts/tauri.mjs` (the first Rust compile is slow; later builds are cached in `src-tauri/target`). Tauri starts `pnpm run web:watch` first, which builds `dist/` once before watching.
- `pnpm run mock` rebuilds the mock repo at `.mock/demo-repo`.
- `pnpm run web:build` bundles the UI into `dist/` (`scripts/web.mjs`; `--test` exposes `window.__gitkrapao` for tests/ui, real builds drop it).
- `pnpm run typecheck` (`tsc --noEmit`), `pnpm run test:ui`, `pnpm run check:bindings` (see TypeScript below), `cd src-tauri && cargo test --lib`.
- Keep using pnpm; do not switch to bun (the bottleneck is Rust, not the package manager).

## TypeScript
- The UI is TypeScript (`src/app.ts`, `highlight.ts`, `ipc.ts`, `types.ts`). esbuild bundles it into one IIFE at `dist/app.js` and does not check types; `tsc` only checks (`noEmit`). Run `pnpm run typecheck` before calling a change done.
- `strict` + `noUncheckedIndexedAccess`. No `@ts-ignore` / `@ts-expect-error`; no `any` except at a parse boundary, with a comment. A `!` or `as` needs the reason it holds (a length check, `has()` before `get()`, an element in index.html), written next to it when it is not obvious.
- Data from Rust is typed by `src/bindings/*.ts`, generated by ts-rs (a dev-dependency only; `#[cfg_attr(test, derive(ts_rs::TS), ts(export))]` on each struct sent to the UI, `u64`/`i64` fields marked `ts(type = "number")`). Changing such a struct: `cargo test --lib` regenerates the bindings, commit them; `pnpm run check:bindings` fails on a forgotten one. `.gitattributes` keeps `src/bindings` LF so regenerating is a no-op on Windows.
- Every Rust command is called through `invoke` in `src/ipc.ts`; its argument types live in the `Commands` map there.

## Environment (Windows)
- Requires Rust (cargo) and the Visual Studio 2026 workload "Desktop development with C++" + Windows SDK.
- The `dev`/`build`/`tauri` scripts run through `scripts/tauri.mjs`, which adds `%USERPROFILE%\.cargo\bin` (or `CARGO_HOME\bin`) to PATH, because VS Code terminals opened before Rust was installed keep the old PATH (VS Code must be fully closed to pick up the new one).
- The error `link: extra operand` means MSVC's `link.exe` was not found and Git's `link` was used instead.
- The main window starts hidden (`"visible": false`) and `run()` shows it on page load (`on_page_load` → Finished, 5 s fallback in `setup`): WebView2 paints white for 1–4 s before the page is up, a big white box over the dark theme.
