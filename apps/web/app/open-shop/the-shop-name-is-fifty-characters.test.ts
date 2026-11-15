/**
 * the-shop-name-is-fifty-characters.test.ts — every shop-name box and writer reads ONE number.
 *
 * Owner ruling 2026-11-06: "50 characters". A supplier's shop name (`vendor_profiles.business_name`) is 50 at most,
 * everywhere. Before this, the sign-up box took 128, My Shop took 128, Admin took 128 and the correction apply
 * clipped to 128 — four hand-typed copies of one rule. They are now ONE constant, `SHOP_NAME_MAX`
 * (lib/business-slug.ts), and the database holds the floor (`vendor_profiles_business_name_max_50`, proven by
 * tests/db/a-shop-name-is-fifty-characters.db.test.ts).
 *
 * This guard fails when a writer or a box stops reading that constant — anchored on SYMBOLS (function names, input
 * names, case labels), never line numbers:
 *
 *   1 · every server writer of the shop name refuses past `SHOP_NAME_MAX` with `SHOP_NAME_TOO_LONG` (no `128`);
 *   2 · every shop-name box carries `maxLength={SHOP_NAME_MAX}`; the sign-up and My Shop boxes draw the counter;
 *   3 · the claim functions' LATEST definitions still clip the couple's typed name to 50 (so a claim never fails);
 *   4 · a census: a NEW file with a `business_name` / `shop_name` box must be classified here — a shop box (held to
 *       the rule) or not a shop (the couple's own record, the platform's own identity) — before it can ship.
 *
 * 🛡 Comments are stripped before matching (`lib/strip-comments`): every file changed here carries a note naming
 *   what it replaced.
 * 🛡 Sabotaged, each red then restored (2026-11-06): `maxLength={128}` put back on the wizard box → red;
 *   `shopNameTooLong` removed from `updateVendorProfileField` → red; the clip removed from `claim_ready_the_shop`'s
 *   latest definition → red; a new `name="business_name"` box in an unlisted file → red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { SHOP_NAME_MAX, SHOP_NAME_TOO_LONG, shopNameCounter, shopNameTooLong } from '@/lib/business-slug';
import { stripComments } from '@/lib/strip-comments';

const WEB = path.resolve(__dirname, '..', '..');
const MIGRATIONS = path.resolve(WEB, '..', '..', 'supabase', 'migrations');

function read(rel: string): string {
  return stripComments(readFileSync(path.join(WEB, rel), 'utf8'));
}

/** The text of `export async function <name>(` … up to the next top-level `export`. */
function fnBody(src: string, name: string): string {
  const m = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  assert.ok(m, `function ${name} not found — the anchor moved; re-point this guard, never delete it`);
  const rest = src.slice(m.index + m[0].length);
  const next = rest.search(/\n(?:export\s|function\s)/);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The text of a `case '<label>': {` … `}` block, first occurrence inside `within`. */
function caseBlock(within: string, label: string): string {
  const i = within.indexOf(`case '${label}': {`);
  assert.ok(i !== -1, `case '${label}' not found — the anchor moved`);
  const rest = within.slice(i);
  const end = rest.indexOf('\n    case ', 10);
  return end === -1 ? rest : rest.slice(0, end);
}

/** The JSX element (from its `<Tag` to its `/>`) that carries `attr`. */
function elementWith(src: string, attr: string): string {
  const i = src.indexOf(attr);
  assert.ok(i !== -1, `${attr} not found — the anchor moved`);
  const start = src.lastIndexOf('<', i);
  const end = src.indexOf('/>', i);
  return src.slice(start, end + 2);
}

test('the constant, the sentence and the counter', () => {
  assert.equal(SHOP_NAME_MAX, 50);
  assert.equal(SHOP_NAME_TOO_LONG, 'Keep the shop name to 50 characters or fewer.');
  assert.equal(shopNameCounter(39), null, 'the counter shows only from 40');
  assert.equal(shopNameCounter(40), '40 / 50');
  assert.equal(shopNameCounter(42), '42 / 50');
  assert.equal(shopNameTooLong('x'.repeat(50)), false);
  assert.equal(shopNameTooLong(`  ${'x'.repeat(50)}  `), false, 'the edges are trimmed before counting');
  assert.equal(shopNameTooLong('x'.repeat(51)), true);
});

test('every server writer of the shop name refuses past SHOP_NAME_MAX', () => {
  const openShop = fnBody(read('app/open-shop/actions.ts'), 'becomeVendor');
  assert.match(openShop, /shopNameTooLong\(rawShopName\)/, 'open-shop: the too-long refusal is gone');
  assert.match(openShop, /SHOP_NAME_TOO_LONG/);
  assert.match(openShop, /clean\(rawShopName, SHOP_NAME_MAX\)/);

  const vd = read('app/vendor-dashboard/actions.ts');
  const myShop = caseBlock(fnBody(vd, 'updateVendorProfileField'), 'business_name');
  assert.match(myShop, /shopNameTooLong\(/, 'My Shop: the too-long refusal is gone');
  assert.match(myShop, /SHOP_NAME_TOO_LONG/);
  assert.match(myShop, /nonBlank\(formData\.get\('business_name'\), SHOP_NAME_MAX\)/);
  assert.doesNotMatch(myShop, /\b128\b/);
  assert.match(
    fnBody(vd, 'requestProfileCorrection'),
    /fieldKey === 'business_name' && shopNameTooLong\(requestedValue\)/,
    'a rename request past 50 must be refused at the request, not after review',
  );

  const adminVendors = read('app/admin/vendors/actions.ts');
  for (const fn of ['createAdminVendorInvite', 'saveUnclaimedVendorProfile']) {
    const body = fnBody(adminVendors, fn);
    assert.match(body, />\s*SHOP_NAME_MAX/, `${fn}: the 50 cap is gone`);
    assert.match(body, /SHOP_NAME_TOO_LONG/, `${fn}: refuse with the one sentence`);
    assert.doesNotMatch(body, /\b128\b/, `${fn}: a hand-typed 128 came back`);
  }

  const corrections = caseBlock(fnBody(read('app/admin/corrections/actions.ts'), 'parseRequestedValue'), 'business_name');
  assert.match(corrections, />\s*SHOP_NAME_MAX/, 'the correction apply must refuse past 50');
  assert.doesNotMatch(corrections, /slice\(/, 'the correction apply must refuse, never clip a name nobody asked for');
});

test('every shop-name box carries maxLength={SHOP_NAME_MAX}', () => {
  const wizard = read('app/open-shop/_components/open-shop-wizard.tsx');
  assert.match(elementWith(wizard, 'name="shop_name"'), /maxLength=\{SHOP_NAME_MAX\}/, 'sign-up box');
  assert.match(wizard, /shopNameCounter\(shopName\.length\)/, 'sign-up box: the counter');

  const row = read('app/vendor-dashboard/shop/_components/editable-row.tsx');
  const shopNameInput = fnBody(row, 'ShopNameInput');
  assert.match(elementWith(shopNameInput, 'name="business_name"'), /maxLength=\{SHOP_NAME_MAX\}/, 'My Shop box');
  assert.match(shopNameInput, /shopNameCounter\(/, 'My Shop box: the counter');
  assert.match(caseBlockLoose(fnBody(row, 'PlainInput'), 'business_name'), /<ShopNameInput/, 'My Shop renders ShopNameInput');
  assert.match(
    fnBody(row, 'RequestOnlyRow'),
    /maxLength=\{field === 'business_name' \? SHOP_NAME_MAX : undefined\}/,
    'the ask-to-rename box',
  );
  assert.match(
    read('app/vendor-dashboard/shop/_components/request-correction-card.tsx'),
    /maxLength=\{field === 'business_name' \? SHOP_NAME_MAX : undefined\}/,
    'the correction-request box',
  );

  const invite = read('app/admin/vendors/_components/invite-vendor-form.tsx');
  const typed = invite.slice(invite.lastIndexOf('<TypedRow', invite.indexOf('fieldName="business_name"')));
  assert.match(typed.slice(0, typed.indexOf('/>')), /maxLength=\{SHOP_NAME_MAX\}/, 'Admin invite box');

  assert.match(
    elementWith(read('app/admin/vendors/[vendorProfileId]/edit/page.tsx'), 'name="business_name"'),
    /maxLength=\{SHOP_NAME_MAX\}/,
    'Admin edit box',
  );
});

/** `case 'x':` without a brace (PlainInput's cases return directly). */
function caseBlockLoose(within: string, label: string): string {
  const i = within.indexOf(`case '${label}':`);
  assert.ok(i !== -1, `case '${label}' not found — the anchor moved`);
  return within.slice(i, within.indexOf('case ', i + 6));
}

test('the claim functions’ LATEST definitions still clip the couple’s typed name to 50', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const [fn, clip] of [
    ['claim_ready_the_shop', 'left(btrim(business_name), 50)'],
    ['claim_ready_the_invited_shop', 'left(btrim(v_inv.business_name), 50)'],
  ] as const) {
    const opener = `CREATE OR REPLACE FUNCTION public.${fn}(`;
    const latest = files.filter((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8').includes(opener)).pop();
    assert.ok(latest, `${fn} is defined nowhere`);
    const sql = readFileSync(path.join(MIGRATIONS, latest), 'utf8');
    const body = sql.slice(sql.indexOf(opener), sql.indexOf('$$;', sql.indexOf(opener)));
    assert.ok(body.includes(clip), `${latest}: ${fn} no longer clips the name to 50 — a long name would fail the claim`);
    if (fn === 'claim_ready_the_invited_shop') {
      assert.ok(!body.includes("NULLIF(btrim(v_inv.business_name), '')"), `${latest}: ${fn} reads the invite's name unclipped`);
    }
  }
  const check = files.find((f) => f.endsWith('_a_shop_name_is_fifty_characters.sql'));
  assert.ok(check, 'the CHECK migration is missing');
  assert.match(
    readFileSync(path.join(MIGRATIONS, check), 'utf8'),
    new RegExp(`CHECK \\(char_length\\(business_name\\) <= ${SHOP_NAME_MAX}\\)`),
    'the database number and SHOP_NAME_MAX disagree',
  );
});

// ── THE CENSUS ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Every file with a `business_name` / `shop_name` box is one of these. A new one fails until it is classified.
const SHOP_BOXES = new Set([
  'app/open-shop/_components/open-shop-wizard.tsx',
  'app/vendor-dashboard/shop/_components/editable-row.tsx',
  'app/admin/vendors/_components/invite-vendor-form.tsx',
  'app/admin/vendors/[vendorProfileId]/edit/page.tsx',
]);
const NOT_A_SHOP = new Map([
  ['app/admin/settings/_surfaces/settings-surface.tsx', 'platform_settings — Setnayan’s own business identity'],
  ['app/admin/business/_components/business-identity-form.tsx', 'platform_settings — Setnayan’s own business identity (avatar › Business, 2026-11-14)'],
  ['app/dashboard/[eventId]/_components/new-manual-vendor-modal.tsx', 'event_manual_vendors — the couple’s own record, free text'],
  ['app/dashboard/[eventId]/_components/record-card-folds.tsx', 'event_manual_vendors — the couple’s own record, free text'],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('census: every business_name / shop_name box is classified', () => {
  const found = [...walk(path.join(WEB, 'app')), ...walk(path.join(WEB, 'lib'))]
    .filter((f) => /name="shop_name"|name="business_name"|fieldName="business_name"/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => path.relative(WEB, f).split(path.sep).join('/'));
  const unclassified = found.filter((f) => !SHOP_BOXES.has(f) && !NOT_A_SHOP.has(f));
  assert.deepEqual(
    unclassified,
    [],
    'a new name box — if it names a SHOP, add maxLength={SHOP_NAME_MAX} and list it in SHOP_BOXES; if not, list it in NOT_A_SHOP with why',
  );
  for (const f of SHOP_BOXES) assert.ok(found.includes(f), `${f} no longer has its box — re-point the census`);
});
