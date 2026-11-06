/**
 * the-access-row-is-three-lines.test.ts — 🔑 THE GUEST CARD'S ACCESS, SIMPLIFIED (owner 2026-11-02: *"simplify access
 * just like the rest of the guest card"*). Opened, Access is at most three lines, like the other rows:
 *   1. Access ▾ — ONE dropdown, None · Helper (can view) · Co-host; what it means is the ⓘ, never a paragraph (and the
 *      read-only word, for a viewer, is the same one row);
 *   1b. ONLY FOR A LINKED GUEST (owner 2026-11-02, verbatim: *"Only for guests with setnayan accounts already"*): an
 *      unlinked guest gets no dropdown — and with no access at all, no Access row; "Account · Not linked" says it;
 *   2. Account — Not linked / Linked — email, on one line; what linking opens is the ⓘ;
 *   3. [Give this spot…] [Take this seat back] side by side; Give opens its name field and Give only on a tap, and only
 *      while the guest has not replied; their explanations are the ⓘ.
 * RENDERED where a part renders alone, read from the card's source for the order. The Passed Away row is untouched.
 * Sabotage (2026-11-02, each reverted, each red): the `accessNote` paragraph back under the word · the Account hint back
 * as a second line · the name field drawn closed · Give offered to a guest who replied · the choices reordered.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { createRequire } from 'node:module';
import { CARD_ACCESS_CHOICES, cardAccessView } from '@/lib/guest-access';

/* `server-only` shim — the card's kit reaches a server-only module through its imports (lib/a-locked-deal-reaches-the-budget.test.ts). */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
{
  const nodeRequire = createRequire(import.meta.url);
  const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
  const STUB = join(process.cwd(), '__server_only_stub_access_row__.js');
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const orig = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return orig.call(this, request, ...rest);
  };
}

(globalThis as { React?: typeof React }).React = React;
let GuestAccessControl: typeof import('./guest-access-control').GuestAccessControl;
let GuestSeatDoors: typeof import('./guest-seat-doors').GuestSeatDoors;
before(async () => {
  ({ GuestAccessControl } = await import('./guest-access-control'));
  ({ GuestSeatDoors } = await import('./guest-seat-doors'));
});

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components');
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const noop = async () => {};

test('1 · Access ▾ is one dropdown in the owner’s order; the word for a viewer is one row, its meaning the ⓘ', () => {
  assert.deepEqual(
    CARD_ACCESS_CHOICES.map((c) => c.label),
    ['None', 'Helper (can view)', 'Co-host'],
  );
  assert.match(code('guest-access-pick.tsx'), /options=\{CARD_ACCESS_CHOICES\.map\(/, 'the dropdown does not offer the card’s three choices');
  const html = renderToStaticMarkup(
    React.createElement(GuestAccessControl, { eventId: 'e1', guestId: 'g1', firstName: 'Ana', initial: { level: 'none', live: false, lock: null }, canManage: false, linked: null }),
  );
  assert.match(html, /data-form-row="card-access"/, 'the word is not a row of the card');
  assert.doesNotMatch(html, /Guests only\. A co-host has the same access/, 'the explanation is a paragraph again, not the ⓘ');
  assert.equal((html.match(/>None</g) ?? []).length, 1, 'the level is said twice');
});

test('2 · Account is one line; its hint is the ⓘ', () => {
  const body = code('guest-card-body.tsx');
  const fold = body.slice(body.indexOf('<K.Fold summary="Access"'), body.indexOf('</K.Fold>', body.indexOf('<K.Fold summary="Access"')));
  assert.match(fold, /<FormRow\s+name="Account"\s+about=\{\{ words: linked \? '[^']+' : '[^']+' \}\}/, 'Account is not one row with its hint behind the ⓘ');
  assert.doesNotMatch(fold, /<p className="text-xs text-ink\/50">/, 'a hint line is back under Account');
  // The order: Access, (a helper's own pieces), Account, then the two doors — nothing else drawn in the fold.
  const at = (s: string) => fold.indexOf(s);
  assert.ok(at('<GuestAccessControl') < at('name="Account"') && at('name="Account"') < at('<GuestSeatDoors'), 'the three lines are out of order');
});

test('3 · Give and Take back side by side; Give opens on a tap, only while they have not replied', () => {
  const closed = renderToStaticMarkup(React.createElement(GuestSeatDoors, { name: 'Ana Cruz', canGive: true, releaseAction: noop }));
  assert.match(closed, /Give this spot…/);
  assert.match(closed, /Take this seat back/);
  assert.doesNotMatch(closed, /name="swap_name"/, 'the name field is drawn before Give is tapped');
  assert.doesNotMatch(closed, /Who takes it\?|Only while they have not replied\. Take back/, 'an explanation is a line, not the ⓘ');
  const replied = renderToStaticMarkup(React.createElement(GuestSeatDoors, { name: 'Ana Cruz', canGive: false, releaseAction: noop }));
  assert.doesNotMatch(replied, /Give this spot/, 'Give is offered to a guest who replied');
  assert.match(replied, /Take this seat back/);
  const doors = code('guest-seat-doors.tsx');
  assert.match(doors, /\{canGive && giving \? \(/, 'the name field is not behind the tap');
  assert.match(doors, /<Explain title="This seat">/, 'the doors’ explanation is not the ⓘ');
});

test('the Passed Away row stays exactly as it was', () => {
  const body = code('guest-card-body.tsx');
  assert.match(body, /<K\.Toggle\s+name="passed_away"\s+form=\{formId\}\s+defaultChecked=\{guest\.passed_away === true\}\s+label="Passed Away"\s+note="Kept on the list as “the late …”\. Not counted, seated or sent an invitation\."\s+soft\s+\/>/);
});

test('1b · Access ▾ only for a LINKED guest — unlinked means no dropdown (owner 2026-11-02)', () => {
  const Pick = () => React.createElement('div', { 'data-stub-access-pick': '' });
  const render = (linked: boolean | null, level: 'none' | 'limited_helper' | 'co_host', lock: 'creator' | 'celebrant' | null = null) =>
    renderToStaticMarkup(
      React.createElement(GuestAccessControl, {
        eventId: 'e1', guestId: 'g1', firstName: 'Ana', initial: { level, live: false, lock }, canManage: true, linked, Pick,
      }),
    );
  // Linked: the one dropdown.
  assert.match(render(true, 'none'), /data-stub-access-pick/, 'a linked guest lost the Access dropdown');
  // Unlinked: NEVER the dropdown, whatever they hold.
  for (const level of ['none', 'limited_helper', 'co_host'] as const) {
    assert.doesNotMatch(render(false, level), /data-stub-access-pick/, `an unlinked guest (${level}) is offered the Access dropdown`);
  }
  // Unlinked with nothing: no Access row at all — the Account line says "Not linked".
  assert.equal(render(false, 'none'), '', 'an unlinked guest with no access still draws an Access row');
  // Unlinked but holding something (a level that waits for them, a celebrant, the creator's own row): the word, read-only.
  assert.match(render(false, 'co_host'), /data-form-row="card-access"/, 'a waiting level was hidden');
  assert.match(render(false, 'none', 'creator'), /data-form-row="card-access"/, 'the creator’s own unlinked row lost its word');
  // The fold summary asks the same question, so it never says "None" for a row the card does not draw.
  assert.equal(cardAccessView({ level: 'none', lock: null }, false, true), 'none');
  assert.equal(cardAccessView({ level: 'none', lock: null }, true, true), 'pick');
  assert.equal(cardAccessView({ level: 'none', lock: null }, null, false), 'word');
  const body = code('guest-card-body.tsx');
  assert.match(body, /cardAccessView\(access, linked, canManageAccess\)/, 'the Access fold summary does not ask cardAccessView');
});
