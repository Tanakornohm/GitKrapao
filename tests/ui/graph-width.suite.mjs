// The Graph column's default width: wide enough for every lane, but at most a
// third of the window, so a repo with many branches never pushes the message
// and date columns off screen. A width the user dragged still wins, and a
// double-click on the resizer goes back to the default.
export const prodSafe = true;
export const variants = [{ name: 'wide', tips: 40 }, { name: 'narrow', tips: 2 }, { name: 'dragged', tips: 40, saved: 900 }];
export const setup = v => `<script>
(() => {
  const h = i => (i + 1).toString(16).padStart(40, '0'), root = 'f'.repeat(40);
  const rec = (sha, parents, t, s) => sha + '\\x1f' + parents + '\\x1fT\\x1ft@t\\x1f' + t + '\\x1f' + t + '\\x1f\\x1f' + s + '\\x1e';
  // ${v.tips} branch tips on one root commit: one lane each.
  const tips = Array.from({ length: ${v.tips} }, (_, i) => h(i));
  const log = tips.map((sha, i) => rec(sha, root, 1700000100 + i, 'tip ' + i)).reverse().join('\\n') + '\\n' + rec(root, '', 1700000000, 'root');
  const refs = { refs: tips.map((sha, i) => [sha, 'refs/heads/b' + i]), headRef: 'refs/heads/b0', headSha: tips[0] };
  const answers = {
    open_repo: a => ({ path: a.path, name: 'demo', lockKey: a.path }),
    start_history: () => ({ gen: 1, remotes: [], fingerprint: 'fp', refs }),
    history_page: () => ({ log, more: false, capped: false }),
    repo_fingerprint: () => 'fp',
    branch_tracking: () => [], list_stashes: () => [], list_remotes: () => [],
    pull_requests: () => ({ repo: null, items: [] }),
    work_status: () => ({ files: [], total: 0 }),
    stop_history: () => null,
  };
  window.__TAURI__ = { core: { invoke: (cmd, args) => {
    const a = answers[cmd];
    return a ? Promise.resolve(a(args || {})) : new Promise(() => {});
  } } };
  localStorage.setItem('lanes.last', JSON.stringify({ path: 'C:/fake/demo', name: 'demo' }));
  ${v.saved ? `localStorage.setItem('lanes.cols', JSON.stringify({ graph: ${v.saved} }));` : ''}
  window.__variant = '${v.name}';
})();
</script>`;
export const probe = `
run(async () => {
  const $ = s => document.querySelector(s);
  const graphW = () => parseFloat($('#grid').style.getPropertyValue('--graphw'));
  const third = Math.floor(innerWidth / 3);
  await wait(300);
  ok(document.querySelectorAll('#body .row').length > 2, 'the repo loaded', document.querySelectorAll('#body .row').length);
  const variant = window.__variant;
  if (variant === 'narrow') {
    // 2 lanes: the natural width, far below a third of the window.
    ok(graphW() > 0 && graphW() < 200, 'a narrow graph keeps its natural width', graphW());
    return;
  }
  if (variant === 'dragged') {
    ok(graphW() === 900, 'a width the user dragged still wins', graphW());
    $('.head .resizer[data-col="graph"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await wait(50);
    ok(graphW() === third, 'double-click goes back to a third of the window', graphW() + ' vs ' + third);
    ok(!JSON.parse(localStorage.getItem('lanes.cols')).graph, 'the reset is saved as the default', localStorage.getItem('lanes.cols'));
    return;
  }
  // 40 lanes need about 1230 px.
  ok(graphW() === third, 'a wide graph is capped at a third of the window', graphW() + ' vs ' + third);
  const msg = $('.head .col-msg').getBoundingClientRect(), date = $('.head .col-date').getBoundingClientRect();
  ok(msg.left < innerWidth - 100 && date.right <= innerWidth + 1, 'message and date columns are on screen', msg.left + ' / ' + date.right + ' / ' + innerWidth);
  ok(/reset/i.test($('.head .resizer[data-col="graph"]').title), 'the resizer says double-click resets', $('.head .resizer[data-col="graph"]').title);
});
`;
