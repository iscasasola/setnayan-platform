/**
 * for-coordinators-says-what-ships.test.ts — /for-coordinators names only tools the app has, promises
 * nothing the code does not do, types no number the app owns, and wears the one shared shell.
 *
 * The page is built from the owner-approved drawing of 20 Nov 2026 (`prototypes/for_coordinators_2026-11-20/`,
 * specs), which replaced the 6 Nov one. MOVED, NOT LOOSENED: the 6 Nov pins on that page's own sentences (the access
 * card's dropdowns, the fold, the desk pills, "The couple can too. The emcee can't.") went with the sentences; every
 * rule they held is held here against the new words — each tool pinned to the symbol that does it, each claim the
 * code contradicts pinned shut, each number pinned to its source, each switched line gated.
 *
 * SABOTAGE (run 2026-11-20 before the commit): type "₱2,490" into the page → RED; drop `needs: 'announcements'`
 * from the announcement row → RED; set COORDINATOR_AREAS.budget to 'edit' → RED; replace the hero's
 * `on.dayOfFree ?` with the free line alone → RED; write "Whisper" on the page → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { COORDINATOR_AREAS, areaChoices } from '@/lib/delegate-areas';
import { TIERS } from '@/lib/badge-tiers';

import { ALL_SWITCHES_OFF, CLAIM_SWITCHES, countWord, shownWith, type ClaimSwitches } from './_claims';

const HERE = import.meta.dirname; // app/(shell)/for-coordinators
const APP = join(HERE, '..', '..');
const WEB = join(APP, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const own = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const PAGE = own('page.tsx');
const FACTS = own('_facts.ts');
const INFO = own('_fc-info.tsx');
/** Everything a visitor can read on this page. */
const WORDS = [PAGE, INFO]
  .join('\n')
  .replace(/^import .*$/gm, '') // module paths are not words a visitor reads
  .replace(/type: 'website'/, '') // the Open Graph type, not copy
  .replace(/\/#website\b/g, ''); // the schema.org node id, not copy

/** Every tool the page names → the file and the symbol that does it. */
const TOOLS: readonly { tool: string; file: string; symbol: RegExp }[] = [
  { tool: 'The hosts open each part (edit, view or off)', file: 'lib/delegate-areas.ts', symbol: /export const COORDINATOR_AREAS\b/ },
  { tool: 'You are in the supplier chats', file: 'lib/chat.ts', symbol: /'coordinator'/ },
  { tool: 'Cue the show, part by part', file: 'app/_actions/run-of-show.ts', symbol: /export async function advanceScheduleBlock\b/ },
  { tool: 'The hosts can move it too', file: 'lib/run-of-show-advance-gate.ts', symbol: /memberType === 'couple'\) return \{ allowed: true/ },
  { tool: 'One requests inbox', file: 'app/vendor-dashboard/on-the-day/_components/requests-inbox.tsx', symbol: /export function RequestsInbox\b/ },
  { tool: 'Scan a pass', file: 'app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx', symbol: /export function CheckinDesk\b/ },
  { tool: 'The scanner finds their table', file: 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/seat-scanner.tsx', symbol: /export function SeatScanner\b/ },
  { tool: 'One announcement, every phone', file: 'lib/coordinator-broadcasts-server.ts', symbol: /export async function fetchLatestBroadcasts\b/ },
  { tool: 'Saved for when there is no signal', file: 'app/_components/offline-ready/schedule-saved-mark.tsx', symbol: /Saved for offline/ },
  { tool: 'A free Helper for the event day', file: 'lib/vendor-free-helper.ts', symbol: /export const FREE_HELPER_SEATS = \d+;/ },
  { tool: 'Booked · one-use', file: 'lib/supplier-qr-codes.ts', symbol: /locked: 'Booked · one-use'/ },
  { tool: 'Check a date', file: 'lib/check-a-date.ts', symbol: /export function checkADateUrl\b/ },
  { tool: 'Invite a supplier (/i/<shop>)', file: 'lib/supplier-invite.ts', symbol: /export const INVITE_SHEET_TITLE = 'Invite a supplier'/ },
  { tool: 'Invite a supplier — its QR, in Shop › Partnerships', file: 'app/vendor-dashboard/partnerships/page.tsx', symbol: /renderUrlQrSvg/ },
  { tool: 'The Invites badge tiers', file: 'lib/badge-tiers.ts', symbol: /export const TIERS\b/ },
  { tool: 'Trusted by, on the shop page', file: 'app/v/[slug]/page.tsx', symbol: /Trusted by/ },
  { tool: 'The coordinator door', file: 'app/open-shop/page.tsx', symbol: /arrivedAs === 'coordinator'/ },
];

test('every tool the page names is in the app', () => {
  const missing = TOOLS.filter(({ file, symbol }) => {
    const p = join(WEB, file);
    return !existsSync(p) || !symbol.test(readFileSync(p, 'utf8'));
  }).map(({ tool, file }) => `${tool} — ${file}`);
  assert.deepEqual(missing, [], 'the page names a tool whose code is gone or renamed:\n  ' + missing.join('\n  '));
});

test('the coordinator AND the hosts move the show forward', () => {
  assert.match(PAGE, /The hosts can move it too\./, 'the page lost the line that the hosts can move the show too');
});

/** Claims the code contradicts, or house words the owner retired — each with the fact that makes it false. */
const FALSE_CLAIMS: readonly { claim: RegExp; why: string }[] = [
  {
    claim: /(voice|video)[^.]{0,40}call|call[^.]{0,20}(voice|video)/i,
    why: 'in-app calls left the chat (owner 2026-10-28, "remove both voice and video call")',
  },
  { claim: /coming soon|\bComing\b/i, why: 'owner: never write "Coming" — the page waits for the feature instead' },
  { claim: /whisper/i, why: 'the coordinator whisper is ruled, not built (lib/chat-whisper.ts is the hosts’ own); the drawing: "must not go live before whisper does"' },
  { claim: /Trusted partner/i, why: 'the rename is ruled, not built — the app says "preferred supplier" and "Trusted by"' },
  { claim: /first paid booking/i, why: 'an invite counts after the supplier’s first COMPLETED booking (INVITE_INFO)' },
  { claim: /Refer a supplier/i, why: 'the app calls it "Invite a supplier" (INVITE_SHEET_TITLE)' },
  { claim: /Patiktok|Music Maker/i, why: 'never on this page (brief, 20 Nov)' },
  { claim: /Event Hub Pro/i, why: 'the name is gone (owner 8 Nov)' },
  { claim: /website/i, why: 'it is an Event Hub, not a website (owner 2026-09-24)' },
  { claim: /\bvendors?\b/i, why: 'say "supplier" (owner 2026-09-27)' },
  { claim: /\/sample\/coordinator/, why: 'app/sample/[...rest] 404s it — there is no coordinator demo' },
  { claim: /₱\s?\d/, why: 'no price is typed — prices come from vendor_billing_catalog, the fee from the live schedule' },
  { claim: /pesoWords\(\d/, why: 'no peso is typed through the formatter either' },
  {
    claim: /free (until|through|till)|until (Jan|Dec|December)|(?<!\/)20\d\d-\d\d-\d\d/i,
    why: 'the day-of tools stay free with NO end date (DECISION_LOG 2026-11-04/05); no dated wording on a doorway',
  },
  { claim: /celebration/i, why: 'say "event" (owner 2026-10-04)' },
];

test('the page makes none of the claims the code contradicts', () => {
  const hits = FALSE_CLAIMS.filter(({ claim }) => claim.test(WORDS)).map(({ claim, why }) => `${claim} — ${why}`);
  assert.deepEqual(hits, [], 'the page says something the app does not do:\n  ' + hits.join('\n  '));
});

// ── NUMBERS ARE READ, NEVER TYPED ─────────────────────────────────────────────────────────────────────

test('prices are read from the catalogue that charges them, with no peso fallback', () => {
  const prices = own('_prices.server.ts');
  assert.match(prices, /fetchV2VendorCatalog\(\)/);
  assert.doesNotMatch(prices, /\b\d{3,}\b/, 'a number is typed into the price reader');
  assert.match(PAGE, /readCoordinatorPrices\(\)/, 'the page does not read the prices');
  assert.match(PAGE, /prices\.plans\[t\]\.month \?/, 'a paid plan whose price cannot be read must drop its figure, not invent one');
  assert.match(PAGE, /pesoWords\(TIER_PRICE_PHP\.free\.monthly\)/);
  assert.match(PAGE, /pesoWords\(TIER_PRICE_PHP\.verified\.monthly\)/);
});

test('the fee is named only from the live schedule; unreadable → no rate is named', () => {
  assert.match(PAGE, /getLiveBookingFeeSchedule\(\)\.catch\(\(\) => null\)/);
  assert.match(PAGE, /\{fee \? \(/, 'the fee paragraph is not dropped when the schedule cannot be read');
  for (const f of ['pctWords(fee.rate)', 'pesoWords(fee.tier1LimitPhp)', 'pctWords(fee.tailRate)', 'pesoWords(fee.minPhp)']) {
    assert.ok(PAGE.includes(f), `the fee does not read ${f}`);
  }
  assert.doesNotMatch(WORDS, /\b\d+(\.\d+)?%/, 'a percent is typed');
  // The free-booking rule is LIVE (16 Nov) and has ONE wording — the page quotes it, never its own sentence.
  for (const w of ['FEE_FREE_RULE', 'FEE_FREE_CHIP', 'FEE_SCOPE']) assert.ok(PAGE.includes(`{${w}}`), `the page does not quote ${w}`);
  assert.match(PAGE, /from '@\/lib\/booking-fee-who-words'/);
});

test('reach and plans come from lib/vendor-tier-caps.ts', () => {
  assert.match(FACTS, /from '@\/lib\/vendor-tier-caps'/);
  assert.match(PAGE, /reachLadderSentence\(\)/);
  assert.doesNotMatch(WORDS, /\b\d+\s?km\b/i, 'a reach is typed');
  assert.doesNotMatch(WORDS, /reach isn.t tied|any plan reaches/i, 'reach-free-of-plan is #8014, not live');
  assert.doesNotMatch(WORDS, /'(Solo|Supplier Plus|Pro|Ultra) plan|from (Solo|Supplier Plus|Pro|Ultra)\b|on (Solo|Supplier Plus|Pro|Ultra)\b|Only Ultra\b/, 'a plan name is typed');
  assert.match(PAGE, /planName\(t\)/);
});

test('the Invites badge is drawn from lib/badge-tiers.ts, one picture per tier, and every picture is there', () => {
  assert.match(PAGE, /TIERS\.map\(\(t, i\) =>/);
  for (let i = 0; i < TIERS.length; i++) {
    assert.ok(existsSync(join(WEB, 'public', 'marketing', '2026-11-20', 'coordinators', `invites-${i}.webp`)), `invites-${i}.webp is missing`);
  }
  assert.doesNotMatch(WORDS, /'(Bronze|Black Diamond)'/, 'a tier name is typed');
  assert.match(PAGE, /<p>\{INVITE_INFO\}<\/p>/, 'when an invite counts is the app’s own sentence');
});

// ── WHAT STAYS WITH THE HOSTS FOLLOWS THE APP ─────────────────────────────────────────────────────────

test('"Budget and Photos are view at most" is read from the coordinator’s access rules', () => {
  assert.match(PAGE, /const viewAtMost = \(\['budget', 'photos'\] as const\)\.every\(/);
  assert.match(PAGE, /\{viewAtMost \? 'Budget and Photos are view at most\. ' : null\}/);
  for (const a of ['budget', 'photos'] as const) {
    assert.ok(!areaChoices(a)?.includes('edit'), `${a} can now be opened to Edit — the sentence lies`);
    assert.notEqual(COORDINATOR_AREAS[a], 'edit', `${a} now defaults to Edit — the sentence lies`);
  }
  const delegate = read('lib/delegate-areas.ts');
  assert.match(delegate, /Seat-plan\s+(?:\/\/\s*)?publish \+ first invitation deploy remain couple-confirmed/, 'the seat plan / first invitation rule moved');
});

// ── LINKS · PHOTOS · SHELL ────────────────────────────────────────────────────────────────────────────

test('every call to action is the coordinator door of the supplier sign-up', () => {
  assert.ok(existsSync(join(APP, 'open-shop', 'page.tsx')), '/open-shop is gone');
  assert.match(PAGE, /const START = '\/open-shop\?as=coordinator';/);
  assert.equal((PAGE.match(/href=\{START\}/g) ?? []).length, 2, 'the hero and the close each open the coordinator door');
});

test('every anchor on the page lands on an id on it; every page link exists', () => {
  const anchors = [...PAGE.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1] ?? '');
  assert.ok(anchors.length >= 3, 'anti-vacuity: no anchor read');
  const dead = anchors.filter((a) => !PAGE.includes(`id="${a}"`));
  assert.deepEqual(dead, [], 'an anchor goes nowhere: ' + dead.join(', '));
  const links = [...PAGE.matchAll(/href="\/([a-z-]+)"/g)].map((m) => m[1] ?? '');
  assert.ok(links.length >= 6, 'anti-vacuity: the footer was not read');
  const gone = links.filter((l) => !existsSync(join(APP, '(shell)', l, 'page.tsx')) && !existsSync(join(APP, l, 'page.tsx')));
  assert.deepEqual(gone, [], 'a link goes to no page: ' + gone.join(', '));
  assert.doesNotMatch(PAGE, /href="https?:/, 'an absolute link — the page links inside the app');
});

test('every picture the page shows is in public/', () => {
  const files = [...PAGE.matchAll(/\$\{SHOT\}\/([a-z0-9-]+\.(?:webp|png))/g)].map((m) => m[1] ?? '');
  // 9 pictures since 20 Nov: the sample card's three medals are drawn by the live CardBadgeRow, not by the page.
  assert.ok(files.length >= 8, `anti-vacuity: only ${files.length} pictures were read`);
  const missing = files.filter((f) => !existsSync(join(WEB, 'public', 'marketing', '2026-11-20', 'coordinators', f)));
  assert.deepEqual(missing, [], 'a picture the page shows is not in public/: ' + missing.join(', '));
  assert.match(PAGE, /const SHOT = '\/marketing\/2026-11-20\/coordinators';/);
});

test('it wears the one shared shell, full-bleed, and is findable', () => {
  assert.ok(!existsSync(join(APP, 'for-coordinators', 'page.tsx')), 'a second page outside the shell serves the URL');
  assert.doesNotMatch(PAGE, /^export const (dynamic|revalidate)\b/m, 'app/(shell)/layout.tsx owns the route directive');
  assert.doesNotMatch(
    PAGE,
    /<(?:AppRailShell|SiteChrome|SiteFooterChrome|ReskinFooter)\b/,
    'the page mounts a chrome of its own — the shell already draws the bar and rail',
  );
  assert.doesNotMatch(PAGE, /^'use client'/m, 'the page ships no script of its own');
  const bleed = /DOORWAY_BLEED_PATHS = \[([^\]]*)\]/.exec(read('app/_components/frontdoor/shell-bleed.ts'));
  assert.ok(bleed, 'DOORWAY_BLEED_PATHS not found — this check would pass vacuously');
  assert.ok((bleed[1] ?? '').includes("'/for-coordinators'"), 'the photo hero would be inset by the shell’s gutters');
  assert.match(read('app/sitemap-static.xml/route.ts'), /path: '\/for-coordinators'/, 'not in the sitemap');
  assert.match(read('app/robots.ts'), /'\/for-coordinators'/, 'robots.txt does not allow it');
});

test('the page shows prices, so the iPhone app does not open it', () => {
  assert.match(read('lib/store-shell.ts'), /'\/for-coordinators'/, 'not in STORE_SHELL_WEB_ONLY_DOORWAYS');
});

// ── THE SWITCHED LINES (owner 2026-11-05: "show each line only when its switch is on") ─────────────────

test('the announcement row shows only while its switch is on, and the day rows pass through the switches', () => {
  const at = PAGE.indexOf("line: 'One announcement, every phone.'");
  assert.ok(at > 0, 'the announcement row is gone — this check would pass vacuously');
  assert.match(PAGE.slice(at, at + 80), /needs: 'announcements'/, 'the announcement row shows while its switch is off');
  assert.equal((PAGE.match(/One announcement, every phone/g) ?? []).length, 1);
  assert.match(PAGE, /const dayRows: Fact\[\] = shownWith\(/, 'the day rows are rendered without their switches');
});

test('the switches are read with the gates the features themselves use, and fail closed', () => {
  const reader = own('_claims.server.ts');
  for (const gate of [
    "isDataPrivacyControlActive('coordinator_run_of_show')",
    'isCoordinatorP3Enabled()',
    'isCoordinatorPrepReleaseEnabled()',
    'isCoordinatorVendorNotesEnabled()',
  ]) {
    assert.ok(reader.includes(gate), `_claims.server.ts does not read ${gate}`);
  }
  assert.equal((reader.match(/\.catch\(\(\) => false\)/g) ?? []).length, 3, 'a DB-read switch is not failing closed');
  assert.match(PAGE, /const \[on, prices, fee\] = await Promise\.all\(\[\s*readClaimSwitches\(\),/, 'the page does not read the live switches');
});

test('a switched item shows only when its switch is on; an unswitched one always shows', () => {
  const items = [{ id: 'always' }, { id: 'ros', needs: 'runOfShow' as const }, { id: 'notes', needs: 'privateNotes' as const }];
  const allOn = Object.fromEntries(CLAIM_SWITCHES.map((k) => [k, true])) as unknown as ClaimSwitches;
  assert.deepEqual(shownWith(items, ALL_SWITCHES_OFF).map((i) => i.id), ['always']);
  assert.deepEqual(shownWith(items, allOn).map((i) => i.id), ['always', 'ros', 'notes']);
  assert.deepEqual(shownWith(items, { ...ALL_SWITCHES_OFF, runOfShow: true }).map((i) => i.id), ['always', 'ros']);
  assert.equal(countWord(1), 'One');
  assert.equal(countWord(21), '21');
});

// ── THE DAY-OF TOOLS ARE "FREE" ONLY WHILE THE GATE SAYS SO ───────────────────────────────────────────

test('the hero and the day’s ⓘ say the day-of tools are free only while they are', () => {
  assert.match(PAGE, /\{on\.dayOfFree \? 'Coordinator tools are free on every plan\. No end date\.' : 'Free to start\. No card needed\.'\}/);
  assert.match(PAGE, /\{on\.dayOfFree \? 'The day-of tools are free on every plan, with no end date\. ' : null\}/);
  assert.equal((PAGE.match(/free on every plan/g) ?? []).length, 2, 'a "free on every plan" line is not behind the gate');
});

test('dayOfFree asks the same two questions the floor-command paywall asks', () => {
  const reader = own('_claims.server.ts');
  assert.match(
    reader,
    /dayOfFree:\s*FREE_SPECIALIZATION_SETS\.has\('floor_command'\) \|\|\s*specializationFreeWindowActive\(vendorDayOfFreeUntilIso\(\), Date\.now\(\)\)/,
  );
  const gate = read('lib/vendor-specialization-gate.ts');
  assert.match(gate, /export const FREE_SPECIALIZATION_SETS\b/);
  assert.match(gate, /export function specializationFreeWindowActive\b/);
});

test('the budget row shows only while the coordinator’s default budget grant is off', () => {
  assert.match(PAGE, /const budgetStaysWithHosts = COORDINATOR_AREAS\.budget == null;/);
  assert.match(PAGE, /budgetStaysWithHosts\s*\?\s*\[\{ term: 'The budget', line: 'It stays with the hosts until they share it\.' \}\]/);
});

test('the Invites line names the per-tier rule — no "every one who books", no count, no peso', () => {
  assert.doesNotMatch(PAGE, /Every one who books earns you a reward/);
  assert.match(PAGE, /Each Invites tier you reach pays a reward\. Free\./);
});

test('the sample service card is the LIVE card (ServiceFace + CardBadgeRow), never a hand copy', () => {
  assert.match(PAGE, /<ServiceFace\b/);
  assert.match(PAGE, /<CardBadgeRow\b/);
  assert.doesNotMatch(PAGE, /fc-sf-(g|cv|t|p|s|in|no|b)\b/, 'a hand-drawn service card is back');
});
