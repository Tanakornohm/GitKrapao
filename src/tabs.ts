/* Repository tabs: the list, which one is active, and what is saved of them.
   No DOM and no backend calls here; app.ts draws the strip and loads repos.
   Saved in localStorage `lanes.tabs` as { tabs: [{ path, name }], active }.
   `lanes.last` keeps holding the active repo, so an older build still opens
   it. lockKey is never read from storage: a tab's info only ever comes from
   open_repo / pick_repo. */
import type { RepoInfo } from './bindings/RepoInfo';

export interface Tab {
  path: string | null;   // null: an empty "New tab"
  name: string;
  info?: RepoInfo;       // last open_repo / pick_repo result (memory only)
  sel?: string;          // hash of the selected commit when the tab was left (memory only)
  err?: boolean;         // the last operation failed; cleared when activated (memory only)
}
export interface Tabs { list: Tab[]; active: number }   // active is -1 when the list is empty

export const NEW_TAB = 'New tab';
const TABS_KEY = 'lanes.tabs', LAST_KEY = 'lanes.last';

// Parse boundary: anything can be stored under a key; callers check what they get.
const read = (k: string): unknown => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch (e) { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or off */ } };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
export const baseName = (path: string) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;

/* A saved entry, or null when it is not one. */
function entry(v: unknown): Tab | null {
  if (!isObj(v) || typeof v.path !== 'string' || !v.path) return null;
  return { path: v.path, name: typeof v.name === 'string' && v.name ? v.name : baseName(v.path) };
}

/* lanes.tabs when it holds a list (even an empty one: the user closed every
   tab), else one tab for lanes.last, else nothing. Bad and duplicate entries
   are dropped. */
export function loadTabs(): Tabs {
  const saved = read(TABS_KEY);
  if (isObj(saved) && Array.isArray(saved.tabs)) {
    const raw: unknown[] = saved.tabs;
    const want = typeof saved.active === 'number' ? saved.active : 0;
    const list: Tab[] = [];
    let active = -1;
    raw.forEach((v, i) => {
      const t = entry(v);
      if (!t) return;
      const at = indexOfPath({ list, active }, t.path!);   // entry() only returns tabs with a path
      if (at < 0) list.push(t);
      if (i === want) active = at < 0 ? list.length - 1 : at;
    });
    if (active < 0) active = Math.min(Math.max(Math.floor(want), 0), list.length - 1);
    return { list, active };
  }
  const last = entry(read(LAST_KEY));
  return last ? { list: [last], active: 0 } : { list: [], active: -1 };
}

/* Writes every tab that has a repo. The saved active is the active tab, or
   for an empty one the closest saved tab before it. */
export function saveTabs(t: Tabs): void {
  const kept = t.list.filter(x => x.path);
  const before = t.list.slice(0, Math.max(t.active, 0)).filter(x => x.path).length;
  write(TABS_KEY, { tabs: kept.map(x => ({ path: x.path, name: x.name })), active: kept.length ? Math.min(before, kept.length - 1) : -1 });
  const cur = t.list[t.active];
  if (cur && cur.path) write(LAST_KEY, { path: cur.path, name: cur.name });
}

export function indexOfPath(t: Tabs, path: string): number {
  return t.list.findIndex(x => x.path === path);
}

/* The active index once tab i is removed (indexes into the list after removal).
   Closing the active tab: its right neighbour, else the left one, else -1.
   Closing another: the same tab stays active, shifted left when it was after i. */
export function afterClose(t: Tabs, i: number): number {
  const n = t.list.length - 1;
  if (n <= 0) return -1;
  if (i === t.active) return Math.min(i, n - 1);
  return t.active > i ? t.active - 1 : t.active;
}

/* Next (1) or previous (-1) tab, wrapping around; -1 with no tabs. */
export function cycle(t: Tabs, dir: 1 | -1): number {
  const n = t.list.length;
  if (!n) return -1;
  return ((t.active < 0 ? 0 : t.active + dir) % n + n) % n;
}

/* Ctrl/⌘ 1–8: that tab when it exists; 9: the last one. -1 when there is none. */
export function nth(t: Tabs, n: number): number {
  if (n === 9) return t.list.length - 1;
  return n >= 1 && n <= 8 && n <= t.list.length ? n - 1 : -1;
}
