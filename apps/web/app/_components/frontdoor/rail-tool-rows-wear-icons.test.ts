/**
 * GUARD — EVERY RAIL ROW WEARS ITS OWN ICON, AND "Sign in" FITS THE STRIP.
 *
 * FOUND ON AN iPAD 13" (PR #6716 walk, D6, 2026-10-19 — the app shell from
 * Safari, held upright at 1032 CSS px, i.e. inside the 72-px strip):
 *
 *   · Marketplace, Guest list, Seat plan, Budget, Schedule, Groups and Mood
 *     Board drew a 6-px gold bullet over their caption while Discover and How
 *     it works above them drew icons. The tool rows (Planner · Builder ·
 *     Together · Studio) never had an icon: they drew `.fd-dot`, the drawing's
 *     list bullet. Beside a word at 1280+ a bullet reads as a list marker; in
 *     the strip the word is hidden, so the bullet was all that was left — read
 *     on the device as seven icons that never loaded.
 *   · The strip's "Sign in" was a gold circle reading "Sign / in": the prompt
 *     kept its 12-px side padding inside a 64-px column, leaving the button
 *     40 px, and its `white-space: normal` broke the word in two.
 *
 * Held as PROPERTIES, never as a pinned word:
 *
 *   1 · DATA — every row every list function returns, in every state (signed
 *       out, signed in, inside an event), names an icon that resolves to a
 *       component in `EVENT_MENU_ICONS`, and no two rows in one list wear the
 *       same one.
 *   2 · RENDER — every tool-group `.map` in the shell draws `<RailIcon>` from
 *       that name, and nothing in the shell or the stylesheet draws `.fd-dot`.
 *   3 · CSS — no rule anywhere hides the icon slot (`.fd-gi`), so it shows at
 *       every width the rail is drawn, web and app shell alike (the store shell
 *       changes which rows exist, never how a row draws).
 *   4 · GEOMETRY — in each strip (1024–1279, and the couple tree's 701–1023
 *       band) the width left for "Sign in" — rail minus the rail's padding,
 *       the prompt's padding and the button's — holds the label's ink at the
 *       button's font size, and the button may not wrap or clip.
 *
 * 🪤 THE INK ESTIMATE IS MEASURED, NOT GUESSED. 0.6 em per character is the
 * conservative bound; the real "Sign in" at 11 px / 650 measured 37.5 px in
 * both Chromium and WebKit (walk, 2026-10-20: /help, /explore, the store shell
 * and /dev/budget-lab?shell=1 at 1032 · 1024 · 1180 · 820) = 0.49 em, so the
 * guard's 46.2 px over-asks by ~9 px. Before the fix the strip offered 28 px
 * and the label measured two lines in both engines.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { EVENT_MENU_ICONS } from '@/lib/customer-menu';
import { STUDIO_APPS } from '@/lib/studio-apps';
import {
  plannerDoorwayRows,
  railToolsSignedIn,
  railToolsSignedOut,
  togetherDoorwayRows,
} from '@/lib/studio-rail';
import { builderRailItems, plannerRailItems, togetherRailItems } from '@/lib/free-tools-rail';
import type { RailTool } from './front-door-shell';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = stripComments(readFileSync(join(HERE, 'front-door-shell.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(HERE, 'front-door.css'), 'utf8'));

const EV = 'S89E-RAILICONS1';

/** Every list the shell is ever handed for its four tool groups, by state. */
const LISTS: ReadonlyArray<[string, ReadonlyArray<RailTool>]> = [
  ['Studio · signed out', railToolsSignedOut()],
  ['Studio · signed in, no event', railToolsSignedIn({ eventId: null, count: 0, profile: null })],
  ['Studio · signed in, two events', railToolsSignedIn({ eventId: null, count: 2, profile: null })],
  ['Studio · inside an event', railToolsSignedIn({ eventId: EV, count: 1, profile: null })],
  ['Planner · doorways', plannerDoorwayRows(false)],
  ['Planner · inside an event', plannerRailItems(EV)],
  ['Builder · inside an event', builderRailItems(EV)],
  ['Together · doorways', togetherDoorwayRows(false)],
  ['Together · signed in', togetherRailItems(null)],
  ['Together · signed in, inside an event', togetherRailItems(EV)],
];

test('1 · every row in every state names an icon the rail can draw — and its own', () => {
  let rows = 0;
  for (const [what, list] of LISTS) {
    const seen = new Map<string, string>();
    for (const t of list) {
      rows++;
      const Icon = (EVENT_MENU_ICONS as Record<string, unknown>)[t.icon as string];
      assert.ok(
        Icon,
        `${what}: "${t.name}" (${t.key}) names icon ${JSON.stringify(t.icon)}, which ` +
          '`EVENT_MENU_ICONS` does not draw. In the 72-px strip the word is hidden, so a row ' +
          'with no icon is a bare caption — on an iPad that read as an icon that never loaded.',
      );
      const twin = seen.get(t.icon);
      assert.equal(
        twin,
        undefined,
        `${what}: "${t.name}" and "${twin}" wear the same icon (${t.icon}). In the strip the ` +
          'icon is most of what a row says; two alike in one group read as one place.',
      );
      seen.set(t.icon, t.name);
    }
  }
  console.log(`  rows checked: ${rows} across ${LISTS.length} lists`);
  assert.ok(rows >= 25, `only ${rows} rows reached the check — a list went empty and this guard went blind.`);
  for (const a of STUDIO_APPS) {
    assert.ok(EVENT_MENU_ICONS[a.railIcon], `${a.key} has no drawable railIcon`);
  }
});

test('2 · every tool group in the shell draws its icon from the row, and no bullet is left', () => {
  const groups = ['plannerTools', 'builderTools', 'togetherTools', 'tools'];
  let drawn = 0;
  for (const g of groups) {
    const at = SHELL.indexOf(`{${g}.map((t) => (`);
    assert.ok(at > 0, `the shell no longer maps \`${g}\` — this guard is reading the wrong shape.`);
    const row = SHELL.slice(at, SHELL.indexOf('</Link>', at));
    assert.match(
      row,
      /<RailIcon as=\{EVENT_MENU_ICONS\[t\.icon\]\} \/>/,
      `the \`${g}\` rows do not draw <RailIcon> from \`t.icon\`. Every other rail row draws an ` +
        'icon; a tool row without one is a dot over a caption in the 72-px strip.',
    );
    drawn++;
  }
  console.log(`  tool groups drawing an icon: ${drawn}/${groups.length}`);
  assert.doesNotMatch(SHELL, /fd-dot/, 'the shell draws `.fd-dot` again — the bullet the iPad read as a missing icon.');
  assert.doesNotMatch(CSS, /\.fd-dot\b/, 'the stylesheet styles `.fd-dot` again.');
});

type Rule = { media: string; sel: string; body: string };

/** Flat rules with their enclosing @media prelude. */
function rules(src: string): Rule[] {
  const out: Rule[] = [];
  const stack: string[] = [];
  let head = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      const h = head.trim();
      if (h.startsWith('@')) stack.push(h);
      else {
        const close = src.indexOf('}', i);
        out.push({ media: stack.filter((s) => s.startsWith('@media')).join(' '), sel: h, body: src.slice(i + 1, close) });
        i = close;
      }
      head = '';
    } else if (c === '}') {
      stack.pop();
      head = '';
    } else head += c;
  }
  return out;
}
const ALL = rules(CSS);

test('3 · no rule hides the icon slot, at any width', () => {
  const slot = ALL.filter((r) => /\.fd-gi\b/.test(r.sel));
  assert.ok(slot.length >= 2, `only ${slot.length} \`.fd-gi\` rules found — the guard is reading the wrong file.`);
  for (const r of slot) {
    assert.doesNotMatch(
      r.body,
      /display:\s*none|visibility:\s*hidden|opacity:\s*0(?:[;\s]|$)|(?:^|;)\s*width:\s*0(?:px)?\s*(?:;|$)/,
      `\`${r.sel}\` ${r.media ? `inside ${r.media} ` : ''}hides the rail's icon slot. The strip shows ` +
        'icons and nothing else; a hidden icon is an empty row.',
    );
  }
});

const px = (v: string | undefined) => Number(/(-?[\d.]+)px/.exec(v ?? '')?.[1] ?? 0);
/** Left + right of a `padding` shorthand. */
function sides(body: string): number {
  const v = /(?:^|;)\s*padding:\s*([^;]+)/.exec(body)?.[1]?.trim().split(/\s+/) ?? [];
  if (v.length === 0) return 0;
  const right = px(v[1] ?? v[0]);
  const left = px(v[3] ?? v[1] ?? v[0]);
  return left + right;
}
function prop(body: string, name: string): string | undefined {
  return new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`).exec(body)?.[1]?.trim();
}
/** The LAST rule in `media` whose selector list contains `sel` exactly. */
function find(media: RegExp, sel: string): Rule {
  const hit = ALL.filter((r) => media.test(r.media) && r.sel.split(',').map((s) => s.trim()).includes(sel)).pop();
  assert.ok(hit, `no \`${sel}\` rule in ${media} — the strip's geometry cannot be read.`);
  return hit;
}

test('4 · "Sign in" fits the strip on one line, in both strips', () => {
  const label = /className="fd-btn-gold"[\s\S]*?>\s*([^<{]+?)\s*<\/Link>/.exec(
    SHELL.slice(SHELL.indexOf('fd-signin-prompt')),
  )?.[1];
  assert.ok(label && label.length >= 4, 'the rail Sign-in button lost its label — this guard reads the wrong place.');

  const STRIP = /^@media \(max-width: 1279\.98px\)$/;
  const btn = find(STRIP, '.fd-signin-prompt .fd-btn-gold');
  const font = px(prop(btn.body, 'font-size'));
  const ink = label.length * font * 0.6;
  assert.equal(prop(btn.body, 'white-space'), 'nowrap', `the strip's Sign-in may wrap ("${label}" broke into two lines on the iPad).`);
  assert.doesNotMatch(btn.body, /text-overflow|overflow:\s*hidden/, 'the strip clips the Sign-in label.');

  const strips: Array<[string, number]> = [];
  {
    const rail = px(prop(find(STRIP, '.fd').body, '--fd-rail'));
    const left = rail - sides(find(STRIP, '.fd-rail').body) - sides(find(STRIP, '.fd-signin-prompt').body) - sides(btn.body);
    strips.push(['1024–1279 strip', left]);
  }
  {
    const TAB = /^@media \(min-width: \d+px\) and \(max-width: 1023\.98px\)$/;
    const rail = px(prop(find(TAB, ".fd[data-boundary='tab']").body, '--fd-rail'));
    const left =
      rail -
      sides(find(TAB, ".fd[data-boundary='tab'] .fd-rail").body) -
      sides(find(TAB, ".fd[data-boundary='tab'] .fd-rail .fd-signin-prompt").body) -
      sides(btn.body);
    strips.push(['701–1023 tablet band', left]);
  }
  for (const [what, left] of strips) {
    console.log(`  ${what}: ${left}px for "${label}" (needs ≤ ${ink.toFixed(1)}px of ink at ${font}px)`);
    assert.ok(
      left >= ink,
      `${what}: the Sign-in button has ${left}px for "${label}" at ${font}px, which needs about ` +
        `${ink.toFixed(1)}px. On an iPad 13" upright it wrapped into a gold circle reading "Sign / in".`,
    );
  }
});
