## 2026-11-10 · fix(stale-tab): webpack's missing-module error reloads once instead of the crash page

A tab left open across a deploy can fail inside webpack's runtime with `TypeError: Cannot read properties of undefined (reading 'call')` (the old tab asks for a module id the new build dropped). `isStaleBundleError` did not know this shape, so the owner saw "Something on our end didn't work" right after a service card SAVED. It now counts as a stale tab — only when the TOP stack frame is the `webpack-*.js` runtime chunk, so the same message from our own code is still a real crash. Two tests.

SPEC IMPACT: None.
