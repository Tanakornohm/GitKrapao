// Opening repositories in quick succession (today through the Repository menu):
// the newest load wins, a superseded load's late result is dropped without a
// banner, and the PR list is remembered per repo so going back within 5
// minutes does not run `az` again (Refresh still does).
export const prodSafe = true;
export const budget = 60000;
export const setup = () => `<script>
(() => {
  const mk = (ch, subj) => ch.repeat(40) + '\\x1f\\x1fT\\x1ft@t\\x1f1700000000\\x1f1700000000\\x1f\\x1f' + subj + '\\x1e';
  const repos = {
    'C:/fake/a': { gen: 1, sha: 'a'.repeat(40), log: mk('a', 'a-one') },
    'C:/fake/b': { gen: 2, sha: 'b'.repeat(40), log: mk('b', 'b-one') },
  };
  const byGen = g => Object.values(repos).find(r => r.gen === g);
  let releaseA; const holdA = new Promise(res => { releaseA = res; });
  let firstA = true;
  const f = window.__fake = { calls: [], prs: {}, releaseA: () => releaseA() };
  const refsOf = r => ({ refs: [[r.sha, 'refs/heads/main']], headRef: 'refs/heads/main', headSha: r.sha });
  const answers = {
    open_repo: a => ({ path: a.path, name: a.path.slice(-1), lockKey: a.path }),
    start_history: async a => {
      const r = repos[a.path];
      if (a.path === 'C:/fake/a' && firstA) { firstA = false; await holdA; }
      return { gen: r.gen, remotes: [], fingerprint: 'fp', refs: refsOf(r) };
    },
    history_page: a => ({ log: byGen(a.gen).log, more: false, capped: false }),
    repo_fingerprint: () => 'fp',
    branch_tracking: () => [],
    list_stashes: () => [],
    pull_requests: a => { f.prs[a.path] = (f.prs[a.path] || 0) + 1; return { repo: null, items: [] }; },
    work_status: () => ({ files: [], total: 0 }),
    list_remotes: () => [],
  };
  window.__TAURI__ = { core: { invoke: (cmd, args) => {
    f.calls.push(cmd + (cmd === 'pull_requests' || cmd === 'start_history' ? ':' + (args || {}).path : ''));
    const a = answers[cmd];
    return a ? Promise.resolve(a(args || {})) : new Promise(() => {});
  } } };
  localStorage.setItem('lanes.last', JSON.stringify({ path: 'C:/fake/b', name: 'b', lockKey: 'C:/fake/b' }));
})();
</script>`;
export const probe = `
run(async () => {
  const f = window.__fake, $ = s => document.querySelector(s);
  const rowsText = () => $('#body').textContent;
  const prCalls = p => f.prs[p] || 0;
  const starts = () => f.calls.filter(c => c.startsWith('start_history')).length;
  // run() cleared localStorage after the boot load; the menu reads the recent list from it.
  localStorage.setItem('lanes.recent', JSON.stringify([{ path: 'C:/fake/a', name: 'a' }, { path: 'C:/fake/b', name: 'b' }]));
  const openFromMenu = async path => {
    if ($('#recentMenu').hidden) $('#repoBtn').click();
    await wait(20);
    $('#recentMenu [data-path="' + path + '"]').click();
    await wait(100);
  };
  ok(rowsText().includes('b-one'), 'b loads at boot', rowsText());
  ok(prCalls('C:/fake/b') === 1, 'boot asked az once for b', prCalls('C:/fake/b'));

  // a stays pending; asking for b again must not be swallowed by the busy flag.
  await openFromMenu('C:/fake/a');
  ok(starts() === 2, 'a started (and is pending)', starts());
  await openFromMenu('C:/fake/b');
  ok(rowsText().includes('b-one'), 'newest load wins', rowsText());
  ok(starts() === 3, 'the second click was not ignored', starts());

  f.releaseA(); await wait(200);
  ok(!rowsText().includes('a-one') && $('#banner').hidden, "a's late result is dropped", rowsText() + ' | banner hidden=' + $('#banner').hidden);
  ok(!document.body.classList.contains('loading'), 'loading state cleared');

  // a (answers at once now), then b, then a again: one az call for a.
  await openFromMenu('C:/fake/a');
  ok(rowsText().includes('a-one'), 'a opens once released', rowsText());
  await openFromMenu('C:/fake/b');
  ok(rowsText().includes('b-one'), 'b again', rowsText());
  await openFromMenu('C:/fake/a');
  ok(rowsText().includes('a-one'), 'a again', rowsText());
  ok(prCalls('C:/fake/a') === 1, 'PR list reused within 5 minutes', prCalls('C:/fake/a'));
  ok(prCalls('C:/fake/b') === 1, 'b reused as well', prCalls('C:/fake/b'));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));
  await wait(200);
  ok(prCalls('C:/fake/a') === 2, 'Refresh still re-asks az', prCalls('C:/fake/a'));
});`;
