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
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { heroMarkSvg, logoSwitchedOff } from '@/lib/hero-monogram-data';
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
