/**
 * lib/static-means-static.test.ts
 *
 * Owner 2026-09-20: a couple who has already paid ₱500 and presses "Use Static
 * Image" — *"Their guests see it still."* Paying unlocks the animation; it does
 * not force it on.
 *
 * Two halves, because either alone fails:
 *   1. the RULE — only a literal `anim.off === true` switches the animation off,
 *      so a malformed or partial write can never freeze a mark someone paid to
 *      see move;
 *   2. the WIRING — every gate that asks "is the animation owned?" in order to
 *      play the mark to guests must ALSO ask "has the couple switched it off?".
 *      A gate that asks only the first plays a mark the couple chose to keep
 *      still, and nothing on any screen would say so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { markAnimationSwitchedOff, sanitizeStudioConfig } from './monogram-studio-shared';

const BASE = {
  text: 'A & B',
  font: 'cardo',
  ink: '#5C2542',
  outlineColor: '#C5A059',
  bg: '#FBFBFA',
  st: [],
  order: [],
  pstate: {},
  strokes: [],
  syms: [],
};
const withAnim = (anim: Record<string, unknown>) => ({ ...BASE, anim: { kind: 'handwriting', dur: 6, smooth: 0.9, delay: 0.3, ...anim } });

test('only a literal true switches the animation off', () => {
  assert.equal(markAnimationSwitchedOff(withAnim({ off: true })), true);
  for (const v of [undefined, false, 'true', 1, null, 'yes']) {
    assert.equal(markAnimationSwitchedOff(withAnim({ off: v })), false, `off=${JSON.stringify(v)} must NOT freeze a paid mark`);
  }
  assert.equal(markAnimationSwitchedOff(null), false, 'no config at all = animate when owned');
  assert.equal(markAnimationSwitchedOff({ junk: 1 }), false);
});

test('the switch survives the sanitizer — it is stored, not dropped', () => {
  /* The sanitizer rebuilds `anim` field by field. If it forgot `off`, the switch
   * would save, round-trip through the next config write, and quietly vanish —
   * turning a still mark back on for guests without anyone touching it. */
  const clean = sanitizeStudioConfig(withAnim({ off: true }));
  assert.equal(clean?.anim?.off, true);
  const again = sanitizeStudioConfig(clean);
  assert.equal(again?.anim?.off, true, 'and survives a second pass');
  assert.equal(sanitizeStudioConfig(withAnim({}))?.anim?.off, undefined, 'absent stays absent');
});

/* ── The wiring ────────────────────────────────────────────────────────────
 * Every file that calls the paid gate to decide whether GUESTS see the mark
 * move must also consult the switch. Two callers are exempt, each for a reason
 * that is about WHAT they gate, not about convenience. */
const EXEMPT: Record<string, string> = {
  // The purchase / confirmation panel on the maker itself. It asks "is it
  // owned?" to decide what to SELL, not whether guests see motion.
  'app/dashboard/[eventId]/monogram/animated-monogram-upgrade.tsx': 'purchase panel — decides what to offer, not what guests see',
  // The 3D seating lab uses ownership to gate an arrival BLOOM, a different
  // effect from the monogram reveal.
  'app/dashboard/[eventId]/seating/lab/page.tsx': 'gates the arrival bloom, not the mark reveal',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

test('every gate that plays the mark to guests also asks whether it was switched off', () => {
  const files = ['app', 'lib'].flatMap((r) => walk(r));
  const callers: string[] = [];
  const missing: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // a CALL, not the definition in lib/animated-monogram.ts
    if (!/eventAnimatedMonogramActive\s*\(/.test(src) || f === 'lib/animated-monogram.ts') continue;
    callers.push(f);
    if (EXEMPT[f]) continue;
    if (!src.includes('markAnimationSwitchedOff(')) missing.push(f);
  }
  /* The floor: this guard proves nothing if the walk found no callers. The two
   * guest-facing gates plus the two exemptions are the known set today. */
  assert.ok(callers.length >= 4, `found only ${callers.length} callers of the paid gate — the walk is broken, not the code`);
  assert.deepEqual(
    missing,
    [],
    `${missing.length} gate(s) play the mark to guests without asking whether the couple switched it off:\n  ` +
      missing.join('\n  ') +
      '\n→ gate on `owned && !markAnimationSwitchedOff(studioConfig)`, or add a reasoned EXEMPT entry.',
  );
  // An exemption for a file that no longer calls the gate is dead weight.
  for (const f of Object.keys(EXEMPT)) assert.ok(callers.includes(f), `stale exemption: ${f} no longer calls the gate`);
});
