/**
 * THE BENCH IS LEGIBLE — every label, on its own fill, in both themes.
 *
 * ── WHY A THIRD CONTRAST GUARD EXISTS ───────────────────────────────────────
 * Two already ship, both run on every PR, and **both report all-clear over this
 * screen while it carries text at 2.22:1**:
 *
 *   • `scripts/lint-label-on-fill-contrast.mjs` knows how to read colours
 *     written three ways. The bench's stylesheet is a template literal of raw
 *     CSS inside a .tsx file, which is a fourth way. It matches nothing here —
 *     not a bug in it, a blind spot.
 *   • `app/dashboard/[eventId]/gold-is-not-text.test.ts` DOES sweep this file,
 *     and every one of its rules is a list of known-bad colour VALUES. The
 *     values at fault were not on the list, so it passed. A deny-list is a bill
 *     you have to keep paying.
 *
 * 🔑 SO THIS ONE COMPUTES INSTEAD OF MATCHING. It parses the stylesheet, resolves
 * the custom properties, composites the alpha tints over the real card, and
 * works out the ratio. A colour nobody has seen before is caught the first time
 * it ships, which is the whole difference between a deny-list and a measurement.
 *
 * ── THE FAILURE THIS FAMILY KEEPS PRODUCING ─────────────────────────────────
 * A colour on a WASH OF ITSELF loses about half a point of contrast. Gold on a
 * gold tint, green on a green tint, terracotta on an ink tint — each looks
 * deliberate, each reads as a designed label, and each is a little too faint.
 * Measured on this file before the fix: `● N locked` 4.18:1 · `In your plan`
 * 4.33:1 · the `Verified` tick 4.43:1 · and **our own `Setnayan` badge at
 * 3.89:1, the least readable text on the page and behind no flag at all**.
 *
 * And in dark mode the token block re-pointed every neutral and forgot the
 * golds, so the same labels landed at 2.22:1 and 2.32:1 — worse than the light
 * failures that started the review.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(import.meta.dirname, '..');
const BENCH = 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx';
const src = readFileSync(join(WEB, BENCH), 'utf8');

// ── colour maths ────────────────────────────────────────────────────────────
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Composite `rgba(r,g,b,a)` (or a hex at alpha 1) over an opaque background. */
function flatten(colour: string, bg: string): string {
  const rgba = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(colour);
  if (!rgba) return colour;
  const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map((v) => Number(v));
  const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
  const back = bg.replace('#', '');
  const mix = [0, 2, 4].map((i, k) =>
    Math.round([r, g, b][k]! * a + parseInt(back.slice(i, i + 2), 16) * (1 - a)),
  );
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The pairings this screen actually renders, each with the surface its tint
 * sits on. Hand-listed rather than scraped, and that is deliberate: scraping
 * this stylesheet would need a CSS parser, and a parser that silently matched
 * nothing is exactly how the two shipped guards came to pass on 2.22:1 text.
 * A row here is a claim someone checked.
 *
 * ⚠ ADD A ROW WHEN YOU ADD A TINTED LABEL. The guard cannot know about a
 * pairing nobody told it about — but it CAN prove that every pairing it knows
 * about still passes, in both themes, whatever the colours become.
 */
const LIGHT_CARD = '#ffffff';
const DARK_CARD = '#2A2E36';

/**
 * ⚠ COLOURS ARE READ OUT OF THE STYLESHEET, NEVER HAND-TYPED HERE.
 * The first cut of this guard listed the hex values in a table and computed the
 * ratio from the TABLE — so changing the colour in the CSS left the guard
 * measuring a value the screen no longer used, and a sabotage that put the
 * pale badge back scored GREEN. Two of six mutations passed before this was
 * rewritten. A guard that measures its own copy of the answer measures nothing.
 */
function ruleFor(selector: string): string {
  const at = src.indexOf(selector + '{');
  if (at === -1) return '';
  return src.slice(at, src.indexOf('}', at) + 1);
}

/** `--gold-text:var(--m-orange-deep,#5C4726)` → `#5C4726`; a plain hex passes through. */
function resolve(value: string, theme: 'light' | 'dark'): string | null {
  const hex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/.exec(value);
  if (value.startsWith('#') && hex) return hex[0];
  const varName = /var\((--[a-z-]+)/.exec(value)?.[1];
  if (!varName) return hex ? hex[0] : null;
  // ⚠ THERE IS MORE THAN ONE `html.dark .slcat{...}` TOKEN BLOCK, and the first
  // one is the neutrals. Reading only the first is how the earlier cut of this
  // resolver reported the golds as unset and produced a false failure.
  if (theme === 'dark') {
    const darkBlocks = [...src.matchAll(/html\.dark \.slcat\{([^}]*)\}/g)].map((m) => m[1] ?? '');
    for (const block of darkBlocks.reverse()) {
      const inDark = new RegExp(`${varName}:\\s*([^;}]+)`).exec(block);
      if (inDark) return resolve(inDark[1]!.trim(), theme);
    }
  }
  const lightBlock = src.slice(src.indexOf('.slcat{'), src.indexOf('.slcat{') + 1400);
  const inLight = new RegExp(`${varName}:\\s*([^;}]+)`).exec(lightBlock);
  if (inLight) return resolve(inLight[1]!.trim(), theme);
  // A `var(--x, #hex)` fallback IS the value when --x is defined elsewhere in
  // the app; taking it is right, and returning null here would silently score
  // the pairing against black.
  return hex ? hex[0] : null;
}

type Pairing = {
  name: string;
  /** The rule whose `color:` and `background:` make the pairing. */
  selector: string;
  /** A later rule that overrides only the colour in dark mode, if any. */
  darkSelector?: string;
};

const PAIRINGS: readonly Pairing[] = [
  { name: '● N locked (folder summary)', selector: '.slcat .fsum .s.lk' },
  { name: 'In your plan', selector: '.slcat .cat-plan' },
  // "Your order" — the couple's own arrangement is in force on this rail (S8).
  // It is gold-on-a-gold-wash, which is the exact family this guard exists for:
  // every one of the four failures that created it was a colour on a wash of
  // itself.
  { name: 'Your order', selector: '.slcat .arrl' },
  { name: 'Verified badge', selector: '.slcat .vc .bdg.verified', darkSelector: 'html.dark .slcat .vc .bdg.verified' },
  {
    name: 'Setnayan badge',
    selector: '.slcat .vc .bdg.setnayan',
    // ⚠ Its dark colour comes from a GROUPED selector further down, and being
    // later it wins. Named explicitly so this guard measures what renders, not
    // what the nearest rule says.
    darkSelector: 'html.dark .slcat .vc .bdg.setnayan',
  },
  // ── "Where you stand" (2026-09-09) ────────────────────────────────────────
  // The sentence added to every contacted supplier's card. Its label and its
  // one call-to-act segment both use --gold-text, and BOTH SIT ON THE PLAIN
  // CARD rather than on a gold wash — the wash is precisely what cost the four
  // pairings above half a point each. Listed here because this guard cannot
  // know about a pairing nobody told it about.
  { name: 'Where you stand (label)', selector: '.slcat .vc .stand .lab' },
  { name: 'Where you stand (body)', selector: '.slcat .vc .stand' },
  { name: 'waiting on you', selector: '.slcat .vc .stand b.need' },
  { name: 'the roll-up', selector: '.slcat .replied' },
  { name: 'the roll-up names', selector: '.slcat .replied .who' },
];

const AA = 4.5;

function measure(p: Pairing, theme: 'light' | 'dark'): { name: string; r: number; fg: string; bg: string } {
  const base = ruleFor(p.selector);
  const tint = /background:\s*(rgba?\([^)]*\)|#[0-9A-Fa-f]{3,6})/.exec(base)?.[1] ?? '';
  let colourDecl = /color:\s*([^;}]+)/.exec(base)?.[1]?.trim() ?? '';
  if (theme === 'dark' && p.darkSelector) {
    // Every rule that sets this selector in dark; the LAST one wins in CSS.
    const all = [...src.matchAll(new RegExp(`[^\\n]*${p.darkSelector.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`, 'g'))];
    const last = all.at(-1)?.[1] ?? '';
    const c = /color:\s*([^;}]+)/.exec(last)?.[1]?.trim();
    if (c) colourDecl = c;
  }
  const fg = resolve(colourDecl, theme) ?? '#000000';
  const card = theme === 'light' ? LIGHT_CARD : DARK_CARD;
  const bg = tint ? flatten(tint, card) : card;
  return { name: p.name, r: ratio(fg, bg), fg, bg };
}

test('the scan read the real stylesheet (an empty read is a green lie)', () => {
  assert.ok(src.includes('const SLCAT_CSS'), 'the bench stylesheet is gone or renamed');
  assert.ok(src.length > 20000, `read only ${src.length} chars`);
  assert.equal(PAIRINGS.length, 10, 'the pairing list changed size — say so in the PR');
  // Every selector must actually be in the file, or the loop measures nothing
  // and reports a clean pass — the shape both shipped guards failed in.
  for (const p of PAIRINGS) {
    assert.ok(ruleFor(p.selector).length > 10, `${p.selector} is not in the stylesheet`);
  }
});

test('🔑 every tinted label on the bench clears AA, in BOTH themes', () => {
  const failures: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    for (const p of PAIRINGS) {
      const m = measure(p, theme);
      if (m.r < AA) failures.push(`${theme}: ${m.name} — ${m.r.toFixed(2)}:1 (${m.fg} on ${m.bg})`);
    }
  }
  assert.deepEqual(
    failures,
    [],
    'a label on its own tint fell below 4.5:1. Deepen the TEXT; never lighten the tint alone.',
  );
});

test('🔑 the gold that carries TEXT is the one globals.css nominated', () => {
  // #5C4726 is --m-orange-deep, and globals.css states the reason beside it:
  // the two lighter golds score 3.37:1 / 4.21:1 on the gold wash and this
  // clears at 7.50:1. The bench had simply never used it.
  assert.ok(
    /--gold-text:var\(--m-orange-deep,#5C4726\)/.test(src),
    'the bench stopped using the only gold that may carry text',
  );
  // ⚠ AND NO TINTED LABEL MAY STILL REACH FOR THE FILL GOLD. `--gold-deep` is
  // legitimate as a BACKGROUND (white on it is fine); the failure was using it
  // for letters on a wash of itself.
  const tintedGoldText = (src.match(/color:var\(--gold-deep\);background:rgba\(169,131,75/g) ?? [])
    .length;
  assert.equal(tintedGoldText, 0, 'a gold label went back to the fill gold on a gold tint');
});

test('🔑 dark mode re-points the golds — the omission that cost 2.22:1', () => {
  assert.ok(
    /html\.dark \.slcat\{--gold:#E2B968;--gold-deep:#E2B968;--gold-text:#E2B968/.test(src),
    'the dark block forgot the golds again — every gold label goes back to ~2.2:1 on the dark card',
  );
});

test('🔑 --ink-faint is DEFINED, not merely used', () => {
  const uses = (src.match(/var\(--ink-faint\)/g) ?? []).length;
  assert.ok(uses >= 5, `expected the bench to use --ink-faint; found ${uses}`);
  const lightBlock = src.slice(src.indexOf('.slcat{'), src.indexOf('.slcat{') + 1400);
  assert.ok(
    /--ink-faint:#[0-9A-Fa-f]{6}/.test(lightBlock),
    'used and never defined — an undefined custom property is invalid at computed-value time, so the rule falls back to INHERITED ink and the search placeholder renders as body text',
  );
});

test('🔑 the free-dates popover uses the bench card, not the app-wide paper', () => {
  // --m-paper has no dark value, so this one panel stayed white in dark mode
  // while its text inherited near-white ink: 1.09:1, invisible.
  const pop = /\.slcat \.fd-pop\{[^}]*\}/.exec(src)?.[0] ?? '';
  assert.ok(pop.length > 0, 'the popover rule is gone');
  assert.ok(!/var\(--m-paper/.test(pop), 'the popover reads the app-wide paper again');
});
