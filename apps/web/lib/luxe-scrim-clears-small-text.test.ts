/**
 * lib/luxe-scrim-clears-small-text.test.ts — LUXE'S SMALL TEXT CLEARS AA OVER
 * THE CHANDELIER LOOP, AND NO OTHER THEME MOVED.
 *
 * Born from the RSVP prototype's measurement (DECISION_LOG 2026-09-27, owner
 * "YES TO ALL" row, last sentence): at Luxe's shipped 62% scrim, muted body
 * text and the gold small-caps/counts (Luxe's `accent`, same hex as its
 * `heading`) measured under WCAG AA_BODY (4.5:1) over the loop's brighter
 * cluster — 4.8:1 and 3.5:1 respectively. The fix deepens `INVITE_THEMES.velvet
 * .scrim.opacity` from 0.62 to 0.86; `hub-legibility.ts`'s `theme-ground`
 * branch (the one `resolveThemeGround` calls) reads that as its FLOOR, so
 * every consumer — the guest page's fixed loop backdrop
 * (`app/[slug]/_components/guest-look-scope.tsx`), the print pieces
 * (`lib/print-pieces.ts`) — picks it up with no code change of its own.
 *
 * This is a PROPERTY test, not a phrasing match: it recomputes the real WCAG
 * contrast ratio from the theme's own tokens, the same arithmetic
 * `hub-legibility.ts` uses, so a reworded comment or a renamed hex cannot walk
 * past it — only an actual regression in the numbers can.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUB_THEMES, INVITE_THEMES } from '@/lib/invite-themes';
import { AA_BODY, AA_LARGE, compositeOver, contrastRatio, hubLegibility } from '@/lib/hub-legibility';

const luxe = INVITE_THEMES.velvet;

test('Luxe (velvet) scrim floor is 0.86, not 0.62', () => {
  assert.ok(luxe.scrim, 'Luxe lost its scrim entirely');
  assert.equal(luxe.scrim!.opacity, 0.86, "Luxe's scrim floor regressed off 0.86");
  assert.equal(luxe.scrim!.color, '#0e0504', "Luxe's scrim colour is no longer its own canvas");
});

test('Luxe body, muted-as-ink and gold accent all clear AA over the loop’s lightest AND darkest cluster', () => {
  assert.ok(luxe.media, 'Luxe has no loop to measure against');
  const samples = [luxe.media!.samples.light, luxe.media!.samples.dark];
  const leg = hubLegibility(luxe, { kind: 'theme' });

  // The rule's own answer (body ink + whichever heading/accent it resolved to).
  for (const s of samples) {
    const painted = compositeOver(leg.scrim.color, leg.scrim.opacity, s);
    assert.ok(
      contrastRatio(leg.ink, painted) >= AA_BODY - 1e-9,
      `Luxe body ink over ${s} (scrimmed ${painted}) is ${contrastRatio(leg.ink, painted).toFixed(2)}:1, under AA_BODY`,
    );
    assert.ok(
      contrastRatio(leg.heading, painted) >= AA_LARGE - 1e-9,
      `Luxe heading over ${s} is ${contrastRatio(leg.heading, painted).toFixed(2)}:1, under AA_LARGE`,
    );
  }

  // The specific small-text roles the prototype measured failing: Luxe's own
  // `muted` (secondary/small body copy) and its `accent` gold (small caps,
  // counts) — used verbatim by CSS (`--hub-muted`/`--hub-accent`), never
  // swapped for the adaptive ink the way `leg.heading`/`leg.accent` are, so
  // they must clear AA_BODY on the THEME'S OWN scrim directly, not on
  // whatever `hubLegibility` decided to fall back to.
  for (const s of samples) {
    const painted = compositeOver(luxe.scrim!.color, luxe.scrim!.opacity, s);
    const mutedRatio = contrastRatio(luxe.palette.muted, painted);
    const goldRatio = contrastRatio(luxe.palette.accent, painted);
    assert.ok(mutedRatio >= AA_BODY - 1e-9, `Luxe muted text over ${s} is ${mutedRatio.toFixed(2)}:1, under AA_BODY (4.5)`);
    assert.ok(goldRatio >= AA_BODY - 1e-9, `Luxe gold accent over ${s} is ${goldRatio.toFixed(2)}:1, under AA_BODY (4.5)`);
  }
});

test('Luxe’s documented `measured` values are internally consistent with its own tokens (not just prose)', () => {
  const samples = [luxe.media!.samples.light, luxe.media!.samples.dark];
  const worst = (ink: string) =>
    Math.min(...samples.map((s) => contrastRatio(ink, compositeOver(luxe.scrim!.color, luxe.scrim!.opacity, s))));
  // Documentation only (no consumer reads `measured` at runtime) — held to a
  // loose tolerance against the live arithmetic so a docs/code drift is still
  // caught, without demanding the exact 5th-percentile methodology the design
  // session used on the real footage.
  assert.ok(Math.abs(worst(luxe.palette.ink) - luxe.measured.body) < 2, 'measured.body drifted from the tokens');
  assert.ok(Math.abs(worst(luxe.palette.muted) - luxe.measured.muted) < 2, 'measured.muted drifted from the tokens');
  assert.ok(Math.abs(worst(luxe.palette.accent) - luxe.measured.heading) < 2, 'measured.heading drifted from the tokens');
  assert.ok(luxe.measured.body >= AA_BODY && luxe.measured.muted >= AA_BODY, 'measured body/muted no longer document an AA pass');
});

test('every OTHER theme’s scrim is byte-identical — only Luxe moved', () => {
  const expected: Record<string, { color: string; opacity: number } | null> = {
    house: null,
    abaca: { color: '#fbf0e4', opacity: 0.86 },
    galeriya: { color: '#f5f0eb', opacity: 0.86 },
    cinderella: { color: '#eef3f8', opacity: 0.82 },
    vintage: { color: '#eadbc6', opacity: 0.88 },
    whimsical: { color: '#fbf7f0', opacity: 0.84 },
    regency: { color: '#f6efe6', opacity: 0.86 },
    gatsby: { color: '#110504', opacity: 0.64 },
    cyber: { color: '#0b0a12', opacity: 0.58 },
  };
  for (const t of HUB_THEMES) {
    if (t.id === 'velvet') continue;
    assert.deepEqual(t.scrim, expected[t.id], `${t.id}'s scrim moved — this pass touches Luxe only`);
  }
  assert.equal(Object.keys(expected).length, HUB_THEMES.length - 1, 'a theme was added or removed — update this list');
});
