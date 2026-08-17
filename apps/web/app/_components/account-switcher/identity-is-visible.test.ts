/**
 * identity-is-visible.test.ts — the account control in the shared top bar has
 * to say who is signed in.
 *
 * ─── WHAT THE OWNER SAW (2026-08-17) ─────────────────────────────────────
 * A zoom of the top-right corner of the signed-in front door and four words:
 * *"what happened to the top nav?"* The bar was whole — wordmark, search,
 * "+ Create event", a live bell, the account menu. The account menu is what
 * looked broken: a box with an arrow in it and nothing else.
 *
 * Measured, not guessed. The avatar was the gold slot at 15% alpha over the
 * cream pill:
 *
 *   fill   #F0E9DD on #FDFBF7 → 1.17:1   (WCAG 1.4.11 asks 3:1 of a control)
 *   letter #8C6932 on #F0E9DD → 4.17:1   (AA asks 4.5:1 of 12px text)
 *
 * …and for this account the letter is "I", one vertical stroke. Nothing was
 * missing; the only thing identifying the person was invisible.
 *
 * 🔑 GOLD CANNOT PASS HERE AT ANY ALPHA. Solid `#A9834B` on cream is 3.37:1,
 * so every tint of it is worse than that — there was no "make the tint
 * stronger" fix, which is why the fill moved to the ink slot (13.82:1 both
 * ways, and it swaps correctly in dark because ink and cream ARE the swapped
 * pair).
 *
 * ─── WHY A NEW GUARD, AND WHY IT CHECKS ARITHMETIC ───────────────────────
 * Two guards already watch colour and NEITHER could see this — the same seam
 * that let `#9A8F86` live on five public routes:
 *
 *   • `lib/palette-lock.test.ts` checks token DEFINITIONS in globals.css. The
 *     token is correct; the defect was the ALPHA at the call site.
 *   • `scripts/lint-label-on-fill-contrast.mjs` checks call sites but, by its
 *     own docblock, judges only pairings where BOTH sides are opaque. An alpha
 *     fill is skipped by design.
 *
 * So this one composites the alpha itself and asserts the OUTCOME. Banning
 * `bg-terracotta/15` by name would pass while the same colour arrived spelled
 * any other way — and the numbers are the actual promise.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..');
const CSS = readFileSync(resolve(APP, 'globals.css'), 'utf8');
const SRC = readFileSync(resolve(HERE, 'account-switcher.tsx'), 'utf8');

/** Strip comments before matching — this file and the component both QUOTE the
 *  retired `bg-terracotta/15` to explain why it is gone, and a raw-source scan
 *  reads the explanation as the defect. (The doors guard pays for this same
 *  lesson; see `doors-are-designed.test.ts`.) */
function code(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, '');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank);
}

const CODE = code(SRC);

/* ─── COLOUR PLUMBING ────────────────────────────────────────────────────── */

/** `--color-cream: 253 251 247;` → `[253, 251, 247]`. These tokens are RGB
 *  TRIPLES, not hexes, because Tailwind composes them with `<alpha-value>`.
 *  Reads the FIRST definition, which is `:root` (light); the `.dark` fork
 *  swaps ink and cream for each other, so a pair built from both is
 *  symmetrical by construction and needs no second measurement. */
function token(name: string): [number, number, number] {
  const m = CSS.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`));
  assert.ok(m, `token --${name} is not defined as an RGB triple in globals.css — renamed?`);
  return [Number(m![1]), Number(m![2]), Number(m![3])];
}

type RGB = [number, number, number];

/** What the eye actually receives when `alpha` of `fg` is painted over `bg`. */
function composite(fg: RGB, bg: RGB, alpha: number): RGB {
  return [0, 1, 2].map((i) => alpha * fg[i]! + (1 - alpha) * bg[i]!) as RGB;
}

function relativeLuminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: RGB, b: RGB): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const round = (n: number) => Math.round(n * 100) / 100;

const CREAM = token('color-cream');
const INK = token('color-ink');
const GOLD = token('color-terracotta');

/** The pill's own surface — `bg-cream`, opaque, so the avatar is composited
 *  against this and not against a guess. */
const PILL = CREAM;

/** WCAG 1.4.11: a control's own shape needs 3:1 against what it sits on.
 *  WCAG 1.4.3: 12px semibold text is normal text and needs 4.5:1. */
const UI_SHAPE = 3;
const AA_TEXT = 4.5;

/* ─── 1 · THE PREMISE — GOLD COULD NEVER HAVE WORKED ─────────────────────── */

test('the gold slot cannot make a visible avatar at any alpha, so this is not a tint bug', () => {
  const solid = contrast(GOLD, PILL);
  assert.ok(
    solid < UI_SHAPE + 0.5,
    `solid gold now measures ${round(solid)}:1 on the pill — if the gold token moved, ` +
      `re-derive this guard's conclusion instead of trusting its prose.`,
  );

  // The shipped defect, reproduced from the tokens rather than quoted.
  const tint15 = composite(GOLD, PILL, 0.15);
  assert.ok(
    contrast(tint15, PILL) < 1.3,
    `gold at 15% measured ${round(contrast(tint15, PILL))}:1 against the pill — expected ` +
      `~1.17:1. The tokens moved; re-measure before touching the component.`,
  );

  // Every alpha is worse than solid, so no tint of gold can reach 3:1.
  const best = Math.max(
    ...[0.15, 0.25, 0.4, 0.6, 0.8, 1].map((a) => contrast(composite(GOLD, PILL, a), PILL)),
  );
  assert.ok(
    best < UI_SHAPE + 0.5,
    `some alpha of gold reached ${round(best)}:1 — the premise of the ink fill changed.`,
  );
});

/* ─── 2 · THE AVATAR'S SHAPE IS PERCEIVABLE ──────────────────────────────── */

test('the trigger avatar is a shape you can see against the pill it sits in', () => {
  const trigger = triggerAvatarClasses();

  assert.ok(
    /\bbg-ink\b(?!\/)/.test(trigger),
    `the trigger avatar no longer carries an opaque \`bg-ink\` fill. Its classes: ${trigger}`,
  );
  assert.ok(
    !/\bbg-terracotta\/\d+\b/.test(trigger),
    `the trigger avatar is back on an alpha tint of the gold slot — that measures ` +
      `${round(contrast(composite(GOLD, PILL, 0.15), PILL))}:1 and reads as an empty box.`,
  );

  const ratio = contrast(INK, PILL);
  assert.ok(
    ratio >= UI_SHAPE,
    `the avatar fill measures ${round(ratio)}:1 against the pill; WCAG 1.4.11 asks ${UI_SHAPE}:1.`,
  );
});

/* ─── 3 · THE INITIAL INSIDE IT CLEARS AA ────────────────────────────────── */

test('the initial inside the avatar clears AA on its own fill', () => {
  const trigger = triggerAvatarClasses();
  assert.ok(
    /\btext-cream\b(?!\/)/.test(trigger),
    `the initial is no longer \`text-cream\` on the ink fill. Its classes: ${trigger}`,
  );

  const ratio = contrast(CREAM, INK);
  assert.ok(
    ratio >= AA_TEXT,
    `the initial measures ${round(ratio)}:1 on its fill; AA asks ${AA_TEXT}:1 of 12px text.`,
  );
});

/* ─── 4 · THE NAME, NOT THE MAILBOX ──────────────────────────────────────── */

test('the initial comes from the display name before the email', () => {
  assert.match(
    CODE,
    /const initial\s*=\s*\n?\s*\(data\.displayName\?\.trim\(\)\s*\|\|\s*data\.email\)\?\.charAt\(0\)/,
    'the trigger initial stopped preferring the display name — a person with a real name on ' +
      'their account is identified by their mail provider again.',
  );
});

/* ─── 5 · IT SAYS WHO IN WORDS WHEN NOTHING ELSE CLAIMS THE SLOT ─────────── */

test('the pill names the signed-in person when there is no event name to show', () => {
  assert.match(
    CODE,
    /const accountLabel\s*=\s*data\.displayName\?\.trim\(\)\s*\|\|\s*data\.email\s*\|\|\s*null/,
    'accountLabel is gone — the launcher and the front door lose the only words in this control.',
  );
  assert.match(
    CODE,
    /\{currentEventName \? \([\s\S]{0,400}?\) : accountLabel \? \(/,
    'the name is no longer the fallback branch of the event-name slot. Rendering both would put ' +
      'two identities in one pill; rendering neither is the box-with-an-arrow the owner photographed.',
  );
  assert.match(
    CODE,
    /className="hidden max-w-\[150px\] truncate text-xs font-medium text-ink\/80 lg:inline"/,
    'the account name lost its `hidden … lg:inline` gate or its truncation. The shared bar carries ' +
      'identity, search and this cluster on ONE row (owner struck the second row 2026-07-30), and ' +
      '"+ Create event" beside it is hidden below 1024 for exactly this reason.',
  );
});

/* ─── 6 · THE PANEL'S CIRCLE IS LEFT ALONE, ON PURPOSE ───────────────────── */

test('the panel header keeps its pale circle — the words beside it do the identifying', () => {
  const panel = panelAvatarClasses();
  assert.ok(
    /\bbg-terracotta\/15\b/.test(panel),
    'the panel header avatar changed too. It was deliberately NOT touched: it sits beside ' +
      '"Signed in as {name}", so the circle is decoration there and its faintness costs nothing. ' +
      'If this is an intended redesign, delete this test rather than loosening it.',
  );
});

/* ─── LOCATING THE TWO AVATARS ───────────────────────────────────────────── */

/**
 * The component draws THREE avatar circles — the panel header, the trigger
 * pill, and the icon-rail trigger — and a file-level match cannot tell them
 * apart. A file-level count is exactly the decoration this repo keeps
 * catching itself shipping, so each is located by its own anchor.
 */
function classesAfter(anchor: RegExp, what: string, nth = 1): string {
  const at = CODE.search(anchor);
  assert.ok(at >= 0, `could not find the ${what} in account-switcher.tsx — anchor moved.`);
  const window = CODE.slice(at, at + 1400);
  const all = [...window.matchAll(/className="([^"]*rounded-full[^"]*)"/g)].map((m) => m[1]!);
  assert.ok(
    all.length >= nth,
    `expected at least ${nth} rounded-full className(s) after the ${what}, found ${all.length}.`,
  );
  return all[nth - 1]!;
}

/**
 * Inside the `<button>` that opens the panel, i.e. the thing in the top bar.
 *
 * 🪤 `nth = 2` IS LOAD-BEARING. The pill BUTTON is itself `rounded-full`, so
 * the first match is the button and the first cut of this guard read the
 * button's own `bg-cream` as the avatar's fill and reported a defect that was
 * not there. The avatar is the circle INSIDE it.
 */
function triggerAvatarClasses(): string {
  return classesAfter(
    /aria-label="Open account switcher"[\s\S]{0,600}?onClick=\{\(\) => setOpen/,
    'trigger pill',
    2,
  );
}

/** Inside SwitcherPanelBody's "Signed in as" header. */
function panelAvatarClasses(): string {
  return classesAfter(/border-b border-ink\/10 px-4 py-3/, 'panel identity header');
}
