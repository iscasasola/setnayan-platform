/**
 * no-record-of-the-older-prices.test.ts — no superseded price may reappear in product copy.
 *
 * ⚖ Owner, 2026-11-04, setting the FINAL price sheet (one price on the web and in the App Store):
 * *"make sure there is no record of the older prices"*. No visitor, couple, supplier or reviewer may see a
 * superseded figure anywhere. Prices live ONLY in the catalogue tables (`platform_retail_catalog_v2`,
 * `vendor_billing_catalog`) and are READ by code; the sibling guards (`event-hub-pro-price-is-never-typed`,
 * `public-price-literals`, `papic-copy-guardrails`) police HOW a price reaches a page. This one polices WHICH:
 * it remembers every figure the sheet retired, so none can be typed back in — by a reverted PR, a copied
 * prototype, a demo frame, a fallback constant or a blog paragraph.
 *
 * 🔑 THE PROPERTY, NOT A PHRASING. A figure is a price when it is written AS money — after `₱` / `PHP` /
 * `&#8369;` or before "pesos" — or when it is a bare number unique enough that it can only be one of the
 * retired prices (6590, 3300, 104000, and their centavo forms). Counts of photos, credits and guests are not
 * money and are not matched. Common round figures (₱500, ₱1,000, ₱2,500 …) are retired ONLY for the products
 * that carried them, so they count only within reach of one of those product names.
 *
 * WHAT IS SCANNED: every non-test `.ts`/`.tsx` under `app/` and `lib/` with comments removed (the repo's one
 * string-aware stripper, `strip-comments.ts` — a docblock narrating history is not a live claim), plus the
 * served text files under `public/`. WHAT IS NOT: `supabase/migrations/` (applied migrations are immutable),
 * and paid orders / receipts / invoices, which render the amount actually paid FROM THE DATABASE — no literal
 * of theirs exists in source to match, so they need no exemption.
 *
 * ⚠ IF THE OWNER LATER SETS A PRICE TO ONE OF THESE FIGURES, delete it from the list in the SAME PR — a
 * figure is retired only while it is not a live price. Do not add an allowlist entry for that.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = process.cwd();

/**
 * Figures that were ONLY ever prices, and are now retired — matched as money anywhere, and as a bare number in
 * code (with their ×100 centavo forms). 2,214 / 929 / 3,954 are the old Papic rungs; 6,590 / 6,290 the old Event
 * Hub Pro; 2,499 the old Setnayan AI / Thank-you / Pro-plan charm price; 3,300 / 1,980 the old Live Watch,
 * Music Maker, Setnayan AI and Patiktok; 10,400 / 26,000 / 104,000 the old supplier years (10.4×).
 */
const UNIQUE_RETIRED = ['6590', '6290', '2499', '3300', '1980', '2214', '929', '3954', '10400', '26000', '104000'];

/** The old Papic pack prices (₱90 = 150 credits, ₱490 = 1,000) — too short to match bare, so money form only. */
const MONEY_ONLY_RETIRED = ['90', '490'];

/**
 * Round figures retired for SPECIFIC products — supplier plans (1,000 / 2,500 / 10,000, and the 8,000 / 25,000 /
 * 80,000 of an earlier ladder), supplier add-ons (250 seat · 500 Deep Search / supplier Papic pack · 1,000
 * branch · 1,500 / 2,000 chatbot · 2,500 photo challenge · 3,000 3D booth), Event Hub Pro's 5,000. They are
 * ordinary numbers elsewhere (a supplier's own ₱5,000 package), so they count only near one of these names.
 */
// 9,990 / 99,900: Ultra on the sheet's first draft, superseded the same day by ₱5,990 / ₱59,900 (owner 2026-11-04).
const CONTEXT_RETIRED = ['250', '500', '1000', '1500', '2000', '2500', '3000', '5000', '8000', '9990', '10000', '25000', '80000', '99900'];
/** Case-SENSITIVE on purpose: the plan names are proper nouns ("Solo"), and "a newer solo shooter" is not a plan. */
const PRODUCT_NAME =
  /\b(?:Solo|Ultra|Enterprise|Pro plan|Deep Search|[Cc]hatbot|AI assistant|3D [Bb]ooth|[Pp]hoto [Cc]hallenge|Papic Challenge|[Ee]xtra branch|[Ee]xtra seat|Papic|Event Hub|Event Pro|Event Plus|Setnayan AI|Live Watch|Music Maker|Patiktok|Logo & QR)\b/;
/** How far either side of a money figure a product name counts as "naming it". */
const REACH = 160;

/** The two retired CLAIMS that carry no peso sign: the 10.4× / save-17-or-20% year, and the 40% sign-up price. */
const RETIRED_CLAIMS: ReadonlyArray<[RegExp, string]> = [
  [/\b10\.4\s*[×x]|\bsave\s+(?:17|20)\s*%/i, 'the retired annual saving (a year is 10× the 4-week price now)'],
  [
    /\b(?:sign[- ]?up|set[- ]?up|onboarding)\b[^\n]{0,60}\b40\s?%|\b40\s?%[^\n]{0,60}\b(?:sign[- ]?up|set[- ]?up|onboarding)\b/i,
    'the retired 40% sign-up price (there is no sign-up discount)',
  ],
];

/**
 * Files allowed to carry a retired figure — each with its reason. Keep this short; a new entry needs a reason a
 * reviewer would accept from the owner's chair.
 */
const ALLOWED: ReadonlyArray<[prefix: string, why: string]> = [
  ['app/admin/', 'owner-only console: it EDITS the catalogue and explains past rulings to the owner, never to a customer'],
  ['app/dev/', 'dev labs — `notFound()` when NODE_ENV is production, so no visitor, couple, supplier or reviewer reaches them'],
  [
    'lib/llms-txt-guard-input.ts',
    'the catalogue mirror the llms.txt guards render against; its INACTIVE rows are negative fixtures that prove a retired price never surfaces',
  ],
  ['lib/sku-catalog.ts', 'the LEGACY v1 catalogue mirror of retired rows, kept only to resolve historical sku_codes on old orders'],
  [
    'lib/setnayan-ai-type-pricing.ts',
    'the Setnayan AI tier ladder fallback for a product taken off sale on 2026-11-04; whether the ladder retires with SETNAYAN_AI is the money-path decision of the same PR (lead-owned), not copy',
  ],
];
const allowedWhy = (rel: string) => ALLOWED.find(([p]) => rel.startsWith(p))?.[1];

function walk(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, keep, out);
    else if (keep(name)) out.push(p);
  }
  return out;
}

const isCode = (n: string) => /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) && !/\.tmp\.ts$/.test(n);
const isServedText = (n: string) => /\.(txt|html|json|md|xml|webmanifest)$/.test(n);

/** `1000` → `1,?000` (money form), `1[,_]?000` (code form). */
const grouped = (n: string, sepClass: string) => (n.length > 3 ? `${n.slice(0, -3)}${sepClass}?${n.slice(-3)}` : n);
const PESO = String.raw`(?:₱|\\u20[bB]1|&#8369;|\bPHP\s?|\bPhp\s?)`;
/** `₱6,590` · `PHP 6590` · `6,590 pesos`. */
const money = (figs: readonly string[]) => {
  const f = figs.map((n) => grouped(n, ',')).join('|');
  return new RegExp(`${PESO}\\s?(${f})(?![\\d]|,\\d)|(?<![\\d,.])(${f})\\s?pesos\\b`, 'gi');
};
/** A bare `6590` / `6_590` / `659000` in code — not part of a longer number, identifier, hex colour or version. */
const BARE = new RegExp(
  `(?<![\\w.,#-])(${UNIQUE_RETIRED.flatMap((n) => [n, String(Number(n) * 100)])
    .map((n) => grouped(n, '[,_]'))
    .join('|')})(?![\\w]|[.,]\\d)`,
  'g',
);

type Hit = { file: string; line: number; what: string };

/** Every retired figure or claim in `text` (already comment-stripped if it is code). Pure — the sabotage test uses it. */
function findRetired(file: string, text: string, isSource: boolean): Hit[] {
  const hits: Hit[] = [];
  const lineOf = (i: number) => text.slice(0, i).split('\n').length;
  const moneySpans: Array<[number, number]> = [];
  for (const m of text.matchAll(money([...UNIQUE_RETIRED, ...MONEY_ONLY_RETIRED]))) {
    moneySpans.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
    hits.push({ file, line: lineOf(m.index ?? 0), what: `retired price ${m[0].trim()}` });
  }
  for (const m of text.matchAll(money(CONTEXT_RETIRED))) {
    const at = m.index ?? 0;
    const near = text.slice(Math.max(0, at - REACH), at + m[0].length + REACH);
    const name = PRODUCT_NAME.exec(near);
    if (name) hits.push({ file, line: lineOf(at), what: `retired price ${m[0].trim()} near "${name[0]}"` });
  }
  if (isSource) {
    for (const m of text.matchAll(BARE)) {
      const at = m.index ?? 0;
      if (moneySpans.some(([a, b]) => at >= a && at < b)) continue; // already reported in its money form
      hits.push({ file, line: lineOf(at), what: `retired figure ${m[0]} typed into code` });
    }
  }
  for (const [re, why] of RETIRED_CLAIMS) {
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) hits.push({ file, line: lineOf(m.index ?? 0), what: `${why}: "${m[0]}"` });
  }
  return hits;
}

const CODE = [...walk(join(WEB, 'app'), isCode), ...walk(join(WEB, 'lib'), isCode)];
const SERVED = walk(join(WEB, 'public'), isServedText);
const rel = (abs: string) => relative(WEB, abs).split(sep).join('/');

test('no superseded price, or retired price claim, appears in product copy', () => {
  const hits: string[] = [];
  for (const abs of CODE) {
    const r = rel(abs);
    if (allowedWhy(r)) continue;
    for (const h of findRetired(r, stripComments(readFileSync(abs, 'utf8')), true)) hits.push(`${h.file}:${h.line} — ${h.what}`);
  }
  for (const abs of SERVED) {
    const r = rel(abs);
    if (allowedWhy(r)) continue;
    for (const h of findRetired(r, readFileSync(abs, 'utf8'), false)) hits.push(`${h.file}:${h.line} — ${h.what}`);
  }
  assert.deepEqual(
    hits,
    [],
    'Owner 2026-11-04: "make sure there is no record of the older prices". Read the price from the catalogue ' +
      '(platform_retail_catalog_v2 / vendor_billing_catalog) or drop the figure from the copy — never retype it.',
  );
});

test('every allowlist entry still matches a real path, and carries a reason', () => {
  const all = [...CODE, ...SERVED].map(rel);
  for (const [prefix, why] of ALLOWED) {
    assert.ok(why.trim().length > 30, `${prefix} needs a real reason`);
    assert.ok(all.some((r) => r.startsWith(prefix)), `${prefix} matches no file — delete the stale exemption`);
  }
});

test('the guard can actually hit — planted figures fail, history in a comment and counts do not', () => {
  // A guard nobody has seen fail proves nothing. Every shape below is planted in memory and run through the
  // same pipeline (comment stripper → findRetired) the real scan uses.
  const plant = (src: string) => findRetired('planted.tsx', stripComments(src), true).map((h) => h.what);

  assert.equal(plant(`const t = 'Event Pro · ₱6,590';`).length, 1, 'a retired price in a string');
  assert.equal(plant(`<p>Live Watch ₱3,300</p>`).length, 1, 'a retired price in JSX text');
  assert.equal(plant(`const x = 'PHP 104,000 a year';`).length, 1, 'PHP prefix');
  assert.equal(plant(`const x = '6,590 pesos';`).length, 1, '"pesos" suffix');
  assert.equal(plant(`const x = '\\u20b16,590';`).length, 1, 'escaped peso sign');
  assert.equal(plant(`const PRICE_PHP = 6590;`).length, 1, 'a bare figure in code');
  assert.equal(plant(`const PRICE_CENTAVOS = 659_000;`).length, 1, 'its centavo form');
  assert.equal(plant(`const papic = 'Papic 150 · ₱90';`).length, 1, 'the old Papic pack');
  assert.equal(plant(`const s = 'Solo — ₱1,000 every 4 weeks';`).length, 1, 'a round figure beside its product');
  assert.equal(plant(`const s = 'Yearly · save 20%';`).length, 1, 'the retired annual saving');
  assert.equal(plant(`const s = '40% off at sign-up';`).length, 1, 'the retired sign-up price');

  assert.deepEqual(plant(`// Event Hub Pro was ₱6,590 until 2026-11-04\nconst x = 1;`), [], 'history in a comment is not a claim');
  assert.deepEqual(plant(`const s = 'Papic 3000 · 3,000 credits';`), [], 'a credit count is not money');
  assert.deepEqual(plant(`const s = 'A ₱5,000 deposit to your caterer';`), [], 'a round figure with no retired product near it');
  assert.deepEqual(plant(`const s = 'from ₱25,000 for a newer solo shooter';`), [], 'a lowercase "solo" is not the plan');
  assert.deepEqual(plant(`const s = 'Event Pro · ₱5,690';`), [], 'a live price is not retired');
  assert.deepEqual(plant(`const c = '#2499ff'; const v = 'v1.3300';`), [], 'a colour or a version is not a price');

  assert.ok(CODE.length > 500, `the walk found only ${CODE.length} files — wrong directory? (run from apps/web)`);
});
