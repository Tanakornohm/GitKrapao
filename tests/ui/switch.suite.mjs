// Switching branches: double-click or right-click a branch in the panel or a
// graph label. The checked-out branch cannot be switched to; while a switch
// runs nothing polls and Fetch is off; afterwards the graph syncs once.
// Results go to the Output drawer; a failure also to the banner.
export const prodSafe = true;
export const budget = 60000;
export const setup = () => `<script>
(() => {
  const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
  const refs = { refs: [[A, 'refs/heads/main'], [A, 'refs/remotes/origin/main'], [C, 'refs/heads/feat'], [B, 'refs/remotes/origin/only']],
                 headRef: 'refs/heads/main', headSha: A };
  const rec = (h, p, t, s) => h + '\\x1f' + p + '\\x1fT\\x1ft@t\\x1f' + t + '\\x1f' + t + '\\x1f\\x1f' + s + '\\x1e\\n';
  const log = rec(C, B, 1700000300, 'feat work') + rec(A, B, 1700000200, 'main work') + rec(B, '', 1700000000, 'root');
  const f = window.__fake = { calls: [], args: [], switch: null };
  const answers = {
    open_repo: a => ({ path: a.path, name: 'demo', lockKey: a.path }),
    start_history: () => ({ gen: 1, remotes: ['origin'], fingerprint: 'fp', refs }),
    history_page: () => ({ log, more: false, capped: false }),
    repo_fingerprint: () => 'fp',
    branch_tracking: () => [],
    list_stashes: () => [],
    pull_requests: () => ({ repo: null, items: [] }),
    work_status: () => ({ files: [], total: 0 }),
    sync_history: () => ({ fingerprintBefore: 'fp', fingerprintAfter: 'fp', refs, log: '', over: false }),
    list_remotes: () => ['origin'],
    commit_detail: () => ({ body: 'x', files: [], totalFiles: 0, add: 0, del: 0 }),
    switch_branch: () => new Promise(res => { f.switch = res; }),
  };
  window.__TAURI__ = { core: { invoke: (cmd, args) => {
    f.calls.push(cmd); f.args.push([cmd, args]);
    const a = answers[cmd];
    return a ? Promise.resolve(a(args || {})) : new Promise(() => {});
  } } };
  localStorage.setItem('lanes.last', JSON.stringify({ path: 'C:/fake/demo', name: 'demo' }));
})();
</script>`;
export const probe = `
run(async () => {
  const f = window.__fake, $ = s => document.querySelector(s);
  const count = c => f.calls.filter(x => x === c).length;
  const lastSwitch = () => { const a = f.args.filter(([c]) => c === 'switch_branch').pop(); return a && a[1].target; };
  const dbl = el => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  const ctx = el => { const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + 5, clientY: r.top + 5 })); };
  const done = (extra = {}) => ({ ok: true, timedOut: false, cancelled: false, durationMs: 300, exitCode: 0,
    command: 'git switch --no-guess feat', stdout: '', stderr: "Switched to branch 'feat'", summary: 'Switched to feat.', ...extra });
  await wait(300);
  const leaf = ref => $('#sideList [data-kind="branch"][data-ref="' + ref + '"]');
  ok(!!leaf('refs/heads/feat') && !!leaf('refs/heads/main') && !!leaf('refs/remotes/origin/only'), 'branches listed in the panel');

  // The checked-out branch: menu entry off, double-click does nothing.
  ctx(leaf('refs/heads/main')); await wait(30);
  const items = () => [...document.querySelectorAll('#ctxMenu .menu-item')];
  const sw = items().find(b => b.textContent.startsWith('Switch to'));
  ok(sw && sw.textContent.startsWith('Switch to main') && sw.disabled, 'head branch: "Switch to" is off', sw && sw.outerHTML);
  ok(items()[0] === sw, '"Switch to" comes first');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(20);
  dbl(leaf('refs/heads/main')); await wait(30);
  ok(!count('switch_branch'), 'double-click on the checked-out branch does nothing');

  // Double-click a local branch: switch runs; no polls and Fetch off meanwhile.
  dbl(leaf('refs/heads/feat')); await wait(30);
  ok(count('switch_branch') === 1 && lastSwitch() === 'refs/heads/feat', 'double-click switches', lastSwitch());
  ok($('#headName').textContent === 'Switching…', 'toolbar says Switching…', $('#headName').textContent);
  ok($('#fetchBtn').getAttribute('aria-disabled') === 'true' && $('#fetchBtn').title === 'Switching branch…', 'fetch is off during a switch', $('#fetchBtn').title);
  const fp = count('repo_fingerprint'), sync = count('sync_history');
  await wait(7000);
  ok(count('repo_fingerprint') === fp, 'no polling during the switch');
  dbl(leaf('refs/heads/feat')); await wait(20);
  ok(count('switch_branch') === 1, 'no second switch while one runs');
  f.switch(done());
  await wait(200);
  ok(count('sync_history') === sync + 1, 'graph syncs once after the switch');
  ok($('#headName').textContent === 'main', 'branch name comes back (from the refs) until the sync moves it', $('#headName').textContent);
  ok(!$('#out').hidden && $('#outList .out-item:last-child .out-sum').textContent === 'Switched to feat.', 'logged in Output');
  ok($('#banner').hidden, 'no banner on success');

  // Right-click a remote-only branch in the panel.
  ctx(leaf('refs/remotes/origin/only')); await wait(30);
  const r = items().find(b => b.textContent.startsWith('Switch to'));
  ok(r && r.textContent === 'Switch to origin/only' && !r.disabled, 'remote branch: Switch to origin/only', r && r.textContent);
  r.click(); await wait(30);
  ok(lastSwitch() === 'refs/remotes/origin/only', 'switches with the remote ref', lastSwitch());
  window.__pwned = false;
  f.switch(done({ ok: false, exitCode: 1, summary: 'boom <img src=x onerror="window.__pwned=true">', stderr: 'error: <b>x</b>' }));
  await wait(200);
  ok(!$('#banner').hidden && $('#bannerMsg').textContent.startsWith('boom <img'), 'failure goes to the banner as text');
  ok(!$('#outList').hidden && !document.querySelector('#outList img, #outList b, #banner img') && !window.__pwned, 'drawer opens; git text stays text');

  // A graph label: double-click and right-click.
  $('#bannerClose').click();
  const pill = [...document.querySelectorAll('#body .pill')].find(p => p.textContent.includes('feat'));
  ok(!!pill, 'feat label in the graph');
  dbl(pill); await wait(30);
  ok(lastSwitch() === 'refs/heads/feat' && count('switch_branch') === 3, 'double-click a graph label switches', lastSwitch());
  f.switch(done({ ok: false, cancelled: true, exitCode: 1, summary: 'Switch cancelled: your uncommitted changes were left as they are.' }));
  await wait(200);
  ok($('#banner').hidden, 'cancel adds no banner', $('#bannerMsg').textContent);
  ok($('#outList .out-item:last-child .out-st').textContent === 'cancelled', 'cancel is logged');
  const head = [...document.querySelectorAll('#body .pill')].find(p => p.textContent.includes('main'));
  ctx(head); await wait(30);
  const hs = items().find(b => b.textContent.startsWith('Switch to'));
  ok(hs && hs.disabled, 'graph label of the checked-out branch: Switch is off');
});`;
