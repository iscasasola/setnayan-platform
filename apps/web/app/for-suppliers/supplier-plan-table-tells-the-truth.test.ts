/**
 * supplier-plan-table-tells-the-truth.test.ts — Build 6 Lane J: the plan tables print what the APP applies, never a
 * typed number (owner 10 Nov 2026: *"update the full FREE vs VERIFIED vs SOLO vs PRO vs ULTRA … and here update FREE vs
 * PLUS vs PRO if there are any changes"*; DECISION_LOG 2026-11-10 "BOTH PLAN TABLES ARE REDRAWN TO THE RULINGS").
 *
 * It fails when:
 *   · a plan table, its renderer, or the front door's plan cards TYPE a peso amount or a credit count;
 *   · a limit cell differs from the entitlement code — the plan sheet's own `limitOf` / `limitWords` (Build 5 Lane B),
 *     the flag-aware `allowance`, and `TIER_CAPS` — in EITHER state of the plan paywall;
 *   · a price cell is not the price the page read (it is fed sentinels, so a typed figure cannot pass);
 *   · a ruled lock the app does NOT enforce is printed as locked, or an enforced one is missing;
 *   · the Event Plus card names an Event Hub part while a paid Event Plus order unlocks none (`hubOwnershipFrom`);
 *   · /features loses its light "no select", or blocks anything more than selection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { formatCount } from '@/lib/format-number';
import { LOCKS, LOCK_KEYS } from '@/lib/locks';
import { PLAN_LIMITS, limitOf, limitWords } from '@/lib/plan-sheet';
import { allowance } from '@/lib/vendor-plan-rows';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';
import { SPECIALIZED_TOOLS_INCLUDED_TIERS } from '@/lib/specialized-tools-access';
import { vendorAddonSkuCode } from '@/lib/vendor-addon-tier-pricing';
import { ULTRA_ADDON_ORDER, canBuyUltraAddOn, ultraAddOnSku } from '@/lib/vendor-ultra-addons';
import { EVENT_PLUS_SKU, HUB_PART_IDS, hubOwnershipFrom } from '@/lib/hub-parts';
import {
  APPLIED_LOCKS,
  FREE_FINDABLE,
  TABLE_TIERS,
  UNAPPLIED_LOCKS,
  addonLines,
  planTable,
  type TableGroup,
} from './_components/plan-table-data';
import { freeSpec } from './_components/supplier-front-data';
import { freeSpec as coordinatorFreeSpec } from '@/app/(shell)/for-coordinators/_facts';
import { plusPeek, proMore, freeGroups, PLUS_MORE } from '@/app/_components/frontdoor/front-door-landing-data';

const WEB = join(__dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Sentinel prices: every one the table prints must be one of these, so a typed figure cannot pass. */
const SENT = (k: string) => `₱SENT:${k}`;
const SKUS = [
  'vendor_deep_search',
  'vendor_ai_addon',
  'vendor_ai_addon_entry',
  'vendor_specialized_tools',
  ...ULTRA_ADDON_ORDER.map(ultraAddOnSku),
];
const PRICES = {
  monthly: { solo: SENT('solo-mo'), pro: SENT('pro-mo'), enterprise: SENT('ent-mo') },
  annual: { solo: SENT('solo-yr'), pro: SENT('pro-yr'), enterprise: SENT('ent-yr') },
  bySku: Object.fromEntries(SKUS.map((k) => [k, SENT(k)])),
};

const rowsOf = (groups: TableGroup[]) => groups.flatMap((g) => g.rows);
const row = (groups: TableGroup[], key: string) => {
  const r = rowsOf(groups).find((x) => x.key === key);
  assert.ok(r, `the table has no row ${key}`);
  return r!;
};

test('no peso amount and no credit count is typed into a plan table, its renderer or the plan cards', () => {
  const files = [
    'app/for-suppliers/_components/plan-table-data.ts',
    'app/for-suppliers/_components/supplier-plan-table.tsx',
    'app/_components/frontdoor/front-door-landing-data.ts',
  ];
  for (const rel of files) {
    const src = code(rel);
    assert.deepEqual(src.match(/₱\s?\d[\d,]*/g) ?? [], [], `${rel} types a peso figure — read it from the catalogue`);
    assert.doesNotMatch(src, /\b\d[\d,]*\s+(Papic\s+)?credits\b/i, `${rel} types a credit count — read included_papic_credits`);
    assert.doesNotMatch(src, /\b\d+\s*km\b/, `${rel} types a reach — read TIER_CAPS`);
  }
});

test('every limit cell is the entitlement code — in both states of the plan paywall', () => {
  for (const paywallOn of [false, true]) {
    const g = planTable({ paywallOn, prices: PRICES });
    for (const l of PLAN_LIMITS) {
      const r = row(g, `limit:${l.key}`);
      for (const t of TABLE_TIERS) {
        const v = limitOf(t, l.key, paywallOn);
        const want = l.key === 'reach' && v === 0 ? FREE_FINDABLE.replace(/^f/, 'F') : v === 0 ? 'None' : limitWords(l.key, v);
        assert.equal(r.cells[t].text, want, `${l.key} · ${t} · paywall ${paywallOn}: the table says ${r.cells[t].text}`);
      }
    }
    const wl = row(g, 'limit:waitlist');
    for (const t of TABLE_TIERS) {
      const v = allowance(TIER_CAPS[t].waitlistAcceptances, 'waitlistAcceptances', paywallOn);
      assert.equal(wl.cells[t].text, v > 0 ? formatCount(v) : 'None', `waitlist · ${t} · paywall ${paywallOn}`);
    }
  }
  // Anti-vacuity: the six limits are the plan sheet's six, and Pro/Ultra differ on bookings a day (3 vs 5 today).
  const g = planTable({ paywallOn: true, prices: PRICES });
  const bpd = row(g, 'limit:bookingsPerDate');
  assert.equal(bpd.cells.pro.text, formatCount(TIER_CAPS.pro.bookingsPerDatePerService));
  assert.equal(bpd.cells.enterprise.text, formatCount(TIER_CAPS.enterprise.bookingsPerDatePerService));
});

test('the plan-feature rows are TIER_CAPS, the tools row is the unlock rule, gifts are the gift-price rule', () => {
  const g = planTable({ paywallOn: true, prices: PRICES });
  const yes = (k: string, cap: (t: (typeof TABLE_TIERS)[number]) => boolean) => {
    const r = row(g, k);
    for (const t of TABLE_TIERS) assert.equal(r.cells[t].kind === 'yes', cap(t), `${k} · ${t}`);
  };
  yes('tool:address', (t) => TIER_CAPS[t].customWebsiteName);
  yes('tool:premium', (t) => TIER_CAPS[t].premiumPage);
  yes('tool:video', (t) => TIER_CAPS[t].formVideoLinks);
  yes('tool:uploads', (t) => TIER_CAPS[t].formMediaUploads);
  yes('tool:trends', (t) => TIER_CAPS[t].performanceTrends);
  yes('tool:intel', (t) => TIER_CAPS[t].marketIntel);
  yes('tool:theft', (t) => TIER_CAPS[t].theftWatch);
  yes('tool:specialized', (t) => SPECIALIZED_TOOLS_INCLUDED_TIERS.includes(t));
  const gift = row(g, 'money:gift');
  // 📦 One price per gift on every plan (owner 2026-11-14) — no plan buys gifts for less; bundles are open to all.
  for (const t of TABLE_TIERS) assert.equal(gift.cells[t].text, 'List price', `gift · ${t}`);
});

test('every price cell is the price the page read — or "—" when it read nothing', () => {
  const g = planTable({ paywallOn: true, prices: PRICES });
  const cells = rowsOf(g).flatMap((r) => TABLE_TIERS.map((t) => r.cells[t].text));
  for (const c of cells) {
    for (const m of c.match(/₱[^\s/]*/g) ?? []) assert.match(m, /^₱SENT:/, `a price cell prints ${m}, which the page never read`);
  }
  assert.equal(row(g, 'price:4w').cells.pro.text, SENT('pro-mo'));
  assert.equal(row(g, 'price:yr').cells.enterprise.text, SENT('ent-yr'));
  for (const t of TABLE_TIERS) {
    assert.equal(row(g, 'money:deep').cells[t].text, `${SENT(vendorAddonSkuCode('deep_search_about_you', t))} a search`);
    assert.equal(row(g, 'money:chatbot').cells[t].text, `${SENT(vendorAddonSkuCode('ai_chatbot_basic', t))} / 4 weeks`);
  }
  const none = planTable({ paywallOn: true, prices: { monthly: {}, annual: {}, bySku: {} } });
  const blank = rowsOf(none).flatMap((r) => TABLE_TIERS.map((t) => r.cells[t].text)).filter((t) => t.includes('₱'));
  assert.deepEqual(blank, [], 'an unread catalogue still printed a peso');
  // Ultra's add-ons: every one the code lets a Grow plan buy, at the SKU it charges.
  const lines = addonLines(PRICES.bySku);
  const buyable = ULTRA_ADDON_ORDER.filter((k) => (['solo', 'pro', 'enterprise'] as const).some((t) => canBuyUltraAddOn(k, t)));
  assert.deepEqual(lines.map((l) => l.kind), buyable);
  for (const l of lines) assert.equal(l.price, SENT(ultraAddOnSku(l.kind)));
  assert.ok(lines.length >= 6, `anti-vacuity: Ultra's add-on list shrank to ${lines.length}`);
});

test('a lock is printed only when the app enforces it — and every enforced one is', () => {
  const g = planTable({ paywallOn: true, prices: PRICES });
  const printed = rowsOf(g).filter((r) => r.key.startsWith('lock:')).map((r) => r.key.slice(5));
  assert.deepEqual(printed, [...APPLIED_LOCKS]);
  for (const k of UNAPPLIED_LOCKS) assert.ok(!printed.includes(k), `${k} has no server gate and is printed as a lock`);
  assert.deepEqual([...APPLIED_LOCKS, ...UNAPPLIED_LOCKS].sort(), [...LOCK_KEYS].sort());
  for (const r of rowsOf(g).filter((x) => x.key.startsWith('lock:'))) {
    const def = LOCKS[r.key.slice(5) as keyof typeof LOCKS];
    assert.deepEqual(r.why, { problem: def.problem, solution: def.solution }, `${r.key} lost its Problem → Solution line`);
    assert.equal(r.cells.free.kind, 'lock', `${r.key}: an unverified shop is not shown the lock`);
  }
  assert.ok(printed.includes('plans'), 'anti-vacuity: the enforced paid-plan lock is gone from the table');
});

test('both front pages say what search does with an unverified shop', () => {
  assert.ok(freeSpec().includes(FREE_FINDABLE));
  assert.ok(coordinatorFreeSpec().includes(FREE_FINDABLE));
  for (const rel of [
    'app/for-suppliers/_components/supplier-front-page.tsx',
    'app/(shell)/for-coordinators/page.tsx',
    'app/for-suppliers/_components/supplier-front-data.ts',
    'app/(shell)/for-coordinators/_facts.ts',
  ]) {
    const src = code(rel);
    assert.doesNotMatch(src, /Only Verified shops are shown/, `${rel}: an unverified shop shows until its first inquiry`);
    assert.doesNotMatch(src, /not in search yet/, `${rel}: an unverified shop shows until its first inquiry`);
  }
});

test('the Event Plus card names only what a paid Event Plus order unlocks', () => {
  // What the code grants a Plus-only event: no Event Hub part at all.
  const own = hubOwnershipFrom({
    fullHeld: false,
    partHeld: () => false,
    paidParts: [],
    prices: new Map([[EVENT_PLUS_SKU, 1]]),
    fullPrice: 2,
    plusPaid: true,
  });
  assert.equal(own.full, false);
  assert.equal(own.parts.size, 0, 'Event Plus now unlocks a Hub part — say so on the Plus card and update this guard');
  assert.ok(HUB_PART_IDS.length > 0);
  const facts = { plusCredits: 7, proCredits: 9, freePapic: null };
  const plus = [...plusPeek(facts), ...PLUS_MORE].join(' · ');
  assert.doesNotMatch(plus, /theme|music|web address|animation|Setnayan mark/i, `the Plus card sells a Hub part: ${plus}`);
  assert.match(plus, /\b7 Papic credits\b/, 'the Plus card does not print the credits the catalogue read');
  assert.match(proMore(facts).join(' '), /\b9 Papic credits\b/, 'the Pro card does not print the credits the catalogue read');
  assert.doesNotMatch(plusPeek({ plusCredits: null, proCredits: null, freePapic: null }).join(' '), /credits/, 'an unread credit count is still said');
  assert.doesNotMatch(proMore(facts).join(' '), /No Setnayan marks/, 'Pro promises no marks while the seat pages still print one');
  const free = freeGroups({ plusCredits: null, proCredits: null, freePapic: null }).flatMap((g) => g.items).join(' · ');
  assert.doesNotMatch(free, /\b50 free credits\b/, 'the Free card types the free-credit number');
});

test('/features: a light "no select" on the sections, and nothing more', () => {
  const body = code('app/features/_PageBody.tsx');
  // 2026-11-11 (v3): the first thing inside the no-select is the English story or, in Taglish, the shipped groups.
  assert.match(
    body,
    /<div className="select-none" data-features-no-select="">\s*\{locale === 'en' \? <FeaturesStory locale=\{locale\} \/> : <FeatureGroups/,
    'the light no-select is gone',
  );
  assert.ok(body.indexOf('{search}') < body.indexOf('select-none'), 'the search field sits inside the no-select');
  for (const rel of [
    'app/features/_PageBody.tsx',
    'app/features/_sections/_FeatureGroups.tsx',
    'app/features/_sections/_Story.tsx',
    'app/features/_story-client.tsx',
    'app/features/_sections/_WhySetnayan.tsx',
    'app/features/_sections/_HowItWorks.tsx',
  ]) {
    const src = code(rel);
    assert.doesNotMatch(src, /onContextMenu|onCopy|onKeyDown|oncontextmenu|oncopy/, `${rel} blocks more than selection`);
  }
  const robots = code('app/robots.ts');
  assert.doesNotMatch(robots, /disallow[^\n]*['"`]\/features/i, 'robots blocks /features');
});
