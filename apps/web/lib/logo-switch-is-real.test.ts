/**
 * GUARD — THE LOGO SWITCH CHANGES WHAT GUESTS SEE: the cover AND the QR centre.
 *
 * ⚖ Owner, 2026-10-15 (DECISION_LOG "SIX OWNER ANSWERS", answer 4): *"make the
 * Logo switch work"*. `events.logo_wanted` ("Do you want a logo?" — "Yes, make
 * one" / "No, use our names") was written by the host and read by no guest
 * page: a switch that changed nothing. Now:
 *   ON  (true, or NULL = never asked) + a logo ⇒ the logo on the cover, and in
 *       the QR centre for an Event Hub Pro event (the Pro gate is unchanged —
 *       a free event's code always wears the Setnayan mark).
 *   OFF (false) ⇒ neither: the cover draws the couple's initials, a Pro code
 *       wears their lettered lockup.
 *
 * 🔑 TWO HALVES, BOTH REQUIRED. The rule (`logoSwitchedOff`, read by
 * `heroMarkSvg` and `qrLookFromRow`) is inert unless the row it reads CARRIES
 * the column — a select that omits it reads as NULL, i.e. "on", silently. So
 * this asserts the behaviour on a real logo AND that the guest cover's and every
 * QR's select names the column.
 *
 * Run from apps/web:  npx tsx --test lib/logo-switch-is-real.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { heroMarkSvg, logoSwitchedOff } from '@/lib/hero-monogram-data';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { revealMarkSvg } from '@/app/[slug]/_lib/reveal-props';
import { QR_LOOK_COLUMNS, qrLookFromRow } from '@/lib/qr-look.server';
import { FREE_QR_LOOK } from '@/lib/qr-look';
import { stripComments } from '@/lib/strip-comments';

const WEB = dirname(fileURLToPath(import.meta.url)).replace(/\/lib$/, '');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** A real drawn logo — the shape every studio-written mark takes (starts with `<svg`). */
const LOGO_FILE = read('public/brand/setnayan-mark.svg');
const LOGO = LOGO_FILE.slice(LOGO_FILE.indexOf('<svg'));

const row = (logo_wanted: boolean | null | undefined) => ({
  display_name: 'Maria & Juan',
  monogram_text: null,
  monogram_color: '#C97B4B',
  monogram_font_key: 'script',
  monogram_style: 'script',
  monogram_frame_key: null,
  monogram_custom_svg: LOGO,
  monogram_uploaded_svg: null,
  role_palette: {},
  style_preferences: {},
  logo_wanted,
});

test('the switch: only an explicit No is off', () => {
  assert.equal(logoSwitchedOff({ logo_wanted: false }), true);
  assert.equal(logoSwitchedOff({ logo_wanted: true }), false);
  assert.equal(logoSwitchedOff({ logo_wanted: null }), false, 'NULL is "not asked yet" — the logo an event already shows stays');
  assert.equal(logoSwitchedOff({}), false);
  assert.equal(logoSwitchedOff(null), false);
});

test('🔘 the COVER follows the switch — the logo with it on, none with it off', () => {
  const on = heroMarkSvg(row(true));
  assert.ok(on && on.includes('<svg'), 'with the switch ON and a logo, the cover must draw the logo');
  assert.ok(heroMarkSvg(row(null)), 'never asked = on');
  assert.equal(heroMarkSvg(row(false)), null, 'with the switch OFF the cover still draws the logo');
});

test('🔘 the QR CENTRE follows the switch, inside the Pro gate', () => {
  assert.equal(qrLookFromRow(row(true), true).centre.kind, 'logo', 'Pro + ON + a logo ⇒ the logo in the centre');
  assert.equal(qrLookFromRow(row(null), true).centre.kind, 'logo');
  assert.equal(qrLookFromRow(row(false), true).centre.kind, 'monogram', 'Pro + OFF ⇒ the lettered lockup, never the logo');
  // The Pro gate is untouched: free is the Setnayan mark whatever the switch says.
  assert.deepEqual(qrLookFromRow(row(true), false), FREE_QR_LOOK);
  assert.deepEqual(qrLookFromRow(row(false), false), FREE_QR_LOOK);
});

test('every cover and QR select CARRIES the switch — an omitted column reads as "on"', () => {
  const cols = (s: string) => s.split(',').map((c) => c.trim());
  assert.ok(cols(QR_LOOK_COLUMNS).includes('logo_wanted'), 'QR_LOOK_COLUMNS lost logo_wanted — every QR would ignore the switch');

  // The Event Hub cover: `loadEventShell`'s one event read feeds `heroMarkSvg(event)`.
  const loaders = stripComments(read('app/[slug]/_lib/loaders.ts'));
  const shell = loaders.slice(loaders.indexOf('export const loadEventShell'));
  const select = /\.select\(\s*'([^']*)'/.exec(shell);
  assert.ok(select, 'loadEventShell no longer selects with one literal — re-point this guard');
  assert.ok(cols(select![1]!).includes('logo_wanted'), "the Event Hub cover's read lacks logo_wanted — the switch would be ignored");
  assert.match(loaders, /heroMarkSvg\(event\)/, 'the cover no longer draws its mark through heroMarkSvg');

  // The invite doors' crest (the invitation's cover) selects INVITE_MARK_COLUMNS.
  const look = read('app/[slug]/invite/_lib/load-invite-look.ts');
  const mark = /export const INVITE_MARK_COLUMNS = '([^']*)'/.exec(look);
  assert.ok(mark && cols(mark[1]!).includes('logo_wanted'), "the invite doors' crest select lacks logo_wanted");

  // The resolvers themselves ask the switch.
  const hero = stripComments(read('lib/hero-monogram-data.ts'));
  const heroFn = hero.slice(hero.indexOf('export function heroMarkSvg'));
  assert.match(heroFn.slice(0, heroFn.indexOf('\n}\n')), /logoSwitchedOff\(row\)/);
  const qr = stripComments(read('lib/qr-look.server.ts'));
  assert.match(qr, /logoSvg: logoSwitchedOff\(row\) \? null :/);
});

/*
  🗂 EVERY READER OF THE COUPLE'S LOGO, LISTED (Batch 9 walk W3, 2026-10-16). The walk found the print sheet, the wax
  seal, the recap / story-after-the-day / wall mastheads and the live screens drawing the logo with the switch off:
  the check lived in two callers (`heroMarkSvg`, `qrLookFromRow`), not in the resolver every mark goes through. It now
  lives in `resolveEventMonogramSvg` itself, so a reader follows the switch exactly when its row CARRIES the column.
  This census walks app/ lib/ components/ for every caller of a mark resolver and requires each to be classified:
    carries — its own select names `logo_wanted`;
    via     — it draws a row read elsewhere, and THAT read names it (checked);
    host    — the couple's own tools / the admin console (the switch decides what guests and the public see);
    editor  — the Logo editor itself, which must open the logo the couple made (`evenIfSwitchedOff`);
    lettered — draws only the lettered mark, never the svg;
    resolver — defines the resolvers.
  A new reader fails here until someone decides which it is. Sabotage (2026-10-16): the gate removed from
  `resolveEventMonogramSvg` → red; `logo_wanted` dropped from the print sheet's mark read → red.
*/

test('🔘 the ONE resolver every mark goes through follows the switch (seal, mastheads, prints, live screens)', () => {
  assert.ok(resolveEventMonogramSvg(row(true))?.includes('<svg'));
  assert.ok(resolveEventMonogramSvg(row(null)), 'never asked = on');
  assert.equal(resolveEventMonogramSvg(row(false)), null, 'the resolver draws the logo with the switch off');
  assert.equal(revealMarkSvg(row(false)), null, "the opening's wax seal draws the logo with the switch off");
  assert.ok(revealMarkSvg(row(true)), 'the wax seal lost the logo with the switch on');
  assert.ok(resolveEventMonogramSvg(row(false), { evenIfSwitchedOff: true }), 'the Logo editor cannot open the logo the couple made');
  const hero = stripComments(read('lib/hero-monogram-data.ts'));
  const fn = hero.slice(hero.indexOf('export async function resolveEventMonogram('));
  assert.match(fn.slice(0, fn.indexOf('\n}\n')), /const bespokeSvg = resolveEventMonogramSvg\(row, \{ ink: markInk \}\);/, 'the mastheads’ resolver bypasses the gated one');
});

const READERS: Record<string, readonly [kind: 'carries' | 'via' | 'host' | 'editor' | 'lettered' | 'resolver', why: string]> = {
  'app/[slug]/_components/editorial/editorial-content.tsx': ['carries', 'the story-after-the-day masthead'],
  'app/[slug]/_components/site-body.tsx': ['via', "the opening's wax seal draws loadEventShell's event (app/[slug]/_lib/loaders.ts)"],
  'app/[slug]/_lib/icon-source.ts': ['carries', "the Event Hub's app icon"],
  'app/[slug]/_lib/loaders.ts': ['carries', 'the Event Hub cover (loadEventShell)'],
  'app/[slug]/_lib/reveal-props.ts': ['resolver', "the wax seal's mark, through resolveEventMonogramSvg"],
  'app/[slug]/invite/_lib/load-invite-look.ts': ['carries', "the invite doors' crest (INVITE_MARK_COLUMNS)"],
  'app/[slug]/invite/page.tsx': ['via', "the opening's wax seal draws a row selected with INVITE_MARK_COLUMNS"],
  'app/[slug]/print/page.tsx': ['carries', 'the recap print sheet'],
  'app/[slug]/recap/page.tsx': ['carries', 'the recap masthead'],
  'app/[slug]/seat/_components/arrival-bloom.tsx': ['lettered', 'Your seat draws the lettered mark only (the seat read selects no logo)'],
  'app/_components/account-switcher/get-switcher-data.ts': ['host', "the host's own account switcher"],
  'app/_components/event-monogram.tsx': ['resolver', "draws whatever its caller's row carries, through resolveEventMonogramSvg"],
  'app/admin/studio/_surfaces/social-queue-surface.tsx': ['host', 'the admin console'],
  'app/api/social/card/[postId]/route.ts': ['carries', 'the shareable social card'],
  'app/dashboard/(account)/library/_components/album-shelf.tsx': ['host', "the host's own library"],
  'app/dashboard/(account)/library/_components/photos-tab.tsx': ['host', "the host's own library"],
  'app/dashboard/(launcher)/page.tsx': ['host', "the host's launcher"],
  'app/dashboard/[eventId]/_components/event-rail-context.tsx': ['host', "the host's rail"],
  'app/dashboard/[eventId]/launch/_components/maker-made-once.tsx': ['host', "the Maker's poster (reads the drafted switch when the draft carries it)"],
  'app/dashboard/[eventId]/layout.tsx': ['host', "the host's rail (select *: it follows the switch too)"],
  'app/dashboard/[eventId]/monogram/animated-monogram-upgrade.tsx': ['host', "the host's logo upgrade card"],
  'app/dashboard/[eventId]/seating/lab/page.tsx': ['host', "the host's seating lab"],
  'app/dashboard/[eventId]/studio/save-the-date/page.tsx': ['host', "the host's Save the Date studio"],
  'app/dashboard/[eventId]/studio/save-the-date/stamp/page.tsx': ['host', "the host's Save the Date stamp"],
  'app/live/_lib/load-screen.ts': ['carries', 'the live screen'],
  'app/panood/control/[eventId]/page.tsx': ['carries', 'the Panood control (what goes on air)'],
  'app/panood/program/[eventId]/page.tsx': ['carries', 'the Panood program output'],
  'app/papic/guest/page.tsx': ['carries', "the guest camera's look"],
  'app/wall/[eventId]/page.tsx': ['carries', 'the Live Photo Wall masthead'],
  'lib/discover-events.ts': ['via', 'discovery cards draw rows selected with coverColumns() (lib/home-public-reads-core.ts)'],
  'lib/event-cover-given.ts': ['via', 'discovery covers draw CoverRow (lib/home-public-reads-core.ts COVER_COLUMNS)'],
  'lib/hero-monogram-data.ts': ['resolver', 'heroMarkSvg · resolveEventMonogram'],
  'lib/home-public-reads-core.ts': ['carries', 'the public home shelves (COVER_COLUMNS)'],
  'lib/maker-logo-opening.ts': ['editor', 'the Maker Logo editor'],
  'lib/monogram-svg-safe.ts': ['resolver', 'resolveEventMonogramSvg — the gate itself'],
  'lib/print-set.server.ts': ['carries', 'the print set'],
  'lib/qr-look.server.ts': ['carries', 'every QR centre (QR_LOOK_COLUMNS)'],
};
/** For a `via` reader: the file whose read must name the column. */
const VIA_SOURCE: Record<string, string> = {
  'app/[slug]/_components/site-body.tsx': 'app/[slug]/_lib/loaders.ts',
  'app/[slug]/invite/page.tsx': 'app/[slug]/invite/_lib/load-invite-look.ts',
  'lib/discover-events.ts': 'lib/home-public-reads-core.ts',
  'lib/event-cover-given.ts': 'lib/home-public-reads-core.ts',
};

test('🗂 every reader of the couple’s logo is listed, and every guest / public one carries the switch', () => {
  const walk = (dir: string): string[] =>
    readdirSync(join(WEB, dir)).flatMap((name) => {
      const rel = `${dir}/${name}`;
      if (name === 'node_modules' || name.startsWith('.')) return [];
      if (statSync(join(WEB, rel)).isDirectory()) return walk(rel);
      return /\.(?:tsx?|mjs)$/.test(name) && !/\.(?:test|spec)\.tsx?$/.test(name) ? [rel] : [];
    });
  const CALL = /\b(?:resolveEventMonogramSvg|resolveEventMonogram|heroMarkSvg|revealMarkSvg)\(|<EventMonogram\b/;
  const found = ['app', 'lib', 'components'].flatMap(walk).filter((f) => CALL.test(stripComments(read(f)))).sort();
  assert.ok(found.length >= 30, `anti-vacuity: only ${found.length} readers found — the walk or the pattern broke`);
  assert.deepEqual(found.filter((f) => !(f in READERS)), [], 'a new reader of the couple’s logo — classify it in READERS');
  assert.deepEqual(Object.keys(READERS).filter((f) => !found.includes(f)), [], 'a listed reader no longer draws the logo — drop it');
  for (const [f, [kind]] of Object.entries(READERS)) {
    const s = stripComments(read(f));
    if (kind === 'carries') assert.match(s, /\blogo_wanted\b/, `${f} (${READERS[f]![1]}) draws the logo from a read without logo_wanted`);
    if (kind === 'via') assert.match(stripComments(read(VIA_SOURCE[f]!)), /\blogo_wanted\b/, `${f}: its source read lacks logo_wanted`);
    if (kind === 'editor') assert.match(s, /evenIfSwitchedOff: true/, `${f}: the Logo editor would open "no logo"`);
    if (kind === 'lettered') assert.doesNotMatch(s, /monogram_(?:custom|uploaded)_svg/, `${f} now reads the logo svg — reclassify it`);
  }
  /* The print sheet's mark: the second read feeding resolveEventMonogram names the column (the walk's W3 (a)). */
  const print = stripComments(read('app/[slug]/print/page.tsx'));
  assert.match(print, /\.select\(`\$\{HERO_MONOGRAM_COLUMNS\}, logo_wanted`\)[\s\S]{0,200}resolveEventMonogram\(admin, event\.event_id, monoRow\)/);
});
