// Branch right-click menu: panel branches, folders, graph labels, rules shared with the eye button.
export const prodSafe = true;
export const probe = `
let copied = null;
Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { copied = t; } }, configurable: true });
const ctx = (el, x = 50, y = 50) => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: x, clientY: y }); el.dispatchEvent(ev); return ev; };
const menu = () => document.querySelector('#ctxMenu');
const open = () => menu() && !menu().hidden;
const items = () => open() ? [...menu().querySelectorAll('[role="menuitem"]')] : [];
const labels = () => items().map(b => b.querySelector('.n').textContent + (b.disabled ? '(off)' : '')).join(',');
const pick = name => { const b = items().find(b => b.querySelector('.n').textContent === name); if (b) b.click(); return !!b; };
const hidden = () => Object.values(JSON.parse(localStorage.getItem('lanes.hidden') || '{}'))[0] || [];
const stats = () => document.querySelector('#stats').textContent;
const leaf = sel => document.querySelector('#sideList ' + sel);
const esc = () => menu() && menu().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

run(async () => {
  // ---- panel: a local branch that is not checked out ----
  const l = leaf('.sb-leaf[data-kind="branch"][data-can-hide][data-ref^="refs/heads/"]');
  ok(!!l, 'sample has a hideable local branch');
  const ref = l.dataset.ref, name = ref.slice('refs/heads/'.length);
  const ev = ctx(l);
  ok(ev.defaultPrevented, 'panel: browser menu suppressed');
  ok(labels() === 'Hide,Copy branch name', 'panel leaf items', labels());
  ok(document.activeElement === menu(), 'mouse open: menu holds focus, no item ringed', document.activeElement && document.activeElement.outerHTML.slice(0, 60));
  ok(document.activeElement !== l, 'mouse open: branch row not focused');
  pick('Copy branch name'); await wait(50);
  ok(copied === name, 'copy local name', copied);
  ok(!open(), 'menu closes after pick');
  ok(!document.activeElement || !document.activeElement.closest('#sideList'), 'mouse pick: focus not sent back to the branch', document.activeElement && document.activeElement.className);
  // Opened from the keyboard: no pointer position -> first item focused.
  l.focus(); ctx(l, 0, 0);
  ok(document.activeElement === items()[0], 'keyboard open: first item focused', document.activeElement && document.activeElement.outerHTML.slice(0, 60));
  esc();
  ok(document.activeElement === l, 'keyboard open: Esc returns focus');
  const before = stats();
  ctx(leaf('[data-ref="' + ref + '"]')); pick('Hide'); await wait(300);
  ok(hidden().includes(ref), 'hide from panel saves ref', JSON.stringify(hidden()));
  ctx(leaf('.sb-leaf[data-ref="' + ref + '"]'));
  ok(labels() === 'Show,Copy branch name', 'hidden leaf offers Show', labels());
  pick('Show'); await wait(300);
  ok(!hidden().includes(ref) && stats() === before, 'show restores', JSON.stringify(hidden()) + ' ' + stats());

  // ---- panel: remote branch name ----
  const r = leaf('.sb-leaf[data-kind="branch"][data-ref^="refs/remotes/"]');
  ok(!!r, 'sample has a remote branch');
  ctx(r); pick('Copy branch name'); await wait(50);
  ok(copied === r.dataset.ref.slice('refs/remotes/'.length), 'copy remote name', copied);

  // ---- panel: checked-out branch ----
  ctx(leaf('.sb-leaf.is-head[data-ref]'));
  ok(labels() === 'Hide(off),Copy branch name', 'head leaf: Hide disabled', labels());
  esc();
  ok(!open(), 'Esc closes');

  // ---- panel: folder / remote node ----
  ctx(leaf('.sb-node[data-ref]'));
  ok(labels() === 'Hide', 'folder node: Hide only', labels());
  document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  document.body.click();
  ok(!open(), 'outside click closes');

  // ---- panel: section header has no menu ----
  ctx(leaf('.sb-sec'));
  ok(!open(), 'section header: no menu');

  // ---- graph label vs eye button ----
  const pill = [...document.querySelectorAll('#body .row .pill:not(.head)')].find(p => !p.title.startsWith('Tag '));
  ok(!!pill, 'graph has a branch label');
  const pname = pill.querySelector('.name').textContent;
  ctx(pill);
  ok(labels() === 'Hide,Copy branch name', 'pill items', labels());
  pick('Copy branch name'); await wait(50);
  ok(pill.title.includes('Local ') ? copied === pname : copied.endsWith('/' + pname), 'pill copy name', copied + ' vs ' + pname);
  ctx([...document.querySelectorAll('#body .row .pill:not(.head)')].find(p => p.querySelector('.name').textContent === pname));
  pick('Hide'); await wait(300);
  const viaMenu = JSON.stringify([...hidden()].sort()), statsMenu = stats();
  ok(hidden().length > 0, 'pill hide saved', viaMenu);
  // Same refs through the eye buttons.
  document.querySelector('#showAllBtn').click(); await wait(300);
  for (const rf of JSON.parse(viaMenu)) { document.querySelector('#sideList [data-hide="' + rf + '"]').click(); await wait(300); }
  ok(JSON.stringify([...hidden()].sort()) === viaMenu && stats() === statsMenu, 'pill hide == eye buttons', JSON.stringify(hidden()) + ' ' + stats() + ' vs ' + statsMenu);
  document.querySelector('#showAllBtn').click(); await wait(300);

  // ---- graph: head label, tag label, plain row ----
  const hp = document.querySelector('#body .row .pill.head');
  if (hp) { ctx(hp); ok(labels() === 'Hide(off),Copy branch name', 'head pill: Hide disabled', labels()); esc(); }
  const tag = [...document.querySelectorAll('#body .row .pill')].find(p => p.title.startsWith('Tag '));
  if (tag) { ctx(tag); ok(!open(), 'tag label: no menu'); }
  const plain = [...document.querySelectorAll('#body .row[data-i]')].find(r => !r.querySelector('.pill') && r.querySelector('.col-msg'));
  ctx(plain.querySelector('.col-msg')); ok(!open(), 'plain row: no menu');

  // ---- solo disables Hide ----
  document.querySelector('#sideList [data-solo="' + ref + '"]').click(); await wait(300);
  ctx(leaf('.sb-leaf[data-ref="' + ref + '"]'));
  ok(labels() === 'Hide(off),Copy branch name' || labels() === 'Show(off),Copy branch name', 'solo: Hide disabled', labels());
  esc();
  document.querySelector('#showAllBtn').click(); await wait(300);

  // ---- keyboard: arrows move between enabled items ----
  ctx(leaf('.sb-leaf[data-ref="' + ref + '"]'));
  const first = document.activeElement;
  menu().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  ok(document.activeElement !== first && document.activeElement.closest('#ctxMenu'), 'ArrowDown moves focus');
  esc();
  ok(document.activeElement === leaf('.sb-leaf[data-ref="' + ref + '"]'), 'Esc returns focus to the branch');
});`;
