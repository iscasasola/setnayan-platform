/**
 * the-lab-cannot-reach-the-database.test.ts — A LAB PRESS NEVER REACHES THE DATABASE (controller, 2026-10-09: the lab's
 * Delete had called the real server action; nothing was harmed only because Postgres refused the id).
 *
 * On the lab's Guests screen every write a plain press reaches goes through a context the lab fills with local stand-ins:
 *   · the removal's two writes (`GuestRemovalActionsContext`, guest-delete.tsx),
 *   · the other ten (`GuestActionsContext`, guest-actions-context.tsx): Set… ▾ · New group · the name box · Quick add (guest,
 *     group, two role writes) · Add from your people (read + add) · Mark as sent — and the door "Invite N" opens.
 * The app never provides either context, so production runs the shipped actions.
 *
 * THE CLAIM, three ways: (1) every name the context carries has a stand-in (none is left real); (2) the six call sites take
 * their action from the context and import no action module of their own; (3) nothing but the lab provides the context.
 * Behaviour: the stand-ins answer the way the real ones do, without a database.
 *
 * NOT stubbed (listed, not hidden): the Setup view's writes, the guest card's autosave / release / e-mail invite (a route the
 * lab does not draw), and the one-by-one run (`SendInviteActions` is in the Maker's first load and must not import the context).
 *
 * SABOTAGE (each seen RED, then restored): a stand-in deleted from the lab · a call site importing its action directly again ·
 * a provider put in the app.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { LAB_GUEST_ACTIONS, LAB_SETUP_REFUSALS } from './lab-stand-ins';
import { isPlainSentence } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';

(globalThis as unknown as { React: unknown }).React = React;
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const GUESTS = join(APP, 'dashboard', '[eventId]', 'guests', '_components');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('(1) every write the context carries has a lab stand-in — none is left real', () => {
  /* The names the context carries — read from its source (importing it would import every server action). */
  const ctx = read(join(GUESTS, 'guest-actions-context.tsx'));
  const real = [...ctx.slice(ctx.indexOf('export const REAL_GUEST_ACTIONS')).matchAll(/^\s{2}(\w+)(?::|,)/gm)].map((m) => m[1]).slice(0, 14);
  assert.equal(real.length, 14, 'the context’s names could not be read');
  assert.deepEqual(Object.keys(LAB_GUEST_ACTIONS).sort(), [...real].sort(), 'a lab press can reach a real action');
  for (const f of ['lab-stand-ins.ts', 'lab-guest-actions.tsx']) {
    assert.doesNotMatch(read(join(HERE, f)), /from '[^']*(?:-actions|\/actions)'|groups-actions|inline-actions/, `${f} imports a real action module`);
  }
});

test('(1b) the stand-ins answer like the real ones, locally', async () => {
  const a = LAB_GUEST_ACTIONS;
  const quick = await a.quickAddGuest!('e', { first_name: 'Ana', last_name: 'Cruz', side: 'both', role: 'guest', group_id: null } as never);
  assert.ok(quick.ok && quick.guest.first_name === 'Ana' && quick.guest.guest_id.startsWith('lab-'));
  const group = await a.quickCreateGroup!('e', 'Barkada');
  assert.ok(group.ok && group.group.label === 'Barkada' && group.created);
  const role = await a.addRoleToGuest!('e', 'g1', 'vip' as never);
  assert.ok(role.ok && role.guest.guest_id === 'g1');
  const people = await a.listPeopleYouCanInvite!('e');
  assert.ok(people.people.length >= 2 && people.people.some((p) => p.alreadyHere) && !people.partial);
  const added = await a.addGuestsFromPeople!('e', [{ key: 'lab-p1' }, { key: 'lab-p2' }] as never, 'both');
  assert.ok(added.ok && added.added === 2 && added.failed === 0);
  const sent = await a.setGuestInvitationSent!('e', 'g1', true);
  assert.ok(sent.ok && typeof sent.sentAt === 'string');
  const unsent = await a.setGuestInvitationSent!('e', 'g1', false);
  assert.ok(unsent.ok && unsent.sentAt === null);
  const drafted = await a.hubDraftAction!('e', new FormData());
  assert.ok(drafted.ok, 'the Setup draft write does not answer');
  const pax = await a.updatePaxSettings!(new FormData());
  assert.ok(pax.ok);
  const fin = await a.setGuestListFinalized!('e', true);
  assert.ok(fin.ok && fin.locked === true);
  const fin2 = await a.setGuestListFinalized!('e', false);
  assert.ok(fin2.ok && fin2.locked === false);
  assert.equal(a.sendRunHref!('e', ['a', 'b']), '/dev/guests-lab?part=run&ids=a,b', '"Invite N" leaves the lab for a real route');
});

test('(2) the call sites take their action from the context and import no action module of their own', () => {
  const sites: Array<[string, string]> = [
    ['guests-screen.tsx', 'bulkApplyRoleAndGroup, sendRunHref'],
    ['new-group-inline-form.tsx', 'createGuestGroup'],
    ['capture-bar.tsx', 'addSingleGuest'],
    ['guest-invite-cell.tsx', 'setGuestInvitationSent'],
    ['quick-add-sheet.tsx', 'quickAddGuest, quickCreateGroup, addRoleToGuest, setGuestPrimaryRole'],
    ['add-from-people-sheet.tsx', 'addGuestsFromPeople, listPeopleYouCanInvite'],
  ];
  /* Guests › Setup's rows live in the shared guest-setup folder. */
  const setup = read(join(APP, 'dashboard', '[eventId]', '_components', 'guest-setup', 'guest-setup-rows.tsx'));
  assert.match(setup, /const \{ hubDraftAction, updatePaxSettings \} = useGuestActions\(\);/, 'Setup’s save no longer takes its writes from the context');
  assert.match(setup, /const \{ setGuestListFinalized \} = useGuestActions\(\);/, 'Finalize no longer takes its write from the context');
  assert.doesNotMatch(setup, /from '[^']*(?:hub-draft-actions|finalize-actions)'|from '\.\.\/\.\.\/actions'/, 'Setup imports a real action module again');
  for (const [file, names] of sites) {
    const src = read(join(GUESTS, file));
    assert.match(src, new RegExp(`const \\{ ${names} \\} = useGuestActions\\(\\);`), `${file} no longer takes ${names} from the context`);
    assert.doesNotMatch(src, /from '\.\.\/(?:groups-actions|inline-actions|quick-add-actions|people-add-actions)'|from '\.\.\/\.\.\/invitation\/actions'/, `${file} imports a real action module again`);
  }
  /* The removal rides its own context. */
  assert.match(read(join(GUESTS, 'guest-delete.tsx')), /useContext\(GuestRemovalActionsContext\) \?\? REAL_REMOVAL_ACTIONS/);
});

test('(3) nothing but the lab provides either context', () => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.ts$/.test(name) && /GuestActionsProvider|GuestActionsContext\.Provider|GuestRemovalActionsContext\.Provider/.test(read(p))) found.push(p.slice(APP.length + 1));
    }
  };
  walk(APP);
  assert.deepEqual(found.sort(), ['dashboard/[eventId]/guests/_components/guest-actions-context.tsx', 'dev/guests-lab/lab-guest-actions.tsx'], 'the app provides stand-ins');
});

test('(3b) the lab screen is drawn inside the stand-ins', () => {
  assert.match(read(join(HERE, 'page.tsx')), /<LabGuestActions refuse=\{sp\.refuse === '1'\}>[\s\S]*<GuestsScreen/);
});

test('(4) with ?refuse=1 Setup’s writes refuse in the database’s own words — on purpose, so the screen can be shown to say its own sentence', async () => {
  const r = LAB_SETUP_REFUSALS;
  assert.deepEqual(Object.keys(r).sort(), ['hubDraftAction', 'setGuestListFinalized', 'updatePaxSettings']);
  const a = await r.hubDraftAction!('e', new FormData());
  const b = await r.updatePaxSettings!(new FormData());
  const c = await r.setGuestListFinalized!('e', true);
  for (const words of [!a.ok && a.error, !b.ok && b.message, !c.ok && c.error]) {
    assert.ok(typeof words === 'string' && !isPlainSentence(words), `the lab’s Setup refusal reads as a sentence: ${words}`);
  }
});
