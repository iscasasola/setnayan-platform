/**
 * 📑 EVERY GUEST PAGE'S DEFAULT SECTION ORDER — as the owner approved it
 * (2026-10-05, DECISION_LOG "APPROVED — EVERY GUEST PAGE'S DEFAULT SECTION
 * ORDER"; audit picture `build-sessions/SECTION-ORDER-AUDIT-2026-10-05.html`).
 *
 * Held here, on maria-and-jose's real shape (its 16 section rows in their
 * production order, read-only — the same shape `/dev/maker-lab` mounts):
 *
 *   · RSVP stage — RSVP form · When yes · When no;
 *   · Save the Date — unchanged;
 *   · Invitation — the RSVP right under the names (owner's answer, 2026-10-05);
 *     the Details run ends dress code → entourage;
 *   · The Day — Live + Announcements first, then find your seat · schedule ·
 *     venue, then photo moments · (your photos) · photos of you, then the
 *     entourage;
 *   · Post Event — cover → before → numbers → chapters → gallery → film →
 *     videos → you → wishes → asked → letters → seating → vendors → entourage →
 *     wall → said → powered → loved → before/after → couple → song → next.
 *
 * 🔑 DEFAULT ONLY: a couple who dragged their own order keeps it (the Day's
 * `config_json.stage_order`, Post Event's `draft_json.sectionOrder`).
 *
 * The navigator's list IS the order the Maker's canvas draws
 * (`the-navigator-follows-the-page.test.ts`, `the-day-parts-are-in-the-maker.test.ts`);
 * the Post Event page's own render is held by source below.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { makerStageLists, type MakerStageInput } from './maker-scene-list';
import { navigatorRows, navigatorTabs, type NavigatorBarItem } from './maker-navigator-tabs';
import { STAGE_SCENES } from './stage-scenes';
import { RSVP_STAGE_SCENES } from './rsvp-stage';
import { draftToScenes } from './post-event-scenes';
import { EDITORIAL_ORDERABLE_KEYS, resolveSectionOrder } from '../app/[slug]/_components/editorial/editorial-order';
import { resolveWeddingOnlyParts } from './wedding-only-parts';
import { WEDDING_PROFILE } from './event-type-profile';
import { stripComments } from './strip-comments';

/** maria-and-jose's section rows, as production holds them (order · always-on). */
const MJ_ROWS: ReadonlyArray<[WidgetType, boolean]> = [
  ['hero', true], ['greeting', true], ['qr_card', true], ['event_details', false], ['countdown', false],
  ['schedule', false], ['rsvp', true], ['venue_map', false], ['dress_code', false], ['photo_moments', false],
  ['your_photos', false], ['tier_comparison', false], ['special_message', false], ['what_to_bring', false],
  ['our_photos', false], ['our_love_story', false],
];

function rows(config: Partial<Record<WidgetType, unknown>> = {}): InvitationWidgetRow[] {
  return MJ_ROWS.map(([t, alwaysOn], i) => ({
    widget_id: `w-${t}`, event_id: 'e', widget_type: t, display_order: i + 1, is_visible: true,
    is_always_on: alwaysOn, tier: 'basic', config_json: (config[t] ?? {}) as Record<string, unknown>,
    created_at: '', updated_at: '', mode: 'auto',
  }));
}

/** The Maker's own input for maria-and-jose (`/dev/maker-lab`'s plan). */
function lists(widgets = rows(), openBrowse = true) {
  const input: Omit<MakerStageInput, 'stage'> = {
    widgets, openBrowse, weddingOnlyParts: resolveWeddingOnlyParts(WEDDING_PROFILE), content: {},
    solemn: false, hasHeroMedia: false, hasEntourage: true, dayParts: true, storyRenders: false,
    countdownPast: false, giftsOff: false, setupLocks: true,
  };
  const all = makerStageLists(input);
  return (stage: keyof typeof all) => all[stage].shown.map((t) => t.key);
}

const OPENING = ['f:hero', 'f:greeting', 'f:pass', 'f:rsvp'];

test('RSVP stage — the three screens read RSVP form · When yes · When no', () => {
  assert.deepEqual(RSVP_STAGE_SCENES.map((s) => s.label), ['RSVP form', 'When yes', 'When no']);
  const tile = stripComments(
    readFileSync(join(__dirname, '../app/dashboard/[eventId]/launch/_components/maker-rsvp-stage.tsx'), 'utf8'),
  );
  const titles = [...tile.matchAll(/(form|thanks|decline): \{ label: '([^']+)', caption: '([^']+)' \}/g)];
  assert.deepEqual(titles.map((m) => m[2]), ['RSVP form', 'When yes', 'When no'], 'the lower third’s tiles');
  for (const m of titles) {
    const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z’']+/).filter(Boolean));
    const shared = [...words(m[3]!)].filter((w) => words(m[2]!).has(w));
    assert.deepEqual(shared, [], `“${m[2]}”’s caption “${m[3]}” never repeats its title`);
  }
});

test('Save the Date — unchanged', () => {
  assert.deepEqual(STAGE_SCENES.save_the_date, ['our_photos', 'countdown', 'our_love_story']);
  assert.deepEqual(lists()('save_the_date'), ['f:film', ...OPENING, 'w:countdown', 'w:our_love_story']);
});

test('Invitation — the RSVP right under the names; the Details run ends dress code → entourage → what to bring', () => {
  // ✅ ANSWERED (owner 2026-10-05, DECISION_LOG): the RSVP stays RIGHT UNDER
  // THE NAMES, where it is live — after the masthead and the guest's own
  // greeting and ticket, before everything else. The Welcome follows the reply
  // (2026-09-30) and carries Reminders — the `what_to_bring` scene
  // (`lib/invitation-welcome.ts`) — so Reminders is drawn above Details.
  const inv = lists()('rsvp');
  assert.equal(inv.indexOf('f:rsvp'), 3, `the RSVP is right under the names: ${inv.join(' · ')}`);
  // 🎒 2026-10-06: What to bring left the Welcome for Details. 2026-10-07 ("SIX
  // BUILD QUESTIONS SETTLED" (1)): it sits AFTER the Entourage — dress → entourage → bring.
  assert.deepEqual(inv, [
    ...OPENING,
    // the Welcome, after the reply
    'f:look', 'f:gifts',
    'w:countdown', 'w:special_message', 'w:our_love_story', 'w:schedule', 'w:venue_map', 'w:dress_code',
    'f:entourage', 'w:what_to_bring', 'f:announcements',
  ]);
});

test('The Day — Live + Announcements, then seat · schedule · venue, then the photos, then the entourage', () => {
  assert.deepEqual(lists()('event'), [
    ...OPENING,
    'f:announcements', 'f:live_hub',
    'f:find_your_seat', 'w:schedule', 'w:venue_map',
    'w:photo_moments', 'f:photos_of_you',
    'f:entourage',
  ]);
  assert.deepEqual(STAGE_SCENES.event, ['schedule', 'venue_map', 'photo_moments', 'your_photos'], 'the day’s scenes keep their own order');
});

test('The Day — the same order with open browsing OFF (the production default)', () => {
  // Closed browsing draws no guest-link stand-ins (greeting · RSVP) for a
  // stranger's canvas; every other place is the same.
  const sansGuestLink = (keys: string[]) => keys.filter((k) => !OPENING.includes(k) || k === 'f:hero');
  assert.deepEqual(sansGuestLink(lists(rows(), false)('event')), sansGuestLink(lists(rows(), true)('event')));
});

test('The Day — the navigator heads every run of a tab, so each scene sits under the tab a guest meets it on', () => {
  // The Day's bar, as the canvas hands it over (Live · Welcome · Camera · Gallery · Me).
  const bar: NavigatorBarItem[] = [
    { key: 'live', label: 'Live', href: '?tab=live', state: 'live' },
    { key: 'home', label: 'Welcome', href: '?tab=home', state: 'live' },
    { key: 'camera', label: 'Camera', href: '/camera', state: 'live' },
    { key: 'gallery', label: 'Gallery', href: '?tab=gallery', state: 'live' },
    { key: 'me', label: 'Me', href: '?tab=me', state: 'live' },
  ];
  for (const openBrowse of [false, true]) {
    const keys = lists(rows(), openBrowse)('event');
    const tabs = navigatorTabs(bar, keys);
    const nav = navigatorRows(tabs, keys);
    assert.deepEqual(nav.map((r) => r.key), keys, 'every scene is listed, in the canvas order');
    const under: string[] = [];
    let current = '';
    for (const r of nav) {
      if (r.header) current = r.header.label;
      under.push(`${current}:${r.key}`);
    }
    assert.deepEqual(under.filter((u) => !/^Live:f:(greeting|pass|rsvp)$/.test(u)), [
      'Live:f:hero', 'Live:f:announcements', 'Live:f:live_hub',
      'Welcome:f:find_your_seat',
      'Live:w:schedule', 'Live:w:venue_map', 'Live:w:photo_moments',
      'Gallery:f:photos_of_you',
      'Live:f:entourage',
    ], `openBrowse ${openBrowse}`);
    assert.deepEqual(
      nav.filter((r) => r.header).map((r) => r.header!.label),
      ['Live', 'Welcome', 'Live', 'Gallery', 'Live'],
      'one header per run of a tab — never one per scene, never one per tab',
    );
  }
});

test('The Day — a couple who dragged their scenes keeps their order; the fixed parts stay around it', () => {
  const dragged = rows({
    photo_moments: { stage_order: { event: 0 } },
    venue_map: { stage_order: { event: 1 } },
    schedule: { stage_order: { event: 2 } },
  });
  assert.deepEqual(lists(dragged)('event'), [
    ...OPENING,
    'f:announcements', 'f:live_hub', 'f:find_your_seat',
    'w:photo_moments', 'w:venue_map', 'w:schedule',
    'f:photos_of_you', 'f:entourage',
  ]);
});

test('Post Event — the approved default, and a couple’s saved order still wins', () => {
  assert.deepEqual([...EDITORIAL_ORDERABLE_KEYS], [
    'chapters', 'gallery', 'watchFilm', 'kwento', 'challengeAnswers', 'guestColumns',
    'seating', 'fromVendors', 'entourage', 'liveWall', 'reviews', 'poweredBy', 'vendorsWeLoved', 'beforeAfter',
  ]);
  assert.deepEqual(draftToScenes({}).map((r) => r.key), [
    'cover', 'before', 'numbers', 'chapters', 'gallery', 'film', 'videos', 'you',
    'wishes', 'asked', 'letters', 'seating', 'vendors', 'entourage', 'wall', 'said', 'powered', 'loved', 'beforeAfter',
    'couple', 'song', 'next',
  ]);
  const saved = ['kwento', 'chapters', 'watchFilm', 'gallery'];
  assert.deepEqual(resolveSectionOrder(saved).slice(0, 4), saved, 'the couple’s order leads, as saved');
  assert.deepEqual(draftToScenes({ sectionOrder: saved }).map((r) => r.key).slice(0, 9), [
    'cover', 'before', 'numbers', 'wishes', 'chapters', 'film', 'videos', 'you', 'gallery',
  ], '“Were you there?” follows the film wherever the couple put it');
});

test('Post Event — the page draws “Were you there?” right after the film, as the navigator lists it', () => {
  const page = stripComments(readFileSync(join(__dirname, '../app/[slug]/_components/editorial/editorial-content.tsx'), 'utf8'));
  const spine = stripComments(readFileSync(join(__dirname, '../app/[slug]/_components/story/story-spine.tsx'), 'utf8'));
  // The spine is drawn without it…
  assert.match(page, /<StorySpine\s+coverScene=\{coverScene\}\s+hideRoad=\{[^}]+\}\s+you="none"/);
  // …and it is drawn alone, by the spine's own code, right after the film block.
  assert.match(page, /const youScene = \(\s*<StorySpine\s+you="only"/);
  assert.match(page, /if \(k === 'watchFilm'\) \{\s*return \(\s*<Fragment key=\{k\}>\s*\{node\}\s*\{youScene\}\s*<\/Fragment>/);
  assert.equal(page.split('{youScene}').length - 1, 1, 'drawn exactly once');
  assert.match(spine, /if \(you === 'only'\) return youScene;/);
  assert.match(spine, /\{you === 'here' \? youScene : null\}/);
  assert.match(spine, /const youScene = \(\s*<>\s*\{makerMarkers \? <span hidden data-maker-section="p:you" \/> : null\}/, 'it carries its navigator marker');
});
