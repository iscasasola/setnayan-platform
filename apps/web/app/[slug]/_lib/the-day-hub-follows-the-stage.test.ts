/**
 * the-day-hub-follows-the-stage.test.ts — `/[slug]/hub` NEVER NAMES A STAGE THE EVENT'S OWN PAGE IS NOT AT.
 *
 * Measured on the live sample event, 61 days before its day (2026-10-11):
 * `/maria-and-jose/hub` said "THE DAY" over a lit "Live" tab, while
 * `/maria-and-jose` — one address up — said "INVITATION". The hub decided from
 * the calendar window alone and hard-coded its own stage word.
 *
 * 🔑 THE PROPERTY: there is ONE answer to "what stage is this event at" — the
 * one `app/[slug]/page.tsx` composes (a host's `?phase=` preview, the couple's
 * pin, the venue's clock) — and the hub page asks it the same way; while that
 * stage is before the day the hub draws NOTHING of its own for a guest and
 * sends them to the page that speaks for the stage.
 *
 * 🎬 …AND A HOST STILL REHEARSES. The couple checks the day's hub before their
 * guests do. A signed-in host who opens `/hub` before the day gets it AS THE
 * DAY — the preview `?phase=event` has always given a host, without the
 * address to remember. (The first cut of this rule redirected hosts too, and
 * the event page's own preview of The Day links to a bare `/hub`.)
 *
 * ❓ WAS THERE A PREP WINDOW FOR GUESTS? No. `lib/day-of-mode.ts` has a `pre`
 * window (T−3d … T−12h), and the event's page files it under the INVITATION
 * (`getLifecyclePhase`: `case 'pre': return 'rsvp'`); The Day begins at T−12h.
 * The page links to `/hub` only while the day is live or just over. The three
 * days before are the HOST's dashboard prep (`EventDayPrepCta`), not a guest
 * stage — so for guests the redirect stands through them. (2) holds that.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { getLifecyclePhase, type LifecyclePhase } from '@/lib/invitation-widgets';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import { dayHubDoor, dayHubOpens } from './day-hub';
import { getDayOfPhase } from '@/lib/day-of-mode';
import { STAGE_BAR } from './stage-bar';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));
const HUB = read('hub/page.tsx');
const PAGE = read('page.tsx');

test('the day’s hub opens on The Day and after it — never while the stage is still before the day', () => {
  const opens = PUBLIC_STAGE_ORDER.map((stage) => `${PUBLIC_STAGE_LABELS[stage]}:${dayHubOpens(stage)}`);
  assert.deepEqual(opens, ['Save the Date:false', 'Invitation:false', 'The Day:true', 'Post Event:true']);
  // Every stage a "Live" tab would be untrue on is a stage the hub does not draw.
  for (const stage of PUBLIC_STAGE_ORDER) {
    const barHasLive = STAGE_BAR[stage].slots.includes('live');
    if (barHasLive) assert.ok(dayHubOpens(stage), `${stage}: the page's own bar has a Live tab and the hub is shut`);
    if (!dayHubOpens(stage)) assert.ok(!barHasLive, `${stage}: the hub is shut on a stage whose own bar carries Live`);
  }
});

test('a guest leaves before the day, a host rehearses — and nobody is turned away once it is the day', () => {
  for (const stage of PUBLIC_STAGE_ORDER) {
    const guest = dayHubDoor(stage, false);
    const host = dayHubDoor(stage, true);
    if (dayHubOpens(stage)) {
      assert.equal(guest, 'open', `${stage}: a guest is turned away from the day’s hub on the day`);
      assert.equal(host, 'open');
    } else {
      assert.equal(guest, 'leave', `${stage}: a guest is shown the day’s hub before the day`);
      assert.equal(host, 'rehearsal', `${stage}: a host cannot rehearse the day’s hub before the day`);
    }
    assert.notEqual(host, 'leave', `${stage}: a host is redirected away from their own hub`);
    assert.notEqual(guest, 'rehearsal', `${stage}: a guest is given the host’s preview`);
  }
});

test('by the clock: the measured case (61 days out) is a stage the hub does not draw, and the day itself is one it does', () => {
  const day = '2026-12-12';
  const tz = 'Asia/Manila';
  const at = (iso: string) => getLifecyclePhase(day, tz, null, Date.parse(iso));
  const cases: Array<[string, string, boolean]> = [
    ['2026-07-01T04:00:00+08:00', 'months out', false],
    ['2026-10-11T02:30:00+08:00', '61 days out — the walk', false],
    ['2026-12-10T12:00:00+08:00', 'two days before', false],
    ['2026-12-12T15:00:00+08:00', 'the ceremony', true],
    ['2026-12-20T12:00:00+08:00', 'the week after', true],
  ];
  for (const [iso, what, open] of cases) {
    assert.equal(dayHubOpens(at(iso)), open, `${what} (${iso}) → stage ${at(iso)}`);
  }
  assert.equal(PUBLIC_STAGE_LABELS[at('2026-10-11T02:30:00+08:00')], 'Invitation', 'the event’s own page said INVITATION that night');

  // The three days before: `pre` is a day-of window, and the PAGE files it under the Invitation — so does the hub.
  // Swept hour by hour from five days out to the day after: the hub opens for a guest exactly when the page's own
  // stage is The Day or later, and never because of the `pre` window alone.
  let pre = 0;
  let opened = 0;
  const T = Date.parse('2026-12-12T00:00:00+08:00');
  for (let h = -120; h <= 48; h++) {
    const now = T + h * 3600_000;
    const window = getDayOfPhase(day, tz, now);
    const stage = getLifecyclePhase(day, tz, null, now);
    if (window === 'pre') {
      pre++;
      assert.equal(stage, 'rsvp', `${h}h: the page left the Invitation inside the prep window — re-read getLifecyclePhase`);
      assert.equal(dayHubDoor(stage, false), 'leave', `${h}h: a guest is shown the day’s hub in the prep window`);
      assert.equal(dayHubDoor(stage, true), 'rehearsal');
    }
    if (dayHubDoor(stage, false) === 'open') {
      opened++;
      assert.ok(stage === 'event' || stage === 'editorial');
      assert.notEqual(window, 'pre');
    }
  }
  assert.ok(pre >= 55 && opened >= 40, `the sweep went thin (${pre} prep hours, ${opened} open hours)`);
});

test('the hub page asks the stage exactly as the event’s page does — preview, then the pin, then the venue’s clock', () => {
  // The pin and the clock, composed literally (the rule `manualLaunchPhase`'s docblock sets for every site).
  const compose = /solemnAdjustedPhase\(\s*phaseOverride \?\?\s*pinnedPhase \?\?\s*getLifecyclePhase\(/;
  assert.match(PAGE, compose, 'the event page no longer composes the stage this way — re-read both before touching this guard');
  assert.match(HUB, compose, 'the hub page resolves the stage some other way than the event’s own page');
  assert.match(HUB, /pinnedPhase: LifecyclePhase \| null = manualLaunchPhase\(event\.launch_mode, event\.manual_phase\)/);
  assert.match(HUB, /getLifecyclePhase\(event\.event_date, venueTz, event\.event_end_date \?\? null\)/, 'the venue’s clock or the last day is no longer handed in');
  // …with the columns the pin and a several-day event are read from.
  const select = /\.from\('events'\)\s*\.select\(\s*(?:\/\/[^\n]*\n\s*)*`([^`]*)`/.exec(readFileSync(join(HERE, '..', 'hub/page.tsx'), 'utf8'));
  assert.ok(select, 'could not find the hub’s events select — update this guard, do not delete it');
  for (const col of ['launch_mode', 'manual_phase', 'event_end_date', 'event_date']) {
    assert.ok(select![1]!.split(',').map((c) => c.trim()).includes(col), `the hub no longer selects ${col}; the stage would be read from nothing`);
  }
  // The day-of phase follows a forced stage the same way on both pages.
  const forced = /const dayOfPhase: DayOfPhase = forcedPhase\s*\? forcedPhase === 'event'\s*\? 'live'\s*: forcedPhase === 'editorial'\s*\? 'post'\s*: 'pre'/;
  assert.match(PAGE, forced);
  assert.match(HUB, forced);
});

test('before the day the hub draws nothing: it leaves for the event’s page before a single panel is built', () => {
  const leave = HUB.search(/if \(door === 'leave'\) \{\s*redirect\(/);
  assert.ok(leave > 0, 'the hub no longer leaves while the stage is before the day');
  // The door is decided from the PAGE's stage, and the host is the one shared definition — asked only when the
  // stage is before the day and the viewer did not ask for a stage themselves.
  assert.match(
    HUB,
    /const door = dayHubDoor\(\s*pageStage,\s*!dayHubOpens\(pageStage\) && !phaseOverride \? await isSignedInEventHost\(event\.event_id\) : false,\s*\);/,
    'the hub decides its door some other way — a guest may be let in early, or a host turned away',
  );
  // A rehearsal is the host's own preview of The Day, nothing more.
  assert.match(HUB, /const lifecyclePhase: LifecyclePhase = door === 'rehearsal' \? 'event' : pageStage;/);
  assert.match(HUB, /const forcedPhase: LifecyclePhase \| null = door === 'rehearsal' \? 'event' : \(phaseOverride \?\? pinnedPhase\);/);
  for (const later of ['const dayOfPhase: DayOfPhase', 'const phaseLabel', 'const header = (', '<HubShell']) {
    const at = HUB.indexOf(later);
    assert.ok(at > leave, `${later} is built before the hub decides whether it is open`);
  }
  // No stage word of the hub's own: outside the day's window the header reads the one table.
  assert.match(HUB, /STAGE_BAR\[lifecyclePhase\]\.label/);
  assert.doesNotMatch(HUB, /:\s*'The day';/, 'the hub hard-codes a stage word again');
});
