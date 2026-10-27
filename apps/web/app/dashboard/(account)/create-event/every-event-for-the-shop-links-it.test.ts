/**
 * GUARD — every event created "for" a shop is the shop's (owner 2026-10-22, "yes").
 *
 * A shop's business alaga (`dependents.dependent_kind = 'business'`, written when
 * the shop opens — lib/business-alaga.ts) is offered in the create picker's
 * "For ▾". Until today the server linked it (`events.honoree_dependent_id`) only
 * on the five life types + corporate · gala night, and DROPPED it on every other
 * type the picker offered for it: a celebration, a tournament, a trip "for" the
 * shop was created and was never filed under the shop.
 *
 * THE PROPERTY, asserted over the whole type roster plus an admin-added type the
 * code has never heard of: for EVERY type the grid offers for a business alaga,
 *   (1) the picker draws the field that posts the alaga (`pickerAsksHonoree`),
 *   (2) what it posts is that alaga's name + record id, and
 *   (3) the server's one answer for every create door (`resolveEventHonoree`)
 *       writes `honoree_dependent_id = that alaga`.
 * And the two things it must not move: a PERSON on a type outside the named
 * lists is still dropped, label and all; a WEDDING names nobody.
 *
 * Then the WIRING: a property proved on a helper nobody calls is green and
 * worthless, so each of the three create doors is held to calling it and
 * writing what it returns.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ANCHOR_BY_TYPE } from '@/lib/event-anchor';
import { LIFE_GATE_BY_TYPE } from '@/lib/life-event-gate';
import {
  BUSINESS_HONOREE_TYPES,
  eventTypeAcceptsHonoreeLink,
  pickerAsksHonoree,
  resolveEventHonoree,
} from '@/lib/honoree-dependent-link';
import {
  dependentSubjects,
  gridHiddenTypes,
  subjectHonoreeDependentId,
  subjectHonoreeLabel,
} from '@/lib/create-subjects';

const OWNER = 'user-owner';
const SHOP_ID = '11111111-2222-4333-8444-555555555555';
const PERSON_ID = '22222222-2222-4333-8444-555555555555';
const TODAY = '2026-10-22';

type DepRow = { dependent_id: string; name: string; dependent_kind: string; owner_user_id: string };
const ROWS: DepRow[] = [
  { dependent_id: SHOP_ID, name: 'Aling Nena’s Store', dependent_kind: 'business', owner_user_id: OWNER },
  { dependent_id: PERSON_ID, name: 'Lola Nena', dependent_kind: 'person', owner_user_id: OWNER },
];

/** PostgREST-shaped fake honouring exactly the filters the resolver sends. */
function fakeAdmin() {
  return () =>
    ({
      from(table: string) {
        const f: Record<string, unknown> = {};
        const b = {
          select: () => b,
          eq(c: string, v: unknown) {
            f[c] = v;
            return b;
          },
          is(c: string, v: unknown) {
            f[c] = v;
            return b;
          },
          async maybeSingle() {
            if (table !== 'dependents') return { data: null, error: null };
            const hit = ROWS.find((r) => r.dependent_id === f.dependent_id && r.owner_user_id === f.owner_user_id);
            return { data: hit ?? null, error: null };
          },
        };
        return b;
      },
    }) as never;
}

/** Every type the code knows, every life/business type, and one an admin added. */
const ROSTER = [
  ...new Set([
    ...Object.keys(ANCHOR_BY_TYPE),
    ...Object.keys(LIFE_GATE_BY_TYPE),
    ...BUSINESS_HONOREE_TYPES,
    'an_admin_added_type',
  ]),
];

const subjects = dependentSubjects(
  ROWS.map((r) => ({ ...r, birth_date: null, sex: null })),
  OWNER,
);
const shop = subjects.find((s) => s.kind === 'business')!;
const person = subjects.find((s) => s.kind === 'person')!;

test('the roster is real — a property over nothing proves nothing', () => {
  assert.ok(ROSTER.length >= 15, `only ${ROSTER.length} types`);
  assert.ok(shop && person, 'both subjects must build from their rows');
});

test('EVERY type offered for a shop is created as the shop’s', async () => {
  const hidden = gridHiddenTypes(shop, [], TODAY);
  const offered = ROSTER.filter((t) => !hidden.includes(t));
  // The widened set must actually be in play, not only the old named types.
  for (const t of ['celebration', 'tournament', 'travel', 'hangout', 'an_admin_added_type']) {
    assert.ok(offered.includes(t), `${t} should be offered for a business`);
  }
  const misses: string[] = [];
  for (const eventType of offered) {
    if (!pickerAsksHonoree(eventType, shop.kind)) {
      misses.push(`${eventType}: the picker posts no alaga`);
      continue;
    }
    const posted = { label: subjectHonoreeLabel(shop), id: subjectHonoreeDependentId(shop) };
    assert.equal(posted.id, SHOP_ID);
    const got = await resolveEventHonoree(fakeAdmin(), {
      userId: OWNER,
      eventType,
      honoreeLabel: posted.label,
      dependentId: posted.id,
    });
    if (got.honoreeDependentId !== SHOP_ID) misses.push(`${eventType}: honoree_dependent_id = ${got.honoreeDependentId}`);
    else if (got.honoreeLabel !== shop.name) misses.push(`${eventType}: honoree_label = ${got.honoreeLabel}`);
  }
  assert.deepEqual(misses, [], 'an event created for the shop was not filed under it');
});

test('a PERSON keeps their own rules — dropped, label and all, where only a shop may be named', async () => {
  for (const eventType of ROSTER) {
    const got = await resolveEventHonoree(fakeAdmin(), {
      userId: OWNER,
      eventType,
      honoreeLabel: subjectHonoreeLabel(person),
      dependentId: subjectHonoreeDependentId(person),
    });
    if (eventTypeAcceptsHonoreeLink(eventType)) {
      assert.equal(got.honoreeDependentId, PERSON_ID, `${eventType} still links a person`);
    } else {
      assert.deepEqual(got, { honoreeLabel: null, honoreeDependentId: null }, `${eventType} must not name a person`);
      assert.equal(pickerAsksHonoree(eventType, person.kind), false, `${eventType} must not ask about a person`);
    }
  }
});

test('a wedding names nobody — not a person, not a shop', async () => {
  for (const subject of [shop, person]) {
    assert.equal(pickerAsksHonoree('wedding', subject.kind), false);
    const got = await resolveEventHonoree(fakeAdmin(), {
      userId: OWNER,
      eventType: 'wedding',
      honoreeLabel: subjectHonoreeLabel(subject),
      dependentId: subjectHonoreeDependentId(subject),
    });
    assert.deepEqual(got, { honoreeLabel: null, honoreeDependentId: null });
  }
});

test('a forged shop id is still refused on a widened type', async () => {
  const got = await resolveEventHonoree(fakeAdmin(), {
    userId: 'somebody-else',
    eventType: 'tournament',
    honoreeLabel: shop.name,
    dependentId: SHOP_ID,
  });
  assert.deepEqual(got, { honoreeLabel: null, honoreeDependentId: null });
});

// ── THE WIRING — every create door asks the one answer and writes it ─────────

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const DOORS = {
  inline: 'app/dashboard/(account)/create-event/actions.ts',
  wizard: 'app/onboarding/_shared/commit-event.ts',
  simple: 'app/onboarding/simple/actions.ts',
} as const;

test('each create door calls resolveEventHonoree once and writes what it returns', () => {
  for (const [door, path] of Object.entries(DOORS)) {
    const src = read(path);
    assert.equal(count(src, /await resolveEventHonoree\(/g), 1, `${door}: must ask the one answer exactly once`);
    // Nobody may re-gate on the narrow predicate in front of it — that is the
    // exact line that dropped the shop on every other type.
    assert.equal(count(src, /eventTypeAcceptsHonoreeLink\(/g), 0, `${door}: re-gates on the narrow predicate`);
  }
  const inline = read(DOORS.inline);
  assert.match(inline, /honoreeLabel: honoree_label, honoreeDependentId: honoree_dependent_id \}\s*=\s*await resolveEventHonoree/);
  assert.match(inline, /\n\s+honoree_label,\n/);
  assert.match(inline, /\n\s+honoree_dependent_id,\n/);
  const wizard = read(DOORS.wizard);
  assert.match(wizard, /\{ \.\.\.payload, displayName, honoreeLabel, honoreeDependentId \}/,
    'the wizard must overwrite BOTH halves with the server answer, never the wire');
  const simple = read(DOORS.simple);
  assert.match(simple, /\n\s+honoree_label,\n\s+honoree_dependent_id,\n/, 'the Get-together insert must write the link');
});

test('the collecting surfaces post the shop on the widened types', () => {
  assert.match(
    read('app/dashboard/(account)/create-event/_components/event-type-picker.tsx'),
    /(?:\{|: )pickerAsksHonoree\(selected\.key, subject\?\.kind\) && !samahanCommunityId \? \(/,
    'the inline picker must draw the field for a shop on every offered type',
  );
  const wizard = read('app/onboarding/[type]/_components/generic-onboarding.tsx');
  assert.match(wizard, /honoreeDependentId: asksHonoree \? honoreeDependentId : carriedLink\?\.dependentId \?\? null,/);
  assert.match(wizard, /honoreeLabel: asksHonoree \? honoree\.trim\(\) \|\| null : carriedLink\?\.name \?\? null,/);
  assert.match(read('app/onboarding/simple/page.tsx'), /<CarriedHonoreeFields \/>/);
});
