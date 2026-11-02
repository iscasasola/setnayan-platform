/**
 * the-access-row-is-three-lines.test.ts — 🔑 THE GUEST CARD'S ACCESS, SIMPLIFIED (owner 2026-11-02: *"simplify access
 * just like the rest of the guest card"*). Opened, Access is at most three lines, like the other rows:
 *   1. Access ▾ — ONE dropdown, None · Helper (can view) · Co-host; what it means is the ⓘ, never a paragraph (and the
 *      read-only word, for a viewer, is the same one row);
 *   2. Account — Not linked / Linked — email, on one line; "When they link, it shows here" is the ⓘ;
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
import { CARD_ACCESS_CHOICES } from '@/lib/guest-access';

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
  assert.match(fold, /<FormRow\s+name="Account"\s+about=\{\{ words: linked \? 'Unlink account is in the ⋯ menu at the top\.' : 'When they link, it shows here\.' \}\}/, 'Account is not one row with its hint behind the ⓘ');
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
