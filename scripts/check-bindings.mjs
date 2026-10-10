// Fails when a Rust struct sent to the UI changed but src/bindings was not
// regenerated: runs cargo test --lib (ts-rs rewrites the bindings), then asks git.
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, PATH: [join(process.env.CARGO_HOME || join(homedir(), '.cargo'), 'bin'), process.env.PATH].join(delimiter) };
const t = spawnSync('cargo', ['test', '--lib'], { cwd: join(root, 'src-tauri'), stdio: 'inherit', env, shell: process.platform === 'win32' });
if (t.status) process.exit(t.status ?? 1);
// Compare content, not file stats (line-ending conversion can mark a file modified with no change).
const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
const changed = git('diff', '--name-only', '--', 'src/bindings').stdout.trim();
const added = git('ls-files', '--others', '--exclude-standard', '--', 'src/bindings').stdout.trim();
if (changed || added) { console.error('src/bindings is out of date; commit the regenerated files:\n' + [changed, added].filter(Boolean).join('\n')); process.exit(1); }
console.log('src/bindings matches the Rust structs');
