// Layout snapshot: every row's (hash, lane, color) and every edge for the
// built-in sample and the mock repo's log, compared with a baseline taken from
// the JavaScript version before the TypeScript conversion. Also small and
// broken histories.
import { existsSync, readFileSync } from 'node:fs';
const fx = new URL('./fixtures/', import.meta.url);
const mock = readFileSync(new URL('mock-log.txt', fx), 'utf8');
const base = new URL('layout-baseline.json', fx);
export const setup = () => `<script>window.__MOCK_LOG = ${JSON.stringify(mock)}; window.__BASELINE = ${existsSync(base) ? readFileSync(base, 'utf8') : 'null'};</script>`;
export const probe = `run(async () => {
  const snap = () => { const S = window.__gitkrapao.S; return {
    rows: S.commits.map(c => [c.hash, c.lane, c.color]),
    edges: S.edges.map(e => [e.from, e.fromLane, e.lane, e.to, e.toLane, e.color]) }; };
  const out = {};
  out.sample = snap();
  ok(out.sample.rows.length === 29, 'sample loads from file:// with 29 rows', out.sample.rows.length);
  await importLog('mock', window.__MOCK_LOG);
  out.mock = snap();
  ok(out.mock.rows.length === 158, 'mock log: 158 rows', out.mock.rows.length);
  ok([...document.querySelectorAll('#body .col-msg')].some(el => /[\\u0E00-\\u0E7F]/.test(el.textContent)), 'Thai subjects render');
  log.push('SNAPSHOT ' + JSON.stringify(out));
  const B = window.__BASELINE;
  if (B) for (const k of ['sample', 'mock']) {
    ok(JSON.stringify(out[k].rows) === JSON.stringify(B[k].rows), k + ': rows (hash, lane, color) match baseline');
    ok(JSON.stringify(out[k].edges) === JSON.stringify(B[k].edges), k + ': edges match baseline');
  } else ok(false, 'baseline exists (run with --write-baseline once)');
  const one = 'a'.repeat(40) + '|~||~|Ann|~|ann@example.com|~|1760000000|~|HEAD -> main|~|only commit';
  await importLog('one', one);
  ok(window.__gitkrapao.S.commits.length === 1 && document.querySelectorAll('#body .row[data-i]').length === 1, 'one-commit log renders one row');
  await importLog('bad', 'not a git log line');
  ok(!document.querySelector('#modal').hidden || /line/i.test(document.querySelector('#err').textContent), 'invalid log reports an error instead of crashing', document.querySelector('#err').textContent);
});`;
