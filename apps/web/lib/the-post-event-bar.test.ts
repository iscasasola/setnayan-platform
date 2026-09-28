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
  hostAllowsCamera: true,
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

test('E1 · after the day a guest reads Recap · Film · Suppliers · Gallery · Me — in that order', () => {
  assert.deepEqual(labels(), ['Recap', 'Film', 'Suppliers', 'Gallery', 'Me']);
  const film = bar().find((s) => s.key === 'film')!;
  assert.equal(film.href, '#open-film', 'Film opens the film’s open-up through its hash, so Back closes it');
  assert.equal(bar().find((s) => s.key === 'suppliers')!.href, `#${POST_EVENT_SUPPLIERS_ANCHOR}`);
});

test('E1 · a slot with no content is ABSENT — not locked, not disabled — and the rest keep their order', () => {
  assert.deepEqual(labels({ postEvent: { film: false, suppliers: true } }), ['Recap', 'Suppliers', 'Gallery', 'Me']);
  assert.deepEqual(labels({ postEvent: { film: true, suppliers: false } }), ['Recap', 'Film', 'Gallery', 'Me']);
  assert.deepEqual(labels({ postEvent: { film: false, suppliers: false }, anyChapterPublic: false }), ['Recap', 'Me']);
  for (const s of bar({ postEvent: { film: false, suppliers: false } })) {
    assert.equal(s.state, 'live', `${s.key} is drawn locked — an empty slot must be absent`);
  }
  // No landing built → no slot, never a door to "#".
  assert.ok(!labels({ destinations: { ...base.destinations, film: null } }).includes('Film'));
});

test('E1 · the stranger: Recap · Film · Suppliers · Gallery — no fifth slot, no camera', () => {
  assert.deepEqual(labels({ viewer: { kind: 'public' } }), ['Recap', 'Film', 'Suppliers', 'Gallery']);
});

test('E2 · after the day a guest and a stranger have NO camera; the couple keeps theirs', () => {
  for (const kind of ['guest', 'public'] as const) {
    for (const hostAllowsCamera of [true, false]) {
      const keys = bar({ viewer: { kind }, hostAllowsCamera }).map((s) => s.key);
      assert.ok(!keys.includes('camera'), `${kind} still has a camera after the day (host switch ${hostAllowsCamera})`);
    }
  }
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
  assert.equal(postEventSuppliersAnchorKey({ ...none, teamVendors: 3, vendorMedia: 2 }, order), 'team', 'the article’s team sits above the run');
  assert.equal(postEventSuppliersAnchorKey({ ...none, teamVendors: 3, sections: { team: false } }, order), null);
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
