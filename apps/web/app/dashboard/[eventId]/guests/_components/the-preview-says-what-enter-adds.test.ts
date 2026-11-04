/**
 * the-preview-says-what-enter-adds.test.ts — THE LINE UNDER THE ADD BOX SAYS WHAT ENTER WILL ADD (owner 2026-11-01:
 * *"A live preview line under the box shows what will be added before Enter"*; his example
 * `Mr. Roman Atkinson +2 +Groomsmen` → Mr. Roman Atkinson, 2 plus-ones, role Groomsman).
 *
 *   1 · the owner's line previews as "→ Mr. Roman Atkinson · +2 · Groomsman · #Barkada";
 *   2 · what Enter SENDS is that same draft — title in the prefix, +2, the groomsman role, the group — through the real
 *       queue and the real server core (`runAddSingleGuest`), so the preview cannot promise what the add drops;
 *   3 · a role this event does not offer is never previewed as one (it is a group there, and is sent as one);
 *   4 · both add boxes draw the preview: the Guests search box (under its Add) and the add sheet's name box.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { createAddQueue, picksForAdd, queueTypedGuest, typedGuestPreview } from './guest-add-queue';
import { runAddSingleGuest } from '@/lib/add-single-guest-core';
import type { ParsedGuestDraft } from '@/lib/guest-parse';
import { WEDDING_ROLE_SET, resolveRoleSet } from '@/lib/role-sets';
import type { QuickAddResult } from '../quick-add-actions';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const WEDDING = { offeredRoles: WEDDING_ROLE_SET.offeredRoles };
const LINE = 'Mr. Roman Atkinson +2 +Groomsmen #Barkada';

test("the owner's line previews as name · +2 · Groomsman · #Barkada", () => {
  assert.equal(typedGuestPreview(LINE, 'both', WEDDING), '→ Mr. Roman Atkinson · +2 · Groomsman · #Barkada');
  assert.equal(typedGuestPreview('', 'both', WEDDING), null);
  assert.equal(typedGuestPreview('Maria', 'both', WEDDING), '→ Maria · add a last name');
  assert.equal(typedGuestPreview('Ana Cruz groom', 'both', WEDDING), '→ Ana Cruz · Groom’s side');
});

test('the couple’s word for the role is the word previewed', () => {
  const picks = { ...WEDDING, roleNames: { groomsman: { one: "Groom's Crew" } } };
  assert.equal(typedGuestPreview('Roman Atkinson +GroomsCrew', 'both', picks), "→ Roman Atkinson · Groom's Crew");
});

test('what Enter sends is the previewed draft — through the real queue and the real server core', async () => {
  const q = createAddQueue({ schedule: (fn) => fn() });
  const sent: ParsedGuestDraft[] = [];
  const inserted: Record<string, unknown>[] = [];
  const add = async (_e: string, d: ParsedGuestDraft): Promise<QuickAddResult> => {
    sent.push(d);
    return runAddSingleGuest('e', d, {
      createGroup: async (_eid: string, name: string) => ({ ok: true, group: { group_id: `g-${name}`, label: name } }) as never,
      addGuest: async (_eid: string, input: unknown) => {
        inserted.push(input as Record<string, unknown>);
        return { ok: true, guest: { guest_id: 'G1' } } as never;
      },
      resolveOfferedRoles: async () => WEDDING_ROLE_SET.offeredRoles,
      attachMembership: async () => {},
      setPlusOne: async () => {},
      deleteEmptyGroup: async () => {},
      revalidate: () => {},
    } as never);
  };
  const picks = picksForAdd({ side: 'both', role: 'guest', category: null, groupIds: [], plus: 0 }, [], null, WEDDING.offeredRoles);
  assert.ok(queueTypedGuest('e', LINE, 'both', add, q, picks).ok);
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent.length, 1);
  const d = sent[0]!;
  assert.equal(d.prefix, 'Mr.');
  assert.equal(`${d.firstName} ${d.lastName}`, 'Roman Atkinson');
  assert.equal(d.plusOnes, 2);
  assert.equal(d.roleHint, 'groomsman');
  assert.deepEqual(d.groups, ['Barkada']);
  const row = inserted[0]!;
  assert.equal(row.name_prefix ?? row.prefix, 'Mr.', `the title is not stored as the title: ${JSON.stringify(row)}`);
  assert.equal(row.role, 'groomsman', `the server did not keep the role: ${JSON.stringify(row)}`);
});

test('a role this event does not offer is not previewed as one — it is a group there, and sent as one', () => {
  const generic = { offeredRoles: resolveRoleSet(null).offeredRoles };
  assert.equal(typedGuestPreview('Ana Cruz +Groomsmen', 'both', generic), '→ Ana Cruz · #Groomsmen');
  // A bare keyword the server drops to Guest ("vip" on a wedding) is not promised either.
  assert.equal(typedGuestPreview('Ana Cruz vip', 'both', WEDDING), '→ Ana Cruz');
});

test('both add boxes draw the preview from the same draft their add sends', () => {
  const bar = read('capture-bar.tsx');
  assert.match(bar, /typedGuestPreview\(value, defaultSide, typed\)/, 'the add sheet’s box does not compute the preview');
  assert.match(bar, /queueTypedGuest\(eventId, value, defaultSide, addSingleGuest, guestAdds, typed\)/, 'the box’s add is not sent with the same roles as its preview');
  assert.match(bar, /<AddPreviewLine text=/, 'the add sheet’s box does not draw the preview');
  const screen = read('guests-screen.tsx');
  assert.match(screen, /<SearchAddRow [^>]*preview=\{typedPreview\}/, 'the search box’s Add does not carry the preview');
  assert.match(screen, /<AddPreviewLine text=\{typedPreview\}/, 'the no-match Add does not carry the preview');
  assert.match(screen, /typedGuestPreview\(q, addPicks\.side, picksForAdd\(addPicks, allGroups, roleNames, offeredRoles\)\)/);
  assert.match(screen, /queueTypedGuest\(eventId, v, addPicks\.side, addSingleGuest, guestAdds, picksForAdd\(addPicks, allGroups, roleNames, offeredRoles\)\)/, 'Enter is not sent with the roles the preview read');
  const queue = read('guest-add-queue.ts');
  assert.match(queue, /export function queueTypedGuest[\s\S]{0,700}typedDraft\(raw, defaultSide, picks\)/, 'Enter does not use the preview’s draft');
});
