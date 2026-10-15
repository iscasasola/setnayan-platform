/**
 * The words the live quality sweep (2026-10-13, item 7) measured under 3:1 on
 * the public site stay at ≥ 12px and ≥ 4.5:1:
 *   - the /explore folder strip's category COUNTS (9px at 60% opacity, 2.0–2.3:1);
 *   - the /login + /signup field labels and "or continue with email" (10.5px
 *     #A8A4A0 on the #F2F2F0 card, 2.2:1) and the card's hints (3.1:1);
 *   - the onboarding card's step eyebrow and "You can change this anytime"
 *     (ink/45 and ink/40, 2.6 and 2.3:1);
 *   - grey fine print: Real Stories' "The palette" / "The team", the blog's
 *     date lines (ink/45 at 10–12px, 2.6:1).
 * Each is pinned where it is drawn, and the colour is checked by arithmetic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Tiny or faint: a pixel size under 12, or an ink tint the text floor does not lift (< /50). */
const TINY = /\btext-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/;
const FAINT = /(?:^|\s)text-ink\/(?:[0-9]|[1-3][0-9]|4[0-9])(?=\s|$)/;

function classesNear(src: string, needle: string): string {
  const i = src.indexOf(needle);
  assert.ok(i >= 0, `"${needle}" is gone — did the element move?`);
  const before = src.lastIndexOf('className=', i);
  const m = src.slice(before).match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
  return (m?.[1] ?? m?.[2] ?? '').trim();
}

test('the explore folder counts are 12px at the tile colour', () => {
  const src = read('app/(shell)/explore/_components/icon-tile-folder-strip.tsx');
  const cls = classesNear(src, '{formatCount(count)}');
  assert.ok(!TINY.test(cls) && !/\bopacity-/.test(cls), `count classes "${cls}" — tiny or faded again`);
});

test('the sign-in card labels, divider and hints are 12px and 4.5:1 on the card', () => {
  const css = stripComments(readFileSync(join(WEB, 'app/_components/home/home-reskin.css'), 'utf8'));
  const rule = css.match(/\.sn-signin-terra \.hr-si-label,\s*\.home-reskin-ov \.sn-signin-terra \.hr-si-or span \{([^}]*)\}/)?.[1] ?? '';
  const px = Number(rule.match(/font-size:\s*([\d.]+)px/)?.[1]);
  assert.ok(px >= 12, `sign-in labels are ${px}px`);
  const fg = rule.match(/color:\s*(#[0-9a-f]{6})/i)?.[1];
  assert.ok(fg && ratio(fg, '#f2f2f0') >= 4.5, `sign-in labels ${fg} read ${fg ? ratio(fg, '#f2f2f0').toFixed(2) : '?'}:1 on the card`);
  const hintRules = [...css.matchAll(/\.sn-signin-terra \.hr-si-hint\b[^{]*\{([^}]*)\}/g)].map((m) => m[1]!);
  const hfg = hintRules.map((r) => r.match(/(?:^|;|\s)color:\s*(#[0-9a-f]{6})/i)?.[1]).filter(Boolean).pop();
  assert.ok(hfg && ratio(hfg, '#f2f2f0') >= 4.5, `sign-in hints ${hfg} under 4.5:1`);
});

test('the onboarding card, Real Stories and blog fine print are not tiny or faint', () => {
  const pins: Array<[string, string]> = [
    ['app/onboarding/_shared/setup-card.tsx', '{footer}</p>'],
    ['app/onboarding/_shared/setup-card.tsx', '{r.line}</p>'],
    ['app/realstories/[slug]/page.tsx', '>The palette</p>'],
    ['app/realstories/[slug]/page.tsx', '>The team</p>'],
    ['app/blog/_components/story-card.tsx', '{metaLine(article)}</p>'],
    ['app/blog/page.tsx', '{metaLine(article)}</p>'],
  ];
  const bad: string[] = [];
  for (const [file, needle] of pins) {
    const cls = classesNear(read(file), needle);
    if (TINY.test(cls) || FAINT.test(cls)) bad.push(`${file} ${needle} → "${cls}"`);
  }
  assert.deepEqual(bad, [], 'fine print slid back under 12px or under the ink floor:\n  ' + bad.join('\n  '));
});
