import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 🔤 A TITLE LOOK PICKED IN THE MAKER IS DRAWN ON THE PAGE.
 *
 * Measured 2026-10-11 on the page's own scope (375 px): with `data-part-look="eyebrow.serif"` on the Title its
 * computed face was dmMono, 10.56 px, uppercase, 2.96 px tracking — the shipped look, unchanged. The pill kept the
 * eyebrow's dark ink on its dark ground; Flanked's right rule was the eyebrow's own hairline
 * (`hub-walk/maker-fixes/shots/_sheet-title-looks.png`, left four).
 *
 * Why: the Title is the page's eyebrow (`pahina-masthead.tsx`: `<p {...el('eyebrow')} className="pahina-eyebrow …">`),
 * and every guest page stands inside `.sn-editorial` (`guest-look-scope.tsx`). `.sn-editorial .pahina-eyebrow` is
 * (0,2,0); each look was written `html [data-part-look="eyebrow.x"]` — (0,1,1) — and lost every property the two
 * share. (Tailwind's `@layer components` is not a cascade layer in the built sheet: specificity decides.) The Maker
 * lab had drawn its cover outside `.sn-editorial`, so the looks were only ever seen working there.
 *
 * This holds the ARITHMETIC, on the stylesheet itself: every rule of every Title look out-ranks the eyebrow rule it
 * shares an element with.
 */
const CSS = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
const MASTHEAD = readFileSync(join(process.cwd(), 'app', '[slug]', '_components', 'pahina-masthead.tsx'), 'utf8');

/** A selector's specificity [ids, classes · attributes · pseudo-classes, elements · pseudo-elements]; `:is()` = its best argument. */
function specificity(selector: string): [number, number, number] {
  let s = selector;
  let extra: [number, number, number] = [0, 0, 0];
  s = s.replace(/:is\(([^()]*)\)/g, (_m, args: string) => {
    const best = args.split(',').map((a) => specificity(a.trim())).sort((x, y) => y[0] - x[0] || y[1] - x[1] || y[2] - x[2])[0]!;
    extra = [extra[0] + best[0], extra[1] + best[1], extra[2] + best[2]];
    return '';
  });
  const pseudoEls = (s.match(/::[a-z-]+/g) ?? []).length;
  s = s.replace(/::[a-z-]+/g, '');
  const attrs = (s.match(/\[[^\]]*\]/g) ?? []).length;
  s = s.replace(/\[[^\]]*\]/g, '');
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w-]+/g) ?? []).length + (s.match(/:(?!:)[a-z-]+/g) ?? []).length;
  s = s.replace(/[#.][\w-]+|:[a-z-]+/g, '');
  const els = (s.match(/\b[a-z][a-z0-9]*\b/g) ?? []).length;
  return [ids + extra[0], classes + attrs + extra[1], els + pseudoEls + extra[2]];
}
const beats = (a: [number, number, number], b: [number, number, number]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Every selector in the sheet that names a Title look, split on commas. */
const lookSelectors = [...CSS.matchAll(/(^|\})\s*([^{}]*data-part-look="eyebrow\.[a-z-]+"[^{}]*)\{/gm)].flatMap((m) =>
  m[2]!
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/,(?![^(]*\))/)
    .map((x) => x.trim())
    .filter(Boolean),
);

test('the arithmetic is right: the worked examples from the docblock', () => {
  assert.deepEqual(specificity('.sn-editorial .pahina-eyebrow'), [0, 2, 0]);
  assert.deepEqual(specificity('html [data-part-look="eyebrow.serif"]'), [0, 1, 1], 'the selector that lost');
  assert.deepEqual(specificity('html [data-part-look="eyebrow.serif"][data-part-look]'), [0, 2, 1]);
  assert.deepEqual(specificity('.sn-editorial .pahina-eyebrow::after'), [0, 2, 1]);
  assert.deepEqual(specificity('html :is([data-part-look="eyebrow.serif"], [data-part-look="eyebrow.pill"])[data-part-look]::after'), [0, 2, 2]);
});

test('the Title is the page’s eyebrow, so the eyebrow’s rules are the ones a look must out-rank', () => {
  assert.match(MASTHEAD, /<p \{\.\.\.el\('eyebrow'\)\} className="pahina-eyebrow[^"]*">/);
  assert.match(CSS, /\.sn-editorial \.pahina-eyebrow \{[^}]*font-family:[^}]*text-transform: uppercase;/);
  assert.match(CSS, /\.sn-editorial \.pahina-eyebrow::after \{[^}]*content: '';/);
});

test('every rule of every Title look out-ranks the eyebrow rule on the same element', () => {
  const own = lookSelectors.filter((s) => !/>\s*span$/.test(s));
  for (const look of ['serif', 'flanked', 'ruled', 'pill']) assert.ok(own.some((s) => s.includes(`eyebrow.${look}`) && !/::/.test(s)), `no rule for eyebrow.${look}`);
  for (const sel of own) {
    const against = /::after$/.test(sel) ? '.sn-editorial .pahina-eyebrow::after' : /::before$/.test(sel) ? '.sn-editorial .pahina-eyebrow' : '.sn-editorial .pahina-eyebrow';
    assert.ok(beats(specificity(sel), specificity(against)) > 0, `${sel}  (${specificity(sel)})  does not out-rank  ${against}  (${specificity(against)})`);
    /* …and the couple's eyebrow FONT role, which names the same element at the same weight as the editorial rule. */
    if (!/::/.test(sel)) assert.ok(beats(specificity(sel), specificity("[data-hub-roles~='eyebrow'] .pahina-eyebrow")) > 0, sel);
  }
});

test('a look that is not the eyebrow’s own shape drops the eyebrow’s trailing hairline; Flanked draws its own two', () => {
  assert.match(CSS, /html :is\(\[data-part-look="eyebrow\.serif"\], \[data-part-look="eyebrow\.ruled"\], \[data-part-look="eyebrow\.pill"\]\)\[data-part-look\]::after \{ content: none; \}/);
  assert.match(CSS, /html \[data-part-look="eyebrow\.flanked"\]\[data-part-look\]::before,\s*html \[data-part-look="eyebrow\.flanked"\]\[data-part-look\]::after \{ content: '';[^}]*width: 1\.6em;/);
});
