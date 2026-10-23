import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

/**
 * THE FRONT DOOR'S SMALL PRINT IS READABLE — WCAG AA, COMPUTED.
 *
 * Quality sweep 2026-10-19, row C3: the rail's group captions ("things you
 * plan with", "things you do with people", "the things you make") and Home's
 * shelf rules ("earned, never sold", "public events only · …") painted
 * `--fd-m3` #A09A8E on the white page — 2.80:1, on every page the rail mounts.
 * The rail's Privacy · Terms line painted `--fd-m2`, 3.67:1; its "© 2026" and
 * "Set na 'yan" lines and Home's "couldn't load" label painted `--fd-m3` too.
 * AA for text this size is 4.5:1.
 *
 * 🔑 THE PROPERTY IS THE RATIO, NOT THE TOKEN NAME. This file resolves each
 * small-print rule's `color` through the `.fd` token block — light AND the
 * `html.dark .fd` pair — and computes the contrast against `--fd-cream`, the
 * ground the rail and the feed both sit on. Re-pointing a rule at any token
 * that reads 4.5 passes; re-tuning a token below 4.5 fails, whichever rule
 * uses it.
 *
 * ⚠ THE LIST IS ANCHORED TO THE MARKUP. Each entry names the source file that
 * renders it, and the test checks that file still does — so a class renamed in
 * the TSX fails here instead of leaving a guard that checks a rule nobody
 * renders.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
/** Comments stripped by the repo's one lexer, so prose about a colour never counts as one. */
const CSS = stripComments(readFileSync(join(HERE, 'front-door.css'), 'utf8'));
const src = (f: string) => readFileSync(join(HERE, f), 'utf8');

const AA = 4.5;

/** `selector` is the exact rule; `rendered` proves the markup still uses it. */
const SMALL_PRINT = [
  { selector: '.fd-smallprint', file: 'front-door-shell.tsx', rendered: /className="fd-smallprint"/ },
  { selector: '.fd-smallprint a', file: 'front-door-shell.tsx', rendered: /className="fd-smallprint"/ },
  { selector: '.fd-sechead .fd-rule', file: 'front-door-feed.tsx', rendered: /className="fd-rule"/ },
  { selector: '.fd-sechead .fd-rule', file: 'front-door-discover.tsx', rendered: /className="fd-rule"/ },
  { selector: '.fd-copy', file: 'front-door-shell.tsx', rendered: /className="fd-copy"/ },
  { selector: '.fd-tag2', file: 'front-door-shell.tsx', rendered: /className="fd-tag2"/ },
  { selector: '.fd-unknown', file: 'front-door-feed.tsx', rendered: /className="fd-unknown"/ },
] as const;

/** Every declaration block whose selector list is exactly `selector`. */
function blocks(selector: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const sels = m[1]!.split(',').map((s) => s.trim());
    if (sels.length === 1 && sels[0] === selector) out.push(m[2]!);
  }
  return out;
}

function tokens(selector: string): Record<string, string> {
  const b = blocks(selector);
  assert.ok(b.length > 0, `the ${selector} token block is gone`);
  const t: Record<string, string> = {};
  for (const m of b[0]!.matchAll(/(--fd-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) t[m[1]!] = m[2]!.toLowerCase();
  return t;
}

const LIGHT = tokens('.fd');
const DARK = { ...LIGHT, ...tokens('html.dark .fd') };

function resolve(value: string, set: Record<string, string>): string {
  const v = /var\((--fd-[\w-]+)\)/.exec(value);
  const hex = v ? set[v[1]!] : /#[0-9a-fA-F]{6}/.exec(value)?.[0]?.toLowerCase();
  assert.ok(hex, `cannot resolve colour "${value}" to a hex value`);
  return hex;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('the anchor: the token blocks parsed and the ratio maths is right', () => {
  assert.equal(LIGHT['--fd-cream'], '#ffffff');
  assert.ok(DARK['--fd-cream'] && DARK['--fd-cream'] !== LIGHT['--fd-cream'], 'the dark pair did not parse');
  assert.equal(contrast('#000000', '#ffffff').toFixed(0), '21');
  // The value the sweep measured in the browser, reproduced here.
  assert.equal(contrast('#a09a8e', '#ffffff').toFixed(2), '2.80');
});

for (const { selector, file, rendered } of SMALL_PRINT) {
  test(`${selector} (${file}) reads at least ${AA}:1 on the page, light and dark`, () => {
    assert.match(src(file), rendered, `${file} no longer renders ${selector} — update this list, do not delete the check`);
    const b = blocks(selector);
    assert.ok(b.length > 0, `the ${selector} rule is gone`);
    for (const decl of b) {
      const color = /(?:^|;)\s*color:\s*([^;]+)/.exec(decl)?.[1];
      if (!color) continue;
      for (const [mode, set] of [['light', LIGHT], ['dark', DARK]] as const) {
        const ratio = contrast(resolve(color, set), set['--fd-cream']!);
        assert.ok(
          ratio >= AA,
          `${selector} paints ${color.trim()} at ${ratio.toFixed(2)}:1 on the ${mode} page — under WCAG AA's ${AA}:1 ` +
            'for small text. Use a token that reads (--fd-m1 is 5.38:1 light, 8.2:1 dark).',
        );
      }
    }
  });
}
