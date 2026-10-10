// Fails when a Rust struct sent to the UI changed but src/bindings was not
// regenerated: runs cargo test --lib (ts-rs rewrites the bindings), then asks git.
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, PATH: [join(process.env.CARGO_HOME || join(homedir(), '.cargo'), 'bin'), process.env.PATH].join(delimiter) };
const t = spawnSync('cargo', ['test', '--lib'], { cwd: join(root, 'src-tauri'), stdio: 'inherit', env, shell: process.platform === 'win32' });
// status is null when cargo could not be started (t.error) or was killed.
if (t.error || t.status !== 0) { if (t.error) console.error(t.error.message); process.exit(t.status || 1); }
// Compare content, not file stats (line-ending conversion can mark a file modified with no change).
const git = (...a) => {
  const r = spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  if (r.error || r.status !== 0) { console.error(`git ${a[0]} failed: ${r.error ? r.error.message : r.stderr}`); process.exit(r.status || 1); }
  return r;
};
const changed = git('diff', '--name-only', '--', 'src/bindings').stdout.trim();
const added = git('ls-files', '--others', '--exclude-standard', '--', 'src/bindings').stdout.trim();
if (changed || added) { console.error('src/bindings is out of date; commit the regenerated files:\n' + [changed, added].filter(Boolean).join('\n')); process.exit(1); }
console.log('src/bindings matches the Rust structs');
