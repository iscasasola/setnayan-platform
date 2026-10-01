/**
 * THE WEDDING'S RITE REACHES THE DAY (P6a, 2026-10-01; audit
 * EVENT_TYPE_RELIGION_AUDIT_2026-09-30 §3 "Religion gaps" + §4 item 10).
 *
 * The rite was asked for at onboarding and then mostly reached only
 * /paperwork. This pins what now follows it, EXECUTED (not grepped) where the
 * logic is pure:
 *
 *  1. The checklist seeds Ninong & Ninang, and candle · veil · cord, only for
 *     rites that have them (the in-repo traditions guide): INC gets its ONE
 *     sponsor pair, civil its two witnesses, JW · LDS · SDA none of it.
 *  2. A mixed wedding keeps BOTH rites — the checklist and the dress note read
 *     `secondary_ceremony_type` too (a Catholic side keeps Pre-Cana; an INC
 *     side brings the modest-dress note).
 *  3. Details' "Wedding type" and the date finder honour the launch gate
 *     (`fetchActiveCeremonyTypes`), as onboarding does.
 *  4. The faith picker promises nothing nobody does ("pre-set halal",
 *     "pre-set alcohol-free").
 *  5. `buildScheduleSeed` has a caller (its db twin:
 *     tests/db/an-inc-wedding-has-no-cocktail-hour.db.test.ts).
 *
 * Sabotage (2026-10-01): `appliesTo: (ct) => !isMuslimCeremony(ct)` back on
 * choose_secondary_sponsors → test 1 red; dropping the secondary from
 * buildSeedRows → test 2 red; `ceremonyChoicesFor` returning `[...all]` → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { buildChecklistSeed } from './checklist';
import { ceremonyChoicesFor } from './ceremony-choices';
import { dressRiteOf } from './chinese-wedding';
import { FAITH_REGISTRY } from './faith-registry';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const keys = (rite: string | null, secondary: string | null = null) =>
  new Set(buildChecklistSeed('e1', rite, secondary).map((r) => r.template_key));

test('1 · sponsor, candle · veil · cord tasks follow the rite', () => {
  const catholic = keys('catholic');
  for (const k of ['invite_sponsors', 'choose_secondary_sponsors', 'sponsors']) assert.ok(catholic.has(k), `catholic lost ${k}`);

  const inc = keys('inc');
  assert.ok(inc.has('inc_invite_sponsor_pair'), 'INC lost its one sponsor pair');
  assert.ok(!inc.has('invite_sponsors'), 'INC is still told to invite many sponsors');
  assert.ok(!inc.has('choose_secondary_sponsors'), 'INC is still seeded candle · veil · cord');

  const civil = keys('civil');
  assert.ok(civil.has('choose_witnesses'));
  for (const k of ['invite_sponsors', 'choose_secondary_sponsors', 'sponsors']) assert.ok(!civil.has(k), `civil is seeded ${k}`);

  for (const rite of ['jw', 'lds', 'sda', 'muslim']) {
    const got = keys(rite);
    for (const k of ['invite_sponsors', 'choose_secondary_sponsors', 'sponsors', 'inc_invite_sponsor_pair']) {
      assert.ok(!got.has(k), `${rite} is seeded ${k}`);
    }
  }
  // Unset stays permissive (don't hide guidance prematurely).
  assert.ok(keys(null).has('choose_secondary_sponsors'));
});

test('2 · a mixed wedding keeps both rites', () => {
  assert.ok(keys('mixed', 'catholic').has('pre_cana'), 'a Catholic side lost Pre-Cana');
  assert.ok(keys('mixed', 'inc').has('inc_lokal_coordinate'), 'an INC side lost its lokal step');
  assert.ok(!keys('mixed', null).has('inc_lokal_coordinate'));
  assert.equal(dressRiteOf({ ceremony_type: 'mixed', secondary_ceremony_type: 'inc' }), 'inc');
  assert.equal(dressRiteOf({ ceremony_type: 'mixed', secondary_ceremony_type: 'muslim' }), 'muslim');
  assert.equal(dressRiteOf({ ceremony_type: 'catholic', secondary_ceremony_type: 'chinese' }), 'catholic');
  // Every mount of the dress-code scene dresses for both columns.
  for (const f of ['app/[slug]/_components/public-hideable-widget.tsx', 'app/[slug]/_components/hideable-widget-render.tsx']) {
    assert.match(read(f), /<DressCodeWidget[^>]*ceremonyType=\{dressRiteOf\(event\)\}/, `${f} reads one rite`);
  }
  assert.equal((read('app/[slug]/_components/site-body.tsx').match(/ceremonyType: dressRiteOf\(event\)/g) ?? []).length, 2);
  assert.match(read('app/dashboard/[eventId]/checklist-actions.ts'), /buildChecklistSeed\(eventId, ceremonyType, secondaryCeremonyType\)/);
});

test('3 · the ceremony pickers honour the launch gate', () => {
  const all = ['catholic', 'civil', 'jewish', 'hindu', 'mixed'] as const;
  assert.deepEqual(ceremonyChoicesFor(all, ['catholic', 'civil'], null), ['catholic', 'civil', 'mixed']);
  assert.deepEqual(ceremonyChoicesFor(all, ['catholic'], 'hindu'), ['catholic', 'hindu', 'mixed'], 'the current rite must stay pickable');
  assert.deepEqual(ceremonyChoicesFor(all, null, null), [...all], 'a failed read must never hide every rite');

  // The governed editors moved whole to /details/change ("Event settings") when
  // /details became the information-only Event Details sheet (#6247).
  const details = read('app/dashboard/[eventId]/details/change/page.tsx');
  assert.match(details, /activeCeremonies=\{await fetchActiveCeremonyTypes\(supabase\)\}/);
  assert.match(read('app/dashboard/[eventId]/details/_components/governed-fields.tsx'), /CEREMONY_OPTIONS\.filter\(\(o\) => offeredCeremonies\.has\(o\.value\)\)/);
  const date = read('app/dashboard/[eventId]/date-selection/page.tsx');
  assert.match(date, /activeCeremonies=\{activeCeremonies\}/);
  assert.match(read('app/dashboard/[eventId]/date-selection/_components/four-question-flow.tsx'), /offered\.has\(o\.value\)/);
});

test('4 · the faith picker promises nothing nobody does', () => {
  for (const f of FAITH_REGISTRY) {
    assert.doesNotMatch(f.react, /pre-set/i, `${f.key}: "${f.react}"`);
  }
});

test('5 · buildScheduleSeed has a caller again', () => {
  assert.match(read('app/dashboard/[eventId]/schedule/actions.ts'), /const seed = buildScheduleSeed\(/);
});
