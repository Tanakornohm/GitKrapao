// Hiding the branch panel must only remove the panel: .app keeps its own layout
// (a class shared with the panel's "N hidden" bar once restyled the whole window).
export const prodSafe = true;
export const probe = `
run(async () => {
  const app = document.querySelector('.app'), bar = document.querySelector('.toolbar');
  const look = () => { const s = getComputedStyle(app); return [s.paddingLeft, s.marginLeft, s.alignItems, s.backgroundColor, s.fontSize].join(' '); };
  const before = look();
  ok(bar.getBoundingClientRect().width === app.getBoundingClientRect().width, 'toolbar spans the window with the panel shown');

  document.querySelector('#sideBtn').click(); await wait(100);
  ok(getComputedStyle(document.querySelector('#side')).display === 'none', 'panel hidden after toggle');
  ok(look() === before, '.app keeps its layout when the panel is hidden', before + ' -> ' + look());
  ok(bar.getBoundingClientRect().width === app.getBoundingClientRect().width, 'toolbar still spans the window',
    bar.getBoundingClientRect().width + ' vs ' + app.getBoundingClientRect().width);
  ok(app.getBoundingClientRect().width === innerWidth, '.app fills the window', app.getBoundingClientRect().width + ' vs ' + innerWidth);

  document.querySelector('#sideBtn').click(); await wait(100);
  ok(getComputedStyle(document.querySelector('#side')).display !== 'none', 'panel back after second toggle');

  // The "N hidden" bar in the panel keeps its own style.
  const hb = document.querySelector('#sideHidden'); hb.hidden = false;
  ok(getComputedStyle(hb).display === 'flex' && getComputedStyle(hb).borderTopLeftRadius === '6px', 'hidden-branches bar keeps its style');
});
`;
