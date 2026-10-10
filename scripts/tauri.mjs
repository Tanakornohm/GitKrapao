// Runs the Tauri CLI with ~/.cargo/bin on PATH, so `pnpm run dev` works even in a terminal
// (or a VS Code window) that was opened before Rust was installed and still has the old PATH.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';

const bin = path.join(process.env.CARGO_HOME || path.join(homedir(), '.cargo'), 'bin');
const key = Object.keys(process.env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
const parts = (process.env[key] || '').split(path.delimiter).filter(Boolean);
const same = p => path.resolve(p).toLowerCase() === bin.toLowerCase();
if (existsSync(bin) && !parts.some(same)) process.env[key] = [bin, ...parts].join(path.delimiter);

const cli = createRequire(import.meta.url).resolve('@tauri-apps/cli/tauri.js');
const r = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
