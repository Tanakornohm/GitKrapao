// Builds the UI into dist/ (or --out <dir>): esbuild bundles src/app.* into one
// IIFE and index.html / app.css are copied next to it. --watch rebuilds on
// change (the first build finishes before watching, so `tauri dev` never opens
// an empty folder). --test sets __TEST__ so tests/ui can read app state;
// production bundles drop that code.
import { build, context } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, rmSync, watch } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const isWatch = args.includes('--watch'), isTest = args.includes('--test');
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? resolve(args[outAt + 1]) : join(root, 'dist');
const entry = ['app.ts', 'app.js'].map(f => join(root, 'src', f)).find(existsSync);
const STATIC = ['index.html', 'app.css'];

function copyStatic(){
  mkdirSync(out, { recursive: true });
  for (const f of STATIC) copyFileSync(join(root, 'src', f), join(out, f));
}
const options = {
  entryPoints: [entry], bundle: true, format: 'iife', target: 'es2022', charset: 'utf8',
  outfile: join(out, 'app.js'), minify: !isWatch && !isTest, sourcemap: isWatch || isTest ? 'linked' : false,
  define: { __TEST__: String(isTest) }, logLevel: 'info',
};

copyStatic();
// A map left by an earlier watch/test build would otherwise ship inside the installer.
if (!options.sourcemap) rmSync(join(out, 'app.js.map'), { force: true });
if (isWatch) {
  const ctx = await context(options);
  await ctx.rebuild();
  await ctx.watch();
  for (const f of STATIC) watch(join(root, 'src', f), () => { try { copyStatic(); } catch { /* file mid-save; the next event copies it */ } });
} else {
  await build(options);
}
