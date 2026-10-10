// Injected before every suite's probe (after capture.js, which owns `log`).
// A probe calls run(async () => { ... }).
const ok = (c, n, x = '') => log.push((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + x));
const wait = ms => new Promise(r => setTimeout(r, ms));
const run = fn => addEventListener('load', async () => {
  try { localStorage.clear(); await wait(400); await fn(); } catch (e) { log.push('FAIL exception ' + ((e && e.stack) || e)); }
  const p = document.createElement('pre'); p.id = 'result'; p.textContent = log.join('\n'); document.body.append(p);
});
// Browser-mode import of a pasted log (the "Import repo" dialog).
async function importLog(name, text){
  document.querySelector('#importBtn').click(); await wait(50);
  document.querySelector('#repoIn').value = name;
  document.querySelector('#logIn').value = text;
  document.querySelector('#loadBtn').click(); await wait(400);
}
