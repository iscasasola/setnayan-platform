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
  assert.equal(yourEventLabel('march', WEDDING), 'Wedding March', 'the march is named from EventWords.eventWord');
  assert.equal(yourEventLabel('parents', WEDDING), 'Parents & hosts');
  assert.deepEqual(peopleLabels(WEDDING_PROFILE.terminology.personA, WEDDING_PROFILE.terminology.personB), ['Bride', 'Groom']);
  const group = DETAILS_ITEM_GROUPS.find((g) => g.group === 'event')!;
  // …then the Seat plan (Details part 4 — the seating editor moved in; its own
  // rule, `the-seat-plan-moves-into-details.test.ts`).
  assert.deepEqual([...group.keys], ['names', 'date', 'venues', 'parents', 'march', 'seating']);
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
  // "Help me choose" is the shipped finder's ranking and words, in the three parts.
  const finder = read(`${L}details-date-finder.tsx`);
  assert.match(finder, /from '\.\.\/\.\.\/find-date\/_components\/find-your-date'/);
  assert.match(finder, /rankWithPin\(m\.dates, pinned\)/);
  assert.match(EDITORS, /<FindDatePicked matrix=\{matrix\}/, 'the picked day and "Use" are on the right');
  assert.match(EDITORS, /<FindDateCandidates matrix=\{matrix\} \/>/, 'the candidate days are in the middle');
});

test('nothing in Your event sends the couple elsewhere to finish it', () => {
  for (const [name, src] of [['editors', EDITORS], ['parts', PARTS]] as const) {
    assert.doesNotMatch(src, /<Link\b|href=|↗/, `${name}: a link-out`);
  }
  for (const f of ['details-date-finder.tsx', 'details-march.tsx', 'details-people.tsx']) {
    assert.doesNotMatch(read(`${L}${f}`), /<Link\b|href=|↗/, `${f}: a link-out`);
  }
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
  assert.equal((dress.match(/You are \{/g) ?? []).length, 1, 'the role is named by the ONE shipped "You are" line');
  assert.equal((dress.match(/\{marchPlaceLine\(march\)\}/g) ?? []).length, 1, 'the march line sits under it');
  assert.match(dress, /\{mine \|\| march \? \(/, 'a walker with no outfit line still gets the panel');
});

test('"Leave the other side blank" happens IN PLACE — the Guest list’s own unpair, no navigation', () => {
  const actions = read('app/dashboard/[eventId]/guests/pair-actions.ts');
  const unpair = actions.slice(actions.indexOf('export async function unpairGuestAction('));
  assert.match(unpair, /const inPlace = mode === 'in-place';/);
  // In place, a refusal is THROWN (said by the caller) and success RETURNS — both before any redirect.
  assert.match(unpair, /if \(inPlace\) throw new Error\([^)]*\);\s*redirect\(/);
  assert.match(unpair, /if \(inPlace\) \{[\s\S]*?return;\s*\}\s*redirect\(backToList\(eventId, \{ unpaired: '1' \}\)\);/);
  // The Maker calls that same action, through the Maker's one refresh.
  const march = read(`${L}details-march.tsx`);
  assert.match(march, /import \{ unpairGuestAction \} from '\.\.\/\.\.\/guests\/pair-actions';/);
  assert.match(march, /await unpairGuestAction\(eventId, pairIds\[0\]!, 'in-place'\);/);
  assert.match(march, /Leave the other side blank/);
  // …and the Guest list's row form still binds two arguments, so it keeps its redirect.
  const roster = read('app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx');
  assert.match(roster, /unpairGuestAction\.bind\(null, eventId, guest\.guest_id\)\}/);
});

test('/find-date lands on Details › Date with "Help me choose" open — for a couple whose event has an Event Hub', () => {
  const page = read('app/dashboard/[eventId]/find-date/page.tsx');
  assert.match(page, /\.eq\('member_type', 'couple'\)/);
  assert.match(page, /if \(coupleRes\.data && surfaceEnabled\(profile, 'website'\)\) \{\s*redirect\(detailsItemHref\(eventId, 'date', '&date=help'\)\);/);
  // Everyone else keeps the page.
  assert.match(page, /return <FindYourDate eventId=\{eventId\} matrix=\{matrix\} \/>;/);
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /helpFirst: one\(search\.date\) === 'help',/);
  // Both halves of the date item open on the same mode.
  assert.equal((EDITORS.match(/useDateState\(helpFirst\)/g) ?? []).length, 2);
  // …through part 3's one piece mechanism, under the item's own key.
  const finder = read(`${L}details-date-finder.tsx`);
  assert.match(finder, /useDetailsPiece\('date'\)/);
  assert.match(finder, /if \(!piece\) return \{ mode: helpFirst \? 'help' : 'have', pick: null, pin: null \};/);
});
