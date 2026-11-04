/**
 * 🍎 THE WELCOME PRICE NEVER REACHES THE APP (owner 2026-10-28, DECISION_LOG
 * "ONE PRICE EVERYWHERE"): *"but only via website"*.
 *
 * Apple's anti-steering rule: inside the iOS / Android app nothing may mention,
 * show or point to a cheaper price on the website. The app shows the StoreKit
 * price and nothing else. This holds REGARDLESS of `WELCOME_DISCOUNT_ENABLED`.
 *
 * ── THE PROPERTY, IN FOUR PARTS ──────────────────────────────────────────────
 *   1 · THE DECISION refuses the store shell FIRST — before the switch, the
 *       order history or the percentage are looked at.
 *   2 · THE SERVER asks the shipped store-shell detector (`isStoreShellRequest`)
 *       on every welcome decision; nothing a browser sends can stand in for it.
 *   3 · THE DRAWER never asks for (or shows) a welcome price in the shell.
 *   4 · A CLOSED ROSTER of every app/ or components/ file that can render a
 *       set-up or welcome price — each with the fence that keeps it out of the
 *       app, CHECKED (the route is a store-shell web-only path, or the file asks
 *       the shell detector in code, or its data is drawn only by a component
 *       that does). A new file that starts rendering one fails here until
 *       someone writes down how the app is kept away from it.
 *
 * 📲 "Bounced by middleware" is NO LONGER a fence (owner 2026-11-02, DECISION_LOG
 * "EVERY PAGE HELD BACK FROM THE APP FOR APPLE GOES LIVE IN THE APP TOO" — "let
 * everything go live"): the app opens `/` and /pricing like the website now. The
 * two roster rows that leaned on that bounce were re-fenced on what actually
 * keeps the welcome price out of the iPhone app today — /pricing is still a
 * store-shell web-only path, and the home price data is drawn only by
 * HomeOverlays, which shows the store shell nothing but Sign in. This ruling
 * did NOT lift "but only via website" — the welcome price stays off the app.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { decideWelcome } from './welcome-discount';
import { isStoreShellWebOnlyPath } from './store-shell';
import { stripComments } from './strip-comments';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const codeOnly = (src: string) => stripComments(src);

test('1 · the decision refuses the app before anything else', () => {
  for (const enabled of [true, false]) {
    for (const paidOrders of [0, 1, null]) {
      for (const pct of [0, 40, 90]) {
        assert.deepEqual(
          decideWelcome({ enabled, storeShell: true, paidOrders, pct }),
          { kind: 'regular', why: 'app' },
          `enabled=${enabled} paidOrders=${paidOrders} pct=${pct}`,
        );
      }
    }
  }
  const src = codeOnly(read('lib/welcome-discount.ts'));
  const fn = src.slice(src.indexOf('export function decideWelcome('));
  const firstIf = /\{\s*if \(([^)]*)\)/.exec(fn.slice(fn.indexOf('): WelcomeDecision')));
  assert.equal(firstIf?.[1], 'input.storeShell', 'the store-shell refusal must be the FIRST check in decideWelcome');
});

test('2 · every server decision asks the shipped store-shell detector', () => {
  const src = codeOnly(read('lib/welcome-discount.server.ts'));
  const at = src.indexOf('export async function readWelcomeDecision(');
  assert.ok(at > 0, 'readWelcomeDecision is gone');
  const body = src.slice(at, src.indexOf('\n}\n', at));
  assert.match(body, /const storeShell = await isStoreShellRequest\(\);/, 'the decision must read the request’s own shell signals');
  assert.match(body, /decideWelcome\(\{ enabled, storeShell,/, 'and hand them to the one decision');
  assert.ok(!/formData|searchParams/.test(body), 'nothing the browser sends may decide it');
  // Every path that hands out a welcome figure goes through that decision.
  const actions = codeOnly(read('app/dashboard/[eventId]/checkout/actions.ts'));
  const quote = actions.slice(actions.indexOf('async function quoteWelcomeForLine('));
  assert.match(quote.slice(0, 2000), /const decision = await readWelcomeDecision\(user\.id\);\s*if \(decision\.kind !== 'welcome'\) return null;/);
});

test('3 · the checkout drawer never asks for, nor shows, a welcome price in the app', () => {
  const src = codeOnly(read('app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx'));
  assert.match(src, /const isNativeApp = useIsStoreShell\(\);/, 'the drawer must use the shipped store-shell hook');
  const call = src.indexOf("fd.set('intent', 'welcome_quote');");
  assert.ok(call > 0, 'the welcome quote call is gone (update this guard with it)');
  assert.match(
    src.slice(Math.max(0, call - 260), call),
    /if \(isNativeApp \|\| !open\) return;/,
    'the quote must be refused in the store shell BEFORE it is asked',
  );
  assert.match(src, /const welcomeShown = !isNativeApp && welcomeQuote !== null/, 'the welcome line must be hidden in the store shell');
  // The shell's trigger is the inert chip — no price, no link.
  const chip = src.slice(src.indexOf('const trigger = isNativeApp ? ('), src.indexOf(') : (', src.indexOf('const trigger = isNativeApp ? (')));
  assert.ok(!/Display|href|welcome/i.test(chip), 'the in-app chip must show no price and point nowhere');
});

type Fence =
  | { kind: 'web-only'; route: string }
  /**
   * A data module with no screen of its own: EVERY file that imports it is listed, and the prices reach a screen only
   * through `drawnBy`, which refuses the store shell before it draws anything but Sign in. The other importers are
   * a roster row of their own, the chrome that hands the data to `drawnBy`, or the JSON route that chrome fetches.
   */
  | { kind: 'drawn-only-by'; drawnBy: string; importers: string[] }
  | { kind: 'asks-shell' }
  | { kind: 'admin' }
  | { kind: 'dev-lab' };

/**
 * Every app/ + components/ file that touches a set-up or welcome price, and how
 * the app is kept away from it. `asks-shell` = the file itself calls the shipped
 * detector (`isStoreShellRequest(` / `useIsStoreShell(` / `readWelcomeDecision(`,
 * which calls it) in code.
 */
const ROSTER: Record<string, Fence> = {
  'app/(shell)/papic/page.tsx': { kind: 'web-only', route: '/papic' },
  // /pricing opens in the desktop app since 2026-11-02; the iPhone app still refuses it (store-shell doorway).
  'app/(shell)/pricing/_pricing-reads.ts': { kind: 'web-only', route: '/pricing' },
  // `/` opens in the app since 2026-11-02 — but these prices only ever reach a screen through HomeOverlays.
  'app/_components/home/pricing-data.ts': {
    kind: 'drawn-only-by',
    drawnBy: 'app/_components/home/HomeOverlays.tsx',
    importers: [
      'app/(shell)/pricing/_pricing-reads.ts',
      'app/_components/home/HomeOverlays.tsx',
      'app/_components/marketing/site-chrome.tsx',
      'app/api/home-pricing/route.ts',
    ],
  },
  'app/onboarding/[type]/page.tsx': { kind: 'asks-shell' },
  'app/onboarding/simple/page.tsx': { kind: 'asks-shell' },
  'app/onboarding/wedding/page.tsx': { kind: 'asks-shell' },
  // Pure view-model; its ONLY caller is app/onboarding/wedding/page.tsx (above), which asks the shell.
  'app/onboarding/wedding/_components/onboarding-pricing.ts': { kind: 'asks-shell' },
  'app/dashboard/[eventId]/checkout/actions.ts': { kind: 'asks-shell' },
  'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx': { kind: 'asks-shell' },
  'app/admin/pricing/actions.ts': { kind: 'admin' },
  'app/admin/pricing/price-control-actions.ts': { kind: 'admin' },
  'app/admin/pricing/_surfaces/pricing-surface.tsx': { kind: 'admin' },
  'app/admin/pricing/_surfaces/papic-ladder-surface.tsx': { kind: 'admin' },
  'app/admin/pricing/_surfaces/ai-prices-surface.tsx': { kind: 'admin' },
};

/** Code that can put a set-up / welcome figure on a screen. */
const TOUCHES_THE_PRICE =
  /welcome_quote|quoteWelcomeForLine|welcome-discount|setupPricePhp|hasSetupSaving|setupPriceAppliesForCreateFlow|onboarding-discount|onboarding_price_php|onboarding_discount_pct|readServicesStepView|buildOnboardingPricing|Welcome price/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(relative(WEB, abs));
  }
  return out;
}

test('4 · every surface that can render a set-up or welcome price is fenced from the app (closed roster)', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'components'))];
  assert.ok(files.length > 500, `the sweep saw only ${files.length} files — it has gone blind`);
  const touching = files.filter((f) => TOUCHES_THE_PRICE.test(codeOnly(read(f)))).sort();
  const unlisted = touching.filter((f) => !(f in ROSTER));
  assert.deepEqual(
    unlisted,
    [],
    'a file now renders a set-up / welcome price with no recorded fence from the app. Apple anti-steering: say how ' +
      'the store shell is kept from it and add it to ROSTER.',
  );
  const stale = Object.keys(ROSTER).filter((f) => !touching.includes(f));
  assert.deepEqual(stale, [], 'roster entries no longer touch the price — prune them');

  for (const [file, fence] of Object.entries(ROSTER)) {
    const code = codeOnly(read(file));
    switch (fence.kind) {
      case 'drawn-only-by': {
        const base = file.replace(/^app\//, '').replace(/\.tsx?$/, '');
        const leaf = base.split('/').pop()!;
        const importsIt = new RegExp(`from '(?:@/app/${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|\\./${leaf})'`);
        const importers = files.filter((f) => f !== file && importsIt.test(codeOnly(read(f)))).sort();
        assert.deepEqual(importers, [...fence.importers].sort(), `${file} gained (or lost) an importer the roster does not fence`);
        // The one component that DRAWS these prices shows the store shell nothing but Sign in.
        assert.match(
          codeOnly(read(fence.drawnBy)),
          /const storeShell = useIsStoreShell\(\);\s*if \(storeShell\) \{\s*return current === 'signin' \? <SignInHerePanel[^;]*: null;\s*\}/,
          `${fence.drawnBy} no longer refuses the store shell before it draws a price`,
        );
        for (const f of fence.importers) {
          if (f === fence.drawnBy) continue;
          const c = codeOnly(read(f));
          if (f in ROSTER) continue; // fenced by its own row
          if (f.startsWith('app/api/')) {
            // A JSON route draws nothing; its only reader is the chrome below, which hands the data to `drawnBy`.
            assert.match(c, /return NextResponse\.json\(pricing,/, `${f} does more than return the prices as JSON`);
            continue;
          }
          // The chrome: it may only hand the prices to `drawnBy`, never draw them itself.
          assert.equal((c.match(/\bpricing=\{pricing\}/g) ?? []).length, 1, `${f} hands the prices to more than one place`);
          assert.match(c, /<HomeOverlays [^>]*pricing=\{pricing\} \/>/, `${f} hands the prices to something other than ${fence.drawnBy}`);
          assert.doesNotMatch(c, /\{pricing\.|pricing\?\./, `${f} draws a price itself`);
        }
        break;
      }
      case 'web-only':
        assert.equal(isStoreShellWebOnlyPath(fence.route), true, `${file}: ${fence.route} is no longer a store-shell web-only path`);
        break;
      case 'asks-shell':
        if (file === 'app/onboarding/wedding/_components/onboarding-pricing.ts') {
          const callers = files.filter((f) => f !== file && /buildOnboardingPricing\(/.test(codeOnly(read(f))));
          assert.deepEqual(callers, ['app/onboarding/wedding/page.tsx'], `${file} gained a caller the roster does not fence`);
          break;
        }
        assert.match(
          code,
          /isStoreShellRequest\(|useIsStoreShell\(|readWelcomeDecision\(/,
          `${file} no longer asks the store-shell detector`,
        );
        break;
      case 'admin':
        assert.ok(file.startsWith('app/admin/'), `${file} is not under the admin console`);
        break;
      case 'dev-lab':
        assert.ok(file.startsWith('app/dev/'), `${file} is not a dev lab`);
        break;
    }
  }
});
