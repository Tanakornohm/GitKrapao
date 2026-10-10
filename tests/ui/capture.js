// Injected before a suite's setup and app.js, so errors while the page boots
// (and promises nobody caught) fail the suite instead of passing silently.
const log = [];
addEventListener('error', e => log.push('ERR ' + e.message + ' @' + e.lineno));
addEventListener('unhandledrejection', e => log.push('ERR unhandled rejection ' + ((e.reason && e.reason.stack) || e.reason)));
