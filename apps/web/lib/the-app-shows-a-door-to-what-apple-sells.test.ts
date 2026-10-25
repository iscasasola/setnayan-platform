/**
 * the-app-shows-a-door-to-what-apple-sells.test.ts — 🍎 EVERY PRODUCT APPLE SELLS IN THE APP HAS A DOOR THERE, AND
 * WITH THE GATE OFF NOT ONE DOES.
 *
 * Measured on 1.0 (build 6), 2026-10-25: with In-App Purchase on, `studio/setnayan-ai`, `studio/pakanta`,
 * `studio/patiktok` and `studio/thank-you` OPENED in the app (`IAP_OPENED_ROUTE`) and each carried its Apple sheet —
 * but nothing in the app linked to them: Home's paid rows and the service parts list both hid every
 * `STORE_SHELL_HIDDEN_ADDON_KEYS` entry whenever `storeShell`, ignoring `iap`. App Review must be able to locate every
 * In-App Purchase product, or the build is rejected.
 *
 * 🔒 BOTH DIRECTIONS (guideline 3.1.1): builds in people's hands — and every build while the owner's switch is off —
 * have `iap` false, and there not one paid door may appear. Each part asserts both.
 *
 * The ONE rule is `isStoreShellHiddenAddon(key, iap)` (lib/store-shell.ts), derived from `IAP_OPENED_ROUTE`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADD_ONS, EVERY_ADD_ON, addOnHref, appStoreDetailHref } from './add-ons-catalog';
import { IAP_PRODUCTS } from './iap/products';
import { STORE_SHELL_HIDDEN_ADDON_KEYS, isStoreShellHiddenAddon, isStoreShellWebOnlyPath } from './store-shell';
import { homePaidFacts } from './home-paid-services';
import { homeServices } from './home-first-screen';
import { stripComments } from './strip-comments';

const E = '00000000-0000-4000-8000-000000000000';
const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The catalogue keys of every one-per-event Apple product (Setnayan AI · Music Maker · Patiktok · Thank You). */
const APPLE_UNLOCK_KEYS = [...new Set(IAP_PRODUCTS.filter((p) => p.kind === 'event-unlock').map((p) => p.serviceKey))].map((sk) => {
  const entry = EVERY_ADD_ON.find((a) => a.serviceKey === sk);
  assert.ok(entry, `Apple sells ${sk}, but no catalogue entry carries it — it can have no door`);
  return entry.key;
});

test('premise · the four one-per-event Apple products are Setnayan AI, Music Maker, Patiktok, Thank You', () => {
  assert.deepEqual([...APPLE_UNLOCK_KEYS].sort(), ['pakanta', 'patiktok', 'setnayan-ai', 'thank-you']);
});

test('1 · the ONE rule: each Apple-sold key has its door only where Apple sells; every other paid key stays hidden', () => {
  for (const key of APPLE_UNLOCK_KEYS) {
    assert.equal(isStoreShellHiddenAddon(key, true), false, `${key}: Apple sells it here, yet its door is hidden`);
    assert.equal(isStoreShellHiddenAddon(key, false), true, `${key}: a door with the gate OFF (3.1.1)`);
    assert.equal(isStoreShellHiddenAddon(key), true, `${key}: a caller that does not pass iap must answer as before`);
    // …and the door (the service's own page — Home's row, `addOnHref`) lands on a page the app opens, only with the gate on.
    const path = addOnHref(key, E).split('?')[0]!;
    assert.equal(isStoreShellWebOnlyPath(path, true), false, `${key}: its door ${path} is refused where Apple sells`);
    assert.equal(isStoreShellWebOnlyPath(path, false), true, `${key}: its door ${path} opens with the gate off`);
  }
  for (const key of STORE_SHELL_HIDDEN_ADDON_KEYS) {
    if (APPLE_UNLOCK_KEYS.includes(key) || key === 'papic') continue;
    assert.equal(isStoreShellHiddenAddon(key, true), true, `${key}: Apple does not sell it in the app — no door there`);
  }
  // The service parts list's door (Thank You under Papic — `ServiceParts`) is its own page, opened the same way.
  const ty = appStoreDetailHref('thank-you', E).split('?')[0]!;
  assert.equal(isStoreShellWebOnlyPath(ty, true), false, `Thank You's part door ${ty} is refused where Apple sells`);
  assert.equal(isStoreShellWebOnlyPath(ty, false), true);
  // A free key is never hidden by this rule.
  assert.equal(isStoreShellHiddenAddon('playlist', false), false);
});

/** Home's paid rows exactly as the page builds them — its `offered` and `refusesPath`, no prices in the app. */
function homeRows(storeShell: boolean, iap: boolean, active: ReadonlySet<string> = new Set()) {
  const reads: Record<string, { active: boolean; pending: boolean }> = {};
  for (const sku of ['SETNAYAN_AI', 'LIVE_STUDIO', 'PAKANTA', 'PATIKTOK_COMPILER', 'COUPLE_WEBSITE_PRO']) {
    reads[sku] = { active: active.has(sku), pending: false };
  }
  const paid = homePaidFacts({
    eventId: E,
    catalogue: ADD_ONS,
    reads,
    prices: storeShell ? new Map() : new Map([['PAKANTA', '₱2,500']]),
    offered: (a) => !(storeShell && isStoreShellHiddenAddon(a.key, iap)),
    sellableNow: () => true,
    aiSellable: true,
    refusesPath: (p) => storeShell && isStoreShellWebOnlyPath(p, iap),
  });
  return homeServices({ next: 'plan', storeShell, iap, papic: 'x', ai: 'y', paid, eventId: E });
}

test('2 · Home › Your services: the app draws Setnayan AI · Music Maker · Patiktok where Apple sells — none with the gate off', () => {
  const on = homeRows(true, true);
  assert.deepEqual(on.map((s) => s.key).sort(), ['ai', 'booth', 'music'], 'the Apple-sold rows are missing from the app Home');
  for (const s of on) {
    assert.ok(s.paid, `${s.key}: no row facts`);
    assert.match(s.paid.href, new RegExp(`^/dashboard/${E}/studio/(setnayan-ai|pakanta|patiktok)$`), `${s.key}: its row opens ${s.paid.href}`);
    assert.equal(isStoreShellWebOnlyPath(s.paid.href, true), false, `${s.key}: its row opens a page the app refuses`);
    assert.doesNotMatch(`${s.status} ${s.paid.price ?? ''}`, /₱|PHP|GCash|BDO/i, `${s.key}: a web price or rail in the app`);
  }
  // Owned → the normal "open" row (On); not owned → the row that opens the page with Apple's buy step.
  const owned = homeRows(true, true, new Set(['PAKANTA']));
  assert.equal(owned.find((s) => s.key === 'music')?.paid?.state, 'owned');
  assert.equal(on.find((s) => s.key === 'music')?.paid?.state, 'add');
  // Never Papic / Live Watch (their Apple rows draw them) nor the Event Hub (the control row's tile).
  assert.equal(on.some((s) => s.key === 'papic' || s.key === 'live' || s.key === 'hub'), false);
  // 🔒 THE OTHER HALF — the gate off, or no facts: nothing.
  assert.deepEqual(homeRows(true, false), [], 'a paid row in the app with the gate OFF (3.1.1)');
  assert.deepEqual(homeServices({ next: 'plan', storeShell: true, iap: true, papic: 'x', ai: 'y' }), [], 'a facts-less row in the app');
  // The web is untouched by the gate.
  assert.deepEqual(homeRows(false, false).map((s) => s.key), homeRows(false, true).map((s) => s.key));
});

test('3 · every door site asks the ONE rule with `iap` — never the raw set, never the route rule without `iap`', () => {
  const page = code('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /offered: \(a\) =>\s*!\(storeShell && isStoreShellHiddenAddon\(a\.key, iap\)\)/, 'Home paid rows: offered');
  assert.match(page, /refusesPath: \(p\) => storeShell && isStoreShellWebOnlyPath\(p, iap\)/, 'Home paid rows: refusesPath');
  assert.match(page, /if \(shell && !iap\) return null;/, 'Home reads the paid rows in the app only where Apple sells');
  assert.match(page, /const price = !shell && /, 'a web price is read for the app');
  assert.match(page, /homePaid\.aiPricePhp > 0 && !storeShell\)/, 'the AI web price is set for the app');
  assert.match(page, /const homeServicesInput: Parameters<typeof homeServices>\[0\] = \{[\s\S]*?storeShell,\s*iap,/);
  // Thank You's Home row: Apple's branch, gated by the one rule, opening its page.
  assert.match(page, /thankYou: canViewPapicCounts && appleThankYouOffered/);
  assert.match(page, /!isStoreShellHiddenAddon\(appleThankYouEntry\.key, iap\)/);
  assert.match(page, /open: `\/dashboard\/\$\{eventId\}\/studio\/thank-you`/);
  const parts = code('app/dashboard/[eventId]/studio/_components/service-parts.tsx');
  assert.match(parts, /\{ storeShell, iap \}\] = await Promise\.all\(\[resolveProfileByEvent\(eventId\), getIapGate\(\)\]\)/);
  assert.match(parts, /storeShell && \(isStoreShellHiddenAddon\(entry\.key, iap\) \|\| isStoreShellWebOnlyPath\(href\.split\('\?'\)\[0\]!, iap\)\)/);
  for (const [rel, src] of [['page.tsx', page], ['service-parts.tsx', parts]] as const) {
    assert.doesNotMatch(src, /STORE_SHELL_HIDDEN_ADDON_KEYS\.has\(/, `${rel} checks the raw set again — it ignores iap`);
    assert.doesNotMatch(src, /isStoreShellWebOnlyPath\([^()]*(?:\([^()]*\)[^()]*)*\)(?<!, iap\))/, `${rel} asks the route rule without iap`);
  }
  const shell = code('app/dashboard/[eventId]/_components/home-first-screen.tsx');
  assert.match(shell, /apple\?\.thankYou \? \(\s*<AppleServiceRow\s+marker="thank-you"/, 'the Thank-You row is not drawn in the app');
});
