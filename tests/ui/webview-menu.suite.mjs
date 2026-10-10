// The WebView's own right-click menu is off in the desktop app, except in text
// boxes and over selected text; browser mode keeps it everywhere.
export const prodSafe = true;
export const variants = [{ name: 'desktop' }, { name: 'browser' }];
export const setup = v => v.name === 'desktop' ? '<script>window.__TAURI__ = { core: { invoke: () => new Promise(() => {}) } };</script>' : '';
export const probe = `
run(async () => {
  const desktop = !!window.__TAURI__;
  const expect = desktop
    ? { canvas: 'blocked', body: 'blocked', search: 'menu', textarea: 'menu', fileInput: 'blocked', selection: 'menu' }
    : { canvas: 'menu', body: 'menu', search: 'menu', textarea: 'menu', fileInput: 'menu', selection: 'menu' };
  const fire = el => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }); el.dispatchEvent(ev); return ev.defaultPrevented ? 'blocked' : 'menu'; };
  getSelection().removeAllRanges();
  const got = {
    canvas: fire(document.querySelector('canvas') || document.body),
    body: fire(document.body),
    search: fire(document.querySelector('#q')),
    textarea: fire(document.querySelector('#logIn')),
    fileInput: fire(document.querySelector('#fileIn')),
  };
  const p = document.createElement('p'); p.textContent = 'selected text'; document.body.append(p);
  const r = document.createRange(); r.selectNodeContents(p); getSelection().addRange(r);
  got.selection = fire(p);
  for (const k of Object.keys(expect)) ok(got[k] === expect[k], (desktop ? 'desktop' : 'browser') + ': ' + k + ' -> ' + expect[k], got[k]);
});`;
