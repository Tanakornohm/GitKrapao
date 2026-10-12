// "+N" labels: hovering the Branch / tag cell lists every label of the commit.
export const prodSafe = true;
export const probe = `
let copied = null;
Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { copied = t; } }, configurable: true });
const pop = () => document.querySelector('#body .ref-pop:not([hidden])');
const over = (el, from = null) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: from }));
const out = (el, to = null) => el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: to }));
const names = el => [...el.querySelectorAll('.pill .name')].map(n => n.textContent);
const rclick = el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 60, clientY: 60 }));

run(async () => {
  const rows = [...document.querySelectorAll('#body .row[data-i]')];
  const row = rows.find(r => r.querySelector('.more')), plain = rows.find(r => r.querySelector('.pill') && !r.querySelector('.more'));
  ok(!!row && !!plain, 'sample has a +N row and a single-label row');
  const ref = row.querySelector('.col-ref');
  const expected = [row.querySelector('.pill .name').textContent, ...row.querySelector('.more').title.split(', ')];

  over(ref); await wait(40);
  ok(!pop(), 'no pop before the hover delay');
  await wait(200);
  const p = pop();
  ok(!!p, 'hover opens the pop');
  ok(p && JSON.stringify(names(p)) === JSON.stringify(expected), 'pop lists every label in order', p && JSON.stringify(names(p)) + ' vs ' + JSON.stringify(expected));
  ok(p && Math.abs(parseFloat(p.style.top) - parseFloat(row.style.top)) < 0.5, 'pop sits on its row', p && p.style.top + ' vs ' + row.style.top);
  const first = p.querySelector('.pill').getBoundingClientRect(), orig = row.querySelector('.pill').getBoundingClientRect();
  ok(Math.abs(first.top - orig.top) < 1.5 && Math.abs(first.left - orig.left) < 1.5, 'first label stays where it was', JSON.stringify([first.top, first.left, orig.top, orig.left]));
  ok(p.getBoundingClientRect().right <= ref.getBoundingClientRect().right + 1, 'pop stays inside the Branch / tag column');
  const ps = getComputedStyle(p);
  ok(ps.backgroundColor === 'rgba(0, 0, 0, 0)' && ps.boxShadow === 'none' && ps.borderRightWidth === '0px', 'pop itself is transparent', ps.backgroundColor + ' / ' + ps.boxShadow + ' / ' + ps.borderRightWidth);
  const item = p.querySelector('.pill').parentElement, is = getComputedStyle(item);
  ok(item !== p && /^rgb\\(/.test(is.backgroundColor), 'each label has an opaque backing', is.backgroundColor);

  out(ref, p); await wait(50);
  ok(!!pop(), 'moving from the cell into the pop keeps it open');
  out(p, ref); await wait(50);
  ok(!!pop(), 'moving back to the cell keeps it open');
  out(p, document.querySelector('#detail')); await wait(50);
  ok(!pop(), 'leaving closes it');

  over(ref); await wait(250);
  const second = pop().querySelectorAll('.pill')[1];
  rclick(second);
  const m = document.querySelector('#ctxMenu');
  ok(second.title.startsWith('Tag ') ? m.hidden : !m.hidden, 'sample: second label (' + second.title + ') menu follows tag/branch rule');
  m.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  over(ref); await wait(250);
  pop().querySelector('.pill').click(); await wait(50);
  ok(document.querySelector('#body .row.sel') && document.querySelector('#body .row.sel').dataset.i === row.dataset.i, 'clicking a pop label selects the commit');

  over(ref); await wait(250);
  document.querySelector('#wrap').dispatchEvent(new Event('scroll'));
  await wait(50);
  ok(!pop(), 'scroll closes it');

  over(plain.querySelector('.col-ref')); await wait(250);
  ok(!pop(), 'single-label row does not open a pop');

  over(ref); await wait(40); out(ref, plain); await wait(250);
  ok(!pop(), 'leaving before the delay cancels it');

  // A commit with three labels: checked-out main (+origin), feature/x, tag v1.
  const t = 1760000000, rec = (h, p, d, s, k) => [h, p, 'Ann Lee', 'ann@example.com', t - k * 60, d, s].join('|~|');
  const H = n => String(n).repeat(40);
  await importLog('pop-test', [
    rec(H(3), H(2), 'HEAD -> main, origin/main, feature/x, tag: v1', 'third', 0),
    rec(H(2), H(1), 'develop', 'second', 1),
    rec(H(1), '', '', 'first', 2),
  ].join('\\n'));
  const r3 = [...document.querySelectorAll('#body .row[data-i]')].find(r => r.querySelector('.more'));
  ok(r3 && r3.querySelector('.more').textContent === '+2', 'custom log: +2 label', r3 && r3.outerHTML.slice(0, 120));
  over(r3.querySelector('.col-ref')); await wait(250);
  ok(pop() && JSON.stringify(names(pop())) === '["main","feature/x","v1"]', 'custom log: pop lists main, feature/x, v1', pop() && JSON.stringify(names(pop())));
  // Stacked labels are as wide as the widest one; their icons line up on the right.
  const box = sel => [...pop().querySelectorAll(sel)].map(e => e.getBoundingClientRect());
  const ws = box('.pill').map(b => Math.round(b.width)), ics = box('.pill .ic').map(b => Math.round(b.right));
  ok(ws.length === 3 && Math.max(...ws) - Math.min(...ws) <= 1, 'stacked labels share one width', JSON.stringify(ws));
  ok(Math.max(...ics) - Math.min(...ics) <= 1, 'their icons line up', JSON.stringify(ics));
  const items = box('.ref-item').map(b => Math.round(b.width));
  ok(Math.max(...items) - Math.min(...items) <= 1 && Math.abs(items[0] - ws[0]) <= 1, 'backings match the labels', JSON.stringify([items, ws]));
  rclick(pop().querySelectorAll('.pill')[1]);
  const its = [...m.querySelectorAll('.menu-item')].map(b => b.querySelector('.n').textContent + (b.disabled ? '(off)' : '')).join(',');
  ok(!m.hidden && its === 'Hide,Copy branch name', 'second label (branch): menu with Hide enabled', its);
  [...m.querySelectorAll('.menu-item')].find(b => b.textContent.includes('Copy')).click(); await wait(50);
  ok(copied === 'feature/x', 'second label: copies feature/x, not main', copied);
  over(r3.querySelector('.col-ref')); await wait(250);
  rclick(pop().querySelectorAll('.pill')[0]);
  const its0 = [...m.querySelectorAll('.menu-item')].map(b => b.querySelector('.n').textContent + (b.disabled ? '(off)' : '')).join(',');
  ok(its0 === 'Hide(off),Copy branch name', 'first label (checked out): Hide disabled', its0);
  m.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  over(r3.querySelector('.col-ref')); await wait(250);
  rclick(pop().querySelectorAll('.pill')[2]);
  ok(m.hidden, 'third label (tag): no menu');
  // Hide the second label from the pop: the walk drops feature/x.
  over(r3.querySelector('.col-ref')); await wait(250);
  rclick(pop().querySelectorAll('.pill')[1]);
  [...m.querySelectorAll('.menu-item')].find(b => b.textContent.startsWith('Hide')).click(); await wait(400);
  const hid = Object.values(JSON.parse(localStorage.getItem('lanes.hidden') || '{}'))[0] || [];
  ok(JSON.stringify(hid) === '["refs/heads/feature/x"]', 'hide from pop hides only feature/x', JSON.stringify(hid));
});`;
