/**
 * 🏬 THE SHOP WEBSITE FOLLOWS THE APPROVED v16 (owner 15 Nov 2026 — DECISION_LOG rows "SHOP WEBSITE: ONE BACK BUTTON,
 * NAMED FOR WHERE THE VISITOR CAME FROM", "SHOP WEBSITE TOP BAR, ONCE SCROLLED", "SHOP WEBSITE AWARDS ROW: THE BADGE +
 * ONE PLAIN FACT" and "SHOP WEBSITE: A 10-BRANCH SHOP …"; prototype shop_website_two_looks_2026-11-15, Supplier Website
 * Looks v16). One test per claim; each was broken on purpose and went red (the sabotage is named in each test).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { WEB } from '@/lib/design-rules-scan';
import { SETNAYAN_HOME_URL, shopColdDoorShows } from '@/lib/shop-back';
import { OWN_LINK_SRC } from '@/lib/supplier-qr-codes';
import { awardFact, awardsRowItems } from '@/lib/shop-award-fact';
import { publicBadgeView, sealsFromEngine, sealsGivenFromEngine, tiersFromCounts, unreadFamilies } from '@/lib/public-badges';
import { milestoneBadge, type ShopBadge } from '@/lib/shop-badges';

const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = src('app/v/[slug]/page.tsx');
const BAR = src('app/v/[slug]/_components/shop-top-bar.tsx');
const LAZY = src('app/v/[slug]/_components/verified-award-button.tsx');
const ROWBTN = src('app/v/[slug]/_components/award-row-button.tsx');
const SAVE = src('app/(shell)/explore/_components/save-vendor-button.tsx');

// Sabotage: return true for every cold arrival (the old `!shopBack.back`) → the `journal` and `qr` cases go red.
test('"See more suppliers" shows only for the supplier’s own QR / link and a typed address', () => {
  assert.equal(OWN_LINK_SRC, 'own');
  assert.equal(shopColdDoorShows({ src: null, eventId: null }), true, 'a typed address');
  assert.equal(shopColdDoorShows({ src: 'own', eventId: null }), true, 'the supplier’s own QR');
  assert.equal(shopColdDoorShows({ src: 'discover', eventId: null }), false);
  assert.equal(shopColdDoorShows({ src: 'journal', eventId: null }), false, 'an arrival tag of ours is not a cold visit');
  assert.equal(shopColdDoorShows({ src: 'qr', eventId: null }), false);
  assert.equal(shopColdDoorShows({ src: null, eventId: 'e1' }), false, 'an event’s Suppliers has its own back');
  assert.match(PAGE, /\{shopColdDoorShows\(shopArrival\) \? \(\s*<Link href=\{shopBack\.href\}/);
});

// Sabotage: rename the heading "Your awards" / drop `awardFact(b)` / let the fact keep " · Gold" → red.
test('the Awards row: heading "Awards", each award its badge + one plain fact, no tier name in the row', () => {
  const at = PAGE.indexOf('data-shop-awards=""');
  assert.ok(at > 0, 'the Awards group is gone');
  const group = PAGE.slice(at, PAGE.indexOf('</ul>', at));
  assert.match(group, />Awards<\/p>/);
  assert.match(group, /\{awardsRow\.map\(\(item\) => \(\s*<li key=\{item\.key\}>\s*<AwardRowButton item=\{item\} shopName=\{displayLabel\} \/>/);
  assert.match(ROWBTN, /<ImageBadge \{\.\.\.item\.image\}[^>]*size=\{48\}[^>]*\/>\s*<\/span>\s*<span className="text-sm leading-snug">\{item\.fact\}<\/span>/);
  assert.doesNotMatch(PAGE, /Earned on Setnayan|tap one/i, 'instruction wording in a shop heading');
  const m100 = milestoneBadge(100);
  assert.equal(awardFact(m100), '100 bookings completed');
  assert.ok(m100.label.includes('·'), 'premise: the milestone label carries its tier name');
  assert.doesNotMatch(awardFact(m100), /·|Bronze|Silver|Gold|Ruby|Emerald|Diamond|Platinum/);
  assert.equal(awardFact({ key: 'verified', kind: 'verified', glyph: null, line1: '', line2: '', label: 'SETNAYAN Verified' } as ShopBadge), 'Setnayan Verified');
});

// Sabotage: observe the article instead of `#shop-top h1` / scroll to 120 / drop the check's button → red.
test('once the name scrolls under the bar: the shop’s logo + name go to the top, and the blue check brings up Verified', () => {
  assert.match(BAR, /document\.querySelector<HTMLElement>\('#shop-top h1'\)/);
  assert.match(BAR, /const toTop = \(\) => window\.scrollTo\(\{ top: 0, behavior: smooth\(\) \}\);/);
  assert.match(BAR, /<button\s+type="button"\s+onClick=\{toTop\}[\s\S]{0,300}\{logo\}\s*<span className="truncate">\{shopName\}<\/span>/);
  assert.match(BAR, /\{verified \? \(\s*<button\s+type="button"\s+onClick=\{showVerified\}[^>]*className="inline-flex h-11 w-11/);
  assert.match(PAGE, /<li id="shop-verified-award"/, 'the Verified award is not in the Awards row');
  assert.match(PAGE, /logo=\{<TopBarLogo logoUrl=\{logoDisplayUrl\}/, 'the top bar does not show the shop’s own logo');
});

// Sabotage: scroll to the row again / import a home-made full screen / load the kit statically / drop the row's art → red.
test('the blue check opens the award kit’s full-screen Verified award (#7752), loaded only on the tap', () => {
  assert.match(BAR, /const showVerified = \(\) => setVerifiedOpen\(true\);/);
  assert.doesNotMatch(BAR, /scrollIntoView/, 'the check scrolls instead of opening the award');
  assert.match(LAZY, /dynamic\(\s*\(\) => import\('@\/app\/_components\/award\/verified-fullscreen'\)\.then\(\(m\) => m\.VerifiedFullscreen\)/);
  for (const [name, code] of [['top bar', BAR], ['row button', LAZY], ['page', PAGE]] as const) {
    assert.doesNotMatch(code, /^import[^;]*_components\/award\//m, `the award kit is in the ${name}’s first load`);
  }
  assert.match(BAR, /import \{ LazyVerifiedFullscreen \} from '\.\/verified-award-button';/);
  assert.match(BAR, /\{verified && verifiedOpen \? \(\s*<LazyVerifiedFullscreen art=\{verifiedArt \?\? null\} shopName=\{shopName\} onClose=\{\(\) => setVerifiedOpen\(false\)\} \/>/);
  assert.match(PAGE, /const verifiedFullArt = \(\s*<ImageBadge \{\.\.\.badgeImageOf\(verifiedBadge\(\)\)\}/, 'the full screen does not show the row’s blue-check seal');
  assert.match(PAGE, /verifiedArt=\{verifiedFullArt\}/);
  // v16 `data-vr`: the drawing's words for both doors, and the row's Verified item opens the same full screen.
  assert.equal((BAR.match(/aria-label="Setnayan Verified — what it means"/g) ?? []).length, 1);
  assert.match(LAZY, /<button type="button" onClick=\{\(\) => setOpen\(true\)\} aria-label="Setnayan Verified — what it means"/);
  assert.match(PAGE, /<li id="shop-verified-award">[\s\S]{0,600}<VerifiedAwardButton art=\{verifiedFullArt\} shopName=\{displayLabel\}[\s\S]{0,400}\{awardFact\(verifiedBadge\(\)\)\}<\/span>\s*<\/VerifiedAwardButton>/);
});

// Sabotage: show `acts` unconditionally / observe nothing → red.
test('Share + the heart join the top bar only after the page’s own buttons have scrolled away', () => {
  assert.match(BAR, /\{acts && acted \? \(/);
  assert.match(BAR, /document\.querySelector<HTMLElement>\('\[data-shop-quick\]'\)/);
  assert.match(PAGE, /data-shop-quick=""/);
  // 44 px floor: `.ab.icon-only` is 40 px wide, so both icon buttons widen to 44 (measured in a browser: 44 × 44).
  assert.equal((PAGE.match(/actionButtonClass\('neutral', \{ iconOnly: true, quiet: true, extra: '!w-11' \}\)/g) ?? []).length, 2);
});

// Sabotage: `<Link href="/">` around the wordmark, or a relative footer link → red.
test('SETNAYAN opens https://www.setnayan.com as an absolute address — top bar and footer', () => {
  assert.equal(SETNAYAN_HOME_URL, 'https://www.setnayan.com');
  assert.match(BAR, /<a href=\{SETNAYAN_HOME_URL\}[^>]*>\s*<Wordmark size=\{22\} \/>/);
  assert.match(PAGE, /<a href=\{SETNAYAN_HOME_URL\}[^>]*>\s*SETNAYAN\s*<\/a>/);
  assert.doesNotMatch(PAGE, /<Link href="\/"[^>]*>\s*<Wordmark/);
});

// Sabotage: put ReportPageButton back inside a <p>, or drop `triggerClassName` → red.
test('the footer’s "Report this shop" is its own outlined 44 px button, inside a <div>', () => {
  assert.match(
    PAGE,
    /<div className="pt-1">\s*<ReportPageButton\s+targetType="vendor"[\s\S]{0,160}label="Report this shop"\s+triggerClassName=\{actionButtonClass\('neutral', \{ extra: 'min-h-11' \}\)\}/,
  );
  const report = src('app/_components/report-page-button.tsx');
  assert.match(report, /className=\{\s*triggerClassName \?\?/);
});

// Sabotage: drop `icon="heart"` from either copy, or stop announcing the save → red.
test('the heart IS Add to event — on the body button and the top bar, and the copies stay in step', () => {
  assert.equal((PAGE.match(/label="Add to your event"\s+icon="heart"/g) ?? []).length, 2);
  assert.match(PAGE, /icon="heart"\s+iconOnly/);
  assert.match(SAVE, /window\.dispatchEvent\(new CustomEvent\(SAVED_EVENT/);
  assert.match(SAVE, /window\.addEventListener\(SAVED_EVENT, onSaved\)/);
});

// Sabotage: add an "after N days" line to the page → red.
test('the public shop page has no "after N days" line (owner: that line is for the shop owner only)', () => {
  assert.doesNotMatch(PAGE, /achieved this|after \$\{[^}]+\} days|after \d+ days/i);
});

// Sabotage: put the section bar back at `top-0` → red (it would slide under the sticky top bar).
test('the section menu sits under the sticky top bar, and lands sections under both', () => {
  const bar = src('app/v/[slug]/_components/shop-section-bar.tsx');
  assert.match(bar, /sticky top-\[var\(--shop-bar-h,0px\)\]/);
  assert.match(bar, /parseFloat\(getComputedStyle\(nav\)\.top\)/);
  assert.match(PAGE, /\['--shop-bar-h' as string\]: '3\.5rem'/);
  assert.match(BAR, /className="sticky top-0 z-30/);
});

// Sabotage: drop `sealsFromEngine` / `tiersFromCounts` / let a fact keep its tier name / say "shops" for clients → red.
test('the Awards row reads the ONE adapter: the seals the shop holds (#7825), then each tiered badge from its counter (#7753)', () => {
  assert.match(PAGE, /const awardsView = publicBadgeView\(\{[\s\S]{0,200}seals: sealsFromEngine\(shopSeals\?\.seals\),\s*tiers: tiersFromCounts\(countsForRow\),/);
  assert.match(PAGE, /const sealsP = startRead\(\s*readShopSeals\(vendor\.vendor_profile_id, vendor\.verification_state === 'verified'\)/);
  assert.match(PAGE, /const tierCountsP = startRead\(\s*readShopTierCounts\(admin, vendor\.vendor_profile_id\)/);
  assert.match(PAGE, /const awardsRow = awardsRowItems\(awardsView, sealsGivenFromEngine\(shopSeals\?\.rows\)\);/);
  assert.doesNotMatch(PAGE, /performancePills|fetchVendorCurrentAwards|AWARD_LABELS|name: 'Completed bookings'/, 'the row reads a retired award or types a family name');
  const view = publicBadgeView({
    verified: true,
    seals: sealsFromEngine(['no1', 'top10', 'clients_choice', 'most_in_demand', 'verified']),
    tiers: tiersFromCounts({ bookings: 63, five_star: 260, gifts: 800, trusted_by: 0 }),
  });
  // v16 order: the seals, then the tiered badges — each at the STEP reached, never the running count.
  const row = awardsRowItems(view, sealsGivenFromEngine([
    { seal: 'top10', award_year: 2025, awarded_at: '2025-12-18T02:00:00Z' },
    { seal: 'top10', award_year: 2026, awarded_at: '2026-12-18T02:00:00Z' },
  ]));
  assert.deepEqual(row.map((r) => r.fact), [
    'No. 1 Supplier of the Year',
    'Top 10 supplier of 2026',
    "Clients' Choice",
    'Most In-Demand',
    '50 bookings completed',
    '250 five-star reviews',
    '750 gift points given',
  ]);
  for (const r of row) assert.doesNotMatch(r.fact, /Bronze|Silver|Gold|Ruby|Emerald|Diamond|Nov|Dec/, 'a tier name or a date in the row');
  const top10 = row.find((r) => r.key === 'seal:top10')!;
  assert.deepEqual(top10.open, { kind: 'seal', seal: 'medal', title: 'Top 10 Supplier', year: 2026, awardedOn: '18 Dec 2026' });
  const gifts = row.find((r) => r.key.startsWith('gifts:'))!;
  assert.deepEqual(gifts.open, { kind: 'tier', tierIndex: 2, tierName: 'Silver', title: 'Gifts given', family: 'giftbox' });
  assert.equal(awardsRowItems(publicBadgeView({ verified: true, tiers: tiersFromCounts({ trusted_by: 5 }) }))[0]!.fact, 'Trusted by 5 clients');
  assert.ok(!row.some((r) => r.key === 'seal:verified'), 'Verified is drawn twice (it keeps its own item)');
  assert.equal(sealsFromEngine(null), null, 'a failed seal read became "no seals"');
  const partner = publicBadgeView({ verified: true, seals: sealsFromEngine(['verified_partner', 'verified']) });
  assert.deepEqual(partner.seals.map((x) => x.key), ['partner'], 'Verified Partner did not replace Setnayan Verified (3077c9b3 rule 8)');
});

// Sabotage: drop the unread line / treat a null counter as 0 → red.
test('a failed awards read says so — never "no awards", and a Partner never silently reads as plain Verified', () => {
  assert.deepEqual(unreadFamilies({ bookings: 3, gifts: null }), ['gifts']);
  assert.deepEqual(tiersFromCounts({ bookings: null, gifts: null }), []);
  assert.match(PAGE, /const awardsUnread = shopSeals === null \|\| unreadFamilies\(countsForRow\)\.length > 0;/);
  assert.match(PAGE, /\{awardsUnread \? \(\s*<li[^>]*role="status"[^>]*data-shop-awards-unread="">\s*Couldn’t load every award/);
});

// Sabotage: drop the slot or the footer tag, or show them on a verified shop → red.
test('the unverified look: the Verified slot reads "Not yet — papers not checked", and the footer carries the tag', () => {
  assert.match(PAGE, /\{vendor\.verification_state !== 'verified' \? \([\s\S]{0,400}<li[^>]*data-shop-not-verified-slot="">[\s\S]{0,300}on=\{false\}[\s\S]{0,200}\{awardFact\(verifiedBadge\(\)\)\}<\/b>\s*<small[^>]*>Not yet — papers not checked<\/small>/);
  // v16 S6: the footer's tag is the ONE shared marking (`NotYetVerifiedTag`, "Not yet verified", opening the sheet).
  assert.match(PAGE, /Supplier ID · [\s\S]{0,300}\{vendor\.verification_state !== 'verified' \? \(\s*<p[^>]*data-shop-footer-not-verified="">\s*<NotYetVerifiedTag \/>\s*<\/p>/);
});

// Sabotage: load a kit full screen statically / let the public seal screen use the kit's owner-facing copy → red.
test('each award opens its own full screen from the award kit, lazily, in the public page’s words', () => {
  assert.match(ROWBTN, /dynamic\(\(\) => import\('@\/app\/_components\/award\/badge-fullscreen'\)\.then\(\(m\) => m\.BadgeFullscreen\)/);
  assert.match(ROWBTN, /dynamic\(\(\) => import\('@\/app\/_components\/award\/seal-plaque'\)\.then\(\(m\) => m\.SealPlaque\)/);
  assert.doesNotMatch(ROWBTN, /^import[^;]*_components\/award\//m, 'the award kit is in the page’s first load');
  assert.doesNotMatch(ROWBTN, /sealPlaqueCopy|AWARD_COPY|achievedAfterDays/, 'owner-facing words on the public page');
  assert.match(ROWBTN, /<button type="button" onClick=\{\(\) => setOpen\(true\)\}/);
});

test('the adapter lists the seals in the engine’s own order (SEAL_ORDER), each once', async () => {
  const { SEAL_ORDER } = await import('@/lib/shop-seals');
  const { SEALS } = await import('@/lib/public-badges');
  assert.deepEqual(SEALS.map((x) => x.key), sealsFromEngine(SEAL_ORDER));
});
