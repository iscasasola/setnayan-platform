/**
 * 🧭 EVERY EVENT WEARS THE ONE BAR — AND THE EVENT DAY KEEPS PAPIC (owner 22 Oct 2026, on a just-created
 * Simple event's Home on its day: the console had no Papic and the bar read "Home · Hub · More" —
 * *"Fix both"*, then *"I think this might be an issue on other events as well"*).
 *
 * PROPERTIES, not phrasings:
 *   1. For EVERY event type the app knows (`DEFAULT_PRESET_BY_TYPE` + the code profiles) × every needs
 *      preset × every phase × web and the app shell, the layout's OWN rule (`eventMenuGates`, handed to
 *      the ONE tree exactly as the layout hands it) builds Home · Guests · Suppliers · Hub, plus More on
 *      the web only (`the-app-bar-has-no-more.test.ts`). The roster is read from the code, so a type
 *      added to it is swept without editing this file; the migrations' own rows are swept by
 *      `tests/db/every-event-type-wears-the-one-bar.db.test.ts`.
 *   2. The layout reads that rule and hands the menu no `hideKeys` at all.
 *   3. On the event day the console carries Home › Your services' OWN Papic entry on the web (the glance
 *      row, Buy more), and NONE in the app shell (Your services builds none there); a failed credits read
 *      says "couldn't read" and never a 0 or a meter; Papic switched off says so, with a door.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCustomerMenuTree, type EventMenuChild } from './customer-menu';
import { eventMenuGates } from './event-menu-gates';
import { DEFAULT_PRESET_BY_TYPE, NEED_PRESETS, needsForPreset } from './event-needs';
import { toProfile, type ProfileRow } from './event-type-profile';
import { DAY_PAPIC_WORDS, dayPapicFace, dayPapicView, homeServices, type HomeService } from './home-first-screen';
import { papicGlance } from './papic-glance';
import type { MenuLifecyclePhase } from './day-of-mode';
import { stripComments } from './strip-comments';

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
const code = (f: string) => stripComments(read(f));

/** Every type the code knows: the needs roster (the twenty that ship) + the code profiles' own types. */
const TYPES = [...new Set([...Object.keys(DEFAULT_PRESET_BY_TYPE), 'wedding', 'simple_event', 'travel', 'wake'])].sort();
const PHASES: MenuLifecyclePhase[] = ['plan', 'dayof', 'after'];
const SERVICES: EventMenuChild[] = [
  { key: 'setnayan-ai', label: 'Setnayan AI', href: '#ai', icon: 'ai' },
  { key: 'papic', label: 'Papic', href: '#papic', icon: 'papic' },
];
const FOUR = ['home', 'guests', 'explore', 'launch'];

/** A type's profile as `resolveProfile` builds it from a row with the Simple Event's one seeded difference. */
function profileOf(t: string) {
  return toProfile({
    event_type: t,
    terminology: null,
    enabled_surfaces: null,
    marketplace_enabled: t === 'simple_event' ? false : null,
  } as unknown as ProfileRow);
}

test('every event type × needs preset × phase × shell builds the one bar — four, plus More on the web', () => {
  assert.ok(TYPES.length >= 20, `the type roster shrank to ${TYPES.length} — a sweep of nothing passes`);
  assert.ok(TYPES.includes('simple_event') && TYPES.includes('hangout') && TYPES.includes('wake'));
  const wrong: string[] = [];
  let cells = 0;
  for (const type of TYPES) {
    const profile = profileOf(type);
    for (const preset of NEED_PRESETS) {
      // The needs reach the bar no more; a preset that switches off the list and suppliers is the case that failed.
      needsForPreset(preset, { marketplace: profile.marketplaceEnabled === true });
      for (const phase of PHASES) {
        for (const storeShell of [false, true]) {
          cells++;
          const gates = eventMenuGates(profile);
          const keys = buildCustomerMenuTree('ev', {
            phase,
            ...gates,
            studioRows: [],
            storeShell,
            services: storeShell ? [] : SERVICES,
          }).map((m) => m.key);
          const want = storeShell ? FOUR : [...FOUR, 'studio'];
          if (keys.join(' ') !== want.join(' ')) wrong.push(`${type} · ${preset} · ${phase} · ${storeShell ? 'app' : 'web'} → ${keys.join(' · ')}`);
        }
      }
    }
  }
  assert.equal(cells, TYPES.length * NEED_PRESETS.length * PHASES.length * 2);
  assert.deepEqual(wrong, [], `an event draws a different bar from the wedding's:\n${wrong.join('\n')}`);
});

test('the menu rule carries no key that can drop a tab', () => {
  for (const type of TYPES) {
    const gates = eventMenuGates(profileOf(type)) as Record<string, unknown>;
    assert.deepEqual(Object.keys(gates).sort(), ['seatingEnabled', 'websiteEnabled'], `${type}: the gates grew a hide`);
    assert.equal(gates.websiteEnabled, true, `${type} has no Hub — say why in DECISION_LOG before shipping it`);
  }
});

test('the event layout reads that rule and hands the menu no hideKeys', () => {
  const layout = code('app/dashboard/[eventId]/layout.tsx');
  assert.match(layout, /eventMenuGates\(profile\)/, 'the layout no longer reads the one menu rule');
  assert.doesNotMatch(layout, /hideKeys/, 'the layout hands the event menu a key to drop again');
  assert.doesNotMatch(layout, /needsHiddenNavKeys/, 'what the event left off drops a tab from the bar again');
  // …and its gates go where they did: the bar and the rail/☰ (hostMenu) both get the Hub gate.
  assert.match(layout, /websiteEnabled = menuGates\.websiteEnabled/);
  assert.match(layout, /<CustomerBottomNav [^>]*websiteEnabled=\{websiteEnabled\}/);
});

test('a vendor-free type’s Suppliers tab answers in place — it does not re-open Home', () => {
  const page = code('app/dashboard/[eventId]/vendors/page.tsx');
  const gate = page.slice(page.indexOf('profile.marketplaceEnabled !== true'));
  assert.ok(gate.length > 0, 'the marketplace gate is gone');
  const branch = gate.slice(0, gate.indexOf('}') + 1);
  assert.doesNotMatch(branch, /redirect\(/, 'the Suppliers tab of a vendor-free event bounces to Home again');
  assert.match(gate.slice(0, 400), /data-suppliers-not-listed/);
});

/* ─── 📷 PAPIC ON THE DAY ───────────────────────────────────────────────── */

const E = '00000000-0000-4000-8000-000000000000';
const WIN = { startDate: null, endIso: null };
const glanceOf = (tile: Parameters<typeof papicGlance>[0]['tile']) => papicGlance({ permitted: true, tile, window: WIN, papicOn: true });
function servicesFor(storeShell: boolean, tile: Parameters<typeof papicGlance>[0]['tile']): HomeService[] {
  const g = glanceOf(tile);
  return homeServices({
    next: 'plan',
    storeShell,
    papic: g.status,
    papicDoors: { glance: g, line: g.line, buy: g.buy },
    ai: 'Try it',
    eventId: E,
  });
}
function dayView(storeShell: boolean, tile: Parameters<typeof papicGlance>[0]['tile'], papicOn: boolean | null = true) {
  const svc = servicesFor(storeShell, tile).find((s) => s.key === 'papic');
  const face = dayPapicFace({ svc, papicOn, permitted: true, tile });
  return { face, svc, view: dayPapicView(face, svc, E) };
}
const LIVE = { shotsLeft: 1240, shotsTotal: 1500, photosGathered: 12 };

test('on the web the day console draws Your services’ own Papic row — credits left, Buy more', () => {
  const { face, svc, view } = dayView(false, LIVE);
  assert.equal(face, 'row');
  assert.equal(view.kind, 'row');
  if (view.kind !== 'row') return;
  assert.equal(view.doors.glance, svc?.papic?.glance, 'the day row is not Your services’ own glance');
  assert.equal(view.doors.line.strong, '1,240 credits left');
  assert.equal(view.doors.buy, true, 'the day row offers no Buy more');
  assert.equal(view.doors.whileNext, undefined, 'the day row stands Buy more down for a Next card that is not on screen');
});

test('in the app shell the day console draws no Papic row — exactly as Your services', () => {
  for (const tile of [LIVE, null, 'failed' as const]) {
    assert.equal(servicesFor(true, tile).some((s) => s.key === 'papic'), false, 'Your services builds a Papic row in the app');
    for (const papicOn of [true, false, null]) {
      const { face, view } = dayView(true, tile, papicOn);
      assert.equal(face, 'hidden');
      assert.equal(view.kind, 'hidden', 'the iPhone app draws a Papic row on the event day');
    }
  }
});

test('a failed credits read says it could not read them — never a 0, never a meter, nothing to buy', () => {
  const { face, view } = dayView(false, 'failed');
  assert.equal(face, 'failed');
  assert.equal(view.kind, 'say');
  if (view.kind !== 'say') return;
  assert.equal(view.words, DAY_PAPIC_WORDS.failed);
  assert.doesNotMatch(view.words, /\d/, 'a failed read printed a number');
  assert.equal(view.meter, false, 'a failed read drew a meter');
  assert.equal(view.door, null);
});

test('Papic switched off says so, with the door to switch it on', () => {
  const off = dayView(false, LIVE, false);
  assert.equal(off.face, 'off');
  assert.equal(off.view.kind, 'say');
  if (off.view.kind !== 'say') return;
  assert.equal(off.view.words, DAY_PAPIC_WORDS.off);
  assert.deepEqual(off.view.door, { label: DAY_PAPIC_WORDS.switchOn, href: `/dashboard/${E}/details/field/papic-answer` });
  // …and not on yet (no pool): its door is the Papic page, which arms the free pool.
  const none = dayView(false, null);
  assert.equal(none.face, 'none');
  assert.equal(none.view.kind === 'say' && none.view.door?.href, `/dashboard/${E}/studio/papic`);
});

test('the day row paints the view — the say line never draws a meter', () => {
  const comp = code('app/dashboard/[eventId]/_components/home-first-screen.tsx');
  const fn = comp.slice(comp.indexOf('export function DayPapicRow'), comp.indexOf('function PaidServiceRow'));
  assert.match(fn, /const view = dayPapicView\(face, svc, eventId\)/);
  assert.match(fn, /view\.kind === 'row' \? \(\s*<PapicServiceRow [^>]*doors=\{view\.doors\}/);
  assert.match(fn, /meter=\{view\.meter\}/);
  assert.match(fn, /mood="plain"/);
});

test('the event day page hands the console that row, and the console draws it beside the Live photo wall', () => {
  const page = code('app/dashboard/[eventId]/page.tsx');
  const grid = page.slice(page.indexOf('<DayOfModeGrid'), page.indexOf('/>', page.indexOf('papic={')) + 2);
  assert.match(grid, /papic=\{\s*<DayPapicRow/, 'the day console is not handed the Papic row');
  assert.match(page, /const dayPapicSvc = homeServiceRow\.find\(\(s\) => s\.key === 'papic'\)/, 'the day row is not Your services’ own entry');
  const g = code('app/dashboard/[eventId]/_components/day-of-mode/grid.tsx');
  const slot = g.indexOf('data-day-papic-slot');
  const wall = g.indexOf('<LivePhotoWallCard');
  assert.ok(slot > 0 && wall > slot && wall - slot < 200, 'the Papic row is not drawn right before the Live photo wall card');
});
