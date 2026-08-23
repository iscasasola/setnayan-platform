import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * editorial-gold-reads.test.ts — the story page's eyebrows can be read.
 *
 * ⚠ THE SLOT NAMED `terracotta` IN THIS REPO IS THE ATELIER GOLD #A9834B, and
 * the action colour lives in the slot named `mulberry`. Inherited, backwards,
 * and the single most common colour mistake made here: `text-terracotta` LOOKS
 * like the safe brand colour and is the unsafe one.
 *
 * Measured on the page ground: **3.48:1**, under the 4.5:1 floor for the 12px
 * type these eyebrows are set in. `terracotta-700` is the same gold one step
 * deeper — 5.02:1 light, 5.17:1 on the candlelight ground — so the page keeps
 * its champagne-gold accent instead of trading it for a different colour.
 *
 * ⛔ WHAT THIS DOES NOT FORBID: the lighter gold on an `aria-hidden` decorative
 * glyph. Those carry no text, the 3:1 non-text bar applies, and 3.48:1 clears
 * it. A guard that banned the token outright would have forced a real design
 * change to go green — and a guard that fails on correct code gets deleted.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = ['editorial-content.tsx', 'living-moments.tsx'];

/**
 * Blank every comment while KEEPING LINE NUMBERS, so the guard reads code and
 * still points at the right line when it fires.
 *
 * 🪤 THE FIRST VERSION OF THIS SKIPPED ONLY `//` AND `*` LINES, AND IT WENT RED
 * ON THE COMMENT THAT EXPLAINS THE FIX — a JSX block naming the very token it
 * had just removed. That is the third time this week a guard has reported the
 * defect it repaired; a stripper is not optional when the change quotes its own
 * subject.
 */
function codeLines(src: string): string[] {
  const stripped = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, (m) => m.replace(/[^\n]/g, ' '));
  return stripped.split('\n').map((l) => (l.trimStart().startsWith('//') ? '' : l));
}

test('no gold-as-text on the story page — and the decorative glyphs are left alone', () => {
  let decorative = 0;
  for (const f of FILES) {
    const lines = codeLines(readFileSync(join(HERE, f), 'utf8'));
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      if (!/(hover:)?\btext-terracotta\b(?!-)/.test(l)) continue;
      /*
        The ONLY permitted use is a decorative glyph, and it must SAY it is one
        on the same element — `aria-hidden` is what moves it under the 3:1
        non-text bar. An unlabelled gold string here is text nobody can read.
      */
      assert.ok(
        l.includes('aria-hidden'),
        `${f}:${i + 1} carries gold-as-text at 3.48:1 — use text-terracotta-700 (5.02:1).\n  ${l.trim()}`,
      );
      decorative++;
    }
  }
  /*
    🔑 FLOORED, SO AN EMPTY SWEEP CANNOT PASS SILENTLY. If both decorative uses
    are ever removed this goes red and asks to be re-read, rather than quietly
    becoming a test of nothing — which is what a file-level "no matches" check
    would have degraded into the first time somebody moved a component.
  */
  assert.equal(
    decorative,
    2,
    `expected the 2 aria-hidden decorative golds and found ${decorative} — re-read this guard.`,
  );
});

test('the eyebrows really are set in the deeper gold', () => {
  // The positive half. Without it, deleting every eyebrow would also pass.
  const src = FILES.map((f) => codeLines(readFileSync(join(HERE, f), 'utf8')).join('\n')).join('\n');
  const deep = (src.match(/text-terracotta-700/g) ?? []).length;
  assert.ok(deep >= 6, `only ${deep} eyebrows carry the readable gold — expected the full set.`);
});
