/** Set by scripts/web.mjs: true only in the tests/ui bundle. */
declare const __TEST__: boolean;

interface Window {
  /** Present in the desktop app (withGlobalTauri); absent in browser mode. */
  __TAURI__?: { core: { invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> } };
  /** tests/ui only (see the boot section of app.ts). */
  __gitkrapao?: unknown;
}
