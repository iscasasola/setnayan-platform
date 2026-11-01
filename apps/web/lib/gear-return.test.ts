/**
 * gear-return.test.ts — 🏪 a save sent from an open ⚙ sheet comes back to that sheet, and NEVER anywhere off the site.
 * (`lib/gear-return.server.ts`, 2026-10-31, the Shop ⚙.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}

test('from an open Shop ⚙: back to that page, sheet open, on the fold, with the save’s own status', async () => {
  const { gearReturnFrom } = await import('./gear-return.server');
  assert.equal(
    gearReturnFrom('https://setnayan.com/vendor-dashboard/profile?gear=1&saved=1&gsec=plan', '/vendor-dashboard/team', 'saved=1', 'team'),
    '/vendor-dashboard/profile?gear=1&saved=1&gsec=team',
  );
  assert.equal(
    gearReturnFrom('https://setnayan.com/vendor-dashboard/website?gear=1', '/vendor-dashboard/team', 'error=No%20such%20account', 'team'),
    '/vendor-dashboard/website?gear=1&error=No+such+account&gsec=team',
  );
});

test('anything else lands on the editor’s own page — never another host, never outside the supplier dashboard', async () => {
  const { gearReturnFrom } = await import('./gear-return.server');
  const fb = '/vendor-dashboard/team';
  assert.equal(gearReturnFrom(null, fb, 'saved=1', 'team'), '/vendor-dashboard/team?saved=1');
  assert.equal(gearReturnFrom('https://setnayan.com/vendor-dashboard/team', fb, 'saved=1', 'team'), '/vendor-dashboard/team?saved=1', 'no ⚙ open');
  assert.equal(gearReturnFrom('https://evil.example/vendor-dashboard/profile?gear=1', fb, 'saved=1', 'team'), '/vendor-dashboard/profile?gear=1&saved=1&gsec=team', 'only the PATH is kept — the host never is');
  assert.equal(gearReturnFrom('https://setnayan.com/dashboard/x?gear=1', fb, 'saved=1', 'team'), '/vendor-dashboard/team?saved=1');
  assert.equal(gearReturnFrom('https://setnayan.com/vendor-dashboard//evil.example?gear=1', fb, 'saved=1', 'team'), '/vendor-dashboard/team?saved=1');
  assert.equal(gearReturnFrom('not a url', fb, 'saved=1', 'team'), '/vendor-dashboard/team?saved=1');
});
