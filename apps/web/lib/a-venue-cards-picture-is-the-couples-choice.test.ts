/**
 * a-venue-cards-picture-is-the-couples-choice.test.ts — ⛪ THE DRAWING SHOWS ONLY
 * WHEN THE COUPLE PICKS IT.
 *
 * Owner, 2026-10-16 (DECISION_LOG "A VENUE CARD'S PICTURE IS THE COUPLE'S
 * CHOICE"), verbatim, after #6588's drawing replaced cale-ice's own uploaded
 * church photo by itself: *"on a church you can upload a photo or use our pro
 * feature photos of the venue"*. Held here, on the real code paths:
 *
 *   1 · THE DRAWING DOES NOT SHOW UNLESS CHOSEN — a Santuario ceremony card with
 *       the couple's uploaded photo and NO pick draws the photo, never the
 *       drawing, through the real resolver and the real `VenueWidget`;
 *   2 · "OUR DRAWING" IS OFFERED ONLY FOR A VENUE IN THE LIBRARY — the Picture ▾
 *       list the Maker draws (`venuePictureOptions`, the one list
 *       `VenuePhotoPicker` builds from);
 *   3 · THE PHOTO IS THE DEFAULT — a stored bag with no `drawing` reads as the
 *       photo; picking a photo, an upload or None takes the drawing off and
 *       picking the drawing keeps the photo underneath;
 *   4 · THE CHOICE IS PRO — turning a drawing ON is held at Apply for a couple
 *       without Event Hub Pro (its photo edits still go live), applied for one
 *       with it, named on the Apply sheet, and removable from there; turning it
 *       OFF is free; the Save-the-Date's live venue door can never set it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import { applyVenueChoices, readVenueChoices, resolveEventVenues, type EventVenue, type EventVenueColumns, type VenueChoices } from './event-venues';
import { parishDrawingFor } from './parish-drawings';
import {
  PICTURE_DRAWING,
  PICTURE_NONE,
  pickVenuePicture,
  uploadedVenuePicture,
  venueDrawingShown,
  venuePictureOptions,
} from './venue-picture-choice';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, type HubLiveState } from './hub-draft';
import { hubDraftProEffects, hubProEffectLine } from './hub-pro-effects';
import type { InvitationWidgetRow } from './invitation-widgets';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';

(globalThis as { React?: unknown }).React = React;
const { VenueWidget } = require('../app/[slug]/_components/venue-widget') as typeof import('../app/[slug]/_components/venue-widget');

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const E = '11111111-1111-4111-8111-111111111111';
const OWN = `r2://${PUBLIC_R2_BUCKET}/events/${E}/scene-background/church.jpg`;
const OWN_2 = `r2://${PUBLIC_R2_BUCKET}/events/${E}/scene-background/church-2.jpg`;
const SANTUARIO = 'Santuario de San Vicente de Paul Parish';
const DRAWING = parishDrawingFor({ role: 'ceremony', name: SANTUARIO })!;

/** cale-ice's shape: both venues typed by the couple, no booking. */
const COLUMNS = {
  std_film_ceremony_name: SANTUARIO,
  std_film_venue_name: 'Seda Hotel Vertis North',
  venue_name: null,
  venue_address: null,
  venue_latitude: null,
  venue_longitude: null,
} as unknown as EventVenueColumns;

/** The guest's venues for a stored `venue_map` config — the resolver the Event Hub reads through. */
function guestVenues(config: unknown): EventVenue[] {
  const bookings = applyVenueChoices({ ceremony: null, reception: null }, readVenueChoices(config, E), E);
  return resolveEventVenues(bookings, COLUMNS).map((v) => ({ ...v, photoUrl: v.photo ? `https://media.example/${v.photo.split('/').pop()}` : null }));
}

function draw(venues: EventVenue[], style: string | null = null): string {
  return renderToStaticMarkup(
    React.createElement(VenueWidget, {
      event: { venues, venue_withheld: false } as unknown as Parameters<typeof VenueWidget>[0]['event'],
      sceneStyle: style,
      map: 'none',
    }),
  );
}

const count = (s: string, needle: string) => s.split(needle).length - 1;

/* ═══ 1 · NEVER UNPICKED ═══════════════════════════════════════════════════ */

for (const style of [null, 'photo-card', 'full-photo'] as const) {
  test(`1 · ${style ?? 'default'}: the Santuario card with the couple's photo and no pick draws the PHOTO, never the drawing`, () => {
    const html = draw(guestVenues({ venue: { ceremony: { source: 'own', ownPhoto: OWN } } }), style);
    assert.equal(count(html, 'data-venue-drawing='), 0, 'the drawing replaced the photo by itself');
    assert.equal(count(html, '/parish-drawings/'), 0);
    assert.ok(html.includes('https://media.example/church.jpg'), "the couple's own photo shows");
  });

  test(`1 · ${style ?? 'default'}: …and once PICKED, the drawing takes the photo's place`, () => {
    const html = draw(guestVenues({ venue: { ceremony: { source: 'own', ownPhoto: OWN, drawing: true } } }), style);
    assert.equal(count(html, `data-venue-drawing="${DRAWING.key}"`), 1);
    assert.ok(!html.includes('https://media.example/church.jpg'), 'one picture per card');
  });
}

test('1 · no photo, no pick: nothing — the drawing is not a fallback either', () => {
  const html = draw(guestVenues({}));
  assert.equal(count(html, 'data-venue-drawing='), 0);
});

test('1 · a picked drawing on a venue the library does not have draws nothing extra (the photo stays)', () => {
  const vs = guestVenues({ venue: { reception: { source: 'own', ownPhoto: OWN, drawing: true } } });
  const html = draw(vs);
  assert.equal(count(html, 'data-venue-drawing='), 0);
  assert.ok(html.includes('https://media.example/church.jpg'));
});

/* ═══ 2 · OFFERED ONLY FOR A VENUE IN THE LIBRARY ══════════════════════════ */

const options = (drawingFor: string | null, role: 'ceremony' | 'reception' | 'both' = 'ceremony', mark: 'try' | 'unlocked' | null = 'try') =>
  venuePictureOptions({
    supplierPhotos: [],
    ownRef: OWN,
    drawing: parishDrawingFor({ role, name: drawingFor }),
    mark,
    markLabel: (m) => `mark:${m}`,
    url: (r) => r,
  });

test('2 · "Our drawing" is listed for the Santuario, marked ◆ Pro — and for no other venue', () => {
  const santuario = options(SANTUARIO);
  assert.deepEqual(
    santuario.map((o) => o.label),
    ['Your photo', 'Upload a different photo', 'Our drawing', 'None'],
  );
  const ours = santuario.find((o) => o.key === PICTURE_DRAWING)!;
  assert.equal(ours.trail?.text, '◆ Pro', 'a free couple sees it is Pro');
  assert.equal(ours.thumb, DRAWING.webp);
  assert.equal(options(SANTUARIO, 'ceremony', 'unlocked').find((o) => o.key === PICTURE_DRAWING)!.trail?.text, '◆');

  for (const [name, role] of [
    ['Santuario de San Antonio', 'ceremony'],
    ['San Vicente de Paul Parish', 'ceremony'],
    ['Seda Hotel Vertis North', 'reception'],
    [SANTUARIO, 'reception'],
    [null, 'ceremony'],
  ] as const) {
    assert.ok(!options(name, role).some((o) => o.key === PICTURE_DRAWING), `"Our drawing" offered for ${name} (${role})`);
  }
});

test('2 · the Maker builds its list from this one function, asking the library with the name the guest reads', () => {
  const src = code('app/dashboard/[eventId]/launch/_components/details-your-event.tsx');
  assert.match(src, /const options: PickOption\[\] = venuePictureOptions\(\{/);
  assert.doesNotMatch(src, /label: 'Our drawing'/, 'a second, hand-built list');
  assert.match(src, /parishDrawingFor\(\{\s*role: slots\.length === 1 \? 'both' : s\.slot,\s*name: own \? v\.name : \(s\.booked\?\.name \?\? null\),\s*\}\)/);
});

/* ═══ 3 · THE PHOTO IS THE DEFAULT ═════════════════════════════════════════ */

test('3 · a stored card without `drawing` reads as no drawing; only `true` is kept', () => {
  assert.equal(readVenueChoices({ venue: { ceremony: { ownPhoto: OWN } } }, E).ceremony?.drawing, undefined);
  assert.equal(readVenueChoices({ venue: { ceremony: { ownPhoto: OWN, drawing: 'yes' } } }, E).ceremony?.drawing, undefined);
  assert.equal(readVenueChoices({ venue: { ceremony: { ownPhoto: OWN, drawing: true } } }, E).ceremony?.drawing, true);
  assert.equal(venueDrawingShown({ ownPhoto: OWN }, DRAWING), false);
  assert.equal(venueDrawingShown({ ownPhoto: OWN, drawing: true }, null), false, 'no library drawing → nothing to show');
});

test('3 · picking: the drawing keeps the photo under it; a photo, None or an upload takes it off', () => {
  const base = { source: 'own' as const, ownPhoto: OWN };
  const drawn = pickVenuePicture(base, PICTURE_DRAWING, true);
  assert.deepEqual(drawn, { source: 'own', ownPhoto: OWN, drawing: true });
  assert.deepEqual(pickVenuePicture(drawn, OWN, true), base, 'the photo back, as it was');
  assert.deepEqual(pickVenuePicture(drawn, PICTURE_NONE, true), { source: 'own', ownPhoto: null });
  assert.deepEqual(uploadedVenuePicture(drawn, OWN_2, true), { source: 'own', ownPhoto: OWN_2 });
  // On a booked card the supplier's photo is the one picked.
  assert.deepEqual(pickVenuePicture({ drawing: true }, 'r2://x/shop.jpg', false), { supplierPhoto: 'r2://x/shop.jpg' });
});

/* ═══ 4 · THE CHOICE IS PRO ════════════════════════════════════════════════ */

const venueRow = (config: unknown): InvitationWidgetRow =>
  ({
    widget_id: 'W-VENUE',
    event_id: E,
    widget_type: 'venue_map',
    is_visible: true,
    is_always_on: false,
    display_order: 1,
    mode: 'auto',
    config_json: config,
  }) as unknown as InvitationWidgetRow;

const LIVE: HubLiveState = { events: {}, widgets: [venueRow({ venue: { ceremony: { source: 'own', ownPhoto: OWN } } })] };
const venueDraft = (venue: VenueChoices) => mergeHubDraft(emptyHubDraft(), { widgets: { venue_map: { venue } } });

test('4 · turning the drawing ON is held for a couple without Pro — and applied for one with it', () => {
  const d = venueDraft({ ceremony: { source: 'own', ownPhoto: OWN, drawing: true } });
  const free = planHubDraftApply(d, LIVE, false);
  assert.equal(free.refused.length, 1, 'the drawing is held');
  assert.equal(free.apply.length, 0, 'and nothing else moved, so nothing is written');
  assert.deepEqual(free.remaining.widgets.venue_map?.venue, { ceremony: { source: 'own', ownPhoto: OWN, drawing: true } }, 'it stays drafted, picked');
  const owned = planHubDraftApply(d, LIVE, true);
  assert.equal(owned.refused.length, 0);
  assert.equal(owned.apply.length, 1);
  assert.deepEqual(owned.apply[0]!.value, { ceremony: { source: 'own', ownPhoto: OWN, drawing: true } });
});

test('4 · a held drawing still lets the photo edits beside it go live (its free part)', () => {
  const d = venueDraft({
    ceremony: { source: 'own', ownPhoto: OWN, drawing: true },
    reception: { source: 'own', ownPhoto: OWN_2 },
  });
  const plan = planHubDraftApply(d, LIVE, false);
  assert.equal(plan.refused.length, 1);
  const freePart = plan.apply.find((i) => i.kind === 'widget' && i.field === 'venue');
  assert.ok(freePart, 'the free part is written');
  assert.deepEqual(freePart!.value, { ceremony: { source: 'own', ownPhoto: OWN }, reception: { source: 'own', ownPhoto: OWN_2 } });
});

test('4 · the Apply sheet names it — "Our drawing · Ceremony venue" — and Remove takes only the drawing off', () => {
  const d = venueDraft({ ceremony: { source: 'own', ownPhoto: OWN, drawing: true } });
  const effects = hubDraftProEffects(d, LIVE, false);
  assert.deepEqual(effects.map(hubProEffectLine), ['Our drawing · Ceremony venue']);
  assert.deepEqual(hubDraftProEffects(d, LIVE, true), [], 'an owning couple is asked for nothing');
  const after = mergeHubDraft(d, effects[0]!.remove!);
  assert.deepEqual(after.widgets.venue_map?.venue?.ceremony, { source: 'own', ownPhoto: OWN }, 'the photo pick is kept');
  assert.equal(planHubDraftApply(after, LIVE, false).refused.length, 0);
  // With nothing else drafted on the card, Remove still leaves nothing the plan holds.
  const bare = venueDraft({ ceremony: { drawing: true } });
  const bareLive: HubLiveState = { events: {}, widgets: [venueRow(null)] };
  const [only] = hubDraftProEffects(bare, bareLive, false);
  assert.equal(planHubDraftApply(mergeHubDraft(bare, only!.remove!), bareLive, false).refused.length, 0);
});

test('4 · turning the drawing OFF is never Pro', () => {
  const live: HubLiveState = { events: {}, widgets: [venueRow({ venue: { ceremony: { source: 'own', ownPhoto: OWN, drawing: true } } })] };
  const plan = planHubDraftApply(venueDraft({ ceremony: { source: 'own', ownPhoto: OWN } }), live, false);
  assert.equal(plan.refused.length, 0);
  assert.equal(plan.apply.length, 1);
});

test("4 · the Save-the-Date's live venue door neither sets nor clears the drawing", () => {
  const src = code('app/dashboard/[eventId]/studio/save-the-date/actions.ts');
  const door = src.slice(src.indexOf('if (data.venueChoice)'));
  const write = door.indexOf('.update({ config_json');
  const keep = door.indexOf('delete choice.drawing;');
  assert.ok(keep > 0 && keep < write, 'the posted drawing is dropped before the write');
  assert.match(door.slice(keep, write), /if \(readVenueChoices\(config, eventId\)\[slot\]\?\.drawing === true\) choice\.drawing = true;/);
});
