/**
 * THE POST EVENT EVENT BAR — the owner's answers 1 and 2 to Fable's five
 * (DECISION_LOG 2026-09-25, "POST EVENT — OWNER ANSWERS TO FABLE'S FIVE"),
 * verbatim: *"1. yes 2. no more camera since that event is done"*.
 *
 *   E1 · after the day the bar is Recap · Film · Suppliers · Gallery · Me, and
 *        a slot with nothing behind it is ABSENT — not locked, not greyed.
 *   E2 · after the day a guest and a stranger have no Camera slot; the couple
 *        keeps theirs. Before the day and on the day, nothing changed.
 *
 * Build brief §5 tests 5 and 6 (`POST_EVENT_SCENES_BUILD_BRIEF_2026-09-26.md`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { resolveSiteNav, navPhaseFor, type NavInput } from '../app/[slug]/_lib/site-nav';
import { STAGE_BAR } from '../app/[slug]/_lib/stage-bar';
import {
  POST_EVENT_SUPPLIERS_ANCHOR,
  postEventFilmDrawn,
  postEventSuppliersAnchorKey,
} from '../app/[slug]/_components/editorial/post-event-bar-facts';
import { openUpHash } from './post-event-scenes';

const AFTER = navPhaseFor({ dayOfPhase: 'post', isRecapBody: true });

const base: NavInput = {
  viewer: { kind: 'guest' },
  phase: AFTER,
  // 📷 Papic OFF here, so E1's doors read as ruled; Papic ON adds the guest's Camera (owner 2026-10-30, below).
  hostAllowsCamera: false,
  anyChapterPublic: true,
  liveBroadcast: false,
  postEvent: { film: true, suppliers: true },
  destinations: {
    camera: '/papic/guest?from=x',
    watch: '/x/hub',
    join: '/x/invite',
    film: openUpHash('film'),
    suppliers: `#${POST_EVENT_SUPPLIERS_ANCHOR}`,
  },
  stageSlots: STAGE_BAR.editorial.slots,
};
const bar = (o: Partial<NavInput> = {}) => resolveSiteNav({ ...base, ...o });
const labels = (o: Partial<NavInput> = {}) => bar(o).map((s) => s.label);

test('E1 · after the day a guest reads Recap · Film · Suppliers · Memories · Me — in that order', () => {
  assert.deepEqual(labels(), ['Recap', 'Film', 'Suppliers', 'Memories', 'Me']);
  // 📷 Papic ON (owner 2026-10-30, "no matter what event hub stage it is"): the Camera joins, and — the five-slot
  // shape holding — Suppliers, a scroll within the Recap, yields first (the same rule as the couple's six doors).
  assert.deepEqual(labels({ hostAllowsCamera: true }), ['Recap', 'Film', 'Camera', 'Memories', 'Me']);
  for (const slot of bar()) assert.equal(slot.state, 'live', `${slot.key} is drawn but not pressable — a door with something behind it is live`);
  const film = bar().find((s) => s.key === 'film')!;
  assert.equal(film.href, '#open-film', 'Film opens the film’s open-up through its hash, so Back closes it');
  assert.equal(bar().find((s) => s.key === 'suppliers')!.href, `#${POST_EVENT_SUPPLIERS_ANCHOR}`);
});

test('E1 · a slot with no content is ABSENT — not locked, not disabled — and the rest keep their order', () => {
  assert.deepEqual(labels({ postEvent: { film: false, suppliers: true } }), ['Recap', 'Suppliers', 'Memories', 'Me']);
  assert.deepEqual(labels({ postEvent: { film: true, suppliers: false } }), ['Recap', 'Film', 'Memories', 'Me']);
  assert.deepEqual(labels({ postEvent: { film: false, suppliers: false }, anyChapterPublic: false }), ['Recap', 'Me']);
  for (const s of bar({ postEvent: { film: false, suppliers: false } })) {
    assert.equal(s.state, 'live', `${s.key} is drawn locked — an empty slot must be absent`);
  }
  // No landing built → no slot, never a door to "#".
  assert.ok(!labels({ destinations: { ...base.destinations, film: null } }).includes('Film'));
});

test('E1 · the stranger: Recap · Film · Suppliers · Memories — no fifth slot, no camera', () => {
  assert.deepEqual(labels({ viewer: { kind: 'public' } }), ['Recap', 'Film', 'Suppliers', 'Memories']);
});

test('E2 · after the day a stranger has NO camera, a guest none while Papic is off; the couple keeps theirs', () => {
  for (const hostAllowsCamera of [true, false]) {
    const keys = bar({ viewer: { kind: 'public' }, hostAllowsCamera }).map((s) => s.key);
    assert.ok(!keys.includes('camera'), `a stranger has a camera after the day (host switch ${hostAllowsCamera})`);
  }
  assert.ok(!bar({ hostAllowsCamera: false }).some((s) => s.key === 'camera'), 'a guest has a camera after the day with Papic off');
  // 📷 …and with Papic ON (owner 2026-10-30) the guest's Camera is LIVE — never a locked stand-in after the day.
  const on = bar({ hostAllowsCamera: true }).find((s) => s.key === 'camera');
  assert.equal(on?.state, 'live', 'Papic on: the guest lost the Camera on Post Event');
  assert.ok(!bar({ hostAllowsCamera: true, destinations: { ...base.destinations, camera: null } }).some((s) => s.key === 'camera'), 'no address → no camera, never a locked one');
  const couple = bar({ viewer: { kind: 'couple' } });
  const cam = couple.find((s) => s.key === 'camera');
  assert.ok(cam, 'the couple lost their camera after the day');
  assert.equal(cam.state, 'live');
  assert.ok(couple.length <= 5, 'the couple’s bar broke the five-slot shape');
  assert.equal(couple.at(-1)?.label, 'Manage');
  assert.equal(couple[0]?.label, 'Recap');
});

test('E2 · before the day and on the day NOTHING changed — a guest’s closed camera is still drawn locked', () => {
  for (const phase of ['before', 'day'] as const) {
    const shut = resolveSiteNav({ ...base, phase, stageSlots: undefined, hostAllowsCamera: false }).find((s) => s.key === 'camera');
    assert.ok(shut, `${phase}: the guest camera vanished — ruling 2 still holds before the day`);
    assert.equal(shut.state, 'locked');
    // …and Film / Suppliers are after-the-day doors only.
    const keys = resolveSiteNav({ ...base, phase, stageSlots: undefined }).map((s) => s.key);
    assert.ok(!keys.includes('film') && !keys.includes('suppliers'), `${phase}: an after-the-day door appeared`);
  }
});

test('the landings are the page’s own: film follows the run’s gate, suppliers the first team scene drawn', () => {
  const none = { sections: null, broadcast: false, films: 0, teamVendors: 0, vendorMedia: 0, vendorsWeLoved: 0 };
  assert.equal(postEventFilmDrawn(none), false);
  assert.equal(postEventFilmDrawn({ ...none, broadcast: true }), true);
  assert.equal(postEventFilmDrawn({ ...none, broadcast: true, sections: { watchFilm: false } }), false, 'a hidden broadcast is not a Film door');
  assert.equal(postEventFilmDrawn({ ...none, films: 1, sections: { watchFilm: false } }), true, 'the couple’s own films show regardless (owner 2026-09-02)');
  const order = ['chapters', 'vendorsWeLoved', 'fromVendors'] as const;
  assert.equal(postEventSuppliersAnchorKey(none, order), null);
  assert.equal(postEventSuppliersAnchorKey({ ...none, vendorMedia: 2, vendorsWeLoved: 1 }, order), 'vendorsWeLoved', 'the couple’s own order decides');
  assert.equal(
    postEventSuppliersAnchorKey({ ...none, teamVendors: 3 }, ['chapters', 'fromVendors', 'vendorsWeLoved']),
    'fromVendors',
    'Supplier Stories credits the team — it is where the slot lands',
  );
  assert.equal(
    postEventSuppliersAnchorKey({ ...none, teamVendors: 3, sections: { fromVendors: false } }, order),
    'team',
    'with Supplier Stories off, the article’s own team list is the landing',
  );
  assert.equal(postEventSuppliersAnchorKey({ ...none, teamVendors: 3, sections: { team: false, fromVendors: false } }, order), null);
});

test('SOURCE: both bars are told what the recap drew, and the page stamps the Suppliers landing', () => {
  const WEB = join(__dirname, '..');
  const body = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.equal(body.match(/postEvent: recapBar,/g)?.length, 2, 'the anonymous AND the guest bar get the recap’s facts');
  assert.equal(body.match(/film: openUpHash\('film'\),/g)?.length, 2);
  const content = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/editorial/editorial-content.tsx'), 'utf8'));
  assert.match(content, /postEventSuppliersAnchorKey\(/, 'the page asks the SAME predicate where the landing goes');
  assert.match(content, /POST_EVENT_SUPPLIERS_ANCHOR/);
});
