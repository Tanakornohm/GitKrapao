// Temporary helper for the strict conversion: runs tsc and counts errors per
// section of src/app.ts (sections start at "/* ---------- <name>"). Deleted when
// typecheck reaches 0.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '-p', root], { encoding: 'utf8' });
const lines = readFileSync(join(root, 'src', 'app.ts'), 'utf8').split(/\r?\n/);
const heads = lines.map((l, i) => [i + 1, (l.match(/^\/\* -{3,} ([^-*\n]+?)\s*(-{3,}|\*\/|$)/) || [])[1]]).filter(([, n]) => n);
const count = new Map();
for (const m of r.stdout.matchAll(/^(.+?)\((\d+),\d+\): error/gm)) {
  let key = m[1];
  if (key.endsWith('app.ts')) { const ln = +m[2]; key = 'app.ts: ' + ([...heads].reverse().find(([at]) => at <= ln)?.[1] ?? '(top)'); }
  count.set(key, (count.get(key) || 0) + 1);
}
let total = 0;
for (const [k, n] of [...count].sort((a, b) => b[1] - a[1])) { console.log(String(n).padStart(5), k); total += n; }
console.log(String(total).padStart(5), 'TOTAL');
