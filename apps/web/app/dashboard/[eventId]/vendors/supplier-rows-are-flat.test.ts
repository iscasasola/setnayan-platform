/**
 * supplier-rows-are-flat.test.ts — THE SUPPLIERS PAGE'S CATEGORY ROWS ARE THE APP'S ROWS.
 *
 * Owner, 2026-10-21, on desktop Suppliers › Find ("Cover your event · Covered 5 of 10"):
 * *"why do i see shadows? the rows do not follow our design template for the app."*
 * House rule (owner 2026-10-11): a frame only on what you press; topics are split by a divider.
 * A row of the template (`app/_components/form-row.tsx`) is a line between rows, its name, one
 * quiet second line, no box, no shadow. Each category row here is pressable as a whole (its head
 * is the button), but it is a ROW of a list, so it wears the list's line, not a card's lift.
 *
 * WHAT WENT WRONG, so the guard aims at the cause, not a spelling of it: the one-screen shape
 * draws each folder as `.fold.flat` and says `box-shadow:none` — but every folder is also
 * `.open`, and `.slcat .fold.open{box-shadow:var(--edge-lift-open)}` sits LATER in the same
 * stylesheet at the SAME weight, so it won. Nothing in the flat rule was wrong; the CASCADE was.
 * A text match on the flat rule (find-rows.test.ts T1 has one) stayed green the whole time.
 *
 * 🔑 SO THIS GUARD RUNS THE CASCADE. It parses the bench's stylesheet (`SLCAT_CSS`), finds every
 * rule whose selector can match an open flat folder / a category row in it (by the element's
 * classes and its ancestors'), and resolves each property by specificity, then order — the way a
 * browser does. A shadow, a radius, a fill or a border box that RESOLVES onto the row fails, from
 * whatever rule it comes. Resting state only: selectors with a pseudo-class or an attribute are
 * conditional and are left out (a press may answer with a soft fill).
 *
 *   T1  an open flat folder resolves to no shadow, no fill, no radius, no border;
 *   T2  a category row (closed and open) resolves to no shadow, no fill, no radius; its head row
 *       carries at most a hairline (blur 0);
 *   T3  the row wears the TEMPLATE's line and second line — the same two strings FormRow draws
 *       with (`lib/form-row.ts`), so the two cannot drift; the bench sets none of the second
 *       line's type itself;
 *   T4  "In your plan" is the row's state word (`.cat-st`, plain type), never a pill — and the
 *       state word itself is plain type.
 *
 * SABOTAGE, each seen red (2026-10-21, PR body has the runs): delete the `.fold.flat.open` rule ·
 * give `.slcat .fold.flat .cat` a box-shadow · put `font-family:var(--mono)` back on `.cat-locked`
 * · draw "In your plan" as `cat-plan` in the flat shape · drop `FORM_ROW_RULE` from the head row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { FORM_ROW_RULE, FORM_ROW_SUBLINE } from '@/lib/form-row';

const WEB = process.cwd();
const BENCH_SRC = readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'vendors', '_components', 'shortlist-categories.tsx'), 'utf8');
const BENCH = stripComments(BENCH_SRC);
const FORM_ROW = stripComments(readFileSync(join(WEB, 'app', '_components', 'form-row.tsx'), 'utf8'));

// ── the stylesheet ──────────────────────────────────────────────────────────
const cssStart = BENCH_SRC.indexOf('const SLCAT_CSS = `');
const cssEnd = BENCH_SRC.indexOf('\n`;', cssStart);
const CSS = BENCH_SRC.slice(cssStart + 'const SLCAT_CSS = `'.length, cssEnd).replace(/\/\*[\s\S]*?\*\//g, '');

type Rule = { selector: string; decls: Map<string, string>; order: number };

/** Flat list of style rules, `@media` / `@supports` bodies included, `@keyframes` skipped. */
function parse(css: string): Rule[] {
  const out: Rule[] = [];
  let order = 0;
  const walk = (src: string) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf('{', i);
      if (open === -1) break;
      const prelude = src.slice(i, open).trim();
      // the matching close brace
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') depth -= 1;
        j += 1;
      }
      const body = src.slice(open + 1, j - 1);
      if (prelude.startsWith('@keyframes')) {
        /* not a style rule */
      } else if (prelude.startsWith('@')) {
        walk(body);
      } else {
        const decls = new Map<string, string>();
        for (const d of body.split(';')) {
          const k = d.indexOf(':');
          if (k > 0) decls.set(d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim());
        }
        for (const sel of prelude.split(',')) out.push({ selector: sel.trim(), decls, order: order++ });
      }
      i = j;
    }
  };
  walk(css);
  return out;
}
const RULES = parse(CSS);

// ── a small selector matcher (classes, tags, descendant chains) ─────────────
type El = { tag?: string; classes: string[] };
type Compound = { tag: string | null; classes: string[]; conditional: boolean };

function compounds(selector: string): Compound[] {
  return selector
    .replace(/\s*[>+~]\s*/g, ' ')
    .trim()
    .split(/\s+/)
    .map((c) => {
      const tag = /^[a-z][a-z0-9-]*/i.exec(c)?.[0] ?? null;
      const classes = [...c.matchAll(/\.([\w-]+)/g)].map((m) => m[1]!);
      return { tag, classes, conditional: /[:[]/.test(c) };
    });
}
const fits = (c: Compound, el: El) => !c.conditional && (!c.tag || c.tag === el.tag) && c.classes.every((k) => el.classes.includes(k));

/** Does `selector` match the last element of `chain` (outermost first)? */
function matches(selector: string, chain: El[]): boolean {
  const cs = compounds(selector);
  const last = cs.at(-1);
  if (!last || !fits(last, chain.at(-1)!)) return false;
  let at = chain.length - 2;
  for (let k = cs.length - 2; k >= 0; k -= 1) {
    while (at >= 0 && !fits(cs[k]!, chain[at]!)) at -= 1;
    if (at < 0) return false;
    at -= 1;
  }
  return true;
}
function specificity(selector: string): number {
  const cs = compounds(selector);
  return cs.reduce((n, c) => n + c.classes.length * 100 + (c.tag ? 1 : 0), 0);
}

/** The value `prop` resolves to on the chain's last element (any of `aliases`, last-wins), or null. */
function resolved(chain: El[], ...aliases: string[]): { value: string; from: string } | null {
  let best: { s: number; o: number; value: string; from: string } | null = null;
  for (const r of RULES) {
    for (const p of aliases) {
      const v = r.decls.get(p);
      if (v === undefined || !matches(r.selector, chain)) continue;
      const s = specificity(r.selector);
      if (!best || s > best.s || (s === best.s && r.order > best.o)) best = { s, o: r.order, value: v, from: `${r.selector}{${p}:${v}}` };
    }
  }
  return best ? { value: best.value, from: best.from } : null;
}

const isNone = (v: string | undefined) => v === undefined || /^(none|0|0px|transparent)$/i.test(v.trim());
/** A shadow that is only a hairline: every layer has blur 0 and offsets ≤ 1px. */
function hairlineOnly(v: string): boolean {
  if (isNone(v)) return true;
  if (/var\(/.test(v)) return false; // cannot prove it is flat
  return v.split(/,(?![^(]*\))/).every((layer) => {
    const lens = [...layer.matchAll(/(-?[\d.]+)(px)?(?![\d.]*%)/g)].map((m) => Number(m[1]));
    const [x = 0, y = 0, blur = 0] = lens;
    return Math.abs(x) <= 1 && Math.abs(y) <= 1 && blur === 0;
  });
}

const HTML: El = { tag: 'html', classes: [] };
const SLCAT: El = { tag: 'div', classes: ['slcat'] };
const FOLD: El = { tag: 'section', classes: ['fold', 'open', 'flat'] };
const IN_FOLD: El[] = [HTML, SLCAT, FOLD, { tag: 'div', classes: ['fold-collapse'] }, { tag: 'div', classes: ['fold-body'] }];
const CAT_CLOSED: El = { tag: 'div', classes: ['cat'] };
const CAT_OPEN: El = { tag: 'div', classes: ['cat', 'open'] };
const HEAD_ROW: El = { tag: 'div', classes: ['cat-head-row'] };

test('the scan read the real stylesheet (an empty read is a green lie)', () => {
  assert.ok(cssStart > -1 && cssEnd > cssStart, 'SLCAT_CSS moved or was renamed — re-anchor');
  assert.ok(RULES.length > 300, `parsed only ${RULES.length} rules`);
  // anti-vacuity: the matcher sees the rules that set the folder's look at all
  assert.ok(resolved([HTML, SLCAT, FOLD], 'margin'), 'no rule matched the open flat folder');
  assert.ok(resolved([...IN_FOLD, CAT_CLOSED], 'margin'), 'no rule matched a category row');
});

test('T1 · an open flat folder resolves to no shadow, no fill, no radius, no border', () => {
  const chain = [HTML, SLCAT, FOLD];
  const shadow = resolved(chain, 'box-shadow');
  assert.ok(!shadow || isNone(shadow.value), `the open folder of rows wears a shadow: ${shadow?.from}`);
  const bg = resolved(chain, 'background', 'background-color');
  assert.ok(!bg || /^(none|transparent)$/.test(bg.value), `the folder has a fill: ${bg?.from}`);
  const radius = resolved(chain, 'border-radius');
  assert.ok(!radius || isNone(radius.value), `the folder has a radius: ${radius?.from}`);
  const border = resolved(chain, 'border', 'border-width');
  assert.ok(!border || isNone(border.value), `the folder has a border box: ${border?.from}`);
});

test('T2 · a category row — closed or open — is no card; its head row draws at most a hairline', () => {
  for (const cat of [CAT_CLOSED, CAT_OPEN]) {
    const chain = [...IN_FOLD, cat];
    const label = cat.classes.join('.');
    const shadow = resolved(chain, 'box-shadow');
    assert.ok(!shadow || isNone(shadow.value), `.${label} wears a shadow: ${shadow?.from}`);
    const bg = resolved(chain, 'background', 'background-color');
    assert.ok(!bg || /^(none|transparent)$/.test(bg.value), `.${label} has a fill: ${bg?.from}`);
    const radius = resolved(chain, 'border-radius');
    assert.ok(!radius || isNone(radius.value), `.${label} has a radius: ${radius?.from}`);
    const head = resolved([...chain, HEAD_ROW], 'box-shadow');
    assert.ok(!head || hairlineOnly(head.value), `.${label}'s head row wears a drop shadow: ${head?.from}`);
  }
});

test("T3 · the row wears the template's line and second line — FormRow's own strings", () => {
  // The template builds its rows from the same two strings, so the two looks cannot drift apart.
  assert.match(FORM_ROW_RULE, /\bborder-t\b/);
  assert.match(FORM_ROW, /export const FORM_ROW_BAND = `\$\{FORM_ROW_RULE\} first:border-t-0`;/);
  assert.match(FORM_ROW, /data-form-row-line="" className=\{`mt-0\.5 block \$\{FORM_ROW_SUBLINE\}`\}/);
  assert.match(FORM_ROW_SUBLINE, /text-ink\/\d+/);
  // The bench imports them from the pure module (not the component, which would ship FormRow in its bundle).
  assert.match(BENCH, /import \{ FORM_ROW_RULE, FORM_ROW_SUBLINE \} from '@\/lib\/form-row';/);
  // The row's line: the head row wears the template rule in the one-screen shape; the row draws no border of its own.
  assert.match(BENCH, /className=\{replan \? `cat-head-row \$\{FORM_ROW_RULE\}` : 'cat-head-row'\}/);
  const own = resolved([...IN_FOLD, CAT_CLOSED], 'border-top', 'border');
  assert.ok(!own || isNone(own.value), `the row draws its own line beside the template's: ${own?.from}`);
  // The supplier line under a booked row: the template's second line, and the bench sets none of its type.
  assert.match(BENCH, /className=\{`cat-locked \$\{FORM_ROW_SUBLINE\}`\}/);
  const lockedChain = [...IN_FOLD, CAT_CLOSED, { tag: 'p', classes: ['cat-locked'] }];
  for (const p of ['font-family', 'font-size', 'color', 'letter-spacing', 'text-transform']) {
    const r = resolved(lockedChain, p);
    assert.equal(r, null, `the supplier line's ${p} is the bench's, not the template's: ${r?.from}`);
  }
});

test('T4 · "In your plan" is the row\'s state word, never a pill; the state word is plain type', () => {
  const at = BENCH.indexOf('>In your plan</span>');
  assert.ok(at > -1, 'the "In your plan" word moved — re-anchor');
  // In the one-screen shape it is the state word…
  assert.match(BENCH, /replan \? \(\s*<span className="cat-st" data-row-state="planned">In your plan<\/span>/);
  // …and the pill survives only in the boxed (flag-off) shape.
  const pills = [...BENCH.matchAll(/<span className="cat-plan">In your plan<\/span>/g)].length;
  assert.equal(pills, 1, `expected the flag-off pill once, found ${pills}`);
  const st = [...IN_FOLD, CAT_CLOSED, { tag: 'span', classes: ['cat-st'] }];
  for (const p of ['background', 'background-color', 'border', 'border-radius', 'text-transform', 'font-family']) {
    const r = resolved(st, p);
    assert.equal(r, null, `the state word carries ${p}: ${r?.from}`);
  }
});
