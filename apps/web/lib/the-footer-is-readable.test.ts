/**
 * the-footer-is-readable.test.ts — DAY-30.
 *
 * Every public page carries the marketing footer, and six of its seven text roles
 * failed AA against their own ground (`--hr-bg` #f2f2f0). Nothing down there is
 * large text — the biggest is 13.5px — so the bar is 4.5:1, not 3:1.
 *
 *     --hr-grey    #8c8884   3.14:1   tagline · nav links · the DPO email
 *     --hr-grey-2  #a8a4a0   2.21:1   column headings · the base line
 *     --hr-ink     #54514d   7.04:1   the wordmark — the only one that passed
 *
 * The worst case was the **Data Protection Officer** contact: the words at 2.21:1
 * and the address at 3.14:1. The one line on the page the law names was the least
 * readable thing on it.
 *
 * ── WHAT THIS GUARD CLAIMS ─────────────────────────────────────────────────────
 * It RESOLVES the colours out of the shipped stylesheet, composites nothing (these
 * are opaque), and asks the contrast — it does not forbid a spelling. A future
 * lightening of any footer role fails here with the role, the colour and the number.
 *
 * It also pins the ROLES: a guard that only checked the two tokens would go green
 * the day somebody pointed a footer rule back at `--hr-grey`.
 *
 * ⚠ THE ARITHMETIC IS NOT REIMPLEMENTED. `contrastRatio` comes from
 * `lib/story-light.ts`, the app's one copy — a second copy is how two files start
 * disagreeing about whether a page is readable.
 *
 * ⚠ AND THE SCOPE IS HONEST. `--hr-grey` / `--hr-grey-2` carry ~54 text roles across
 * the whole marketing reskin and fail there for the same arithmetic. This row fixed
 * the footer and reported the rest; this guard therefore asserts the FOOTER and says
 * so, rather than implying the site is clear.
 *
 * 🛡 Sabotage-checked, each mutation still parsing, with the role count printed
 * before the colour is read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contrastRatio, type Rgb } from '@/lib/story-light';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(
  join(HERE, '..', 'app', '_components', 'home', 'home-reskin.css'),
  'utf8',
);

/** AA for normal text. Every role below is normal text — the largest is 13.5px. */
const AA = 4.5;

function hexToken(name: string): Rgb {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  assert.ok(m, `token --${name} is gone from home-reskin.css`);
  const h = m[1]!.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb;
}

/**
 * The colour a footer rule actually paints, resolved through its token.
 *
 * ⚠ THE BLOCK IS TAKEN FROM THE FIRST `{` AFTER THE SELECTOR TO ITS MATCHING
 * `}`, AND THE FIRST VERSION OF THIS FUNCTION DID NOT. It allowed `[^{]*\{`
 * between the selector and the body, which walked past `.hr-foot-base`'s own
 * block and read `.hr-foot-base a`'s instead — so the base line reported the
 * LINK's colour. Both happened to pass, so the test was green about the wrong
 * cell. A window that can slide is a window that will.
 */
function ruleBody(selector: string): string {
  const at = css.indexOf(selector);
  assert.ok(at >= 0, `selector \`${selector}\` is gone from home-reskin.css`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  assert.ok(open > 0 && close > open, `\`${selector}\` has no declaration block`);
  return css.slice(open + 1, close);
}

function roleColour(selector: string): Rgb {
  const m = /color:\s*var\(--([\w-]+)\)/.exec(ruleBody(selector));
  assert.ok(m, `no colour in \`${selector}\`'s own block — the rule lost its colour`);
  return hexToken(m[1]!);
}

test('every footer text role clears 4.5:1 on the footer’s own ground', () => {
  const ground = hexToken('hr-bg');
  const roles: Array<[string, string]> = [
    ['.hr-foot-tag', 'the tagline (13px)'],
    ['.hr-foot-col h3', 'column headings (11px/500)'],
    ['.hr-foot-linkbtn {', 'the nav links and buttons (13.5px)'],
    ['.hr-foot-base {', 'the base line — “Data Protection Officer ·” (12px)'],
    ['.hr-foot-base a', 'the DPO email address (12px)'],
    ['.hr-foot-word', 'the wordmark (20px serif)'],
  ];
  console.log(`  ground --hr-bg = ${ground.join(',')} · roles checked: ${roles.length}`);
  assert.equal(roles.length, 6, 'the role list changed — re-measure before editing this number');

  const failures: string[] = [];
  for (const [sel, what] of roles) {
    const ink = roleColour(sel);
    const r = contrastRatio(ink, ground);
    console.log(`  ${r >= AA ? 'PASS' : 'FAIL'} ${r.toFixed(2).padStart(5)}:1  ${ink.join(',')}  ${what}`);
    if (r < AA) failures.push(`${what} reads ${r.toFixed(2)}:1, below the ${AA}:1 AA bar`);
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
});

test('the two footer greys stay a PAIR — the hierarchy is not flattened', () => {
  /*
   * Solving both roles to the bar collapses them onto each other. The column
   * headings are deliberately quieter than the links, and a footer where every
   * line shouts equally is a different regression from an unreadable one.
   */
  const loud = hexToken('hr-foot-ink');
  const quiet = hexToken('hr-foot-ink-2');
  const ground = hexToken('hr-bg');
  const rl = contrastRatio(loud, ground);
  const rq = contrastRatio(quiet, ground);
  console.log(`  loud ${rl.toFixed(2)}:1 · quiet ${rq.toFixed(2)}:1 · separation ${(rl - rq).toFixed(2)}`);
  assert.ok(rl > rq, 'the quieter footer grey is no longer quieter than the louder one');
  assert.ok(rl - rq >= 0.4, `the two footer greys have collapsed to ${(rl - rq).toFixed(2)} apart`);
});
