/**
 * details-your-event.test.ts — Details › Your event (part 2a) adapts to the
 * event type and edits in place through the shipped writers.
 *
 *   1. Which items an event shows, and every word they carry, come from the
 *      event type — a birthday and a wake read no wedding words (controller
 *      rule 2026-09-29, "THE PLAN ADAPTS TO EVERY EVENT TYPE — BUILT IN").
 *   2. Every editor saves through the writer its existing screen uses (+0
 *      server actions) and sends the couple nowhere (DECISION_LOG "NO 'GO EDIT
 *      IT OVER THERE' LINKS").
 *   3. The march reads ONE order — the invitation's, the print's, the panel's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE, type EventTypeProfile } from '@/lib/event-type-profile';
import { resolveRoleSet } from '@/lib/role-sets';
import {
  dateDisplayOf,
  marchOffered,
  parentsOffered,
  peopleLabels,
  yourEventDateLabel,
  yourEventDone,
  yourEventItems,
  yourEventLabel,
  yourEventUsedOn,
  type YourEventFacts,
  type YourEventKind,
} from './details-your-event';
import { DETAILS_ITEM_GROUPS } from './maker-details-items';

const BIRTHDAY: EventTypeProfile = {
  ...GENERIC_PROFILE,
  eventType: 'birthday',
  terminology: { ...GENERIC_PROFILE.terminology, organizerNoun: 'celebrant', eventWord: 'birthday', celebrantNoun: 'celebrant' },
};
const kindOf = (p: EventTypeProfile): YourEventKind => ({
  words: eventWordsFromProfile(p),
  offeredRoles: resolveRoleSet(p.roleSetKey).offeredRoles,
});
const WEDDING = kindOf(WEDDING_PROFILE);
const NON_WEDDINGS: Array<[string, YourEventKind]> = [
  ['birthday', kindOf(BIRTHDAY)],
  ['wake', kindOf(WAKE_PROFILE)],
];
const WEDDING_WORDS = /\b(wedding|couple|bride|groom|bridal|ninong|ninang|entourage)\b/i;

test('a wedding shows all five, in the navigator’s order, in the “Your event” group', () => {
  assert.deepEqual(yourEventItems(WEDDING), ['names', 'date', 'venues', 'parents', 'march']);
  assert.equal(yourEventLabel('march', WEDDING), 'Wedding march', 'the march is named from EventWords.eventWord');
  assert.equal(yourEventLabel('parents', WEDDING), 'Parents & hosts');
  assert.deepEqual(peopleLabels(WEDDING_PROFILE.terminology.personA, WEDDING_PROFILE.terminology.personB), ['Bride', 'Groom']);
  const group = DETAILS_ITEM_GROUPS.find((g) => g.group === 'event')!;
  assert.deepEqual([...group.keys], ['names', 'date', 'venues', 'parents', 'march']);
});

for (const [name, kind] of NON_WEDDINGS) {
  test(`a ${name} shows no wedding-only item and reads no wedding word`, () => {
    const items = yourEventItems(kind);
    assert.ok(!items.includes('names'), `${name}: no two named people, so no two-name box`);
    assert.ok(!items.includes('march'), `${name}: its role set prints no entourage, so no march`);
    assert.ok(!parentsOffered(kind) && !marchOffered(kind));
    assert.deepEqual(items, ['date', 'venues', 'parents']);
    const said = [
      ...items.map((k) => yourEventLabel(k, kind)),
      ...items.flatMap((k) => yourEventUsedOn(k, kind)),
      yourEventDateLabel(kind.words),
    ].join(' · ');
    assert.doesNotMatch(said, WEDDING_WORDS, `${name} reads: ${said}`);
    assert.equal(yourEventLabel('parents', kind), 'Hosts');
    assert.equal(peopleLabels(null, null), null);
  });
}

test('the date label is the event’s own word; a solemn event is never promised a countdown', () => {
  assert.equal(yourEventDateLabel(eventWordsFromProfile(BIRTHDAY)), 'Birthday date');
  assert.equal(yourEventDateLabel(WEDDING.words), 'Wedding date');
  assert.ok(yourEventUsedOn('date', WEDDING).includes('The countdown'));
  assert.ok(!yourEventUsedOn('date', kindOf(WAKE_PROFILE)).some((s) => /countdown/i.test(s)));
});

test('"done" is read from what is stored — never a new column', () => {
  const f: YourEventFacts = { names: ['Claire', ''], date: { value: '2026-12-12', dayPrecise: false }, venueCount: 0, parentCount: 0, hostCount: 1, marchLines: 0 };
  assert.equal(yourEventDone('names', f), false, 'one name is not both');
  assert.equal(yourEventDone('names', { ...f, names: ['Claire', 'Indalecio'] }), true);
  assert.equal(yourEventDone('date', f), false, 'a month is not yet a day');
  assert.equal(yourEventDone('date', { ...f, date: { value: '2026-12-12', dayPrecise: true } }), true);
  assert.equal(yourEventDone('venues', f), false);
  assert.equal(yourEventDone('parents', f), true, 'a host is enough — parents are optional');
  assert.equal(yourEventDone('march', f), false);
  assert.equal(dateDisplayOf('2026-12-12', 'day'), 'December 12, 2026');
  assert.equal(dateDisplayOf('2026-12-01', 'month'), 'December 2026');
  assert.equal(dateDisplayOf(null, 'day'), null);
});

// ── by source: the writers, the in-place rule, the one order ─────────────────

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components/';
const EDITORS = read(`${L}details-your-event.tsx`);
const PARTS = read(`${L}details-your-event-parts.tsx`);
const LOAD = read(`${L}details-your-event-load.tsx`);

test('every editor saves through the writer its own screen uses — +0 server actions', () => {
  assert.doesNotMatch(EDITORS, /['"]use server['"]/);
  assert.match(EDITORS, /makerSave\(\(\) => updateEventMatchCriteria\(fd\), requestMakerRefresh\)/, 'names: the Personalization writer');
  // That writer clears region and feel when absent — they go back unchanged.
  assert.match(EDITORS, /fd\.set\('region', keep\.region\)/);
  assert.match(EDITORS, /fd\.set\('mood_feel_key', keep\.feel\)/);
  assert.match(EDITORS, /<GovernedFields[\s\S]*?only=\{\['date'\]\}[\s\S]*?proposal=\{proposal\}/, 'date: the governed row, conflict preview and all');
  assert.match(EDITORS, /await updateEventDate\(fd\)/, 'a month goes through the same date writer');
  assert.match(EDITORS, /makerSave\(\(\) => saveAllStdContent\(eventId, data\), requestMakerRefresh\)/, 'venues: the typed names the hub already reads');
  assert.match(EDITORS, /const data: Parameters<typeof saveAllStdContent>\[1\] = \{ launchDate \}/, 'the launch date is posted back, never cleared');
  assert.match(EDITORS, /<FindYourDate eventId=\{eventId\} matrix=\{m\} embedded=/, '"Help me choose" is the shipped Find your date');
});

test('nothing in Your event sends the couple elsewhere to finish it', () => {
  for (const [name, src] of [['editors', EDITORS], ['parts', PARTS]] as const) {
    assert.doesNotMatch(src, /<Link\b|href=|↗/, `${name}: a link-out`);
  }
  const finder = read('app/dashboard/[eventId]/find-date/_components/find-your-date.tsx');
  const embedded = finder.slice(finder.indexOf('if (embedded) {'), finder.indexOf('if (!matrix.hasDate) {', finder.indexOf('if (embedded) {') + 20));
  assert.doesNotMatch(embedded, /<Link\b/, 'in place, the finder links nowhere');
  const governed = read('app/dashboard/[eventId]/details/_components/governed-fields.tsx');
  assert.match(governed, /\{embedded \? null : \(\s*<p className="text-\[11px\] text-ink\/50">\s*Need a flexible window/, 'in place, the date row drops "More date options"');
});

test('no typed wedding word in the Your event editors and parts', () => {
  // What a person reads: string literals and JSX text — not import paths.
  const strings = (src: string) =>
    [...src.replace(/^import[^;]*;$/gm, '').matchAll(/'[^'\n]*'|"[^"\n]*"|`[^`]*`|>[^<>{}]+</g)].map((m) => m[0]);
  const TYPED = /\b(wedding|couple|bride|groom|bridal)\b/i;
  for (const [name, src] of [['editors', EDITORS], ['parts', PARTS]] as const) {
    const hits = strings(src).filter((s) => TYPED.test(s));
    assert.deepEqual(hits, [], `${name} types a wedding word: ${hits.join(' | ')}`);
  }
});

test('the march reads ONE order: the invitation’s, The Entourage card’s, the panel’s', () => {
  assert.match(LOAD, /loadEntourage\(admin, eventId\)/, 'the aisle reads the invitation’s own loader');
  assert.match(LOAD, /<EntourageOrderPanel eventId=\{eventId\} view="all" \/>/, 'the order list is the shipped Guest list panel, moved in whole');
  const loaders = read('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /return buildEntourage\(\s*\(data \?\? \[\]\) as EntourageGuestRow\[\],\s*await loadEntourageSectionOrder\(admin, eventId\),/);
  assert.match(read('lib/print-set.server.ts'), /buildEntourage\(rows, await loadEntourageSectionOrder\(admin, eventId\)\)/);
  assert.match(read('app/dashboard/[eventId]/guests/_components/entourage-order-panel.tsx'), /orderedGroupKeys\(savedSections\)[\s\S]*?entourageLines\(rows, key\)/);
  // The guest's own line is built from the same groups the section prints.
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /marchPlace=\{isMakerCanvas \? null : marchPlaceOf\(entourage, guest\?\.guest_id\)\}/);
  const dress = read('app/[slug]/_components/dress-code-widget.tsx');
  assert.equal((dress.match(/You are \{/g) ?? []).length, 2, 'the role is named by the shipped "You are" line (and its march-only twin)');
  assert.equal((dress.match(/\{marchPlaceLine\(march\)\}/g) ?? []).length, 2, 'the march line sits under both');
});
