/**
 * 🛒 THE ULTRA ADD-ON ON SCREEN — said once, readable on a phone, and on the For Suppliers page where the approved
 * drawing puts it (fix pass on PR #8019, 22 Nov · brief item E).
 *
 *   E1 · AT 375 px THE BUY ROW CUT OFF ITS OWN PRICE. One row held "+1 branch · +15 live cards · +3 people · +50 GB ·
 *        ₱… every 4 weeks · you have N" beside the "Add one" button. A row's line never wraps (the house row,
 *        `DatesRow`, truncates), so a phone showed "+1 branch · +15 live cards · +3 p…" — the price and the +50 GB were
 *        the part lost. Now two house rows: what it gives, with no control beside it (the whole width), then the
 *        PRICE as the title of the row that holds "Add one".
 *   E2 · THE WORDS WERE TYPED THREE TIMES (the Plan row, the Plans table cell, the purchase label). They are built
 *        once, from `ULTRA_ADDON_GIVES` — `ultraAddOnGivesWords`.
 *   E3 · THE APPROVED DRAWING's Plans ⓘ (`prototypes/for_suppliers_2026-11-20/site/index.html`) has a "Branches and
 *        storage." line and the Ultra Add-on line; the built page drew neither. Both are drawn now — the numbers from
 *        `TIER_CAPS` / `ULTRA_ADDON_GIVES`, the price from the catalogue row (unread → the line is not drawn).
 *   E4 · `buyMoreLine` had no reader on the 20 Nov page: deleted (`ultraAddOnInfoLine` is the line the drawing has).
 *
 * ⚠ NOT SEEN IN A BROWSER: this machine could not run the app on 22 Nov. What is held here is the structure and the
 * words; the pixel check at 375 px is the ship controller's.
 *
 * SABOTAGE THAT TURNS THIS RED (each run once, 22 Nov):
 *   · plan-rows.tsx: put `end={ultraAddOn.buy?.end}` back on the "Ultra Add-on" row → E1 fails;
 *   · plan-screen.tsx: type `gives: '+1 branch · +15 live cards · +3 people · +50 GB'` → E2 fails;
 *   · supplier-front-data.ts: make `ultraAddOnInfoLine(null)` return a sentence (drop the `!price` guard) → E3 fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { branchesAndStorageLine, ultraAddOnInfoLine } from '../app/for-suppliers/_components/supplier-front-data';
import { planTable } from '../app/for-suppliers/_components/plan-table-data';
import { stripComments } from './strip-comments';
import { STORAGE_GB, TIER_CAPS, ULTRA_ADDON_GIVES } from './vendor-tier-caps';
import { COUNT_ADDONS, ultraAddOnGivesWords, ultraAddOnSku } from './vendor-ultra-addons';

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const src = (rel: string) => stripComments(raw(rel));

/**
 * Measured on the PR's own 375 px shot of the old row (build-sessions/shots-plan-numbers): 33 characters of the 13 px
 * line showed beside "Add one" before the ellipsis. A line longer than this beside a control is cut off on a phone.
 */
const CHARS_BESIDE_A_BUTTON_AT_375 = 33;

test('E2 · what one Ultra Add-on gives is built ONCE from ULTRA_ADDON_GIVES — and typed nowhere', () => {
  const g = ULTRA_ADDON_GIVES;
  const words = ultraAddOnGivesWords();
  assert.equal(words, `+${g.branches} branch · +${g.liveCards} live cards · +${g.people} people · +${g.storageGb} GB`);
  // The owner's final ruling (DECISION_LOG 20 Nov "ULTRA ADD-ON (FINAL)"), pinned so a change of numbers is deliberate.
  assert.equal(words, '+1 branch · +15 live cards · +3 people · +50 GB');
  assert.equal(COUNT_ADDONS.ultra.label, `Ultra Add-on: ${words}`);
  // The Plans table's cell says the same words after the catalogue's price.
  const table = planTable({ paywallOn: true, prices: { monthly: {}, annual: {}, bySku: { [ultraAddOnSku('ultra')]: 'PRICE' } } });
  const cells = table.flatMap((grp) => grp.rows).flatMap((r) => Object.values(r.cells).map((c) => c.text));
  assert.ok(cells.includes(`PRICE every 4 weeks · ${words}`), 'the Plans table does not say the add-on in the one function’s words');

  // The three surfaces ask the function…
  assert.match(src('app/vendor-dashboard/subscription/_components/plan-screen.tsx'), /gives: ultraAddOnGivesWords\(\),/);
  assert.match(src('app/for-suppliers/_components/plan-table-data.ts'), /every 4 weeks · \$\{ultraAddOnGivesWords\(\)\}/);
  assert.match(src('app/for-suppliers/_components/plan-table-data.ts'), /ultra: COUNT_ADDONS\.ultra\.label,/);
  assert.match(src('lib/vendor-ultra-addons.ts'), /label: `Ultra Add-on: \$\{ultraAddOnGivesWords\(\)\}`/);
  // …and no shipped file types the sentence (the plan surfaces, their lab, and the lib's top level).
  const files: string[] = [];
  const walk = (dir: string, deep: boolean) => {
    for (const name of readdirSync(join(WEB, dir))) {
      const rel = `${dir}/${name}`;
      const st = statSync(join(WEB, rel));
      if (st.isDirectory()) {
        if (deep) walk(rel, deep);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(rel);
    }
  };
  walk('app/vendor-dashboard/subscription', true);
  walk('app/for-suppliers', true);
  walk('app/dev/supplier-plan-lab', true);
  walk('lib', false);
  assert.ok(files.length > 500, `only ${files.length} files scanned — the walk moved or emptied`);
  const typed = files.filter((f) => /\+\s*15 live cards/.test(src(f)));
  assert.deepEqual(typed, [], 'the Ultra Add-on’s words are typed again, beside the function that builds them');
});

test('E1 · on a phone nothing is cut off: what it gives has a row to itself; the price titles the row with "Add one"', () => {
  const rows = src('app/vendor-dashboard/subscription/_components/plan-rows.tsx');
  // The words are longer than a phone shows beside a button — which is WHY they may not share a row with one.
  assert.ok(ultraAddOnGivesWords().length > CHARS_BESIDE_A_BUTTON_AT_375, 'the words now fit beside a button — this guard should be re-justified');
  const gives = rows.match(/<DatesRow data="plan-ultra-addon" [^>]*\/>/)?.[0] ?? '';
  assert.match(gives, /title="Ultra Add-on" line=\{ultraAddOn\.gives\}/);
  assert.doesNotMatch(gives, /\bend=/, 'a control sits beside the add-on’s words again — they are cut off at 375 px');
  assert.doesNotMatch(gives, /\bhref=/);
  // The price comes first: it is the TITLE of the row that holds the Add control.
  const buy = rows.match(/<DatesRow data="plan-ultra-addon-buy" [^>]*\/>/)?.[0] ?? '';
  assert.match(buy, /title=\{ultraAddOn\.buy\.price\} line=\{ultraAddOn\.buy\.line\} end=\{ultraAddOn\.buy\.end\}/);
  assert.ok(rows.indexOf(gives) < rows.indexOf(buy) && rows.indexOf(buy) < rows.indexOf('data="plan-ultra-addon-held"'), 'the rows are out of order');

  const page = src('app/vendor-dashboard/subscription/_components/plan-screen.tsx');
  // Read from the catalogue; no readable price → no figure and no Add control (never a fallback).
  assert.match(page, /buy:\s*ultraAddOnPricePhp !== null\s*\? \{\s*price: `\$\{formatPhp\(ultraAddOnPricePhp\)\} every 4 weeks`,/);
  assert.match(page, /end: <UltraAddOnButton action=\{buyUltraAddOn\} \/>,\s*\}\s*: null,/);
  assert.match(page, /const ultraAddOnPricePhp = vendorCatalog\.find\(\(r\) => r\.sku_code === COUNT_ADDONS\.ultra\.sku\)\?\.price_php \?\? null;/);
  // "You have N" is a MEASURED count only.
  assert.match(page, /line: ultraAddOnCount !== null && ultraAddOnCount > 0 \? `You have \$\{NUMBER\.format\(ultraAddOnCount\)\}` : null,/);
  // What sits beside the button is short enough for a phone, even at a six-figure price.
  assert.ok('₱999,990 every 4 weeks'.length <= CHARS_BESIDE_A_BUTTON_AT_375 - 9, 'the price title is too long for the 15 px title beside a button');
  assert.ok('You have 99'.length <= CHARS_BESIDE_A_BUTTON_AT_375);
});

test('E3 · For Suppliers › Plans ⓘ draws the drawing’s two lines — numbers read, price from the catalogue or not at all', () => {
  // "Branches and storage." — each plan's own numbers, from TIER_CAPS.
  const gb = (t: 'solo' | 'pro' | 'enterprise') => (TIER_CAPS[t].storageBytes ?? 0) / STORAGE_GB;
  const b = (t: 'pro' | 'enterprise') => TIER_CAPS[t].branchesIncluded;
  assert.equal(
    branchesAndStorageLine(),
    `Plus ${gb('solo')} GB · Pro ${b('pro')} branch, ${gb('pro')} GB · Ultra ${b('enterprise')} branches, ${gb('enterprise')} GB`,
  );
  // The approved drawing's sentence, word for word (prototypes/for_suppliers_2026-11-20/site/index.html).
  assert.equal(branchesAndStorageLine(), 'Plus 5 GB · Pro 1 branch, 10 GB · Ultra 3 branches, 20 GB');

  // The Ultra Add-on line: the drawing's sentence, its price handed in by the page.
  const g = ULTRA_ADDON_GIVES;
  assert.equal(
    ultraAddOnInfoLine('₱P'),
    `On Ultra, the Ultra Add-on is ₱P per 4 weeks: one more branch, ${g.liveCards} cards, ${g.people} people and ${g.storageGb} GB.`,
  );
  // No readable price → no line. Never a figure from memory.
  assert.equal(ultraAddOnInfoLine(null), null);
  assert.equal(ultraAddOnInfoLine(''), null);

  const page = src('app/for-suppliers/_components/supplier-front-page.tsx');
  assert.match(page, /const ultraAddOnLine = ultraAddOnInfoLine\(prices\.bySku\[ultraAddOnSku\('ultra'\)\] \?\? null\);/);
  assert.match(page, /<b>Branches and storage\.<\/b> \{branchesAndStorageLine\(\)\}\./);
  assert.match(page, /\{ultraAddOnLine \? <p data-sf-plans-info="ultra-addon">\{ultraAddOnLine\}<\/p> : null\}/);
  // Inside the Plans lede's ⓘ, after the People line — where the drawing puts them.
  const lede = page.slice(page.indexOf('<Lede text="Upgrade only to manage more.">'), page.indexOf('<PlanRows rows={planRows}'));
  assert.ok(lede.indexOf('<b>People.</b>') > 0 && lede.indexOf('<b>People.</b>') < lede.indexOf('Branches and storage.'));
  assert.ok(lede.indexOf('Branches and storage.') < lede.indexOf('ultraAddOnLine ?'));
  // The price is typed nowhere on the page or in its data.
  for (const f of ['app/for-suppliers/_components/supplier-front-page.tsx', 'app/for-suppliers/_components/supplier-front-data.ts']) {
    assert.doesNotMatch(src(f), /2[,.]?490/, `${f} types the Ultra Add-on's price`);
  }
  // The header no longer says the two are not live.
  assert.doesNotMatch(raw('app/for-suppliers/_components/supplier-front-page.tsx'), /Ultra Add-on and storage are not live/);
});

test('E4 · `buyMoreLine` is gone — it had no reader on the approved page', () => {
  for (const f of readdirSync(join(WEB, 'app/for-suppliers/_components')).filter((n) => /\.tsx?$/.test(n))) {
    assert.doesNotMatch(src(`app/for-suppliers/_components/${f}`), /\bbuyMoreLine\b/, `${f} still names buyMoreLine`);
  }
});
