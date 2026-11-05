/**
 * supplier-page-words.test.ts — what the /for-suppliers port (4 Nov 2026 prototype) says is read, not typed,
 * and every door and photo it draws is really there.
 *
 *   (1) NO DEMO / SAMPLE BUTTONS. The prototype linked "See the demo shop" and twelve "See it on the demo shop"
 *       links to `/sample/supplier`. Owner, 2026-11-04/05: *"do not add buttons now"* · *"just do not add
 *       buttons"* — not hidden behind a switch, not added. No file that draws this page may link to `/sample` or
 *       say "demo shop". The doors it does draw must exist.
 *   (2) THE ALLOWANCES FOLLOW TIER_CAPS. The plan lines and the problem answers put reach, team seats, waitlists
 *       and the own web address into words. Every number in those words must be one TIER_CAPS holds, and no
 *       JavaScript value ("Infinity", "NaN", "undefined") may reach a person.
 *   (3) THE PHOTOS ARE ON DISK, with the owner's hero shifts.
 *
 * SABOTAGE (run 2026-11-05): add a "See the demo shop" link to /sample/supplier in the hero → (1) RED · type "100 km" into planLine → (2) RED ·
 * delete public/marketing/2026-11-04/supplier-team-hero.webp → (3) RED · change florist's --dr to 5% → (3) RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';
import { FEATURE_PAGES } from '@/lib/feature-pages';
import {
  HERO_SLIDES,
  MARKETING_PHOTOS,
  OPEN_SHOP_HREF,
  freePlanLine,
  giftProducts,
  packageTools,
  planLine,
  planTools,
  reachLine,
  verifiedPlanLine,
  seatsLine,
} from './supplier-page-words';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const has = (rel: string) => existsSync(join(WEB, rel));

/** Source without comments — so the comment explaining why there is no button never reads as a button. */
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) no demo or sample button anywhere on the page — and the doors it does draw exist', () => {
  const files = [
    'app/(shell)/for-suppliers/page.tsx',
    'app/for-suppliers/_components/vendor-grow-hero.tsx',
    'app/for-suppliers/_components/vendor-grow-sections.tsx',
    'app/for-suppliers/_components/vendor-tier-deltas.tsx',
    'app/for-suppliers/_components/supplier-page-words.ts',
    'app/for-suppliers/_components/for-vendors-motion.tsx',
  ];
  for (const f of files) {
    const src = code(f);
    assert.ok(src.length > 200, `${f} could not be read`);
    assert.doesNotMatch(src, /['"`]\/sample\b/, `${f} links to /sample — owner: "just do not add buttons"`);
    assert.doesNotMatch(src, /demo shop/i, `${f} draws a demo-shop button or line — owner: "just do not add buttons"`);
  }
  assert.ok(has(`app${OPEN_SHOP_HREF}/page.tsx`), `${OPEN_SHOP_HREF} — the "Open a shop" door — has no page`);
  assert.ok(has('app/vendor-dashboard/profile/page.tsx'), '"Get Verified — free" (the papers, /vendor-dashboard/profile#docs) points at a page that is gone');
});

test('(2) every allowance the page says is a number TIER_CAPS holds — none is typed', () => {
  const lines = [
    verifiedPlanLine(),
    planLine('solo', 'verified'),
    planLine('pro', 'solo'),
    planLine('enterprise', 'pro'),
    seatsLine(),
    reachLine(),
  ];
  const known = new Set<string>();
  for (const t of ['verified', 'solo', 'pro', 'enterprise'] as const) {
    const c = TIER_CAPS[t];
    for (const n of [c.serviceRadiusKm, c.agentAccounts, c.waitlistAcceptances]) if (Number.isFinite(n)) known.add(String(n));
  }
  for (const line of lines) {
    assert.doesNotMatch(line, /Infinity|NaN|undefined|null/, `a JavaScript value reached a person: "${line}"`);
    for (const m of line.matchAll(/\d+/g)) {
      assert.ok(known.has(m[0]), `"${m[0]}" in "${line}" is not a number TIER_CAPS holds — it was typed`);
    }
  }
  // The reach line names every rung, in order, from the table.
  for (const t of ['verified', 'solo', 'pro', 'enterprise'] as const) {
    const km = TIER_CAPS[t].serviceRadiusKm;
    assert.ok(reachLine().includes(Number.isFinite(km) ? `${km} km` : 'the whole country'), `reach for ${t} is missing`);
  }
  // Each plan's line says THAT plan's reach — a number the table holds for some other plan is still a typed one.
  for (const [t, below] of [['solo', 'verified'], ['pro', 'solo'], ['enterprise', 'pro']] as const) {
    const km = TIER_CAPS[t].serviceRadiusKm;
    const line = planLine(t, below);
    if (km !== TIER_CAPS[below].serviceRadiusKm) {
      assert.ok(
        line.toLowerCase().includes(Number.isFinite(km) ? `${km} km reach` : 'nationwide reach'),
        `${t}'s line "${line}" does not say its own reach (${km})`,
      );
    }
    for (const m of line.matchAll(/(\d+) km/g)) assert.equal(Number(m[1]), km, `${t}'s line names another plan's reach: "${line}"`);
  }
  // The lines CLIMB (owner, 5 Nov): Free says what it covers, then each plan is "Everything in <below>, plus: …".
  assert.match(freePlanLine(), /bring in your own clients/, 'Free no longer says you run the business with your own clients');
  assert.match(freePlanLine(), /Not shown in search/, 'Free no longer says it is hidden from search');
  assert.ok(verifiedPlanLine().startsWith('Everything in Free, plus:'), verifiedPlanLine());
  const vkm = TIER_CAPS.verified.serviceRadiusKm;
  assert.ok(verifiedPlanLine().includes(Number.isFinite(vkm) ? `within ${vkm} km` : 'anywhere in the country'), 'Verified does not say its own reach');
  for (const [t, below, name] of [['solo', 'verified', 'Verified'], ['pro', 'solo', 'Solo'], ['enterprise', 'pro', 'Pro']] as const) {
    assert.ok(planLine(t, below).startsWith(`Everything in ${name}`), `${t}'s line does not build on ${name}: "${planLine(t, below)}"`);
  }
  // A seat count the table says moved is said; one that did not move is not.
  const moved = TIER_CAPS.pro.agentAccounts !== TIER_CAPS.solo.agentAccounts;
  assert.equal(/team seat/.test(planLine('pro', 'solo')), moved);
});

test('(2b) the components draw these words and type no allowance of their own', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'vendor-grow-sections.tsx'), 'utf8');
  const port = src.slice(src.indexOf('/* ── 1b · VERIFIED ONLY'), src.indexOf('/* ── responsive helpers'));
  assert.ok(port.length > 2000, 'could not find the ported sections');
  assert.doesNotMatch(port, /\b\d+\s*km\b/, 'a reach is typed into the ported sections');
  assert.doesNotMatch(port, /\b(one|five|ten|\d+) (team )?seats? on\b/i, 'a seat count is typed into the ported sections');
  assert.doesNotMatch(port, /₱\s*[1-9]/, 'a peso figure is typed into the ported sections');
  for (const fn of ['planLine(', 'seatsLine()', 'reachLine()', 'ownAddressFrom()']) assert.ok(port.includes(fn), `${fn} is no longer drawn`);
});

test('(1b) true claims (CLOUD_BOARD check, 5 Nov): no calls, four papers, the 3D logo from Solo, no e-sign', () => {
  const files = [
    'app/(shell)/for-suppliers/page.tsx',
    'app/for-suppliers/_components/vendor-grow-hero.tsx',
    'app/for-suppliers/_components/vendor-grow-sections.tsx',
    'app/for-suppliers/_components/vendor-tier-deltas.tsx',
    'app/for-suppliers/_components/vendor-tier-matrix.tsx',
    'app/_components/home/vendor-benefits.ts',
  ];
  for (const f of files) {
    const src = code(f);
    assert.doesNotMatch(src, /in-app (video|audio)|video & audio call/i, `${f}: in-app calls left the chat on 28 Oct`);
    assert.doesNotMatch(src, /12-doc|12 papers|twelve papers/i, `${f}: verification is four papers and a video call, not twelve`);
    assert.doesNotMatch(src, /e-sign/i, `${f}: contracts are uploaded PDFs — nobody e-signs in the app`);
  }
  const solo = VENDOR_TIER_SECTIONS.find((x) => x.tier === 'solo')!.groups.flatMap((g) => g.items.map((i) => i.n));
  const pro = VENDOR_TIER_SECTIONS.find((x) => x.tier === 'pro')!.groups.flatMap((g) => g.items.map((i) => i.n));
  assert.ok(solo.some((n) => /3D seat plan/.test(n)), 'the 3D seat-plan logo opens from Solo (with the 3D Booth add-on)');
  assert.ok(!pro.some((n) => /3D seat plan/.test(n)), 'the 3D seat-plan logo is listed as a Pro tool again');
});

test('(2c) every plan lists its tools, from the one shared list (owner, 5 Nov: "list all tools")', () => {
  const by = Object.fromEntries(planTools().map((p) => [p.plan, p.tools]));
  assert.deepEqual(Object.keys(by), ['free', 'verified', 'solo', 'pro', 'enterprise']);
  assert.ok(by.free!.some((t) => /Build your own Setnayan page/.test(t)), 'Free no longer names the page');
  assert.ok(by.free!.some((t) => /gifts/i.test(t)), 'Free no longer names gift sending');
  assert.ok(by.free!.some((t) => /Import past clients/.test(t)), 'Free no longer names importing your clients');
  const vkm = TIER_CAPS.verified.serviceRadiusKm;
  assert.ok(by.verified![0]!.includes(Number.isFinite(vkm) ? `within ${vkm} km` : 'anywhere'), 'Verified does not lead with being seen');
  const shared = new Set(VENDOR_TIER_SECTIONS.flatMap((x) => x.groups.flatMap((g) => g.items)).map((i) => i.n));
  const soon = new Set(VENDOR_TIER_SECTIONS.flatMap((x) => x.groups.flatMap((g) => g.items.filter((i) => i.soon))).map((i) => i.n));
  for (const [plan, tools] of Object.entries(by)) {
    assert.ok(tools.length > 0, `${plan} lists no tools`);
    for (const t of tools) {
      assert.ok(!soon.has(t), `${plan} sells a tool that is not built yet: "${t}"`);
      assert.doesNotMatch(t, /switched off|Infinity|NaN|undefined/, `${plan}: "${t}"`);
    }
    if (plan === 'solo' || plan === 'pro' || plan === 'enterprise') {
      for (const t of tools) assert.ok(shared.has(t), `${plan} lists "${t}", which is not in the shared plan list`);
    }
  }
  // Nothing is listed twice across the ladder.
  const all = Object.values(by).flat();
  assert.equal(new Set(all).size, all.length, 'a tool is listed under two plans');
});

test('(2d) your package: the couple’s free tools from the Features list, and the owner’s gifts (5 Nov)', () => {
  const tools = packageTools();
  assert.ok(tools.length >= 10, `only ${tools.length} tools — the Features list was not read`);
  for (const t of tools) {
    const f = FEATURE_PAGES.find((x) => x.slug === t.slug);
    assert.ok(f, `${t.slug} is not a Features page`);
    assert.notEqual(f!.price.kind, 'paid', `${t.name} is a PAID tool — it is a gift, never "free for your couple"`);
  }
  for (const must of ['guest-list', 'budget', 'event-hub']) assert.ok(tools.some((t) => t.slug === must), `${must} is missing (owner named it)`);
  assert.ok(!tools.some((t) => t.slug === 'marketplace' || t.slug === 'compare' || t.slug === 'suppliers'), 'a supplier-finding page is listed as a package tool');
  assert.deepEqual(giftProducts(), ['Papic', 'Event Plus', 'Event Pro', 'Live Watch', 'Music Maker', 'Patiktok']);
  const src = code('app/for-suppliers/_components/vendor-grow-sections.tsx');
  const block = src.slice(src.indexOf('export function VendorGrowPackage'), src.indexOf('export type PlanLinePrices'));
  assert.ok(block.length > 300, 'could not find VendorGrowPackage');
  assert.doesNotMatch(block, /₱\s*\d/, 'a gift price is typed — gift prices live in the catalogue');
  assert.match(block, /packageTools\(\)/);
  assert.match(block, /giftProducts\(\)/);
});

test('(3) every photo is on disk, with the owner’s hero shifts', () => {
  const sections = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'vendor-grow-sections.tsx'), 'utf8');
  const problemKeys = [...sections.matchAll(/photo: '([a-z0-9-]+)'/g)].map((m) => m[1]!);
  assert.equal(problemKeys.length, 12, `expected the twelve problem photos, found ${problemKeys.length}`);
  for (const key of [...HERO_SLIDES.map((s) => s.key), ...problemKeys]) {
    assert.ok(has(`public${MARKETING_PHOTOS}/${key}.webp`), `public${MARKETING_PHOTOS}/${key}.webp is missing`);
  }
  // Owner, 4 Nov ("images are too cut") — the prototype's --dr per slide.
  assert.deepEqual(Object.fromEntries(HERO_SLIDES.map((s) => [s.key.replace(/^supplier-|-hero$/g, ''), s.dr])), {
    florist: '4%',
    caterer: '19%',
    photographer: '0%',
    makeup: '22%',
    videographer: '19%',
    team: '19%',
  });
});
