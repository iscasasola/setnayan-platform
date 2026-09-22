/**
 * the-print-never-reaches-the-wordmark.test.ts — Abaca's ground can print a
 * couple's photo INTO the paper without printing over the only way out.
 *
 * ─── WHAT IS AT RISK ──────────────────────────────────────────────────────
 * On the invite doors the Setnayan wordmark is the one piece of navigation a
 * door carries, it is the one piece of lettering that sits on the GROUND rather
 * than on the card, and on a dead or refused link it is the only thing left to
 * click. Abaca's ground is the couple's own photo multiplied into kraft —
 * multiply DARKENS and never lightens, so a couple who uploads a night shot
 * turns the paper under that wordmark black. Ink on black is 1.0:1.
 *
 * The design's answer is an opaque kraft patch — the wordmark is a torn strip
 * of gummed tape. `<Wordmark>` belongs to DoorShell and a skin may not reach it
 * (themes-stay-skins.test.ts), so abaca.module.css makes the patch the other
 * way round: the PHOTO is masked out of the crown of the page.
 *
 * ─── WHY THE MASK IS A PERCENTAGE, AND WHY THAT IS THE THING GUARDED ──────
 * Below `sm` the door's column is top-ranged and the wordmark sits at y=16→46
 * always. From `sm` DoorShell CENTRES it, so the wordmark floats with the
 * viewport — measured across 21 viewports its foot ran from 16px to 823px, a
 * 17× spread in pixels, but never past **38.1% of the page**. A fixed pixel
 * band that looks generous on a phone is nothing at 1280×1440. So the guard is
 * not "a mask exists": it re-reads the stops out of the stylesheet, works out
 * how far open the mask is at 38.1%, and computes what that leaves of the
 * wordmark's contrast over the worst photo a couple can upload — pure black.
 *
 * ⚠ WHAT IT CANNOT DO. It renders nothing. The 38.1% is a browser measurement
 * from 2026-09-14 (see abaca.module.css), not something this file re-measures,
 * and a DoorShell change that moved the wordmark further down the page would
 * make the arithmetic here correct and its premise stale. Say both.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
/** Comments stripped — a note ABOUT a mask must never satisfy a check FOR it. */
const css = stripComments(readFileSync(join(HERE, 'abaca.module.css'), 'utf8'));
const globals = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8'));

/**
 * The lowest the wordmark's foot ever sat, as a fraction of the page, over the
 * 21 viewports measured in a browser on 2026-09-14 (375×812 → 1920×2160). It
 * approaches 50% only as the viewport grows without bound.
 */
const WORDMARK_FOOT = 0.381;

/** Large text (the wordmark is 24px/800) passes AA at 3:1. */
const AA_LARGE = 3;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x!, y!) + 0.05) / (Math.min(x!, y!) + 0.05);
}
/** Kraft under a BLACK photo multiplied at mask alpha `a`: every channel × (1−a). */
function kraftUnderBlack(kraft: string, a: number): string {
  const h = kraft.replace('#', '');
  return (
    '#' +
    [0, 2, 4]
      .map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - a)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** The `.print` rule, sliced to its own braces. */
function printRule(): string {
  const i = css.indexOf('.print {');
  assert.notEqual(i, -1, 'the .print layer is gone — Abaca no longer prints the couple’s photo at all');
  return css.slice(i, css.indexOf('}', i));
}

test('the print is a MULTIPLY layer — which is why the worst case is a dark photo, not a bright one', () => {
  assert.match(
    printRule(),
    /mix-blend-mode:\s*multiply/,
    'the photo no longer multiplies into the kraft. That is the theme (the paper is the white point) ' +
      'AND it is the premise of every number below — a normal-blended photo can be light or dark, and ' +
      'the arithmetic here only covers "darker".',
  );
});

test('the mask is written as a fraction of the page, never as a pixel band', () => {
  const rule = printRule();
  const masks = [...rule.matchAll(/mask-image:\s*linear-gradient\(([^;]*)\)\s*;/g)].map((m) => m[1] ?? '');
  assert.equal(masks.length, 2, `expected mask-image and its -webkit- twin, found ${masks.length}`);
  assert.equal(masks[0], masks[1], 'the -webkit- twin has drifted from the standard property, so one engine gets a different ground');
  for (const m of masks) {
    assert.doesNotMatch(
      m,
      /\d+px/,
      'the mask is back to a PIXEL band. The wordmark floats with the viewport from `sm` — a band ' +
        `sized on a phone is nothing at 1280×1440, where its foot sits at ${Math.round(WORDMARK_FOOT * 100)}% of the page: ${m}`,
    );
    assert.match(m, /%/, `the mask has no percentage stop at all: ${m}`);
  }
});

test('over a pure black photo the wordmark still clears AA at the lowest it has ever sat', () => {
  const rule = printRule();
  const stops = [...(rule.match(/mask-image:\s*linear-gradient\(([^;]*)\);/) ?? [])][1] ?? '';
  // `transparent 0, transparent A%, #000 B%, …` — A is where the mask starts to
  // open and B is where it is fully open.
  const clear = Number(/transparent\s+(\d+(?:\.\d+)?)%/.exec(stops)?.[1]);
  const full = Number(/#000\s+(\d+(?:\.\d+)?)%/.exec(stops)?.[1]);
  assert.ok(
    Number.isFinite(clear) && Number.isFinite(full) && full > clear,
    `could not read the ramp out of the mask — re-anchor this guard rather than deleting it: ${stops}`,
  );

  /*
    🪤 THE TOKEN MOVED, THE FACT DID NOT (2026-09-22). `--ab-kraft` used to be
    declared in abaca.module.css; it now lives in globals.css under
    `[data-invite-theme='abaca'], [data-hub-theme='abaca']`, because the Event
    Hub pages behind this door wear the same material and cannot import this
    stylesheet. Both files are read so this guard keeps measuring the colour
    that actually ships, wherever it is declared — re-anchored rather than
    relaxed, and it still fails if the token disappears entirely.
  */
  const kraft =
    /--ab-kraft:\s*(#[0-9a-f]{6})/i.exec(css)?.[1] ??
    /--ab-kraft:\s*(#[0-9a-f]{6})/i.exec(globals)?.[1];
  assert.ok(kraft, 'the kraft token is gone from BOTH the skin stylesheet and globals.css');
  // The wordmark takes its colour from `--m-ink`; Velvet rebinds that token for
  // its own page and Abaca deliberately does not, so this is the real value.
  const ink = /--m-ink:\s*(#[0-9a-f]{6})/i.exec(globals)?.[1];
  assert.ok(ink, '--m-ink is gone from globals.css — the wordmark’s colour is no longer knowable here');

  const fraction = WORDMARK_FOOT * 100;
  const alpha = fraction <= clear ? 0 : Math.min(1, (fraction - clear) / (full - clear));
  const ground = kraftUnderBlack(kraft!, alpha);
  const ratio = contrast(ink!, ground);
  console.log(
    `\nmask ${clear}% → ${full}% · wordmark foot at ${fraction}% of the page · mask ${(alpha * 100).toFixed(1)}% open` +
      `\nkraft ${kraft} under a black photo → ${ground} · ${ink} on it = ${ratio.toFixed(2)}:1 (need ${AA_LARGE}:1)` +
      `\nbare kraft, no photo: ${contrast(ink!, kraft!).toFixed(2)}:1`,
  );
  assert.ok(
    ratio >= AA_LARGE,
    `a couple who uploads a night shot gets a wordmark at ${ratio.toFixed(2)}:1 — the one way out of the ` +
      `door, on the ground, unreadable. Open the mask later (a larger first stop) or ramp it more slowly.`,
  );
  // The bare sheet is the other end of the same claim and is what the theme
  // looks like for a couple with no photo at all.
  assert.ok(contrast(ink!, kraft!) >= 4.5, `the bare kraft itself fails AA for normal text: ${contrast(ink!, kraft!).toFixed(2)}:1`);
});
