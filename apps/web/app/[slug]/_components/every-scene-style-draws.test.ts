/**
 * EVERY SCENE'S B AND C STYLES DRAW — AND DRAW ONLY THE SCENE'S OWN DATA.
 *
 * Owner 2026-09-29, "EVERY SCENE ON EVERY STAGE HAS AT LEAST THREE PREMADE
 * STYLES"; approved design `prototypes/every_scene_three_styles_2026-09-29.html`.
 * A is the shipped component; B and C live beside it as `<scene>-styles.tsx`
 * and are reached through the shipped component's `sceneStyle` prop.
 *
 * For each scene this holds:
 *   · each style renders ONE root (the "one part after another" seam) carrying
 *     `data-scene-style="<id>"`, so a pick visibly changes the scene;
 *   · the couple's own words/data are all there — a style never drops or adds
 *     a fact;
 *   · the rule each shipped look keeps (a withheld venue gives no directions,
 *     a solemn event gets no countdown, the reply keeps its three answers and
 *     its fields, a known guest sees only their own dress code, a guest keeps
 *     every consent control on their photos) holds under every style.
 *
 * 🪤 Same harness as the neighbouring render tests: `globalThis.React` before
 * the DYNAMIC imports (`"jsx": "preserve"`), `server-only` stubbed so the real
 * server-action import chains load.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const h = React.createElement;
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

/** How many top-level elements, and the style marker on the first. */
function root(markup: string): { roots: number; style: string | null } {
  let depth = 0;
  let roots = 0;
  let style: string | null = null;
  for (const m of markup.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*?)(\/?)>/g)) {
    const closing = m[1] === '/';
    // React closes every non-void element (an SVG <circle> included), so only
    // the HTML void elements open no level.
    const self = m[4] === '/' || ['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr'].includes(m[2] ?? '');
    if (closing) {
      depth -= 1;
      continue;
    }
    if (depth === 0) {
      roots += 1;
      style ??= /data-scene-style="([^"]+)"/.exec(m[3] ?? '')?.[1] ?? null;
    }
    if (!self) depth += 1;
  }
  return { roots, style };
}

function assertStyled(markup: string, id: string, what: string) {
  const r = root(markup);
  assert.equal(r.roots, 1, `${what}: ${r.roots} top-level elements`);
  assert.equal(r.style, id, `${what}: the root does not say it is "${id}"`);
}

const decode = (s: string) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

// ── COUNTDOWN ────────────────────────────────────────────────────────────────

test('countdown · big number and the calendar: one root each, and the server markup never reads the clock', async () => {
  const { CountdownWidget } = await import('./countdown');
  for (const id of ['big-number', 'calendar']) {
    const at = (now: number) => {
      const real = Date.now;
      Date.now = () => now;
      try {
        return renderToString(h(CountdownWidget, { targetIso: '2026-12-18', timeZone: 'Asia/Manila', sceneStyle: id }));
      } finally {
        Date.now = real;
      }
    };
    const a = at(Date.UTC(2026, 8, 29));
    const b = at(Date.UTC(2026, 11, 17, 15, 59, 59));
    assert.equal(a, b, `${id}: the server markup changed with the clock (#418)`);
    assertStyled(a, id, `countdown ${id}`);
    // The count is read after mount: the shell holds placeholders, never digits
    // (the date the calendar and the footer print is not a reading).
    assert.ok((a.match(/––/g) ?? []).length >= 4, `${id}: the shell lost its placeholders`);
    assert.match(decode(a), /Until we say/, `${id}: the wedding's line is kept`);
  }
  const cal = html(h(CountdownWidget, { targetIso: '2026-12-18', sceneStyle: 'calendar' }));
  assert.match(cal, /December 2026/);
  assert.match(cal, /data-calendar-day="the-day"[^>]*>18</, 'the day is marked on the month');
});

test('countdown · a solemn event gets no countdown in ANY style', async () => {
  const { CountdownWidget } = await import('./countdown');
  const { EventWordsProvider } = await import('./event-words-provider');
  const words = { theOrganizer: 'the family', TheOrganizer: 'The family', theOrganizerPossessive: 'the family’s', eventWord: 'wake', occasion: 'gathering', solemn: true };
  // The widget's own guard runs after mount; the SERVER shell for a solemn
  // event is already empty because `w.solemn` is read before any style.
  for (const id of [null, 'big-number', 'calendar']) {
    const out = html(h(EventWordsProvider, { words, children: h(CountdownWidget, { targetIso: '2026-12-18', sceneStyle: id }) }));
    assert.equal(out, '', `a wake drew a countdown in style ${id}`);
  }
});

// ── SPECIAL MESSAGE · WHAT TO BRING ────────────────────────────────────────

const MESSAGE = 'We’ve waited a long time for this day. Come hungry, stay late, and bring your dancing shoes.';

test('special message · the letter is signed with the event’s names; the quote leads with the first sentence', async () => {
  const { SpecialMessageWidget } = await import('./special-message-widget');
  const letter = html(h(SpecialMessageWidget, { text: MESSAGE, sceneStyle: 'letter', signedBy: 'Indalecio & Claire' }));
  assertStyled(letter, 'letter', 'letter');
  assert.ok(decode(letter).includes(MESSAGE), 'the letter carries the whole message');
  assert.ok(decode(letter).includes('Indalecio & Claire'), 'signed with the names');
  const unsigned = html(h(SpecialMessageWidget, { text: MESSAGE, sceneStyle: 'letter' }));
  assert.doesNotMatch(unsigned, /text-right font-pahina/, 'no names → no invented signature');

  const quote = decode(html(h(SpecialMessageWidget, { text: MESSAGE, sceneStyle: 'quote' })));
  assertStyled(quote, 'quote', 'quote');
  assert.ok(quote.includes('We’ve waited a long time for this day.'), 'the first sentence leads');
  assert.ok(quote.includes('Come hungry, stay late, and bring your dancing shoes.'), 'the rest follows');
  assert.equal(html(h(SpecialMessageWidget, { text: '  ', sceneStyle: 'quote' })), '', 'blank still hides the scene');
});

const BRING = 'Your presence is the present.\nNo boxed gifts, please — we fly home the morning after.\nBlock heels for the lawn.';

test('what to bring · the list is one row per line, a "no" marked ✕; the gift line leads with the first sentence', async () => {
  const { WhatToBringWidget } = await import('./what-to-bring-widget');
  const list = decode(html(h(WhatToBringWidget, { text: BRING, sceneStyle: 'list' })));
  assertStyled(list, 'list', 'list');
  assert.equal((list.match(/data-bring-row=/g) ?? []).length, 3, 'three lines, three rows');
  assert.equal((list.match(/data-bring-row="dont"/g) ?? []).length, 1, 'only the "No…" line is a don’t');
  const gift = decode(html(h(WhatToBringWidget, { text: BRING, sceneStyle: 'gift-line' })));
  assertStyled(gift, 'gift-line', 'gift line');
  assert.ok(gift.includes('Your presence is the present.'));
  assert.ok(gift.includes('Block heels for the lawn.'), 'nothing the couple wrote is dropped');
});

// ── LOVE STORY ───────────────────────────────────────────────────────────────

const STORY = {
  how_we_met: 'A rainy Tuesday in a Katipunan café',
  met_year: 2019,
  proposal: 'Sunset at Sonya’s Garden',
  milestones: [{ year: 2021, title: 'Batanes' }],
};

test('love story · the years is one screen with the first moment open; the essay is the shipped OurStory', async () => {
  const { OurLoveStoryWidget } = await import('./our-love-story-widget');
  const { loveStoryScenes } = await import('@/lib/love-story-moments');
  const scenes = loveStoryScenes(STORY);
  assert.ok(scenes.length >= 2, 'the fixture has moments');
  const years = decode(html(h(OurLoveStoryWidget, { config: STORY, sceneStyle: 'years' })));
  assertStyled(years, 'years', 'years');
  assert.equal((years.match(/aria-pressed=/g) ?? []).length, scenes.length, 'one year per moment on the rail');
  assert.ok(years.includes(scenes[0]!.line), 'the first moment is open before any tap');

  const essay = html(h(OurLoveStoryWidget, { config: STORY, sceneStyle: 'essay' }));
  assertStyled(essay, 'essay', 'essay');
  assert.match(essay, /pahina-dropcap/, 'the essay is OurStory’s full variant');
});

test('love story · a story told only in moments has no essay to write — the chapters draw instead of nothing', async () => {
  const { OurLoveStoryWidget } = await import('./our-love-story-widget');
  const momentsOnly = { moments: [{ id: 'm1', chapter: 'met', line: 'We met at a wedding.', date: '2019-05-01' }] };
  const out = html(h(OurLoveStoryWidget, { config: momentsOnly, sceneStyle: 'essay' }));
  if (out === '') return; // this shape is not a readable story on this tree — nothing to fall back from
  assert.match(out, /data-love-scene=/, 'the chapters drew');
  assert.doesNotMatch(out, /data-scene-style="essay"/);
});

// ── THE DETAILS ──────────────────────────────────────────────────────────────

const VENUES = [
  { role: 'ceremony' as const, name: 'Our Lady of Lourdes Parish', address: 'Tagaytay–Nasugbu Hwy', latitude: 14.1153, longitude: 120.9621 },
  { role: 'reception' as const, name: 'The Garden Pavilion', address: 'Sungay East, Tagaytay', latitude: 14.1009, longitude: 120.995 },
];

test('the details · big date and the card print the same date and places; the card writes the date in words', async () => {
  const { PublicEventDetails } = await import('./empty-states');
  const base = { dateLabel: 'December 18, 2026', dateIso: '2026-12-18', venueName: null, venueAddress: null, venues: VENUES };
  const big = decode(html(h(PublicEventDetails, { ...base, sceneStyle: 'big-date' })));
  assertStyled(big, 'big-date', 'big date');
  assert.match(big, />18</);
  const card = decode(html(h(PublicEventDetails, { ...base, sceneStyle: 'card' })));
  assertStyled(card, 'card', 'card');
  assert.ok(card.includes('Friday, the eighteenth of December'));
  assert.ok(card.includes('two thousand twenty-six'));
  for (const out of [big, card]) {
    for (const v of VENUES) {
      assert.ok(out.includes(v.name), `${v.name} is printed`);
      assert.ok(out.includes(v.address), `${v.address} is printed`);
    }
    assert.doesNotMatch(out, /Get directions|google\.com\/maps/, 'no directions are added to the details');
  }
});

// ── SCHEDULE ─────────────────────────────────────────────────────────────────

const BLOCKS = [
  { block_id: 'b1', event_id: 'e1', block_type: 'ceremony', label: 'The wedding', start_at: '2026-12-18T15:00:00Z', end_at: null, location: 'Our Lady of Lourdes', notes: null, run_state: 'upcoming', actual_start_at: null },
  { block_id: 'b2', event_id: 'e1', block_type: 'cocktails', label: 'Photos', start_at: '2026-12-18T16:30:00Z', end_at: null, location: null, notes: 'On the church steps', run_state: 'upcoming', actual_start_at: null },
  { block_id: 'b3', event_id: 'e1', block_type: 'reception', label: 'Reception', start_at: '2026-12-18T18:30:00Z', end_at: null, location: 'The Garden Pavilion', notes: null, run_state: 'upcoming', actual_start_at: null },
];

test('schedule · one chapter per screen and the clock face draw every moment, and keep the "Estimated" line', async () => {
  const { ScheduleWidget } = await import('./schedule-widget');
  for (const id of ['one-per-screen', 'clock-face']) {
    const out = decode(html(h(ScheduleWidget, { blocks: BLOCKS, eventTz: 'Asia/Manila', estimated: true, sceneStyle: id } as never)));
    assert.match(out, new RegExp(`data-scene-style="${id}"`), `${id} is drawn`);
    for (const b of BLOCKS) assert.ok(out.includes(b.label), `${id}: ${b.label} is on it`);
    assert.match(out, /Estimated program/, `${id}: the plan is still labelled a plan`);
    assert.doesNotMatch(out, /data-clock-hand/, `${id}: no hand before the day has begun`);
  }
  const rail = html(h(ScheduleWidget, { blocks: BLOCKS, eventTz: 'Asia/Manila' } as never));
  assert.doesNotMatch(rail, /data-scene-style=/, 'no style is the shipped rail, attribute for attribute');
});

// ── VENUE MAP ────────────────────────────────────────────────────────────────

const EVENT = { venues: VENUES, venue_withheld: false, venue_name: null, venue_address: null, venue_latitude: null, venue_longitude: null };

// 🏛 VENUE STYLES APPROVED (owner 2026-09-30, `prototypes/venue_styles_2026-09-30_fable.html`):
// Photo card (the default, today's look) · Full photo · The journey, plus the Map switch.
const PHOTO = 'https://media.example/venue.jpg';

test('venue · full photo puts the name on the photo, the address and directions on the plate; no photo = a text card', async () => {
  const { VenueWidget } = await import('./venue-widget');
  const ev = { ...EVENT, venues: [{ ...VENUES[0]!, photoUrl: PHOTO }, VENUES[1]!] };
  const out = decode(html(h(VenueWidget, { event: ev, sceneStyle: 'full-photo' } as never)));
  assertStyled(out, 'full-photo', 'full photo');
  for (const v of VENUES) {
    assert.ok(out.includes(v.name), `${v.name} is named`);
    assert.ok(out.includes(v.address), `${v.address} is printed`);
  }
  assert.match(out, /<figcaption[^>]*text-white[^>]*>[\s\S]*Our Lady of Lourdes Parish[\s\S]*<\/figcaption>/, 'the name sits ON the photo');
  assert.match(out, /rgba\(20,22,26,\.9\) 100%/, 'over a fixed dark gradient, 90 % ink at the baseline');
  assert.equal(out.split('data-venue-photo=').length - 1, 1, 'no photo, no band — the reception is a text card');
  assert.equal(out.split('class="pahina-plate').length - 1, 2, 'each venue keeps a plate for its words');
  assert.match(out, /data-venue-map-pins="2"/, 'one map for both, by default');
});

test('venue · the journey: one map with both pins joined, each stop its time from the run of show and ONE Directions dropdown', async () => {
  const { VenueWidget } = await import('./venue-widget');
  const out = decode(html(h(VenueWidget, { event: EVENT, sceneStyle: 'journey', blocks: BLOCKS } as never)));
  assertStyled(out, 'journey', 'journey');
  assert.match(out, /data-venue-map-pins="2"/, 'both venues on the one map');
  assert.match(out, /data-venue-route=""/, 'the stops are joined');
  assert.match(out, /© OpenStreetMap/, 'the map is credited');
  for (const v of VENUES) assert.ok(out.includes(v.name));
  assert.equal(out.split('data-venue-directions=').length - 1, 2, 'one Directions dropdown per stop');
  assert.match(out, /<summary[^>]*>Directions/, 'the dropdown says what it is');
  for (const app of [/maps\.google|google\.com\/maps/, /waze/, /maps\.apple/]) assert.match(out, app);
  assert.doesNotMatch(out, /label="Get directions"|Get directions/, 'never three buttons in the journey');
  const { formatBlockTimeRange } = await import('@/lib/schedule');
  assert.ok(out.includes(formatBlockTimeRange(BLOCKS[0]!.start_at, null)), 'the ceremony stop shows the ceremony block time');
  assert.ok(out.includes(formatBlockTimeRange(BLOCKS[2]!.start_at, null)), 'the reception stop shows the reception block time');
  assert.doesNotMatch(out, /min drive|min between|by car/, 'no drive time — nothing measures one');
  const bare = decode(html(h(VenueWidget, { event: EVENT, sceneStyle: 'journey' } as never)));
  assert.ok(!bare.includes(formatBlockTimeRange(BLOCKS[0]!.start_at, null)), 'no run of show, no invented time');
});

test('venue · photo card (the default) with two located venues draws ONE map for both; one venue keeps its own map', async () => {
  const { VenueWidget } = await import('./venue-widget');
  const two = decode(html(h(VenueWidget, { event: EVENT } as never)));
  assert.match(two, /data-venue-map-pins="2"/, 'one map holds both pins');
  assert.doesNotMatch(two, /openstreetmap\.org\/export\/embed/, 'and no map per card');
  const one = decode(html(h(VenueWidget, { event: { ...EVENT, venues: [VENUES[0]!] } } as never)));
  assert.doesNotMatch(one, /data-venue-map-pins/, 'one place: no shared map …');
  assert.match(one, /openstreetmap\.org\/export\/embed/, '… its own map stays in its card, as shipped');
});

test('venue · "No map" draws no map in any style', async () => {
  const { VenueWidget } = await import('./venue-widget');
  for (const sceneStyle of [null, 'photo-card', 'full-photo', 'journey']) {
    for (const venues of [VENUES, [VENUES[0]!]]) {
      const out = decode(html(h(VenueWidget, { event: { ...EVENT, venues }, sceneStyle, map: 'none', blocks: BLOCKS } as never)));
      assert.doesNotMatch(out, /data-venue-map-pins|openstreetmap\.org\/export\/embed|tile\.openstreetmap/, `${sceneStyle} drew a map with "No map"`);
      for (const v of venues) assert.ok(out.includes(v.name), `${sceneStyle}: ${v.name} still named`);
    }
  }
});

test('venue · a WITHHELD venue gives no map pin and no directions in any style, and says so once', async () => {
  const { VenueWidget } = await import('./venue-widget');
  const { VENUE_WITHHELD_LINE } = await import('@/lib/venue-disclosure');
  const withheld = {
    ...EVENT,
    venue_withheld: true,
    venues: VENUES.map((v) => ({ ...v, address: null, latitude: null, longitude: null, photoUrl: PHOTO })),
  };
  for (const id of ['photo-card', 'full-photo', 'journey']) {
    const out = decode(html(h(VenueWidget, { event: withheld, sceneStyle: id, blocks: BLOCKS } as never)));
    assert.doesNotMatch(out, /Get directions|>Directions|maps\.google|google\.com\/maps|waze\.com|maps\.apple/, `${id} handed out directions to a withheld venue`);
    assert.doesNotMatch(out, /data-venue-map-pins|openstreetmap\.org\/export/, `${id} drew a pin for a withheld venue`);
    assert.equal(out.split(decode(VENUE_WITHHELD_LINE)).length - 1, 1, `${id}: the withheld line, once`);
    for (const v of VENUES) assert.ok(out.includes(v.name), `${id}: the name stays before the reply`);
  }
});

// ── DRESS CODE ───────────────────────────────────────────────────────────────

const BOARD = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC'],
  principal_sponsors: ['#C9A24B', '#F4E9DC'],
  bridesmaids: ['#8E3B5B'],
  touched_roles: ['principal_sponsors', 'bridesmaids'],
};
const DRESS = {
  title: 'Garden formal',
  description: 'Long dresses and barongs or suits.',
  roles: { principal_sponsor_ninang: { style: 'long_gown' } },
};
const WEDDING_WORDS = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;

test('dress code · the palette and the line draw the general view: words, colours and every role row', async () => {
  const { DressCodeWidget } = await import('./dress-code-widget');
  const general = decode(html(h(DressCodeWidget, { words: WEDDING_WORDS, config: DRESS, rolePalette: BOARD } as never)));
  const roleRows = [...general.matchAll(/data-role-row="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(roleRows.length > 0, 'the fixture dresses at least one role');
  for (const id of ['palette', 'line']) {
    const out = decode(html(h(DressCodeWidget, { words: WEDDING_WORDS, config: DRESS, rolePalette: BOARD, sceneStyle: id } as never)));
    assertStyled(out, id, id);
    assert.ok(out.includes('Garden formal') && out.includes('Long dresses and barongs or suits.'), `${id}: the words`);
    for (const hex of BOARD.reception) assert.ok(out.toUpperCase().includes(hex), `${id}: our colour ${hex}`);
  }
  const line = decode(html(h(DressCodeWidget, { words: WEDDING_WORDS, config: DRESS, rolePalette: BOARD, sceneStyle: 'line' } as never)));
  assert.deepEqual([...line.matchAll(/data-role-row="([^"]+)"/g)].map((m) => m[1]), roleRows, 'the line keeps every role row, in order');
});

test('dress code · a KNOWN guest sees only their own role in every style (owner 2026-09-28)', async () => {
  const { DressCodeWidget } = await import('./dress-code-widget');
  for (const id of [null, 'palette', 'line']) {
    const out = decode(html(h(DressCodeWidget, { words: WEDDING_WORDS, config: DRESS, rolePalette: BOARD, guestRole: 'principal_sponsor_ninang', sceneStyle: id } as never)));
    assert.match(out, /data-dress-code="you"/, `${id}: the guest's own panel`);
    assert.doesNotMatch(out, /data-scene-style="(palette|line)"/, `${id}: the general view replaced the guest's own`);
    assert.doesNotMatch(out, /data-role-row=/, `${id}: everyone else's roles shown to a known guest`);
  }
});

// ── ENTOURAGE ────────────────────────────────────────────────────────────────

const person = (id: string, name: string, role: string) => ({ id, name, role, pairId: null, order: null, ceremonyOnly: false });
const GROUPS = [
  { key: 'honour', label: 'Maid of Honour & Best Man', rows: [[person('g1', 'Mia Villanueva', 'maid_of_honor'), person('g2', 'Paolo Reyes', 'best_man')]] },
  { key: 'principal_sponsors', label: 'Principal Sponsors', rows: [[person('g3', 'Hugo Cruz', 'principal_sponsor_ninong'), person('g4', 'Cora Bautista', 'principal_sponsor_ninang')]] },
  { key: 'secondary_sponsors', label: 'Secondary Sponsors', rows: [[person('g5', 'Ben Ocampo', 'candle_sponsor'), person('g6', 'Rica Flores', 'candle_sponsor')]] },
  { key: 'bridesmaids_groomsmen', label: "Bride's Crew & Groom's Crew", rows: [[person('g7', 'Joy Lim', 'bridesmaid'), person('g8', 'Marco Tan', 'groomsman')]] },
];

test('entourage · two sides puts each role on its side and keeps the side-less pairs under the rule', async () => {
  const { EntourageSection } = await import('./entourage-section');
  const out = decode(html(h(EntourageSection, { groups: GROUPS, sceneStyle: 'two-sides' } as never)));
  assertStyled(out, 'two-sides', 'two sides');
  const left = out.slice(out.indexOf('data-entourage-side="0"'), out.indexOf('data-entourage-side="1"'));
  const right = out.slice(out.indexOf('data-entourage-side="1"'));
  for (const n of ['Mia Villanueva', 'Cora Bautista', 'Joy Lim']) assert.ok(left.includes(n), `${n} on the first side`);
  for (const n of ['Paolo Reyes', 'Hugo Cruz', 'Marco Tan']) assert.ok(right.includes(n) && !left.includes(n), `${n} on the second side`);
  assert.ok(out.includes('Ben Ocampo & Rica Flores'), 'a candle pair stays a pair, on no side');
  // `best_woman` stands where the best man stands — on the second side.
  const withBestWoman = [{ key: 'honor', label: 'Maid of Honor & Best Woman', rows: [[person('b1', 'Lara Diaz', 'maid_of_honor'), person('b2', 'Nina Uy', 'best_woman')]] }];
  const bw = decode(html(h(EntourageSection, { groups: withBestWoman, sceneStyle: 'two-sides' } as never)));
  assert.ok(bw.slice(bw.indexOf('data-entourage-side="1"')).includes('Nina Uy'), 'the best woman stands on the best man’s side');
  const oneSided = [GROUPS[2]!];
  assert.doesNotMatch(
    html(h(EntourageSection, { groups: oneSided, sceneStyle: 'two-sides' } as never)),
    /data-scene-style="two-sides"/,
    'with nobody on either side, the roll call draws',
  );
});

test('entourage · the march numbers every line in order and lifts only the signed-in member’s', async () => {
  const { EntourageSection } = await import('./entourage-section');
  const stranger = decode(html(h(EntourageSection, { groups: GROUPS, sceneStyle: 'march' } as never)));
  assertStyled(stranger, 'march', 'march');
  assert.equal((stranger.match(/data-march-line=/g) ?? []).length, 4, 'one line per printed row');
  assert.doesNotMatch(stranger, /data-march-line="mine"/, 'a stranger sees no mark');
  const joy = decode(html(h(EntourageSection, { groups: GROUPS, sceneStyle: 'march', myGuestId: 'g7' } as never)));
  assert.equal((joy.match(/data-march-line="mine"/g) ?? []).length, 1);
  assert.match(joy, /you walk 4th/);
});

// ── CAMERA CUES ──────────────────────────────────────────────────────────────

const MOMENTS = {
  intro_copy: 'Be here with us for the vows.',
  moments: [
    { time_label: '3:00 PM', title: 'The ceremony', note: 'Eyes up.', mode: 'phone_down' },
    { time_label: '4:30 PM', title: 'Church steps', note: '', mode: 'camera_ok' },
    { time_label: '6:30 PM', title: 'The reception', note: 'Shoot for us in Papic.', mode: 'papic_only' },
  ],
};

test('camera cues · down the day and yes-and-no keep every moment; the Papic cue is on the "yes" side', async () => {
  const { PhotoMomentsWidget } = await import('./photo-moments-widget');
  for (const id of ['down-the-day', 'yes-and-no']) {
    const out = decode(html(h(PhotoMomentsWidget, { words: WEDDING_WORDS, config: MOMENTS, sceneStyle: id } as never)));
    assertStyled(out, id, id);
    for (const m of MOMENTS.moments) assert.ok(out.includes(m.title), `${id}: ${m.title}`);
    assert.ok(out.includes(MOMENTS.intro_copy), `${id}: the intro`);
    assert.match(out, /Our paparazzi/, `${id}: Papic keeps its name`);
  }
  const yn = decode(html(h(PhotoMomentsWidget, { words: WEDDING_WORDS, config: MOMENTS, sceneStyle: 'yes-and-no' } as never)));
  const yes = yn.slice(yn.indexOf('data-moments-side="yes"'), yn.indexOf('data-moments-side="no"'));
  assert.ok(yes.includes('The reception') && yes.includes('Church steps') && !yes.includes('The ceremony'));
});

// ── RSVP ─────────────────────────────────────────────────────────────────────

const RSVP_WORDS = { organizer: 'couple', theOrganizer: 'the couple', TheOrganizer: 'The couple', theOrganizerPossessive: 'the couple’s', TheOrganizerPossessive: 'The couple’s', eventWord: 'wedding', organizerIsHonoree: false };
const GUEST = { guest_id: 'g-1', first_name: 'Ana', last_name: 'Reyes', display_name: null, rsvp_status: 'pending', meal_preference: null, dietary_restrictions: null, guest_note: null, email: null, mobile: null, plus_one_allowed: true, plus_one_count: 1, qr_token: 't', photo_source: null, photo_url: null };

async function reply(sceneStyle: string | null, over: Record<string, unknown> = {}) {
  const { RsvpWidget } = await import('./rsvp-widget');
  return decode(
    renderToStaticMarkup(
      h(RsvpWidget as never, { words: RSVP_WORDS, guest: GUEST, eventId: 'e-1', eventPublicId: 'S89E-X', faceMode: 'mode_b', termsOnSend: true, sceneStyle, ...over } as never),
    ),
  );
}
const fieldNames = (s: string) => [...s.matchAll(/ name="([^"]+)"/g)].map((m) => m[1]).sort();

test('rsvp · the question and the ticket keep the same fields, the same two answers and the terms line', async () => {
  const card = await reply(null);
  assert.match(card, /pahina-perforation/, 'no style is the reply card');
  for (const id of ['question', 'ticket']) {
    const out = await reply(id);
    assert.match(out, new RegExp(`data-scene-style="${id}"`), `${id} is drawn`);
    assert.deepEqual(fieldNames(out), fieldNames(card), `${id}: the form's fields changed`);
    for (const v of ['attending', 'declined']) {
      assert.equal((out.match(new RegExp(`name="rsvp_status" value="${v}"`, 'g')) ?? []).length, 1, `${id}: answer ${v}`);
    }
    for (const label of ['Joyfully accepts', 'Regretfully declines']) assert.ok(out.includes(label), `${id}: ${label}`);
    assert.doesNotMatch(out, /Undecided/, `${id}: a guest is never offered maybe`);
    assert.match(out, /<fieldset data-rsvp-step/, `${id}: the answers are still a step the one-at-a-time walker finds`);
    assert.equal(/Privacy Notice/.test(out), /Privacy Notice/.test(card), `${id}: the Privacy Notice line`);
    assert.match(out, /attending-reveal|selfie-reveal/, `${id}: "yes" still reveals the rest`);
  }
  assert.match(await reply('question'), /Ana, will you be there\?/);
  assert.match(await reply('ticket'), /Admit 2/, 'Ana and her one extra seat');
});

// ── FIND YOUR SEAT ───────────────────────────────────────────────────────────

const SEAT = {
  tableLabel: 'Table 7',
  venueName: 'The Garden Pavilion',
  // The floor plan arrives drawn (`GuestSeatMap.plan`, the seat plan's own renderer).
  plan: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300"><circle data-you="" cx="1" cy="1" r="1"/></svg>',
  arrived: false,
};

test('find your seat · the table number and the place card carry the table, the venue and the map', async () => {
  const { YourSeatBlock } = await import('./your-seat-block');
  const big = decode(html(h(YourSeatBlock, { ...SEAT, sceneStyle: 'table-number' } as never)));
  assertStyled(big, 'table-number', 'table number');
  assert.match(big, />7</, 'the number, large');
  assert.match(big, /<details/, 'the map waits behind a tap, with no script');
  const card = decode(html(h(YourSeatBlock, { ...SEAT, sceneStyle: 'place-card' } as never)));
  assertStyled(card, 'place-card', 'place card');
  assert.ok(card.includes('Table 7') && card.includes('The Garden Pavilion'));
  // 🎩 No casual first name on a guest's screen (owner, DECISION_LOG 2026-09-30) — in any seat style.
  for (const style of ['table-number', 'place-card']) {
    const arrived = decode(html(h(YourSeatBlock, { ...SEAT, arrived: true, firstName: 'Ana', sceneStyle: style } as never)));
    assert.doesNotMatch(arrived, /Ana/, `${style}: a first name reached the guest's screen`);
  }
});

test('find your seat · 🪪 the place card is a name card: the FORMAL name in the Names look, never a bare first name', async () => {
  const { YourSeatBlock } = await import('./your-seat-block');
  const { placeCardName } = await import('@/lib/formal-name');
  const guest = { name_prefix: 'Mr.', first_name: 'Manuel', middle_name: 'Cruz', last_name: 'Casasola' };
  const card = decode(
    html(
      h(YourSeatBlock, {
        ...SEAT,
        sceneStyle: 'place-card',
        formalName: placeCardName(guest, 'middle-initial'),
        nameStyle: { fontFamily: 'var(--font-names-test)' },
      } as never),
    ),
  );
  assert.match(card, /<p data-place-card-name=""[^>]*style="font-family:var\(--font-names-test\)"[^>]*>Mr\. Manuel C\. Casasola<\/p>/, 'the formal name, in the Names look');
  // …in the event's Name style (owner 2026-09-30): Surname first on the card itself.
  const sf = decode(html(h(YourSeatBlock, { ...SEAT, sceneStyle: 'place-card', formalName: placeCardName(guest, 'surname-first') } as never)));
  assert.match(sf, />Mr\. Casasola, Manuel C\.<\/p>/, 'the card does not print the event’s Name style');
  assert.ok(card.includes('Table 7'), 'and the table');
  // A guest with only a first name gets NO name on the card — never "Manuel" alone.
  const bare = decode(
    html(h(YourSeatBlock, { ...SEAT, sceneStyle: 'place-card', formalName: placeCardName({ first_name: 'Manuel' }) } as never)),
  );
  assert.doesNotMatch(bare, /Manuel/, 'a bare first name reached the place card');
  assert.ok(bare.includes('Table 7'), 'the card still carries its table');
  // The site passes the name from the guest row's formal parts, in the event's Name style.
  const { readFileSync } = await import('node:fs');
  const site = readFileSync(new URL('./site-body.tsx', import.meta.url), 'utf8');
  assert.match(site, /formalName=\{placeCardName\(guest, eventNameStyle\)\}/, 'the page no longer hands the card the formal name in the event’s style');
  assert.match(site, /const eventNameStyle =[\s\S]{0,120}loadEventNameStyle\(/, 'the page no longer reads the event’s Name style');
});

// ── PHOTOS YOU ADD · EACH GUEST'S OWN PHOTOS ─────────────────────────────────

const URLS = ['https://m/1.jpg', 'https://m/2.jpg', 'https://m/3.jpg', 'https://m/4.jpg', 'https://m/5.jpg'];

test('photos you add · grid and film strip show every photo, in order', async () => {
  const { OurPhotosWidget } = await import('./our-photos-widget');
  for (const id of ['grid', 'film-strip']) {
    const out = html(h(OurPhotosWidget, { urls: URLS, sceneStyle: id }));
    assertStyled(out, id, id);
    for (const u of URLS) assert.ok(out.includes(u), `${id}: ${u}`);
  }
});

test('each guest’s photos · the big one and polaroids place every tile whole — its controls come with it', async () => {
  const { PhotosOfYouLead, PhotosOfYouPolaroids } = await import('./photos-of-you-styles');
  const tiles = ['a', 'b', 'c'].map((k, i) => ({
    key: k,
    capturedAt: `2026-12-18T0${8 + i}:41:00Z`,
    node: h('figure', { 'data-tile': k }, h('button', null, 'Not me'), h('button', null, 'Take it down')),
  }));
  for (const [id, out] of [
    ['lead', html(h(PhotosOfYouLead, { tiles }))],
    ['polaroids', html(h(PhotosOfYouPolaroids, { tiles, timeZone: 'Asia/Manila' }))],
  ] as const) {
    assertStyled(out, id, id);
    assert.equal((out.match(/data-tile=/g) ?? []).length, 3, `${id}: every tile placed`);
    assert.equal((out.match(/Not me/g) ?? []).length, 3, `${id}: every "Not me" kept`);
    assert.equal((out.match(/Take it down/g) ?? []).length, 3, `${id}: every "Take it down" kept`);
  }
  assert.match(html(h(PhotosOfYouPolaroids, { tiles, timeZone: 'Asia/Manila' })), /4:41 PM/, 'the capture time, in the event’s zone');
});

// ── ANNOUNCEMENTS · LIVE HUB ─────────────────────────────────────────────────

test('announcements · the notice and the line keep the words, the live region and the tone', async () => {
  const { AnnouncementNotice, AnnouncementLine } = await import('./announcement-styles');
  const body = 'Ceremony starts at 3:00 PM sharp. Parking is at the school across the road.';
  for (const [id, C] of [['notice', AnnouncementNotice], ['line', AnnouncementLine]] as const) {
    for (const stage of ['before', 'live'] as const) {
      const out = decode(html(h(C, { body, stage })));
      assertStyled(out, id, `${id} ${stage}`);
      assert.match(out, /role="status"/);
      assert.match(out, /aria-live="polite"/);
      assert.ok(out.replace(/<[^>]+>/g, '').includes('Ceremony starts at 3:00 PM sharp.'), `${id}: the words`);
      assert.equal(/terracotta/.test(out), stage === 'live', `${id} ${stage}: the tone`);
    }
  }
});

test('live hub · the same player and wall, placed three ways; one missing draws the other alone', async () => {
  const { LiveHubArrangement } = await import('./live-hub-styles');
  const player = h('div', { 'data-part': 'player' });
  const wall = h('div', { 'data-part': 'wall' });
  const order = (s: string) => [...s.matchAll(/data-part="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order(html(h(LiveHubArrangement, { player, wall }))), ['player', 'wall']);
  assert.deepEqual(order(html(h(LiveHubArrangement, { sceneStyle: 'theatre', player, wall }))), ['player', 'wall']);
  assert.deepEqual(order(html(h(LiveHubArrangement, { sceneStyle: 'wall-first', player, wall }))), ['wall', 'player']);
  assert.deepEqual(order(html(h(LiveHubArrangement, { sceneStyle: 'theatre', player: null, wall }))), ['wall']);
  assert.equal(html(h(LiveHubArrangement, { sceneStyle: 'theatre', player: null, wall: null })), '');
});

// ── NO STORED STYLE = TODAY'S PAGE, BYTE FOR BYTE (controller 2026-09-29) ────

test('🔒 an event with no stored style renders byte-identically to the shipped scene on every stage', async () => {
  const { sceneStyleOfRow } = await import('@/lib/scene-style-of-row');
  const { CountdownWidget } = await import('./countdown');
  const { SpecialMessageWidget } = await import('./special-message-widget');
  const { WhatToBringWidget } = await import('./what-to-bring-widget');
  const { OurLoveStoryWidget } = await import('./our-love-story-widget');
  const { PublicEventDetails } = await import('./empty-states');
  const { ScheduleWidget } = await import('./schedule-widget');
  const { VenueWidget } = await import('./venue-widget');
  const { DressCodeWidget } = await import('./dress-code-widget');
  const { PhotoMomentsWidget } = await import('./photo-moments-widget');
  const { OurPhotosWidget } = await import('./our-photos-widget');

  // Each scene: its row type and the SHIPPED call (no style prop) — the markup
  // every live page draws today. The same call with the style the page now
  // resolves for an unstyled row must be identical.
  const scenes: Array<[string, (style?: string | null) => React.ReactElement]> = [
    ['countdown', (sceneStyle) => h(CountdownWidget, { targetIso: '2026-12-18', ...(sceneStyle === undefined ? {} : { sceneStyle }) })],
    ['special_message', (sceneStyle) => h(SpecialMessageWidget, { text: MESSAGE, ...(sceneStyle === undefined ? {} : { sceneStyle, signedBy: 'Indalecio & Claire' }) })],
    ['what_to_bring', (sceneStyle) => h(WhatToBringWidget, { text: BRING, ...(sceneStyle === undefined ? {} : { sceneStyle }) })],
    ['our_love_story', (sceneStyle) => h(OurLoveStoryWidget, { config: STORY, ...(sceneStyle === undefined ? {} : { sceneStyle }) })],
    ['event_details', (sceneStyle) => h(PublicEventDetails, { dateLabel: 'December 18, 2026', venueName: null, venueAddress: null, venues: VENUES, ...(sceneStyle === undefined ? {} : { sceneStyle, dateIso: '2026-12-18' }) })],
    ['schedule', (sceneStyle) => h(ScheduleWidget, { blocks: BLOCKS, eventTz: 'Asia/Manila', estimated: true, ...(sceneStyle === undefined ? {} : { sceneStyle }) } as never)],
    ['venue_map', (sceneStyle) => h(VenueWidget, { event: EVENT, ...(sceneStyle === undefined ? {} : { sceneStyle }) } as never)],
    ['dress_code', (sceneStyle) => h(DressCodeWidget, { words: WEDDING_WORDS, config: DRESS, rolePalette: BOARD, ...(sceneStyle === undefined ? {} : { sceneStyle }) } as never)],
    ['photo_moments', (sceneStyle) => h(PhotoMomentsWidget, { words: WEDDING_WORDS, config: MOMENTS, ...(sceneStyle === undefined ? {} : { sceneStyle }) } as never)],
    ['our_photos', (sceneStyle) => h(OurPhotosWidget, { urls: URLS, ...(sceneStyle === undefined ? {} : { sceneStyle }) })],
  ];
  for (const [type, draw] of scenes) {
    const shipped = html(draw(undefined));
    assert.ok(shipped.length > 0, `${type}: the fixture renders`);
    for (const stage of ['save_the_date', 'rsvp', 'event'] as const) {
      for (const eventType of ['wedding', 'birthday']) {
        for (const config_json of [null, {}, { canvas: {} }, { canvas: { style: 'no-such-style' } }]) {
          const style = sceneStyleOfRow({ widget_type: type, config_json }, stage, eventType);
          assert.equal(html(draw(style)), shipped, `${type} on ${stage} (${eventType}, ${JSON.stringify(config_json)}) drew ${style} instead of today's scene`);
        }
      }
    }
  }
  const { RsvpWidget } = await import('./rsvp-widget');
  const rsvpProps = { words: RSVP_WORDS, guest: GUEST, eventId: 'e-1', eventPublicId: 'S89E-X', faceMode: 'mode_b', termsOnSend: true };
  const shippedReply = renderToStaticMarkup(h(RsvpWidget as never, rsvpProps as never));
  for (const stage of ['save_the_date', 'rsvp', 'event'] as const) {
    const style = sceneStyleOfRow({ widget_type: 'rsvp', config_json: null }, stage, 'wedding');
    assert.equal(renderToStaticMarkup(h(RsvpWidget as never, { ...rsvpProps, sceneStyle: style } as never)), shippedReply, `rsvp on ${stage} drew ${style}`);
  }
});

test('🔒 the five fixed parts with no pick render byte-identically to the shipped part', async () => {
  const { fixedSceneStyleOf } = await import('@/lib/fixed-scene-style-of');
  const { EntourageSection } = await import('./entourage-section');
  const { YourSeatBlock } = await import('./your-seat-block');
  const { DayOfAnnouncement } = await import('./day-of-announcement');
  const { PhotosOfYouGallery } = await import('./photos-of-you-gallery');
  const gallery = {
    total: 2,
    photos: ['a', 'b'].map((id) => ({ id, sourceTable: 'papic_photos', url: `https://m/${id}.jpg`, capturedAt: null, capturedBy: null, wall: 'off' })),
  };
  const galleryProps = { gallery, eventId: 'e', isLive: true, isPost: false, showClaimAccountCta: false, occasion: 'celebration', eventWord: 'wedding' };
  const parts: Array<[Parameters<typeof fixedSceneStyleOf>[1], 'rsvp' | 'event', (style?: string | null) => React.ReactElement]> = [
    ['entourage', 'rsvp', (s) => h(EntourageSection, { groups: GROUPS, ...(s === undefined ? {} : { sceneStyle: s, myGuestId: 'g7' }) } as never)],
    ['entourage', 'event', (s) => h(EntourageSection, { groups: GROUPS, ...(s === undefined ? {} : { sceneStyle: s }) } as never)],
    ['find_your_seat', 'event', (s) => h(YourSeatBlock, { ...SEAT, ...(s === undefined ? {} : { sceneStyle: s }) } as never)],
    ['announcements', 'event', (s) => h(DayOfAnnouncement, { body: 'Be seated by 2:45.', ...(s === undefined ? {} : { sceneStyle: s }) })],
    ['announcements', 'rsvp', (s) => h(DayOfAnnouncement, { body: 'Be seated by 2:45.', stage: 'before', ...(s === undefined ? {} : { sceneStyle: s }) })],
    ['photos_of_you', 'event', (s) => h(PhotosOfYouGallery, { ...galleryProps, ...(s === undefined ? {} : { sceneStyle: s }) } as never)],
  ];
  for (const [scene, stage, draw] of parts) {
    const shipped = html(draw(undefined));
    assert.ok(shipped.length > 0, `${scene}: the fixture renders`);
    for (const prefs of [{}, null, { scene_styles: {} }, { qr: { shape: 'circle' } }, { scene_styles: { [scene]: 'no-such' } }]) {
      const style = fixedSceneStyleOf(prefs, scene, stage, 'wedding');
      assert.equal(html(draw(style)), shipped, `${scene} on ${stage} with ${JSON.stringify(prefs)} drew ${style}`);
    }
  }
});
