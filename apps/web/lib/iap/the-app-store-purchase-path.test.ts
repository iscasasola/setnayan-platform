/**
 * 🍎 THE APP STORE PURCHASE PATH STAYS THE SHAPE IT WAS BUILT IN (2026-10-18).
 *
 * The db test (tests/db/an-app-store-purchase-is-one-order.db.test.ts) proves
 * the money path BEHAVES; this file holds the wiring a behaviour test cannot
 * see: who may reach the minter, in what order the checks run, that a test
 * root never reaches production, that the app never shows a web price, and
 * that the phone build actually carries the plugin it announces.
 *
 * 🛡 Each test was sabotaged red and restored (PR body lists them).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const MOBILE = resolve(WEB, '..', 'mobile');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const raw = (abs: string) => readFileSync(abs, 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(full);
  }
  return out;
}
const PROD_FILES = ['app', 'lib']
  .flatMap((d) => walk(join(WEB, d)))
  .filter((f) => !/\.test\.tsx?$/.test(f))
  .map((f) => relative(WEB, f));

test('every production caller hands the minter the MONEY writer', () => {
  const actions = code('lib/iap/iap-actions.ts');
  assert.match(actions, /createPurchaseIntent\(createMoneyWriterClient\(\),/);
  assert.match(actions, /fulfilAppleTransaction\(createMoneyWriterClient\(\), verified\.tx, \{ expectUserId: userId \}\)/);
  assert.match(actions, /const writer = createMoneyWriterClient\(\);[\s\S]*fulfilAppleTransaction\(writer, verified\.tx, \{ expectUserId: userId \}\)/);
  const route = code('app/api/iap/app-store-notifications/route.ts');
  assert.match(route, /handleAppStoreNotification\(createMoneyWriterClient\(\), signedPayload\)/);
  // Only these modules may reach the minter at all.
  const callers = PROD_FILES.filter((f) => f !== 'lib/iap/fulfil.server.ts' && /fulfilAppleTransaction\(|revokeAppleTransaction\(|createPurchaseIntent\(/.test(code(f)));
  assert.deepEqual(callers.sort(), ['lib/iap/iap-actions.ts', 'lib/iap/notifications.server.ts']);
});

test('the intent is written only AFTER every check a web checkout makes (and owned is never sold twice)', () => {
  const src = code('lib/iap/iap-actions.ts');
  const start = src.slice(src.indexOf('export async function startAppStorePurchase'), src.indexOf('function outcomeToResult'));
  const at = (re: RegExp) => {
    const m = re.exec(start);
    assert.ok(m, `missing in startAppStorePurchase: ${re}`);
    return m.index;
  };
  const mint = at(/createPurchaseIntent\(/);
  for (const check of [
    /await getIapGate\(\)/,
    /supabase\.auth\.getUser\(\)/,
    /\.from\('event_members'\)/,
    /coordinatorMoneyScopeAllowed\(/,
    /resolveServiceSellability\(/,
    /papicCreditsMatch\(/,
    /moodBoardRendersMatch\(/,
    /setnayanAiSoldInApp\(/,
    /eventIsOver\(/,
    /eventOwnsSku\(/,
  ]) {
    assert.ok(at(check) < mint, `${check} must run before the intent is written`);
  }
});

test('the promote is conditional and counted, and ONLY the call that promoted activates', () => {
  const src = code('lib/iap/fulfil.server.ts');
  assert.match(src, /\.in\('status', PROMOTABLE_ORDER_STATUSES\)\s*\.select\('order_id'\)/);
  assert.equal((src.match(/\bactivateOrderSku\(/g) ?? []).length, 1, 'activation is called from exactly one place');
  const branch = src.slice(src.indexOf("if ((promoted ?? []).length === 1) {"));
  assert.ok(branch.search(/\bactivateOrderSku\(/) > 0 && branch.search(/\bactivateOrderSku\(/) < branch.indexOf('} else {'), 'activation is outside the promoted branch');
  // Refund: flip first, then deactivate (the re-derive must see the refunded state).
  const revoke = src.slice(src.indexOf('export async function revokeAppleTransaction'));
  assert.ok(revoke.indexOf(".in('status', ['paid', 'fulfilled'])") < revoke.indexOf('deactivateOrderSku('));
  // Identity from the intent row, through the house helpers.
  assert.match(src, /orderRowFor\(\s*\{ userId: row\.user_id, eventId, vendorProfileId: null \}/);
  assert.match(src, /paymentRowFor\(\s*\{ userId: row\.user_id, verifiedOrderId: order\.order_id \}/);
});

test('a test signing root never reaches production — the fixture loader is test-only', () => {
  const offenders = PROD_FILES.filter((f) => f !== 'lib/iap/apple-jws-fixture.ts' && /apple-jws-fixture|FIXTURE_ROOTS|rootSha256/.test(code(f)));
  assert.deepEqual(offenders, []);
  // Production verification defaults to Apple's root alone.
  assert.match(code('lib/iap/apple-transaction.ts'), /PRODUCTION_TRUSTED_ROOTS: readonly string\[\] = \[APPLE_ROOT_CA_G3_SHA256\]/);
  assert.match(code('lib/iap/apple-transaction.ts'), /trustedRootSha256: readonly string\[\] = PRODUCTION_TRUSTED_ROOTS/);
  assert.match(code('lib/iap/iap-actions.ts'), /verifyAppleTransaction\(typeof input\.jws === 'string' \? input\.jws : ''\)/);
});

test('the phone finishes a transaction ONLY after our server settled it', () => {
  const src = code('lib/iap/native-store.ts');
  const finishes = [...src.matchAll(/call\('finish'/g)].length;
  assert.equal(finishes, 2);
  assert.equal([...src.matchAll(/settled\(server\) && (transactionId|t\.transactionId)\) /g)].length, 2, 'a finish is not gated on the server');
});

test('the app shows no web price, no GCash/BDO, no web link on an Apple surface', () => {
  const surfaces = [
    'app/_components/iap/iap-papic-sheet.tsx',
    'app/_components/iap/iap-live-watch-sheet.tsx',
    'app/_components/iap/iap-unlock-sheet.tsx',
    'lib/iap/setnayan-ai-in-app.server.ts',
    'app/_components/iap/restore-purchases-row.tsx',
    'app/_components/iap/apple-pro-screen.tsx',
    'app/dashboard/[eventId]/apple-pro/page.tsx',
    'lib/iap/native-store.ts',
  ];
  for (const f of surfaces) {
    const src = code(f);
    assert.doesNotMatch(src, /formatPhp|@\/lib\/php'|retail_price_php|formatV2Sku|GCash|BDO|setnayan\.com|href=|\/pay\b|cheaper|on the web/i, `${f} steers to the web or shows a web price`);
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a price`);
  }
});

test('the iOS build announces the plugin it carries — and Android never claims it', () => {
  const cfg = raw(join(MOBILE, 'capacitor.config.ts'));
  const ios = /ios:\s*\{[\s\S]*?appendUserAgent:\s*'([^']+)'/.exec(cfg);
  assert.ok(ios, 'the iOS block must declare its own appendUserAgent');
  /* RE-AIMED 2026-10-21 (owner): the build that sells is 1.1, `SetnayanIAP/2` — `/1` is build 5's and never sells. */
  assert.match(ios[1]!, /\bSetnayanIAP\/2\b/);
  assert.match(ios[1]!, /\bSetnayanApp\b/, 'the iOS UA still reads as the store shell');
  assert.match(ios[1]!, /\bSetnayanSignIn\/1\b/, 'the iOS UA still announces native sign-in');
  const global = /\n {2}appendUserAgent:\s*'([^']+)'/.exec(cfg);
  assert.ok(global && !/SetnayanIAP/.test(global[1]!), 'the shared (Android) user-agent must not claim StoreKit');

  const bridge = raw(join(MOBILE, 'ios/App/App/SetnayanBridgeViewController.swift'));
  assert.match(bridge, /bridge\?\.registerPluginInstance\(SetnayanStorePlugin\(\)\)/);
  const pbx = raw(join(MOBILE, 'ios/App/App.xcodeproj/project.pbxproj'));
  assert.equal((pbx.match(/SetnayanStorePlugin\.swift in Sources \*\/,/g) ?? []).length, 1, 'the plugin is not compiled into the app target');
  const plugin = raw(join(MOBILE, 'ios/App/App/SetnayanStorePlugin.swift'));
  assert.match(plugin, /jsName = "SetnayanStore"/);
  assert.match(code('lib/iap/native-store.ts'), /NATIVE_STORE_PLUGIN = 'SetnayanStore'/);
  for (const m of ['getProducts', 'purchase', 'finish', 'pendingTransactions', 'restore']) {
    assert.match(plugin, new RegExp(`CAPPluginMethod\\(name: "${m}"`), `plugin method ${m} not exposed`);
  }
  assert.match(plugin, /\.appAccountToken\(token\)/, 'the server token is not signed into the purchase');
  assert.match(raw(join(MOBILE, 'ios/App/App/Info.plist')), /<key>SKIncludeConsumableInAppPurchaseHistory<\/key>\s*<true\/>/);
});

test('every Apple surface is mounted ONLY behind the three-part gate', () => {
  // The net rides Home (where the app lands), never the event layout (the Maker's first load).
  assert.match(code('app/dashboard/[eventId]/page.tsx'), /\{appleFacts \? <AppStoreTransactions \/> : null\}/);
  assert.doesNotMatch(code('app/dashboard/[eventId]/layout.tsx'), /AppStoreTransactions|lib\/iap\//);
  assert.match(code('app/dashboard/[eventId]/page.tsx'), /getIapGate\(\)\.then\(async \(\{ iap \}\) => \{\s*if \(!iap\) return null;/);
  assert.match(code('app/dashboard/(account)/profile/page.tsx'), /\{appleIap \? <RestorePurchasesRow className=\{ACCOUNT_ROW\} \/> : null\}/);
  assert.match(code('lib/hub-draft-store.ts'), /appleIap: iap,/);
  assert.match(code('app/dashboard/[eventId]/apple-pro/page.tsx'), /const \{ iap \} = await getIapGate\(\);\s*if \(!iap\) redirect\(back\);/);
  // Owned is never sold twice: an event with Pro goes straight back to apply.
  // 💎 Part by part (2026-10-22): "owned" is Full Pro (or the cap reached) through the one ownership read.
  assert.match(code('app/dashboard/[eventId]/apple-pro/page.tsx'), /if \(own\?\.full\) redirect\(`\$\{back\}\?apply=1`\);/);
  assert.match(code('lib/iap/iap-actions.ts'), /const \{ iap \} = await getIapGate\(\);\s*if \(!iap\) return startRefusal\('unavailable'\);/);
});
