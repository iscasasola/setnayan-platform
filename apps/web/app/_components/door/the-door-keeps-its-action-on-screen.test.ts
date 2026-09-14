/**
 * the-door-keeps-its-action-on-screen.test.ts — door 01's "Continue" stays on
 * the first screen of a phone, for every theme and every name length.
 *
 * ─── WHAT WAS WRONG ───────────────────────────────────────────────────────
 * `/{slug}/invite` door 01 is the screen a guest meets after scanning a printed
 * QR: a phone, no session, never seen the product. Measured in a browser on the
 * real component tree at 375×812 — the top of the "Continue" button, the event
 * carrying a date and no venue:
 *
 *     theme      "Cale & Ice"   27 chars   45 chars
 *     House          599           599        615
 *     Capiz          622           622        638
 *     Galeriya       635           654        691
 *     Velvet         648           669        720   ← merged, live, missed it
 *
 * against a 640 bar (what is left of 812 once a phone browser's own chrome is
 * on screen). Velvet missed it on a TEN-character name; the two themes whose
 * skin sets the name at 40px missed it on any long one.
 *
 * 🔑 THE BAR BELONGS TO THE DOOR, NOT TO A THEME. Shortening one theme's
 * ornament fixes one theme at one name length, and the next theme arrives with
 * the identical question. The fix is `DoorShell`'s, in three parts, and Abaca
 * inherits all three without knowing they exist:
 *
 *   1 · the column is TOP-RANGED below `sm` instead of centred — a centred card
 *       spends the fold twice, once on the air above it and again on every
 *       pixel saved below it (the column moves half as far as the content it
 *       lost, which is why "shorten the theme" could never win);
 *   2 · a tighter page rhythm below `sm` (`py-4`, the wordmark gap, the rail's
 *       margins, the content gap) — but NOT the card's own `p-6`, which two
 *       skins have written down as a literal (`capiz.module.css` positions its
 *       seal with `calc(-1.5rem - 33px)`, `galeriya.module.css` ranges its
 *       accent tab off `--ga-card-pad: 1.5rem`);
 *   3 · the name is FITTED, never truncated — `doorTitleFit` (lib/door-fold.ts)
 *       hands the shell a RATIO, which multiplies whatever size the theme asked
 *       for, so the shell imposes a ceiling without naming a size.
 *
 * ─── WHAT THIS FILE CAN AND CANNOT DO ─────────────────────────────────────
 * ⚠ IT DOES NOT MEASURE A PIXEL. `tsx --test` has no layout engine, so the
 * numbers below come from a browser at 375×812 and this file is (a) an
 * ARITHMETIC MODEL of the stack, calibrated against those 24 measured cells and
 * re-checked against every one of them, and (b) text pins on the three
 * mechanisms, because a model cannot see that the component still ranges from
 * the top. Say both; never upgrade "this file is green" to "it was measured
 * today".
 *
 * 🛡 WHAT MAKES IT ABLE TO FAIL. The model calls the SHIPPED `doorTitleFit`, so
 * weakening the fit moves every prediction; the per-theme name sizes are
 * re-read from the skins' own stylesheets, so a theme that enlarges its name is
 * caught; and every `ready` theme must be modelled, so a fifth theme cannot
 * ship invisible to this. Each was broken on purpose, the mutation counted, and
 * the result printed — see the changelog fragment.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { DOOR_FOLD_BAR, DOOR_TITLE_MIN_RATIO, doorTitleFit } from '@/lib/door-fold';
import { INVITE_THEME_IDS, INVITE_THEMES } from '@/lib/invite-themes';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
/**
 * Comments stripped — a note ABOUT a rule must never satisfy a check FOR it.
 * The repo's ONE stripper, per `scripts/lint-one-comment-stripper.mjs`: a
 * hand-rolled two-replace regex blanks a whole file the moment a line comment
 * contains `video/*`, and a guard then asserts against the blank and passes.
 */
const code = (src: string) => stripComments(src);

const THEMES_DIR = 'app/[slug]/invite/_components/themes';

/* ══════════════════════════════════════════════════════════════════════════
   THE MODEL
   ══════════════════════════════════════════════════════════════════════════ */

/** The card's content width at 375: 375 − 2×16 (px-4) − 2×24 (p-6) − 2×1 border. */
const CONTENT_W = 293;

/** A two-line meta ("Friday, December 18, 2026 · Sta. Maria Parish Church"). */
const VENUE_LINE = 16;

type ThemeModel = {
  /** y of "Continue" with a ONE-LINE name — everything above it except the name. */
  fixed: number;
  /** The name's size in px, as the theme sets it. Re-checked against the skin. */
  size: number;
  /** Its line box, as a multiple of the size. */
  lineHeight: number;
  /** Mean advance per character, as a multiple of the size — this face, this string. */
  charWidth: number;
};

/**
 * Calibrated from the browser, AFTER the fix, at 375×812, name "Cale & Ice",
 * date-only meta: `fixed` is that measured y minus the one-line name box.
 * (House 452 − 32 · Capiz 497 − 32 · Galeriya 523 − 38 · Velvet 550 − 42.)
 */
const MODEL: Record<string, ThemeModel> = {
  house: { fixed: 420, size: 24, lineHeight: 1.333, charWidth: 0.45 },
  capiz: { fixed: 465, size: 24, lineHeight: 1.333, charWidth: 0.45 },
  galeriya: { fixed: 485, size: 40, lineHeight: 0.94, charWidth: 0.46 },
  velvet: { fixed: 508, size: 40, lineHeight: 1.05, charWidth: 0.5 },
};

/** Where "Continue" starts, in px from the top of the document, at 375×812. */
function actionY(themeId: string, name: string, opts: { venue: boolean }): number {
  const m = MODEL[themeId];
  assert.ok(m, `no model for theme "${themeId}"`);
  const ratio = Number(doorTitleFit(name) ?? 1);
  const size = m.size * ratio;
  const lines = Math.max(1, Math.ceil((name.length * size * m.charWidth) / CONTENT_W));
  return m.fixed + lines * size * m.lineHeight + (opts.venue ? VENUE_LINE : 0);
}

/** The names the bar is claimed for. 27 is the minimum this row was set. */
const SHORT = 'Cale & Ice'; // 10
const LONG = 'Maria Cristina & Juan Pablo'; // 27
const LONGEST = 'Maria Cristina Villanueva & Juan Carlos Reyes'; // 45

/**
 * EVERY CELL MEASURED IN THE BROWSER AFTER THE FIX. The model must reproduce
 * each one — that is what stops a model being re-tuned until it is green.
 */
const MEASURED: ReadonlyArray<[string, string, boolean, number]> = [
  ['house', SHORT, false, 452], ['house', LONG, false, 450], ['house', LONGEST, false, 463],
  ['capiz', SHORT, false, 497], ['capiz', LONG, false, 495], ['capiz', LONGEST, false, 508],
  ['galeriya', SHORT, false, 523], ['galeriya', LONG, false, 557], ['galeriya', LONGEST, false, 564],
  ['velvet', SHORT, false, 550], ['velvet', LONG, false, 588], ['velvet', LONGEST, false, 596],
  ['house', SHORT, true, 468], ['house', LONG, true, 466], ['house', LONGEST, true, 479],
  ['capiz', SHORT, true, 513], ['capiz', LONG, true, 511], ['capiz', LONGEST, true, 524],
  ['galeriya', SHORT, true, 539], ['galeriya', LONG, true, 573], ['galeriya', LONGEST, true, 580],
  ['velvet', SHORT, true, 566], ['velvet', LONG, true, 604], ['velvet', LONGEST, true, 612],
];

test('the model reproduces the browser — all 24 measured cells, within 4px', () => {
  const rows: string[] = [];
  const wrong: string[] = [];
  for (const [theme, name, venue, measured] of MEASURED) {
    const predicted = Math.round(actionY(theme, name, { venue }));
    const drift = Math.abs(predicted - measured);
    rows.push(
      `${theme.padEnd(9)} len=${String(name.length).padStart(2)} ${venue ? 'venue  ' : 'no venue'} ` +
        `measured=${measured} model=${predicted} Δ=${drift}`,
    );
    if (drift > 4) wrong.push(`${theme}/${name.length}/${venue}: model ${predicted} vs measured ${measured}`);
  }
  console.log('\n' + rows.join('\n'));
  assert.deepEqual(
    wrong,
    [],
    'The arithmetic has drifted from the browser. Re-measure at 375×812 before ' +
      `touching a constant to make this pass: ${wrong.join(' · ')}`,
  );
});

test('"Continue" is above the fold on every live theme, at 27 characters and at 45', () => {
  const rows: string[] = [];
  const over: string[] = [];
  for (const themeId of INVITE_THEME_IDS) {
    if (!INVITE_THEMES[themeId].ready) continue;
    for (const name of [SHORT, LONG, LONGEST]) {
      // The venue line is the case a real couple has, so it is the one asserted.
      const y = Math.round(actionY(themeId, name, { venue: true }));
      rows.push(`${themeId.padEnd(9)} len=${String(name.length).padStart(2)}  y=${y}  bar=${DOOR_FOLD_BAR}  ${y < DOOR_FOLD_BAR ? 'ok' : 'BELOW THE FOLD'}`);
      if (y >= DOOR_FOLD_BAR) over.push(`${themeId} at ${name.length} chars: y=${y}`);
    }
  }
  console.log('\n' + rows.join('\n'));
  assert.deepEqual(
    over,
    [],
    'A guest who scanned a printed QR cannot see the one thing this screen is ' +
      `for without scrolling: ${over.join(' · ')}`,
  );
});

test('a name long enough to need it is actually set smaller — and never below a name', () => {
  // The fit is the part that carries the long names; a `doorTitleFit` that
  // returns nothing would leave every prediction above untouched ONLY because
  // the short cells dominate, so assert the ratio itself.
  assert.equal(doorTitleFit(SHORT), undefined, 'an ordinary two-name mark must be set exactly as its theme asks');
  const long = Number(doorTitleFit(LONGEST));
  assert.ok(long > 0 && long < 1, `a 45-character name is not being fitted (got ${doorTitleFit(LONGEST)})`);
  console.log(`\nfit: "${SHORT}" → none · "${LONG}" → ${doorTitleFit(LONG)} · "${LONGEST}" → ${doorTitleFit(LONGEST)}`);
  // 🔒 THE FLOOR IS A DESIGN LIMIT, NOT AN ARITHMETIC ONE. The bare door sets
  // the name at 24px over 16px body copy; a fit that put the couple's name
  // UNDER their own body copy would be a different defect, so the floor may
  // never drop there however much fold it would buy.
  assert.ok(
    DOOR_TITLE_MIN_RATIO * 24 > 16,
    `the floor sets the bare door's name at ${(DOOR_TITLE_MIN_RATIO * 24).toFixed(1)}px, at or under its own 16px body copy`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   THE PINS — what the model cannot see
   ══════════════════════════════════════════════════════════════════════════ */

/** The `<main>` frame's class list, sliced to the tag that opens the door. */
function doorFrameClasses(): string {
  const src = code(read('app/_components/door/door-shell.tsx'));
  const i = src.indexOf('min-h-dvh');
  assert.notEqual(i, -1, 'the door frame is gone or no longer full-height — re-anchor this guard');
  const line = src.slice(src.lastIndexOf("'", i), src.indexOf("'", i + 1) + 1);
  return line;
}

test('the door ranges from the top on a phone — centring is what halves every pixel saved', () => {
  const frame = doorFrameClasses();
  assert.match(frame, /\bjustify-start\b/, `the phone column is centred again: ${frame}`);
  assert.match(frame, /\bsm:justify-center\b/, `centring above sm was dropped, which is a look change nobody asked for: ${frame}`);
  assert.match(frame, /\bpy-4\b/, `the phone page padding is back to full height: ${frame}`);
});

test('the shell computes the fit from the title and carries it to the page frame', () => {
  const src = code(read('app/_components/door/door-shell.tsx'));
  assert.match(src, /doorTitleFit\(title\)/, 'DoorShell no longer asks lib/door-fold for the ratio');
  assert.match(src, /--door-title-fit/, 'the ratio never reaches the page — the property it rides is gone');
  assert.match(src, /data-door-title-fit/, 'the scope attribute is gone, so the globals.css rule can never match');
});

test('the card’s own padding is untouched — two skins have written it down as a literal', () => {
  // capiz positions its seal with calc(-1.5rem - 33px) and galeriya ranges its
  // accent tab off --ga-card-pad: 1.5rem. Both ARE DoorShell's `p-6`. Tightening
  // the card on a phone would move a seal and an accent tab off the edge they
  // trace, silently, on the live themes.
  const src = code(read('app/_components/door/door-shell.tsx'));
  const card = src.slice(src.indexOf('rounded-2xl'), src.indexOf('rounded-2xl') + 200);
  assert.match(card, /\bp-6\b/, `the card's phone padding changed: ${card.slice(0, 120)}`);
  assert.match(code(read(`${THEMES_DIR}/capiz.module.css`)), /calc\(-1\.5rem - 33px\)/, 'capiz no longer pins its seal to p-6 — re-check this pair');
  assert.match(code(read(`${THEMES_DIR}/galeriya.module.css`)), /--ga-card-pad:\s*1\.5rem/, 'galeriya no longer ranges off p-6 — re-check this pair');
});

test('the zoom rule exists, is scoped to a door, and only applies where there is a fold to lose', () => {
  const css = code(read('app/globals.css'));
  const i = css.indexOf('[data-door-title-fit]');
  assert.notEqual(i, -1, 'the rule that reads --door-title-fit is gone; the shell sets a property nothing renders');
  const window_ = css.slice(Math.max(0, i - 240), i + 160);
  assert.match(window_, /@media\s*\(max-width:\s*639px\)/, 'the fit is no longer phone-only — a long name would be shrunk on a desktop that has no fold to lose');
  assert.match(window_, /zoom:\s*var\(--door-title-fit\)/, 'the rule no longer applies the ratio');
  // 🪤 `transform: scale()` paints the name smaller and reserves exactly the
  // same height — it would move no pixel of the thing this file is for.
  assert.doesNotMatch(window_, /transform:\s*scale/, 'a transform changes no layout; the fold would be lost with every test still green');
});

/* ══════════════════════════════════════════════════════════════════════════
   THE COVERAGE — a fifth theme cannot ship invisible to this
   ══════════════════════════════════════════════════════════════════════════ */

test('every live theme is modelled, and the modelled name size is the size its skin sets', () => {
  const live = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].ready);
  assert.ok(live.length >= 4, `only ${live.length} themes are ready — this rule derives its set and a derivation that stopped matching reads exactly like a pass`);
  const missing = live.filter((id) => !MODEL[id]);
  assert.deepEqual(
    missing,
    [],
    'a theme is live with no entry here, so nobody has measured whether its door ' +
      `keeps its action on screen. Measure it at 375×812 and add it: ${missing.join(', ')}`,
  );
  // The modelled size is a claim ABOUT a stylesheet — so read the stylesheet.
  for (const id of live) {
    if (id === 'house') continue;
    const css = code(read(`${THEMES_DIR}/${id}.module.css`));
    const rule = css.match(/header\)?\s*h1\s*\{[^}]*\}/);
    const declared = rule?.[0].match(/font-size:\s*(\d+)px/)?.[1];
    const modelled = MODEL[id]?.size;
    if (declared) {
      assert.equal(
        Number(declared),
        modelled,
        `${id} sets its name at ${declared}px and this file models ${modelled}px — every number above is now wrong`,
      );
    } else {
      assert.equal(modelled, 24, `${id} sets no name size, so it inherits DoorShell's text-2xl (24px), not ${modelled}px`);
    }
  }
});
