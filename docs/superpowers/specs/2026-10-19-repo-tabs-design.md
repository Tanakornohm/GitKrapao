# Repository tabs — design

## สรุป (ภาษาไทย)

เพื่อนของผู้ใช้ดูแลโค้ดหลาย repo และรู้สึกว่าการเปลี่ยน repo ยาก เพราะต้องกดปุ่ม Repository บน toolbar เพื่อเปิดเมนู recent ก่อนทุกครั้ง เขาอยากได้แถบแท็บแบบ GitKraken คือคลิกแท็บเดียวก็สลับ repo ได้

**สิ่งที่จะทำ ("ระดับ 1")**
- เพิ่มแถบแท็บเหนือ toolbar
- คลิกแท็บไหน ก็แสดง history, lanes, branch, stash, PR และ WIP ของ repo นั้น
- ทุกครั้งที่สลับแท็บจะโหลด repo ใหม่ แอปถือข้อมูลของแท็บที่เปิดอยู่แท็บเดียว เพื่อไม่ให้กินทรัพยากรเครื่อง
- **action แยกกันต่อแท็บ:**
  - fetch repo A ค้างไว้แล้วไปทำงานแท็บ B ได้
  - ในแท็บเดียวกันทำได้ทีละ action ถ้า action หนึ่งยังทำงานอยู่ action อื่นของแท็บนั้นจะกดไม่ได้
  - ทั้งแอปทำ action พร้อมกันได้ไม่เกิน 3 อัน
- แท็บที่ไม่ได้เปิดดูจะไม่ poll และไม่โหลดอะไรในเบื้องหลัง
- ปุ่ม + เปิดแท็บใหม่ ปุ่ม × ปิดแท็บ
- คีย์ลัด:
  - Ctrl+T เปิดแท็บใหม่
  - Ctrl+W ปิดแท็บ
  - Ctrl+Tab และ Ctrl+Shift+Tab สลับแท็บถัดไปหรือก่อนหน้า
  - Ctrl+1 ถึง 9 กระโดดไปแท็บตามลำดับ
- ปิดแอปแล้วเปิดใหม่ แท็บเดิมจะกลับมาครบ

**สิ่งที่ไม่ทำ**
- สลับแท็บได้ทันทีโดยไม่ต้องโหลดใหม่ (ระดับ 2)
- auto-fetch ในเบื้องหลัง
- ลากเพื่อเรียงลำดับแท็บ

---

## Intent

A user's friend manages several repositories, and switching between them in GitKrapao takes too many steps:

1. Open the toolbar's Repository dropdown (`#repoBtn` → `#recentMenu`, `src/app.ts:2443`).
2. Pick a repo, and wait while `loadRepo` reloads everything.

They want a GitKraken-style tab strip, with one tab per open repository, so that a single click switches repos. The reference is GitKraken's top bar, as seen in a screenshot:

- a row of tabs above the toolbar, each with a repo icon and the repo name;
- the active tab highlighted, with a × to close it;
- a + at the end of the row;
- a ⌄ on the right that lists every tab.

Success means:

- the friend can keep their usual repos open as tabs and hop between them in one click or one shortcut;
- a long fetch in one repo does not stop them working in another;
- the app stays light on the machine. The user explicitly asked that it must not eat resources and slow the computer down.

## Goals

- A tab strip above `.toolbar`, with one tab per open repository.
- Clicking a tab shows that repository: history, lanes, branch panel, stashes, PRs and the WIP row. Nothing from another tab may ever appear.
- **Per-tab actions** ("Level 1"):
  - An action runs in the tab it was started from, and the user can switch to other tabs and work there meanwhile.
  - Inside one tab, only one action runs at a time. While it runs, that tab's other actions are disabled.
- Tabs persist across app restarts.
- Keyboard shortcuts for tab navigation.

## Non-goals

- **Instant tab switching with kept state ("Level 2").** That would mean keeping several repos' `S`, streams and caches in memory. A switch reloads the repository instead, as picking a recent repo does today. Revisit only if reload-on-switch feels slow in practice.
- **Background auto-fetch** (GitKraken fetches every repo periodically). Fetch stays manual only, as CLAUDE.md requires: no surprise credential prompts, and fetch passes the trust gate.
- **Drag to reorder tabs**, and drag a tab out into its own window.
- **Multiple windows.**
- **Browser mode.** It has one pasted/sample log and no repos, so the tab strip is not shown there.

## Anti-goals (would be a failure even if it "works")

- One repo's data showing under another tab's highlight:
  - graph, panel, stash list, PRs, WIP or a commit card;
  - an error banner from a background tab's fetch landing over the active tab.
- Background tabs costing CPU, disk or processes. That includes:
  - polling;
  - WIP `git status`;
  - PR refreshes via `az`;
  - holding a `git log` stream open.
- A dialog that doesn't say which repository it is about, for example a trust prompt or "Stash and switch" for repo A that pops up while the user is looking at repo B.
- Losing users' saved settings. Keep the existing `lanes.*` keys and the Tauri identifier unchanged.

## Decisions

The user decided these:

1. **Tabs above the toolbar**, GitKraken style: a repo icon, the name, × on the active tab, a + at the end and a ⌄ list.
2. **A tab shows only its own repo's data.**
3. **Level 1: actions are independent per tab.** Within a tab, only one action at a time. While an action runs in a tab, every other action in that tab is disabled.
4. **No Level 2 for now.**
5. **No auto-fetch.**
6. **Must stay light on resources.**

## What counts as an "action"

Actions are mutually exclusive within one tab:

- Fetch.
- Switch branch, including Stash and switch.
- Refresh (button and Ctrl/⌘ R).
- Hide or show a branch, folder or remote, and Show all.
- Solo and Exit solo.
- Replacing the tab's repo: from the Repository menu, Ctrl/⌘ O, or the empty state's Open button.
- Closing the tab.

The tab's own history load is not an action that blocks others (my call).
- Fetch, switch, refresh, hide and solo wait until the load finishes, as `busy` already makes them.
- Closing the tab, replacing its repo or activating another tab supersedes the load, the same way activation does. A slow load (for example a repo on a network drive) must never leave a tab that cannot be closed.

Two things are tab-level actions, not per-tab:

- **Switching to another tab** is allowed while the current tab has an action running. That is the point of Level 1.
- **Opening a new tab** (+, Ctrl+T) is also always allowed.

These are views, not actions, and always stay allowed:

- scrolling;
- selecting a commit, stash or PR;
- opening diffs;
- search;
- copying a branch name;
- resizing columns;
- toggling the side panel or the Output drawer.

Automatic work (poll, WIP poll, PR refresh, tracking counts) still runs only for the active tab, as today, and is skipped while the active tab has an action running, as `opHere()` already does.

## Behaviour

### Tab strip

- **Placement.** A new row above `.toolbar` in `src/index.html` (desktop only). It is roughly 30–32 px tall and uses the `--panel` / `--border` tokens. It gets its own class prefix `tab-` / `tabs-`, which must not collide with graph classes (see the `.head` incident in CLAUDE.md).
- **Each tab shows:**
  - a repo icon;
  - the repo name (`RepoInfo.name`), with the full path as its title;
  - a × close button. The × is always visible on the active tab and appears on hover for the others.
- **States.**
  - The active tab is visually distinct: the background matches the toolbar it sits on.
  - A tab with an action running shows a small spinner in place of the icon.
  - A tab whose last action failed shows an error dot until the user activates it.
- **Overflow.** Tabs shrink to a minimum width, then the strip scrolls horizontally. A ⌄ button at the right end opens a list of all tabs (name and path).
  - Choosing one from the list activates it and scrolls it into view.
  - The list's markup and keyboard handling are like `#recentMenu`.
- **New tab.** The + button and Ctrl/⌘ T create a new empty tab and activate it.
  - An empty tab shows the existing empty state (`showEmpty`: recent list plus Open).
  - Its label is "New tab".
  - Picking a repo there fills that tab.
- **Accessibility.** The strip is an ARIA `tablist`; each tab is a `tab` with `aria-selected`. Arrow keys move between tabs when the strip has focus.

### Opening a repository

The three ways in behave as follows:

- **Recent menu, Ctrl/⌘ O, the empty state's recent items or Open button:** open the repo in the **active tab**, replacing what it showed. That matches GitKraken's repository dropdown.
- **No tabs exist:** first create one tab.
- **The chosen repo is already open in another tab:** activate that tab instead of opening a duplicate. Then close the current tab if it is an empty "New tab".

### Switching tabs

1. Remember the outgoing tab's selected commit hash, in memory only. Then drop its in-memory state:
   - `S`, the WIP state, the stash/PR lists and the open diff;
   - the history stream, which `start_history` already kills when it replaces the stream (`lib.rs:585`).
2. **Load the incoming tab with `loadRepo`.** A tab activation must supersede a load in flight. Today `loadRepo` returns early when `busy`, which would drop the click. Add a load sequence/token:
   - the newest activation always wins;
   - an older load's results are discarded when they arrive.
3. **After load,** if the remembered hash is among the loaded rows, select it and scroll it into view.
   - If it is not loaded, do not page further to find it, to keep switching cheap. Show the top instead.
   - My call: restore only the selection, not the exact scroll offset.
4. **If the incoming tab has an action running,** `start_history` returns `busy`. Then the center area shows a placeholder instead of the old tab's graph, and the side panel and detail panel are cleared:
   - "Fetching… the history loads when it finishes" or "Switching branch…";
   - when that action ends and the tab is still active, load it.
5. The toolbar shows the active tab's state:
   - repo name, branch;
   - the Fetch button state: running, disabled or idle.

### Actions per tab

- **Replace the app-wide `opPath` / `opKind` / `pendingLoad` / `opErr` (`app.ts:2304–2306`) with per-repo state.** For example, a `Map` holding `{ kind, pendingLoad, err }`.
  - **Key it by the backend's lock key, not the path** (my call). Linked worktrees of one repo are separate tabs (tabs are deduplicated by `RepoInfo.path`), but they share one `RepoLock` (`GitDirs.lock_key`, from the common dir).
  - Expose an opaque `lockKey` in `RepoInfo` (Rust struct change; regenerate the ts-rs bindings).
  - All tabs with the same key then show the running action together: spinner, disabled actions, the placeholder, and a load when it ends if one of them is active.
  - `opHere()` stays "the active tab's repo has an action".
  - `updateFetchBtn` and `switchOff` must disable on `opHere()` or the global cap, not on any action anywhere. The "A fetch or switch is running in another repository" tooltip goes away.
- **Concurrency cap: at most 3 actions running at once app-wide** (my call, for the resource requirement).
  - When the cap is reached, Fetch / Switch are disabled with a tooltip saying why.
  - Refresh, hide and solo are local reloads, not git operations, so they don't count toward the cap.
- **When an action finishes in a tab that is not active:**
  - log it in the Output drawer as today, but do not open the drawer;
  - do not show the banner;
  - do not load or sync anything;
  - a failure sets the tab's error dot;
  - when the user activates the tab later, it is fully loaded anyway.
- **When it finishes in the active tab:** keep today's behaviour (banner on failure, drawer opens, sync or run the pending load).
- **Closing a tab with an action running is disabled** (× greyed, Ctrl+W ignored with a tooltip). That follows the rule "while an action runs, no other action".

### Closing tabs

- **Closing the active tab** activates its right neighbour, or the left one if it was last.
- **Closing a background tab** doesn't change the active tab and loads nothing.
- **Closing the last tab** leaves no tabs. The window shows the empty state (recent list + Open), and the strip shows only +.
- Closing never deletes anything from recents.

### Closing the app while actions run

The user decided this:
- **Nothing running:** the window closes at once, as today.
- **A fetch or switch running in any tab:** closing the window first shows a native confirm (`ask_native` style, Rust side). It lists each running action with its repo name, for example "Switch branch — myrepo" or "Fetch — other".
  - The warning says that stopping a branch switch can leave the work tree half updated.
  - Buttons are "Close anyway" and "Cancel".
  - "Close anyway" kills every running tree (see the PID set below) and closes.
  - "Cancel" keeps the app open and leaves every action running.
- Implementation:
  - handle `WindowEvent::CloseRequested` and call `prevent_close` while `busy_repos` is non-empty;
  - ask on a blocking thread;
  - on Close anyway, kill the trees and destroy the window.
- An action that finishes while the dialog is open is fine. The list may be stale by then; the kill of a finished PID is a no-op.

### Keyboard

- **Ctrl/⌘ T:** new tab.
- **Ctrl/⌘ W:** close the active tab.
- **Ctrl+Tab / Ctrl+Shift+Tab:** next / previous tab, wrapping around.
- **Ctrl/⌘ 1–8:** go to tab N.
- **Ctrl/⌘ 9:** go to the last tab (browser convention).
- **Existing shortcuts** (Ctrl/⌘ R, Ctrl/⌘ Shift F, Ctrl/⌘ O, Ctrl/⌘ B) act on the active tab.
- **Verify in the real WebView2** that Ctrl+Tab, Ctrl+W and Ctrl+T reach the page and are not taken by the WebView. Call `preventDefault` as is done for Ctrl+R.

### Persistence

- **New key `lanes.tabs`** stores `{ tabs: [{ path, name }], active }`, written on every change. Empty tabs are not saved.
- **Migration.**
  - If `lanes.tabs` is missing and `lanes.last` exists, start with one tab for `lanes.last`.
  - Keep writing `lanes.last` as the active repo, so a downgrade still opens the right repo.
- **Boot.** Restore the tabs and load only the active one. Background tabs are not touched; a missing folder is only discovered when the tab is activated.
- **A tab whose repo fails to open:**
  - shows the error banner and the empty state in that tab;
  - stays in the strip so the user can close it;
  - is removed from recents as today (`forgetRecent`).

### Backend changes

- **`AppState.op_pid: Mutex<Option<u32>>` (`lib.rs:183`) holds one PID.** With concurrent actions, closing the app would kill only one process tree.
  - Make it a collection keyed by lock key. Each entry holds the PID once git has started, plus the action kind and repo name, for the close warning. A running action is listed even before its PID exists, for example while a trust dialog is open.
  - Update `fetch_in` / `switch_in` (`FetchCtx.pid`, `SwitchCtx.pid`) and the exit handler (`lib.rs:1466–1472`) so every running tree is killed.
- **`ask_native` titles** (`fetch.rs:605`, `switch.rs:329–330`) must include the repository name:
  - "Fetch — myrepo: trust this repository?";
  - "Switch branch — myrepo: uncommitted changes".
- **Unchanged:**
  - `RepoLock` (`busy_repos`) is already per repository;
  - `start_history` keeps one stream at a time and kills the previous one;
  - the trust-file writes are already serialised by `trust_lock`.

### Resource budget

- **One history stream at a time**, for the active tab only.
- **Polling, WIP status, PR refresh and tracking** run for the active tab only, with no per-tab timers. The existing loaders already guard on `current.path` / sequence numbers:
  - `loadTracking`, `loadStashes`, `loadPrs`, `loadRemotes`;
  - `requestDetail` and the diff cache, both keyed by repo path.
  - `wipOn` checks `wip.path`.

  Re-check that every one of them drops results for a repo that is no longer active, including `loadWip`.
- **PR list cache per repo** (my call). Today `loadPrs` resets the one global `prs` when the path changes (`app.ts:1828`), so every switch would start a new `az repos pr list`.
  - Keep each repo's last PR list and its fetch time in a `Map` keyed by path, bounded by the open tabs (drop the entry when a tab closes).
  - Activation reuses it while it is younger than `PR_EVERY` (5 min); Refresh still forces a new fetch.
  - So `az` runs at most once per 5 minutes per repo, however often the user switches.
- **Follow-up calls only for the load that is still current.** `loadTracking`, `loadStashes`, `loadPrs` and `loadWip` start after a load completes. They start only when that load's token is still the newest, so a quick Ctrl+Tab through several tabs starts no follow-up calls for tabs that were skipped.
  - A call already running for a tab the user left is not cancelled. Its result is dropped by the existing seq/path checks.
  - No new backend cancellation is added (my call).
- **Only the active tab's `S` lives in memory.** The commit-detail and diff caches stay shared, bounded as today (300 / 100) and keyed by repo path.
- **Background tabs cost nothing** except a running action, if the user started one.

## Things that must change alongside

- **CLAUDE.md.**
  - "One fetch or switch at a time app-wide (`opPath`, `runOp`)" becomes per-repo plus the cap of 3.
  - Add a "Tabs" section covering:
    - the `lanes.tabs` key and its format;
    - activation supersedes loads;
    - background tabs do no work;
    - closing is disabled while an action runs.
- **UI test suites.** `tests/ui/fetch.suite.mjs` and `switch.suite.mjs` assume an app-wide lock. Update them where they do.
- **README** feature list and screenshot, if it describes repo switching.

## Testing

- **New `tests/ui/tabs.suite.mjs`**, using a fake `__TAURI__` as in `fetch.suite.mjs`. The fake `fetch` promise is resolved by hand. Cases:
  1. Open two repos as tabs. Activating each shows its own commits, refs and stash list, and nothing from the other.
  2. Fetch A, switch to B. B's Fetch is enabled; B's graph is shown. Resolve A's fetch with a failure:
     - no banner over B;
     - the Output drawer stays closed but has the entry;
     - A's tab shows the error dot.
  3. While A's fetch runs:
     - A's Refresh, hide, solo, switch and × are disabled;
     - switching to B and back shows the placeholder;
     - resolving the fetch loads A.
  4. Click tab B while A's load is in flight. B wins, and A's late result is discarded.
  5. Three concurrent fetches; a fourth tab's Fetch is disabled with the cap tooltip.
  6. Closing the active tab, a background tab and the last tab.
  7. The new tab's empty state; opening a repo already in another tab activates that tab.
  8. Persistence. `lanes.tabs` round-trips, and migration works from `lanes.last` alone.
  9. Shortcuts: Ctrl+T/W/Tab/Shift+Tab/1–9.
  10. Selection restore. Select a commit in A, go to B, back to A, and the same commit is selected.
  11. Background tabs make no `invoke` calls. Count the fake invokes per path while idle on B.
- **`cargo test --lib`.**
  - The PID-set change: two concurrent long operations are both killed by the exit path, or the helper used by it.
  - Dialog titles include the repo name, if testable through the ctx closures.
- **Run:**
  - `pnpm run typecheck`;
  - `pnpm run test:ui`;
  - `pnpm run check:bindings`;
  - `cd src-tauri && cargo test --lib`.
- **Manual check.** Do it in `pnpm run dev` with the mock repo plus a second test repo, never the user's work repos. A copy of `.mock/demo-repo` built by `pnpm run mock` into another folder works. Check:
  - the tab look in light and dark themes;
  - that the shortcuts reach the page in WebView2;
  - that the native dialogs show the repo name.

## Left to the builder

- The exact visual design of the strip:
  - height, icon, the active-tab treatment, min/max tab width;
  - the spinner and the error dot.

  It should sit naturally with the existing toolbar and both themes.
- Data structures for per-tab state and the load token.
- Whether the ⌄ list reuses the `#recentMenu` code or a small shared menu helper.
