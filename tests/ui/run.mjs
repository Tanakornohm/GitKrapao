// Headless Edge UI tests. Builds a test bundle (window.__lanes exposed) and a
// production bundle, then for each suite writes a page (built index.html +
// optional setup before app.js + helpers + probe after it), opens it in Edge
// with a fresh profile, and reads the PASS/FAIL lines from <pre id="result">.
//   pnpm run test:ui [filter]          run suites whose file name contains filter
//   pnpm run test:ui -- --write-baseline   also save the layout snapshot
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const args = process.argv.slice(2), writeBaseline = args.includes('--write-baseline');
const filter = args.find(a => !a.startsWith('--'));
const edge = process.env.EDGE_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!edge) { console.error('Microsoft Edge not found; set EDGE_PATH'); process.exit(2); }

const builds = { test: join(here, '.build', 'test'), prod: join(here, '.build', 'prod') };
for (const [kind, dir] of Object.entries(builds)) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'web.mjs'), ...(kind === 'test' ? ['--test'] : []), '--out', dir], { stdio: 'inherit' });
  if (r.error || r.status !== 0) process.exit(r.status || 1);
}
const capture = readFileSync(join(here, 'capture.js'), 'utf8'), helpers = readFileSync(join(here, 'helpers.js'), 'utf8');
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

let failed = 0;
for (const file of readdirSync(here).filter(f => f.endsWith('.suite.mjs') && (!filter || f.includes(filter)))) {
  const s = await import(pathToFileURL(join(here, file)).href);
  const kinds = s.prodSafe ? ['test', 'prod'] : ['test'];
  for (const kind of kinds) for (const v of s.variants || [{}]) {
    const name = `${file.replace('.suite.mjs', '')}${v.name ? ':' + v.name : ''}${kind === 'prod' ? ' [prod]' : ''}`;
    const dir = builds[kind];
    const html = readFileSync(join(dir, 'index.html'), 'utf8')
      .replace('<head>', () => `<head><base href="${pathToFileURL(dir).href}/">`)
      .replace('<html lang="en">', () => `<html lang="en"${v.theme ? ` data-theme="${v.theme}"` : ''}>`)
      .replace('<script src="app.js"></script>', () => `<script>${capture}</script>${typeof s.setup === 'function' ? s.setup(v) : s.setup || ''}<script src="app.js"></script><script>${helpers}</script><script>${s.probe}</script>`);
    const page = join(dir, `${name.replace(/\W+/g, '_')}.html`);
    writeFileSync(page, html);
    const prof = mkdtempSync(join(tmpdir(), 'lanes-ui-'));
    const r = spawnSync(edge, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', `--user-data-dir=${prof}`,
      `--virtual-time-budget=${s.budget || 20000}`, '--window-size=1400,900', '--dump-dom', pathToFileURL(page).href],
      { encoding: 'utf8', maxBuffer: 64 << 20 });
    rmSync(prof, { recursive: true, force: true });
    const m = (r.stdout || '').match(/<pre id="result">([\s\S]*?)<\/pre>/);
    const lines = m ? decode(m[1]).split('\n').filter(Boolean) : ['FAIL no result (page crashed or timed out)'];
    for (const l of lines.filter(l => l.startsWith('SNAPSHOT ')))
      if (writeBaseline) writeFileSync(join(here, 'fixtures', 'layout-baseline.json'), JSON.stringify(JSON.parse(l.slice(9)), null, 1));
    const bad = lines.filter(l => /^(FAIL|ERR)/.test(l)), pass = lines.filter(l => l.startsWith('PASS')).length;
    failed += bad.length;
    console.log(`${bad.length ? '✗' : '✓'} ${name}: ${pass} passed${bad.length ? `, ${bad.length} failed` : ''}`);
    bad.forEach(l => console.log('    ' + l));
  }
}
process.exit(failed ? 1 : 0);
