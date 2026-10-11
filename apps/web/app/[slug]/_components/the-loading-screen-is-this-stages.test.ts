/**
 * THE LOADING SCREEN IS NEVER ANOTHER STAGE'S PAGE.
 *
 * A guest's walk, 2026-10-11 (fault N07): on an event in its Save the Date stage the Event Hub's loading screen
 * drew the INVITATION's cover — the names stacked, "invite you to celebrate their wedding", the cover's link down
 * ("the day, the place, the story ↓"), two grey scene cards — for about a second and a half, and then the
 * full-screen film replaced all of it. The owner's rule for this screen (2026-09-27) is that it is the page itself,
 * loading; for a stage whose page is not that cover, the cover is the "another website under" he ruled out.
 *
 * WHAT IS HELD:
 *   (1) THE RULE AGREES WITH THE PLAN. For every stage × film-or-photos × event type that may or may not have a
 *       film × `?film=0` × solemn × pinned: `loadingScreenFor` answers "quiet" exactly when the page the guest is
 *       about to get is the full-screen film (`resolveSiteBodyPlan(...).fullBleed`, run on the same facts).
 *   (2) A `?phase=` in the address may or may not be honoured — the quiet screen is drawn if EITHER stage is the film.
 *   (3) The Maker's canvas keeps the loading screen it has.
 *   (4) THE QUIET SCREEN IS QUIET — rendered: the couple's mark, a spoken "Loading…", and none of the cover (no
 *       names heading, no invitation line, no link down, no band, no scene cards). And the page's own screen still
 *       draws all of those (so (4) is not passing on a skeleton that lost its cover).
 *   (5) `page.tsx` hands the skeleton the rule's answer, from the venue's clock and the couple's pin.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`, re-checked):
 *   · `loadingScreenFor` made to answer "page" always → (1) (2) red;
 *   · the skeleton made to ignore `quiet` → (4) red;
 *   · (2026-10-11, Post Event) `stageIsTheStory` made to answer false → (1) (2) red;
 *   · `quiet={…}` taken off the fallback in `page.tsx` → (5) red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadingScreenFor, stageOpensOnTheFilm } from '../_lib/loading-stage';
import { solemnAdjustedPhase } from '../_lib/event-words';
import { resolveSiteBodyPlan } from '@/lib/site-body-plan';
import { configWithStdLead, type StdLead } from '@/lib/stage-scenes';
import type { InvitationWidgetRow, LifecyclePhase } from '@/lib/invitation-widgets';
import { HUB_LINK_DEFAULT_WORDS } from '@/lib/element-style';
import { resolveMonogram } from '@/lib/monogram';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const PHASES: LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const LEADS: Array<StdLead | null> = [null, 'film', 'photos'];
const BOOL = [true, false];

/** The gallery's row, carrying the couple's pick of film or photos (where `storedStdLead` reads it). */
function widgetsWithLead(lead: StdLead | null): InvitationWidgetRow[] {
  return [
    {
      widget_id: 'w-photos',
      widget_type: 'our_photos',
      is_visible: true,
      position: 0,
      config_json: configWithStdLead({}, lead),
    } as unknown as InvitationWidgetRow,
  ];
}

/** The page the guest is about to get, by the plan itself: is it NOT the cover's page — the full-screen film, or
 *  (2026-10-11, the same rule one stage along) the story after the day? */
function planIsTheFilm(phase: LifecyclePhase, f: { phasesEnabled: boolean; may: boolean; lead: StdLead | null; stdFilm: boolean }): boolean {
  const plan = resolveSiteBodyPlan({
    identity: 'guest',
    phasesEnabled: f.phasesEnabled,
    lifecyclePhase: phase,
    stdFilm: f.stdFilm,
    isSample: false,
    hasHeroMedia: false,
    hasBgMusic: false,
    liveMediaPublic: false,
    weddingOnlyParts: { save_the_date_film: f.may },
    widgets: widgetsWithLead(f.lead),
  });
  return plan.fullBleed || plan.body === 'editorial';
}

test('(1) "quiet" exactly when the page about to appear is the full-screen film — the rule and the plan, on every combination', () => {
  let cases = 0;
  let films = 0;
  for (const clock of PHASES) for (const pin of [null, ...PHASES]) for (const lead of LEADS) for (const may of BOOL)
    for (const stdFilm of BOOL) for (const solemn of BOOL) for (const phasesEnabled of BOOL) {
      // The stage the body gives a guest: the pin, else the clock, inside the solemn wrap (page.tsx).
      const stage = solemnAdjustedPhase(pin ?? clock, solemn);
      const film = planIsTheFilm(stage, { phasesEnabled, may, lead, stdFilm });
      const got = loadingScreenFor({
        hostCanvas: false, phasesEnabled, clockPhase: clock, pinnedPhase: pin, askedPhase: null, solemn,
        mayShowStdFilm: may, storedLead: lead, stdFilm,
      });
      cases += 1;
      if (film) films += 1;
      assert.equal(
        got,
        film ? 'quiet' : 'page',
        `clock=${clock} pin=${pin} lead=${lead} mayShowFilm=${may} film=${stdFilm} solemn=${solemn} phases=${phasesEnabled}: the plan ${film ? 'opens on the film' : 'draws the page'} and the loading screen is "${got}"`,
      );
    }
  assert.ok(cases === 4 * 5 * 3 * 2 * 2 * 2 * 2, `ran ${cases} combinations`);
  // The film: a Save the Date by the pin or the clock (5 of 20) × never chosen or film (2 of 3), and each of the
  // other four facts on its one arm = 10. The story: Post Event by the pin or the clock (5 of 20) × every lead (3)
  // × may (2) × film (2) × solemn (2), with the engine on = 120.
  assert.equal(films, 130, `anti-vacuity: ${films} of ${cases} combinations are the film or the story`);
});

test('(2) a ?phase= that may or may not be honoured: quiet if EITHER stage is the film', () => {
  const base = { hostCanvas: false, phasesEnabled: true, pinnedPhase: null, solemn: false, mayShowStdFilm: true, storedLead: null, stdFilm: true } as const;
  // An invitation by the clock, a host asking to see the Save the Date.
  assert.equal(loadingScreenFor({ ...base, clockPhase: 'rsvp', askedPhase: 'save_the_date' }), 'quiet');
  // A Save the Date by the clock, a host asking to see the invitation — a guest who types it still gets the film.
  assert.equal(loadingScreenFor({ ...base, clockPhase: 'save_the_date', askedPhase: 'rsvp' }), 'quiet');
  // Neither is the film or the story.
  assert.equal(loadingScreenFor({ ...base, clockPhase: 'rsvp', askedPhase: 'event' }), 'page');
  // Post Event — by the clock, by the pin, or asked for — is never the invitation's cover either.
  assert.equal(loadingScreenFor({ ...base, clockPhase: 'editorial', askedPhase: null }), 'quiet');
  assert.equal(loadingScreenFor({ ...base, clockPhase: 'rsvp', pinnedPhase: 'editorial', askedPhase: null }), 'quiet');
  assert.equal(loadingScreenFor({ ...base, clockPhase: 'event', askedPhase: 'editorial' }), 'quiet');
  assert.equal(loadingScreenFor({ ...base, phasesEnabled: false, clockPhase: 'editorial', askedPhase: null }), 'page');
  // The one fact, said directly: a wake never opens on the film.
  assert.equal(stageOpensOnTheFilm(solemnAdjustedPhase('save_the_date', true), { phasesEnabled: true, mayShowStdFilm: true, storedLead: null, stdFilm: true }), false);
});

test('(3) the Maker’s canvas keeps the loading screen it has', () => {
  assert.equal(
    loadingScreenFor({
      hostCanvas: true, phasesEnabled: true, clockPhase: 'save_the_date', pinnedPhase: null, askedPhase: 'save_the_date',
      solemn: false, mayShowStdFilm: true, storedLead: 'film', stdFilm: true,
    }),
    'page',
  );
});

test('(4) the quiet screen draws the mark and none of the cover; the page’s own screen still draws the cover', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InvitationSkeleton } = await import('./invitation-skeleton');
  const event = { display_name: 'Marco & Marga', monogram_text: null, monogram_color: null };
  const props = {
    displayName: event.display_name,
    monogramText: null,
    eventDate: null,
    venueName: null,
    mark: { design: {}, monogram: resolveMonogram(event) },
  };
  const page = renderToStaticMarkup(React.createElement(InvitationSkeleton, props));
  const quiet = renderToStaticMarkup(React.createElement(InvitationSkeleton, { ...props, quiet: true }));

  /* Anti-vacuity: what the guest was shown IS what the page's own screen draws. */
  const COVER: Array<[RegExp, string]> = [
    [/<header\b/, 'a band or a cover header'],
    [/<h1\b/, 'the names as the cover’s heading'],
    [/invite you to celebrate/, 'the invitation line'],
    [new RegExp(HUB_LINK_DEFAULT_WORDS), 'the cover’s link down'],
    [/sn-hub-cards/, 'the scene cards'],
    [/Setnayan/, 'the band’s wordmark'],
  ];
  for (const [re, what] of COVER) assert.match(page, re, `anti-vacuity: the page’s own loading screen no longer draws ${what}`);
  for (const [re, what] of COVER) assert.doesNotMatch(quiet, re, `the quiet loading screen draws ${what}`);

  assert.match(quiet, /^<main\b[^>]*aria-busy="true"/, 'the quiet screen is not marked busy');
  assert.match(quiet, /role="status"[^>]*>Loading…</, 'a screen reader is told nothing');
  // The mark is the couple's own, the same drawing the page's screen holds (the row already in hand)…
  const mark = quiet.slice(quiet.indexOf('</p>') + '</p>'.length, quiet.lastIndexOf('</main>'));
  assert.ok(mark.length > 20, 'the quiet screen draws no mark at all — a blank screen again');
  assert.ok(page.includes(mark), 'the quiet screen’s mark is not the page’s mark');
  // …and nothing else a guest can read is on it.
  const words = quiet.replace(mark, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(words, 'Loading…', `the quiet screen says more than it knows: ${JSON.stringify(words)}`);
});

test('(5) page.tsx hands the skeleton the rule’s answer, from the venue’s clock and the couple’s pin', () => {
  const page = stripComments(readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8'));
  const door = page.slice(page.indexOf('const loadingScreen = loadingScreenFor({'), page.indexOf('<InvitationBody'));
  assert.ok(door.length > 200, 'page.tsx no longer asks which loading screen to draw');
  assert.match(door, /clockPhase: getLifecyclePhase\(event\.event_date, venueTz, event\.event_end_date \?\? null\)/);
  assert.match(door, /pinnedPhase: manualLaunchPhase\(event\.launch_mode, event\.manual_phase\)/);
  assert.match(door, /hostCanvas: asksForHostCanvas\(search\)/);
  assert.match(door, /storedLead: await skeletonStdLead\(admin, event\.event_id\)/);
  assert.match(door, /<InvitationSkeleton[\s\S]*?quiet=\{loadingScreen === 'quiet'\}/, 'the fallback is not told');
});
