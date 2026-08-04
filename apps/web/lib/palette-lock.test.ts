/**
 * PALETTE LOCK — Warm Editorial Archive (owner-locked 2026-08-01).
 *
 * WHY THIS EXISTS: the palette changed FOUR times in three weeks — Atelier gold
 * (07-12, declared "FINAL") → pure-white page (07-13) → Facebook grey + mandarin
 * (07-31) → Warm Editorial Archive (08-01). Each turn left stale values behind
 * that nothing caught: the `mulberry` tint ladder was still GOLD after that slot
 * had held terracotta, and the `--m-*` WCAG header still advertised a retired
 * obsidian CTA at 16.42:1. A doc row cannot stop that. This can.
 *
 * ⚠ THIS IS DELIBERATELY NOT A HAND-TYPED COMPARISON. Asserting
 * `expect(CTA).toBe('#C24E25')` would be two hand-typed strings that drift
 * together and keep CI green — the exact failure this repo has been bitten by
 * before. Instead it PARSES the live token values out of globals.css and
 * COMPUTES WCAG contrast from them. Change a token and the math re-runs; the
 * test can only pass if the palette is genuinely still accessible.
 *
 * THE NEAR-MISS IT WOULD HAVE CAUGHT: the CTA was first set to #C75026, which
 * clears AA against pure white (4.56:1) — but `.button-primary` labels with
 * `text-cream` (#FDFBF7), where it measures 4.41:1 and FAILS. A contrast check
 * against white waves that through. Case `cta/label` below checks the label the
 * app actually renders.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, '..', 'app', 'globals.css'), 'utf8');

/**
 * Every `:root { … }` block body, in file order.
 *
 * ⚠ Do NOT scope by slicing on the text `html.dark` — the string appears in a
 * prose comment at the top of globals.css explaining the light lock, ~45 lines
 * ABOVE the light token block, so the slice silently excludes the very tokens
 * it means to read. (That bug made the first version of this file throw
 * "token --color-cream not found" against a file that plainly defines it.)
 * CSS declarations do not nest, so the first `}` after `:root {` closes it.
 */
const ROOT_BLOCKS: string[] = (() => {
  const out: string[] = [];
  const re = /:root\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const start = m.index + m[0].length;
    const end = CSS.indexOf('}', start);
    if (end !== -1) out.push(CSS.slice(start, end));
  }
  return out;
})();

/** The first `:root` block that actually defines `name`. */
function blockDefining(name: string): string {
  const block = ROOT_BLOCKS.find((b) => new RegExp(`--${name}\\s*:`).test(b));
  assert.ok(
    block,
    `token --${name} is not defined in any :root block — renamed, deleted, or moved?`,
  );
  return block;
}

/** `--color-x: 253 251 247;` → `#FDFBF7`. Space-separated RGB triplet form. */
function rgbToken(name: string): string {
  const m = blockDefining(name).match(
    new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`),
  );
  assert.ok(m, `--${name} is defined but not as an "R G B" triplet`);
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** `--m-x: #FDFBF7;` → `#FDFBF7`. Hex form. */
function hexToken(name: string): string {
  const m = blockDefining(name).match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  const hex = m?.[1];
  assert.ok(hex, `--${name} is defined but not as a 6-digit hex`);
  return hex.toUpperCase();
}

/** WCAG 2.x relative luminance + contrast ratio. */
function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── The live values, read from source ──────────────────────────────────────
const PAGE = rgbToken('color-cream'); //   page + card
const INK = rgbToken('color-ink'); //      body text
const CTA = rgbToken('color-mulberry'); // primary buttons
const CTA_HOVER = rgbToken('color-mulberry-600');
const ACCENT = rgbToken('color-terracotta'); //     gold — highlights only
const ACCENT_TEXT = rgbToken('color-terracotta-700'); // gold's text escalation
const LINK = rgbToken('color-link'); //    links + secondary buttons

test('palette · body text clears AAA on the page', () => {
  const r = contrast(INK, PAGE);
  assert.ok(r >= 7, `ink ${INK} on ${PAGE} is ${r.toFixed(2)}:1 — needs ≥7 (AAA)`);
});

test('palette · the CTA clears AA against the label the app ACTUALLY renders', () => {
  // `.button-primary` uses `text-cream`, NOT `text-white`. Checking against
  // pure white would pass #C75026 (4.56:1) while the rendered pairing is
  // 4.41:1 and fails. See the header note.
  const r = contrast(PAGE, CTA);
  assert.ok(
    r >= 4.5,
    `CTA ${CTA} with its cream label ${PAGE} is ${r.toFixed(2)}:1 — needs ≥4.5 (AA). ` +
      `Do NOT fix this by switching the label to white; darken the fill.`,
  );
});

test('palette · the CTA hover state does not drop below the resting state', () => {
  const rest = contrast(PAGE, CTA);
  const hover = contrast(PAGE, CTA_HOVER);
  assert.ok(
    hover >= rest,
    `hover ${CTA_HOVER} (${hover.toFixed(2)}:1) is weaker than rest ${CTA} (${rest.toFixed(2)}:1)`,
  );
});

test('palette · links clear AA on the page', () => {
  const r = contrast(LINK, PAGE);
  assert.ok(r >= 4.5, `link ${LINK} on ${PAGE} is ${r.toFixed(2)}:1 — needs ≥4.5 (AA)`);
});

test('palette · gold has a text-safe escalation even though gold itself is UI-only', () => {
  // Gold is deliberately allowed to sit under 4.5 — it is for borders, rules,
  // pills and active states, never body copy. What must hold is that the
  // escalation token exists and IS text-safe, so a surface that needs gold-
  // coloured text has somewhere legal to go.
  const r = contrast(ACCENT_TEXT, PAGE);
  assert.ok(
    r >= 4.5,
    `gold's text escalation ${ACCENT_TEXT} is ${r.toFixed(2)}:1 on ${PAGE} — needs ≥4.5 (AA)`,
  );
});

test('palette · the CTA and the accent are DIFFERENT colours', () => {
  // The structural half of the lock, and the reason terracotta was introduced.
  // When `mulberry` and `terracotta` both held gold (through 2026-07-31), a
  // primary button was indistinguishable from a selected filter chip. Owner
  // locked the split 2026-08-01: terracotta acts, gold highlights.
  assert.notEqual(
    CTA,
    ACCENT,
    `CTA and accent are both ${CTA}. A primary action must not look like a ` +
      `selected state. Terracotta acts; gold highlights (owner-locked 2026-08-01).`,
  );
});

test('palette · the two token families have not drifted apart', () => {
  // `--color-*` drives app chrome, `--m-*` drives marketing. They describe the
  // same palette and have silently diverged before.
  assert.equal(hexToken('m-paper'), PAGE, '--m-paper has drifted from --color-cream');
  assert.equal(hexToken('m-ink'), INK, '--m-ink has drifted from --color-ink');
  assert.equal(hexToken('m-mulberry'), CTA, '--m-mulberry has drifted from --color-mulberry');
});

test('palette · the marketing CTA clears AA against its own hard-coded #fff label', () => {
  // `.m-btn-primary` sets `color: #fff` literally, so it is checked against
  // white — unlike `.button-primary`, which uses cream. Different label,
  // different floor; both must hold.
  const marketingCta = hexToken('m-mulberry');
  const r = contrast('#FFFFFF', marketingCta);
  assert.ok(
    r >= 4.5,
    `.m-btn-primary fill ${marketingCta} with its #fff label is ${r.toFixed(2)}:1 — needs ≥4.5`,
  );
});
