/**
 * a-tap-target-is-reachable.test.ts — an icon button a thumb cannot hit.
 *
 * ── The defect (register ST-11) ─────────────────────────────────────────────
 * The story moment row's remove control — and its two reorder siblings — were
 * `p-1.5` around an `h-4 w-4` icon. That is **16px of icon plus 12px of padding
 * = a 28×28 target**, on a row a host edits on a phone. WCAG 2.5.5 and the
 * Apple HIG both put the floor at **44px**.
 *
 * 🔑 IT IS INVISIBLE TO EVERY OTHER CHECK. It renders correctly, it is
 * keyboard-reachable, it has an `aria-label`, contrast passes, and no test can
 * fail on it — the only symptom is a person on a phone tapping three times and
 * deleting the wrong moment. A control being *drawn* small is not the defect;
 * being *hittable* only when small is.
 *
 * ── Why a baseline and not a sweep ──────────────────────────────────────────
 * Measured across `app/`: **20 controls in 15 files** share the shape. Fixing
 * all twenty in one pass would put twenty unreviewed visual changes into a
 * bundle about something else, and some may sit in dense admin tables where 44px
 * genuinely does not fit and the answer is a different layout, not a bigger box.
 *
 * So: the three ST-11 named are fixed, the rest are frozen, and the count can
 * only go down. Same contract as `supabase-unread-error.baseline.txt` —
 * **DEBT, not permission.**
 *
 * ⚠ Scope, stated plainly: this matches `p-1`/`p-1.5` on a `<button>` with no
 * `min-h` floor. It is a shape check, not a computed-layout check — a control
 * sized by a parent, by CSS, or by a component wrapper is invisible to it. It
 * catches the common Tailwind shape in this repo and says so rather than
 * implying more.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const BASELINE = join(WEB, 'lib/touch-target.baseline.txt');

/** `p-1` or `p-1.5` with no 44px floor declared alongside it. */
const SMALL_PAD = /\bp-1(\.5)?\b/;
const HAS_FLOOR = /min-h-(11|12|\[44)/;
const BUTTON = /<button[^>]*?className="([^"]*)"[^>]*?>/gs;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (abs.endsWith('.tsx') && !abs.includes('.test.')) out.push(abs);
  }
  return out;
}

function currentCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const abs of walk(join(WEB, 'app'))) {
    const src = readFileSync(abs, 'utf8');
    let n = 0;
    for (const m of src.matchAll(BUTTON)) {
      const cls = m[1]!;
      if (SMALL_PAD.test(cls) && !HAS_FLOOR.test(cls)) n += 1;
    }
    if (n > 0) counts.set(abs.slice(WEB.length + 1), n);
  }
  return counts;
}

function baseline(): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of readFileSync(BASELINE, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [file, n] = line.split('\t');
    out.set(file!, Number(n));
  }
  return out;
}

test('no NEW icon button lands under the 44px touch floor', () => {
  const now = currentCounts();
  const base = baseline();

  const total = [...now.values()].reduce((a, b) => a + b, 0);
  console.log(
    `[tap-target] ${now.size} file(s), ${total} control(s) under 44px · baseline ${base.size} file(s)`,
  );
  // Floors: a walk that found nothing must not read as a clean tree.
  assert.ok(base.size >= 10, `baseline looks truncated (${base.size} files)`);
  assert.ok(now.size >= 1, 'the matcher found nothing at all — it has stopped working');

  const grown: string[] = [];
  for (const [file, n] of now) {
    const was = base.get(file) ?? 0;
    if (n > was) grown.push(`${file}  ${was} → ${n}`);
  }
  assert.deepEqual(
    grown,
    [],
    'An icon button was added or shrunk below the 44px touch floor (WCAG 2.5.5 / Apple HIG).\n' +
      'Add `inline-flex min-h-11 min-w-11 items-center justify-center` — the icon keeps its ' +
      'drawn size, only the hit area grows.\n  ' + grown.join('\n  '),
  );

  const paid = [...base].filter(([f, n]) => (now.get(f) ?? 0) < n).map(([f]) => f);
  if (paid.length) console.log(`#   ${paid.length} paid down — lower them: ${paid.join(', ')}`);
});

test('the control ST-11 named now meets the floor', () => {
  const rel = 'app/dashboard/[eventId]/website/photo-moments/_components/photo-moments-editor.tsx';
  const src = readFileSync(join(WEB, rel), 'utf8');

  const floored = (src.match(/min-h-11 min-w-11/g) ?? []).length;
  assert.equal(
    floored,
    3,
    `the moment row should have 3 floored controls (move up, move down, remove) — found ${floored}`,
  );
  // And the label the register named must still be one of them: a fix that
  // widened two reorder arrows and left the destructive control small would
  // pass a bare count.
  const removeAt = src.indexOf('aria-label="Remove moment"');
  assert.ok(removeAt > 0, 'the Remove moment control has moved — re-aim this test');
  // ⚠ The window must span the WHOLE opening tag. `className` comes AFTER
  // `aria-label` in this JSX, so slicing from `<button` to the label excludes
  // the very attribute under test — the first version of this assertion did
  // exactly that and failed against correct code.
  const openTag = src.lastIndexOf('<button', removeAt);
  const tagEnd = src.indexOf('>', removeAt);
  assert.ok(tagEnd > openTag, 'could not find the end of the Remove button tag');
  assert.match(
    src.slice(openTag, tagEnd),
    /min-h-11 min-w-11/,
    'the REMOVE control is the one ST-11 named, and it is still under the floor — widening its ' +
      'siblings does not fix the destructive one',
  );
});
