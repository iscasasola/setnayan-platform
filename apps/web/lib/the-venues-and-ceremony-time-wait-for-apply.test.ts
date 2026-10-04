/**
 * the-venues-and-ceremony-time-wait-for-apply.test.ts — B4 (owner 2026-10-01
 * DECISION_LOG "THE MAKER'S VENUES GET A REAL PIN AND A PICKED CITY", "NOTHING
 * TAKES EFFECT UNTIL APPLY"; 2026-10-04 "YES TO ALL" on the approved
 * `prototypes/maker_venues_pin_and_time_2026-10-04_fable.html`).
 *
 * The schema half (a save writes no `events` row; Apply writes the venues and
 * both pins; the Ceremony block is created / moved / follows the date) is
 * proven as the couple's own session in
 * `tests/db/venues-and-ceremony-time-wait-for-apply.db.test.ts`. Held here:
 *
 *   1. the draft holds the venues, both pins and the ceremony time — each
 *      through its writer's own bound — and counts the venues as ONE change;
 *   2. the invitation's preview prints the DRAFTED ceremony time before Apply
 *      ("Ceremony at 3:00 PM"), from the same placement Apply makes;
 *   3. the city is a CLOSED pick — onboarding's list, or refused at the door;
 *   4. AddressPinField's two hint lines are hidden in the Maker ONLY;
 *   5. opening any of these never writes, and nothing in them writes live;
 *   6. the ceremony's own pin reaches guests' Directions and closes until they reply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HUB_DRAFT_CEREMONY_TIME,
  HUB_DRAFT_EVENT_READ_COLUMNS,
  HUB_DRAFT_VENUE_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftWidgets,
  planHubDraftApply,
  summarizeHubDraft,
} from './hub-draft';
import { blockTime, ceremonyBlock } from './print-pieces';
import { blocksWithDraftedCeremony, printDraftOf } from './ceremony-time';
import { isListedPlaceName } from './listed-place';
import { resolveEventVenues } from './event-venues';
import { withheldVenue } from './venue-disclosure';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const L = 'app/dashboard/[eventId]/launch/_components/';
const EDITORS = read(`${L}details-your-event.tsx`);
const CITY = read(`${L}details-city-pick.tsx`);
const PIN = read('app/dashboard/[eventId]/_components/address-pin-field.tsx');

// ── 1 · the draft ────────────────────────────────────────────────────────────

test('the draft holds every venue column, both pins and the ceremony time — through their own bounds', () => {
  const d = mergeHubDraft(emptyHubDraft(), {
    events: {
      std_film_venue_name: '  Blackbird  ',
      venue_address: 'x'.repeat(400),
      venue_latitude: '14.554123456789',
      venue_longitude: 121.02451,
      ceremony_venue_latitude: 91, // off the globe — dropped
      std_film_venue_city: 'Makati',
      ceremony_time: '15:00',
    },
  });
  assert.equal(d.events.std_film_venue_name, 'Blackbird');
  assert.equal((d.events.venue_address as string).length, 300, 'the address is held to its column’s 300');
  assert.equal(d.events.venue_latitude, 14.5541235, 'a pin is kept to the column’s 7 decimals');
  assert.equal('ceremony_venue_latitude' in d.events, false, 'a latitude off the globe reached the draft');
  assert.equal(d.events.ceremony_time, '15:00');
  for (const junk of ['3pm', '25:00', null, 1500]) {
    const j = mergeHubDraft(emptyHubDraft(), { events: { ceremony_time: junk } as never });
    assert.equal('ceremony_time' in j.events, false, `${String(junk)} reached the draft as a ceremony time`);
  }
  // The time is not an events column — no live read ever selects it.
  assert.equal((HUB_DRAFT_EVENT_READ_COLUMNS as readonly string[]).includes(HUB_DRAFT_CEREMONY_TIME), false);
  for (const c of HUB_DRAFT_VENUE_COLUMNS) assert.ok((HUB_DRAFT_EVENT_READ_COLUMNS as readonly string[]).includes(c));
});

test('the Apply badge counts the venues ONCE (columns and card choices), the ceremony time once', () => {
  const live = {
    events: { venue_latitude: '14.5541200', ceremony_time: null },
    widgets: [{ widget_id: 'w1', widget_type: 'venue_map' as const, is_always_on: false, display_order: 1, config_json: {}, mode: 'auto' as const }],
  };
  const d = mergeHubDraft(emptyHubDraft(), {
    events: { std_film_venue_name: 'Blackbird', venue_address: 'Ayala Triangle', venue_latitude: 14.55, venue_longitude: 121.02, ceremony_time: '15:00' },
    widgets: { venue_map: { venue: { reception: { source: 'own' } } } },
  });
  assert.equal(summarizeHubDraft(d, live as never, false).changeCount, 2);
  // "14.5541200" read back and 14.55412 drafted are ONE pin — nothing to write.
  const same = planHubDraftApply(mergeHubDraft(emptyHubDraft(), { events: { venue_latitude: 14.55412 } }), live as never, false);
  assert.equal(same.apply.length, 0);
  // The drafted card choice is what the host's canvas draws, card by card.
  const [row] = overlayHubDraftWidgets(live.widgets as never, d);
  assert.deepEqual((row!.config_json as Record<string, unknown>).venue, { reception: { source: 'own' } });
});

// ── 2 · the preview prints the drafted time ─────────────────────────────────

test('the invitation preview prints the DRAFTED ceremony time — creating or moving it as Apply will', () => {
  const blocks = [{ label: 'Guests arrive', block_type: 'arrival', start_at: '2031-03-13T13:30:00Z', parent_block_id: null }];
  const made = blocksWithDraftedCeremony(blocks, '15:00', '2031-03-13');
  assert.equal(blockTime(ceremonyBlock(made)), '3:00 PM', 'the preview does not read "Ceremony at 3:00 PM"');
  assert.equal(made[0], blocks[0], 'another block was touched');
  const moved = blocksWithDraftedCeremony([...blocks, { label: 'Ceremony', block_type: 'ceremony', start_at: '2031-03-13T14:00:00Z', parent_block_id: null }], '16:30', '2031-03-13');
  assert.equal(moved.filter((b) => b.block_type === 'ceremony').length, 1, 'a second Ceremony was drawn');
  assert.equal(blockTime(ceremonyBlock(moved)), '4:30 PM');
  assert.equal(blockTime(ceremonyBlock(blocksWithDraftedCeremony(blocks, '3pm', '2031-03-13'))), null, 'a junk time was printed');
  // The Maker names the drafted time in each preview's address; the route lays exactly those keys on.
  assert.deepEqual(printDraftOf({ ceremony_time: '15:00', site_bg_color: '#000000' }), { ceremony_time: '15:00' });
  assert.match(read(`${L}maker-prints.tsx`), /mode === 'screen' && draftVersion \? `&draft=\$\{draftVersion\}` : ''/);
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /mode !== 'print' && piece !== 'passes' && url\.searchParams\.get\('draft'\)/, 'a saved or printed file was drawn from a draft');
  assert.match(read('lib/print-set.server.ts'), /blocksWithDraftedCeremony\(liveBlocks, draft\.ceremony_time, draftDay\)/);
});

// ── 3 · the city is a closed pick ───────────────────────────────────────────

test('the City or area is a closed pick — onboarding’s list or nothing, refused at the draft door', () => {
  assert.equal(isListedPlaceName('Makati'), true);
  assert.equal(isListedPlaceName('Tagaytay'), true);
  assert.equal(isListedPlaceName('Quezon City'), true, 'a PSGC city is on the list');
  assert.equal(isListedPlaceName('Makati near the mall'), false);
  const action = stripComments(read('app/dashboard/[eventId]/website/hub-draft-actions.ts'));
  assert.match(action, /if \(typeof city === 'string' && city\.trim\(\) && !isListedPlaceName\(city\)\) \{\s*return \{ ok: false, intent, error: 'Pick the city or area from the list\.' \};/);
  // The editor has no box a city is typed into: the one search field only finds, a tap on a row picks.
  assert.doesNotMatch(EDITORS, /e\.g\. Quezon City|setCityValue\(e\.target\.value\)/, 'the city is free text again');
  assert.match(EDITORS, /<CityPick\b/);
  assert.match(CITY, /onPick\(c\.n\);/);
  assert.equal((stripComments(CITY).match(/onPick\(/g) ?? []).length, 1, 'something other than a listed row picks the city');
  assert.match(CITY, /from '@\/app\/onboarding\/wedding\/_data\/wedding-cities'/, 'not onboarding’s own list');
  assert.match(CITY, /import\('@\/app\/onboarding\/wedding\/_data\/ph-places'\)/, 'the PSGC list must load lazily, as onboarding loads it');
});

// ── 4 · the pin field's hints hidden in the Maker only ──────────────────────

test('AddressPinField hides its two hint lines behind a prop — set in the Maker, never on the manual sheet', () => {
  const pin = stripComments(PIN);
  assert.match(pin, /\{hideHints \? null : \(\s*<p className="text-\[10px\] text-ink\/45">\s*\{required \? MANUAL_VENUE_ADDRESS_HINT/);
  assert.match(pin, /\{pin \|\| !hideHints \? \(/, 'the unpinned "Drag the map…" line still shows in the Maker');
  assert.match(pin, /hideHints = false,/, 'the default must show them');
  assert.match(EDITORS, /<AddressPinField[\s\S]{0,200}hideHints[\s\S]{0,80}onChange=\{\(next\) => edit\(s\.slot, next\)\}/);
  assert.doesNotMatch(read('app/dashboard/[eventId]/_components/new-manual-vendor-modal.tsx'), /hideHints/, 'the manual sheet lost its hints');
});

// ── 5 · opening never writes; nothing writes live ───────────────────────────

test('opening Venues or Date writes nothing, and nothing in them writes live', () => {
  const src = stripComments(EDITORS);
  // The ONE effect is AutoDraft's (owner 2026-10-05: no Save) — and it sends only a CHANGE, never what was drawn.
  assert.equal((src.match(/useEffect\(/g) ?? []).length, 1, 'an editor that saves on open');
  assert.match(src, /function AutoDraft\([\s\S]{0,400}useEffect\(\(\) => \{\s*if \(watch === sent\.current\) return;/, 'AutoDraft would send what it was drawn with');
  assert.doesNotMatch(src, /saveAllStdContent|HubSavesImmediately/, 'a live write from inside the Maker');
  // CityPick's only effects load the place list.
  const effects = [...stripComments(CITY).matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)].map((m) => m[1]!);
  assert.ok(effects.length >= 1);
  for (const e of effects) assert.doesNotMatch(e, /onPick|hubDraftAction|draft/i, 'opening the city list writes');
  // The ceremony time is drafted, and says when guests see it.
  assert.match(src, /draftFacts\(eventId, \{ ceremony_time: time \}\)/);
  assert.match(src, /<input\s+type="time"/, 'the phone’s own time picker');
});

// ── 6 · guests' Directions use the ceremony pin, closed until they reply ────

test('the ceremony’s own pin reaches the venue list — and closes until the guest replies', () => {
  const [ceremony] = resolveEventVenues(
    { ceremony: null, reception: null },
    { std_film_ceremony_name: 'San Agustín Church', ceremony_venue_latitude: '14.5888000', ceremony_venue_longitude: 120.9755 },
  );
  assert.equal(ceremony?.latitude, 14.5888);
  assert.equal(ceremony?.longitude, 120.9755);
  const shut = withheldVenue({ ceremony_venue_latitude: 14.5888, ceremony_venue_longitude: 120.9755, venues: [ceremony!] });
  assert.equal(shut.ceremony_venue_latitude, null, 'the ceremony pin leaks before the reply');
  assert.equal(shut.ceremony_venue_longitude, null);
  assert.equal(shut.venues?.[0]?.latitude, null);
  for (const f of ['app/[slug]/_lib/loaders.ts', 'app/[slug]/hub/page.tsx', 'lib/guest-reminder-emails.ts']) {
    assert.match(read(f), /ceremony_venue_latitude, ceremony_venue_longitude/, `${f} does not read the ceremony pin`);
  }
});
