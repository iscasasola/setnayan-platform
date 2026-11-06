/**
 * the-report-sheet-is-readable.test.ts — A GUEST CAN READ THE REPORT SHEET ON EVERY LOOK.
 *
 * Measured on the live sample event (`/maria-and-jose`, 375 × 812, 2026-10-11),
 * a dark Look: the sheet's six reasons and its text box painted the page's ink —
 * a dusty rose, the LIGHT colour there — over `bg-white/60`:
 * rgb(194 168 166) on rgb(165 167 169), **1.09 : 1**. The heading and the button
 * read; the list a guest has to choose from did not.
 *
 * The sheet opens inside the page it reports, so it wears that page's colours:
 * `--color-cream` (the paper) and `--color-ink`. A literal white is the one
 * colour that cannot follow them.
 *
 * 🔑 A CLASS NAME CANNOT SEE THE PIXELS. This file reads the classes the sheet
 * is written with, then PAINTS them: for every theme × every Mood Board × every
 * background a couple can choose (the real composition, `guestLookFrom`, over
 * the real stylesheet) it blends each fill over the paper and each word over
 * its fill, and measures the pair.
 *
 *   (1) the sheet is drawn with the page's own tokens — no white, no black, no hex;
 *   (2) on the measured Look every word reads ≥ 4.5 : 1 (it was 1.09);
 *   (3) on EVERY Look no word on the sheet is harder to read than the page's own
 *       small print (`text-ink/65`, the repo's bar) — and wherever that reads at
 *       AA, so does every word here;
 *   (4) every control on the sheet is at least 44 px tall.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { INVITE_THEME_IDS, type InviteThemeId } from '@/lib/invite-themes';
import { PLATE_MUTED_ALPHA, blendOver, contrastOf } from '../[slug]/_lib/pro-site-vars';

/* `server-only` shim (as lib/a-dark-look-keeps-its-words.test.ts) — so the REAL
   look composition is what is measured, never a copy of it. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(__filename)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_report_sheet__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
const { guestLookFrom } = require('../[slug]/_lib/loaders') as typeof import('../[slug]/_lib/loaders');

const WEB = join(__dirname, '..', '..');
const CSS = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
const SRC = stripComments(readFileSync(join(WEB, 'app/_components/report-page-button.tsx'), 'utf8'));

function cssVars(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const esc = selector.replace(/[[\]'().*]/g, (c) => `\\${c}`);
  for (const m of CSS.matchAll(new RegExp(`^[ \\t]*${esc}\\s*\\{([^}]*)\\}`, 'gm'))) {
    for (const d of m[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim();
  }
  return out;
}
const ROOT = cssVars(':root');

type Event = Record<string, unknown>;
/** The paper and the ink one Look resolves — `:root` → the theme's block → the inline bag. */
function look(themeId: InviteThemeId, event: Event): { paper: string; ink: string } {
  const row = { role_palette: null, site_bg_color: null, site_button_color: null, site_button_style: null, site_font_key: null, site_art_direction: null, ...event } as never;
  const bag = guestLookFrom(row, { theme: themeId, accent: '#a9834b', monogram: 'M & J' }, false).vars ?? {};
  const theme = themeId === 'house' ? {} : cssVars(`[data-hub-theme='${themeId}']`);
  const v = { ...ROOT, ...theme, ...bag };
  const paper = v['--color-cream'];
  const ink = v['--color-ink'];
  assert.ok(paper && /^\d+ \d+ \d+$/.test(paper) && ink && /^\d+ \d+ \d+$/.test(ink), `${themeId}: the paper or the ink does not resolve (${paper} · ${ink})`);
  return { paper: paper!, ink: ink! };
}

const ROSE_BOARD = { reception: ['#525252', '#C5A059', '#373B31', '#C9A9A6', '#E8D9BD'] };
const PINK_BOARD = { reception: ['#C97B4B', '#CEA7AE', '#FAF7F2'], ceremony: ['#D3AE93'] };
const BOARDS: Record<string, Event> = { 'no board': {}, 'a light board': { role_palette: PINK_BOARD }, 'a rose board': { role_palette: ROSE_BOARD } };
const BACKGROUNDS: Record<string, Event> = {
  'no background': {},
  white: { site_bg_color: '#ffffff' },
  'a tan background': { site_bg_color: '#d9c7a8' },
  'a mid sage background': { site_bg_color: '#8fa58a' },
  'a dark background': { site_bg_color: '#1a1410' },
  'a light ombré': { site_bg_color: 'ombre:glow:#f3e2d8' },
  'a dark ombré': { site_bg_color: 'ombre:dawn:#1e2229' },
};

/* ── The sheet as it is written ──────────────────────────────────────────── */

type Word = { what: string; classes: string; text: number; fill: number | null; solid: boolean };

/** `text-ink/75` → 0.75 · `text-ink` → 1 · `bg-ink/[0.04]` → 0.04. Null when the class is absent. */
function alphaOf(classes: string, prefix: 'text-ink' | 'bg-ink' | 'placeholder:text-ink'): number | null {
  const esc = prefix.replace(/[-:]/g, (c) => `\\${c}`);
  const m = new RegExp(`(?:^|\\s)${esc}(?:\\/(?:\\[([\\d.]+)\\]|(\\d+)))?(?=\\s|$)`).exec(classes);
  if (!m) return null;
  if (m[1] !== undefined) return Number(m[1]);
  if (m[2] !== undefined) return Number(m[2]) / 100;
  return 1;
}

/** Every element of the sheet that sets words in the ink, with the fill those words sit on. */
function words(): Word[] {
  const out: Word[] = [];
  for (const m of SRC.matchAll(/className="([^"]+)"/g)) {
    const classes = m[1]!;
    const text = alphaOf(classes, 'text-ink');
    const fill = alphaOf(classes, 'bg-ink');
    if (text !== null) out.push({ what: classes.slice(0, 70), classes, text, fill, solid: false });
    const placeholder = alphaOf(classes, 'placeholder:text-ink');
    if (placeholder !== null) out.push({ what: `placeholder · ${classes.slice(0, 50)}`, classes, text: placeholder, fill, solid: false });
    // A solid ink button: its label is the paper.
    if (fill === 1 && /(?:^|\s)text-cream(?=\s|$)/.test(classes)) out.push({ what: `label on ink · ${classes.slice(0, 50)}`, classes, text: 1, fill: 1, solid: true });
  }
  return out;
}

/** The pair one word paints on one Look: its blended pixel, on the blended fill under it. */
function paint(w: Word, l: { paper: string; ink: string }): number {
  if (w.solid) return contrastOf(l.paper, l.ink);
  const ground = w.fill === null ? l.paper : blendOver(l.ink, l.paper, w.fill);
  return contrastOf(blendOver(l.ink, ground, w.text), ground);
}

test('(1) the sheet is drawn with the page’s own tokens — no white, no black, no fixed colour', () => {
  const classes = [...SRC.matchAll(/className="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/));
  const colour = classes.filter((c) => /(?:^|:)(?:bg|text|border|placeholder:text|accent|ring|fill|stroke)-/.test(c) && !/(?:^|:)text-(?:xs|sm|base|lg|\[\d)/.test(c));
  assert.ok(colour.length >= 15, `only ${colour.length} colour classes were found — the scan went blind`);
  const offPage = colour.filter((c) => !/-(?:ink|cream|terracotta)(?:-\d+)?(?:\/|$)/.test(c));
  assert.deepEqual(offPage, [], `colours that do not follow the page’s Look: ${offPage.join(', ')}`);
  assert.doesNotMatch(SRC, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'a literal colour is written into the sheet');
  // The sheet itself is the paper, and what it lists sits on a tint of the ink.
  assert.match(SRC, /rounded-2xl border border-ink\/15 bg-cream p-5/);
  const list = words();
  assert.ok(list.filter((w) => w.fill !== null && !w.solid).length >= 3, 'the reasons, the text box and its placeholder are no longer measured on their own fill');
  assert.ok(list.length >= 9, `only ${list.length} words were found on the sheet`);
});

test('(2) the measured Look: the reasons and the text box read (they were 1.09 : 1)', () => {
  const live = look('cyber', { role_palette: ROSE_BOARD, site_bg_color: 'ombre:dawn:#1e2229' });
  assert.equal(live.paper, '30 34 41');
  // As it shipped: the page's pale ink at 80 % on white at 60 % over the dark paper.
  const whiteFill = blendOver('255 255 255', live.paper, 0.6);
  assert.ok(contrastOf(blendOver(live.ink, whiteFill, 0.8), whiteFill) < 1.3, 'the white fill should reproduce the unreadable list');
  for (const w of words()) {
    const c = paint(w, live);
    assert.ok(c >= 4.5, `${w.what}: ${c.toFixed(2)} : 1 on the measured Look`);
  }
});

test('(3) on every Look, no word on the sheet is harder to read than the page’s own small print — and reads at AA wherever that does', () => {
  const failures: string[] = [];
  let looks = 0;
  let atAA = 0;
  let dark = 0;
  for (const themeId of INVITE_THEME_IDS) {
    for (const [boardName, board] of Object.entries(BOARDS)) {
      for (const [bgName, background] of Object.entries(BACKGROUNDS)) {
        const l = look(themeId, { ...board, ...background });
        looks++;
        if (contrastOf('255 255 255', l.paper) > contrastOf('0 0 0', l.paper)) dark++;
        // The page's own faintest words (`text-ink/65`) on its paper — the repo's bar for a Look.
        const bar = Math.min(4.5, contrastOf(blendOver(l.ink, l.paper, PLATE_MUTED_ALPHA), l.paper));
        if (bar >= 4.5) atAA++;
        for (const w of words()) {
          const c = paint(w, l);
          if (c < bar - 1e-9) failures.push(`${themeId} · ${boardName} · ${bgName} · ${w.what}: ${c.toFixed(2)} : 1 (the page’s own small print reads ${bar.toFixed(2)})`);
        }
      }
    }
  }
  assert.equal(looks, INVITE_THEME_IDS.length * 3 * 7);
  assert.ok(dark >= 40 && looks - dark >= 80, `the sweep must hold dark AND light pages (dark ${dark} of ${looks})`);
  assert.ok(atAA >= looks * 0.6, `only ${atAA} of ${looks} Looks hold small print at AA — the claim is nearly vacuous`);
  assert.deepEqual(failures, [], `words on the report sheet that cannot be read:\n  ${failures.slice(0, 30).join('\n  ')}`);
});

test('(4) every control on the sheet is a full tap target', () => {
  // The six reasons, the two full-width buttons and the close control.
  assert.match(SRC, /<label[^>]*className="flex min-h-11 /, 'a reason row is under 44 px');
  for (const label of ['Done', "\\{pending \\? 'Sending…' : 'Submit report'\\}"]) {
    const m = new RegExp(`<button((?:[^>]|=>)*)>\\s*${label}`).exec(SRC);
    assert.ok(m, `could not find the ${label} button`);
    assert.match(m![1]!, /min-h-11/, `the ${label} button is under 44 px`);
  }
  const close = /<button((?:[^>]|=>)*)aria-label="Close"/.exec(SRC);
  assert.ok(close, 'the close control is gone');
  assert.match(close![1]!, /\bh-11 w-11\b/, 'the close control is under 44 × 44');
});
