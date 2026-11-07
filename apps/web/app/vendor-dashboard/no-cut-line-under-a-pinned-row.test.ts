/**
 * no-cut-line-under-a-pinned-row.test.ts — ✂ NO CUT LINE UNDER A PINNED ROW (THE ONE BUILD F3 / guard G4, 8 Nov 2026).
 *
 * Owner, v110 "No cut line": a row that sticks to the top says it is above the page with the SOFT HAIRLINE — the token
 * `--sn-hair` drawn as a shadow (class `sn-pin-hair`, or the shared parts below) — never `border-b border-ink/10`, a hard
 * line drawn into the row's own box.
 *
 * What it holds:
 *   1. no sticky row under `app/vendor-dashboard/**` wears a `border-b` — except the KNOWN rows each owning lane is
 *      moving onto `sn-pin-hair` in THE ONE BUILD. That list ONLY SHRINKS: a new offender is red, and a row that has
 *      been fixed must leave the list (a stale entry is red too), so the count goes to 0 as the lanes land;
 *   2. the shared pinned row's divider and the collapsing top read `var(--sn-hair)` and draw no border;
 *   3. the class itself is the hairline token as a shadow, light and dark pairs present.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): `border-b border-ink/10` added to a sticky row in
 * `vendor-dashboard/_components/vendor-rail-context.tsx` (red: a new offender); the pinned-row divider put back to
 * `rgb(var(--color-ink) / 0.1)` (red: test 2).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * The rows each lane moves onto `sn-pin-hair` in its own files (spec §9 #12: "each owner applies the token in its own
 * files"). Owner lane in brackets. Remove a line the moment its row is fixed — this list may only shrink.
 */
const KNOWN: Record<string, string> = {
  'app/vendor-dashboard/customers/_components/customers-pin.tsx': 'L2 — Clients pinned row',
  'app/vendor-dashboard/clients/[eventId]/page.tsx': 'L2 — the client page header',
  'app/vendor-dashboard/shop/_components/shop-segments.tsx': 'C4 — Shop segments row',
  'app/vendor-dashboard/_components/supplier-open-row.tsx': 'C1 — Today open row',
  'app/vendor-dashboard/_components/today-counts.tsx': 'C1 — Today counts row',
  'app/vendor-dashboard/services/_components/canvas-maker.tsx': 'C4 — the canvas maker head',
};

/** Every className string literal (quoted or template) that is sticky AND carries a bottom border. */
function cutLines(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|'([^']*)')/g)) {
    const cls = m[1] ?? m[2] ?? m[3] ?? '';
    if (/(^|\s)sticky(\s|$)/.test(cls) && /(^|\s)border-b(\s|$|-|\/)/.test(cls)) out.push(cls);
  }
  return out;
}

test('no sticky supplier row draws a hard bottom border — the known rows only shrink', () => {
  const found: Record<string, number> = {};
  for (const file of walk(join(WEB, 'app', 'vendor-dashboard'))) {
    const n = cutLines(stripComments(readFileSync(file, 'utf8'))).length;
    if (n) found[relative(WEB, file)] = n;
  }
  const fresh = Object.keys(found).filter((f) => !(f in KNOWN));
  assert.deepEqual(fresh, [], `a NEW sticky row with a border-b (a cut line) — use the class sn-pin-hair:\n${fresh.join('\n')}`);
  const fixed = Object.keys(KNOWN).filter((f) => !(f in found));
  assert.deepEqual(fixed, [], `these rows no longer draw a cut line — take them OFF the KNOWN list (it only shrinks):\n${fixed.join('\n')}`);
  // eslint-disable-next-line no-console
  console.log(`cut lines left under a pinned row: ${Object.keys(found).length} (target 0)`);
});

test('the shared pinned row and the collapsing top read the soft hairline, never a border', () => {
  const pin = read('app/_components/pinned-row/pinned-row.module.css');
  const after = /\.pin::after \{([^}]*)\}/.exec(pin)?.[1] ?? '';
  assert.match(after, /background: var\(--sn-hair\);/, 'the pinned row divider is not the soft hairline token');
  assert.doesNotMatch(pin, /border-bottom/);
  const ct = read('app/_components/collapsing-top/collapsing-top.css');
  assert.match(ct, /\.sn-ct\[data-pinned\] \{\s*box-shadow: 0 1px 0 var\(--sn-hair\);/, 'the locked top does not draw the hairline');
  assert.doesNotMatch(stripComments(ct), /border-bottom|border-b\b/, 'the collapsing top draws a border');
});

test('sn-pin-hair is the hairline as a shadow; the token has light and dark values', () => {
  const css = read('app/globals.css');
  assert.match(css, /\.sn-pin-hair \{\s*box-shadow: 0 1px 0 var\(--sn-hair\);\s*\}/);
  assert.match(css, /--sn-hair: rgb\(44 42 41 \/ 0\.08\);/, 'light hairline is not ink at 8 %');
  assert.match(css, /--sn-hair: rgb\(251 250 247 \/ 0\.1\);/, 'dark hairline is not paper at 10 %');
});
