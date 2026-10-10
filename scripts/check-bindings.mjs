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
const s = spawnSync('git', ['status', '--porcelain', '--', 'src/bindings'], { cwd: root, encoding: 'utf8' });
if (s.stdout.trim()) { console.error('src/bindings is out of date; commit the regenerated files:\n' + s.stdout); process.exit(1); }
console.log('src/bindings matches the Rust structs');
