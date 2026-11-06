/**
 * for-coordinators-says-what-ships.test.ts — /for-coordinators names only tools the app has, promises
 * nothing the code does not do, types no number the app owns, and wears the one shared shell.
 *
 * The page is a port of the owner-approved prototype of 6 Nov 2026 (`prototypes/for_coordinators_2026-11-06/`,
 * corpus), which replaced the 4 Nov one. Each tool it names is pinned to the symbol that does it; each claim
 * the code contradicts is pinned shut with the fact that makes it false; each number (price, reach, seats,
 * the fee, the access levels) is pinned to its source — so a session that changes one of those knows exactly
 * what moved, and why.
 *
 * SABOTAGE (run 2026-11-06 before the PR): type "₱2,490" into the page → RED; drop `needs: 'announcements'`
 * from the announcement cap → RED; set COORDINATOR_AREAS.mood_board to 'edit' → RED (the ⓘ sentence lies);
 * replace the inbox's `tag: deskTag` with a hard "Free" pill → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { COORDINATOR_AREAS, areaChoices } from '@/lib/delegate-areas';

import { ALL_SWITCHES_OFF, CLAIM_SWITCHES, countWord, shownWith, type ClaimSwitches } from './_claims';

const HERE = import.meta.dirname; // app/(shell)/for-coordinators
const APP = join(HERE, '..', '..');
const WEB = join(APP, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const own = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const PAGE = own('page.tsx');
const FACTS = own('_facts.ts');
const CLIENT = own('_fc-client.tsx');
/** Everything a visitor can read: the page, the fold's words, the client pieces' words. */
const WORDS = [PAGE, FACTS, CLIENT].join('\n');

/** Every tool the page names → the file and the symbol that does it. */
const TOOLS: readonly { tool: string; file: string; symbol: RegExp }[] = [
  { tool: 'The couple invites you (Full Event Access)', file: 'lib/coordinator-grant.ts', symbol: /export async function autoInviteCoordinator\b/ },
  { tool: 'The parts, their levels, a coordinator’s defaults', file: 'lib/delegate-areas.ts', symbol: /export const COORDINATOR_AREAS\b/ },
  { tool: '“Ask the host for access”', file: 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/ask-access.tsx', symbol: /Ask the host for access/ },
  { tool: '“Your coordinator is asking for access”', file: 'app/dashboard/[eventId]/_components/access-requests-doorway.tsx', symbol: /Your coordinator is asking/ },
  { tool: 'Access ends N days after the event', file: 'lib/delegate-access-window.ts', symbol: /export const DELEGATE_GRACE_DAYS = \d+;/ },
  { tool: 'Each supplier sees only their rows', file: 'lib/schedule-ros.ts', symbol: /export function filterBlocksForAudience\b/ },
  { tool: 'Check-in desk (scan a guest’s pass)', file: 'app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx', symbol: /export function CheckinDesk\b/ },
  { tool: 'Cue the show, part by part', file: 'app/_actions/run-of-show.ts', symbol: /export async function advanceScheduleBlock\b/ },
  { tool: 'One requests inbox', file: 'app/vendor-dashboard/on-the-day/_components/requests-inbox.tsx', symbol: /export function RequestsInbox\b/ },
  { tool: 'The seat scanner', file: 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/seat-scanner.tsx', symbol: /export function SeatScanner\b/ },
  { tool: 'The day-of desks are free (the set held free)', file: 'lib/vendor-specialization-gate.ts', symbol: /export const FREE_SPECIALIZATION_SETS\b/ },
  { tool: '“Saved for offline · updated …”', file: 'app/_components/offline-ready/schedule-saved-mark.tsx', symbol: /Saved for offline/ },
  { tool: 'Check a date (the code and the page)', file: 'lib/check-a-date.ts', symbol: /export function checkADateUrl\b/ },
  { tool: 'Shortlist code', file: 'lib/vendor-couple-invite.ts', symbol: /export function buildVendorInviteUrl\b/ },
  { tool: 'Review code → the reviews on the page', file: 'app/v/[slug]/page.tsx', symbol: /id="reviews"/ },
  { tool: '“— a returning client”', file: 'lib/chat-actions.ts', symbol: /a returning client/ },
  { tool: 'One helper seat free', file: 'lib/vendor-free-helper.ts', symbol: /export const FREE_HELPER_SEATS = \d+;/ },
  { tool: 'Announcements on every guest’s phone', file: 'lib/coordinator-broadcasts-server.ts', symbol: /export async function fetchLatestBroadcasts\b/ },
  { tool: 'Prepare in private, then release', file: 'app/dashboard/[eventId]/schedule/actions.ts', symbol: /export async function setBlockPrepVisibility\b/ },
  { tool: 'Private notes and notes the couple can read', file: 'lib/vendor-working-notes.ts', symbol: /'coordinator_private', 'shared'/ },
];

test('every tool the page names is in the app', () => {
  const missing = TOOLS.filter(({ file, symbol }) => {
    const p = join(WEB, file);
    return !existsSync(p) || !symbol.test(readFileSync(p, 'utf8'));
  }).map(({ tool, file }) => `${tool} — ${file}`);
  assert.deepEqual(missing, [], 'the page names a tool whose code is gone or renamed:\n  ' + missing.join('\n  '));
});

test('the coordinator AND the couple move the show forward — never the emcee', () => {
  const gate = read('lib/run-of-show-advance-gate.ts');
  assert.match(gate, /memberType === 'couple'\) return \{ allowed: true/, 'the couple no longer advances the show');
  assert.match(PAGE, /The couple can too\. The emcee can’t\./, 'the page lost the line that the couple can move the show too');
});

/** Claims the code contradicts, or house words the owner retired — each with the fact that makes it false. */
const FALSE_CLAIMS: readonly { claim: RegExp; why: string }[] = [
  {
    claim: /(voice|video)[^.]{0,40}call|call[^.]{0,20}(voice|video)/i,
    why: 'in-app calls left the chat (owner 2026-10-28, "remove both voice and video call"); no screen calls startThreadCall',
  },
  { claim: /Recommend an add-on/i, why: 'studio/recommend-actions.ts: "NO SCREEN POSTS THESE SINCE 2026-10-02"' },
  { claim: /coming soon/i, why: 'owner 6 Nov: "remove all coming soon" — the page waits for the feature instead' },
  { claim: /\/sample\/coordinator/, why: 'app/sample/[...rest] 404s it — there is no coordinator demo' },
  { claim: /₱\s?\d/, why: 'no price is typed — prices come from vendor_billing_catalog, the fee from the live schedule' },
  {
    claim: /free (until|through|till)|until (Jan|Dec|December)|(?<!\/)20\d\d-\d\d-\d\d/i,
    why: 'the day-of desks stay free with NO end date (DECISION_LOG 2026-11-04/05); no dated wording on a doorway',
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
  assert.match(prices, /BRANCH_SKU_CODE/);
  assert.match(prices, /SEAT_SKU_CODE/);
  assert.doesNotMatch(prices, /\b\d{3,}\b/, 'a number is typed into the price reader');
  assert.match(PAGE, /readCoordinatorPrices\(\)/, 'the page does not read the prices');
});

test('the fee is named only from the live schedule; unreadable → no rate is named', () => {
  assert.match(PAGE, /getLiveBookingFeeSchedule\(\)\.catch\(\(\) => null\)/);
  assert.match(PAGE, /const feeRates = fee\s*\?/);
  assert.doesNotMatch(WORDS, /fee[^.]{0,60}\b\d+(\.\d+)?%/i, 'a fee percent is typed');
});

test('reach, seats, cards and photos come from lib/vendor-tier-caps.ts', () => {
  assert.match(FACTS, /from '@\/lib\/vendor-tier-caps'/);
  assert.doesNotMatch(WORDS, /\b\d+\s?km\b/, 'a reach is typed');
  assert.doesNotMatch(WORDS, /'(Solo|Pro|Ultra) plan|from (Solo|Pro|Ultra)\b|on (Solo|Pro|Ultra)\b|Only Ultra\b/, 'a plan name is typed');
});

// ── FULL EVENT ACCESS FOLLOWS THE APP ─────────────────────────────────────────────────────────────────

test('the access card is drawn from lib/delegate-areas.ts — parts, levels and defaults', () => {
  for (const sym of ['DELEGATE_AREAS', 'DELEGATE_AREA_LABEL', 'areaChoices(area)', 'choiceOfLevel(COORDINATOR_AREAS[area]']) {
    assert.ok(PAGE.includes(sym), `the access card does not read ${sym}`);
  }
  for (const label of ['Guest list', 'Seat plan', 'Budget & payments', 'Mood board', 'Mood Board']) {
    assert.ok(!PAGE.includes(`'${label}'`), `"${label}" is typed instead of read from DELEGATE_AREA_LABEL`);
  }
});

test('“How access works” says what COORDINATOR_AREAS and areaChoices actually do', () => {
  assert.match(PAGE, /A coordinator starts with Edit on the guest list, seat plan, the day and suppliers; the mood board at View;\s+budget and photos Off\. Budget and photos can be opened to View at most, never Edit\./);
  for (const a of ['guest_list', 'seat_plan', 'schedule', 'vendors'] as const) assert.equal(COORDINATOR_AREAS[a], 'edit', a);
  assert.equal(COORDINATOR_AREAS.mood_board, 'view');
  assert.equal(COORDINATOR_AREAS.budget ?? null, null);
  assert.equal(COORDINATOR_AREAS.photos ?? null, null);
  for (const a of ['budget', 'photos'] as const) assert.ok(!areaChoices(a)?.includes('edit'), `${a} can now be opened to Edit`);
});

// ── LINKS · PHOTOS · SHELL ────────────────────────────────────────────────────────────────────────────

test('every call to action is the supplier door — a coordinator opens a supplier shop', () => {
  assert.ok(existsSync(join(APP, 'open-shop', 'page.tsx')) || existsSync(join(APP, '(shell)', 'open-shop', 'page.tsx')), '/open-shop is gone');
  assert.equal((PAGE.match(/href="\/open-shop"/g) ?? []).length, 4, 'the hero, the plans, the close and the dock each open /open-shop');
});

test('every anchor on the page lands on an id on it; the sample shop link is the shop page', () => {
  const anchors = [...PAGE.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1] ?? '');
  assert.ok(anchors.length >= 1, 'anti-vacuity: no anchor read');
  const dead = anchors.filter((a) => !PAGE.includes(`id="${a}"`));
  assert.deepEqual(dead, [], 'an anchor goes nowhere: ' + dead.join(', '));
  assert.match(PAGE, /href=\{`\/v\/\$\{SAMPLE_SHOP\.slug\}`\}/);
  assert.ok(existsSync(join(APP, 'v', '[slug]', 'page.tsx')), '/v/[slug] is gone');
  assert.doesNotMatch(PAGE, /href="https?:/, 'an absolute link — the page links inside the app');
});

test('every photo and mark the page shows is in public/', () => {
  const bases: Record<string, string> = { SHOT: '2026-11-04', SHOT6: '2026-11-06/coordinators' };
  const files = [...PAGE.matchAll(/\$\{(SHOT6?)\}\/([a-z0-9-]+\.(?:webp|svg))/g)].map((m) => join(bases[m[1] ?? ''] ?? '', m[2] ?? ''));
  assert.ok(files.length >= 20, `anti-vacuity: only ${files.length} photos were read`);
  const missing = files.filter((f) => !existsSync(join(WEB, 'public', 'marketing', f)));
  assert.deepEqual(missing, [], 'a photo the page shows is not in public/: ' + missing.join(', '));
});

test('it wears the one shared shell, full-bleed, and is findable', () => {
  assert.ok(!existsSync(join(APP, 'for-coordinators', 'page.tsx')), 'a second page outside the shell serves the URL');
  assert.doesNotMatch(PAGE, /^export const (dynamic|revalidate)\b/m, 'app/(shell)/layout.tsx owns the route directive');
  assert.doesNotMatch(
    PAGE,
    /<(?:AppRailShell|SiteChrome|SiteFooterChrome|ReskinFooter)\b/,
    'the page mounts a chrome of its own — the shell already draws the bar and rail',
  );
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

/** Each switch-dependent sentence → the switch it needs → the file that holds it. */
const SWITCHED_LINES: readonly { line: string; needs: string; src: 'PAGE' | 'FACTS' }[] = [
  { line: "title: 'One announcement, every phone.'", needs: 'announcements', src: 'PAGE' },
  { line: "text: 'Prepare items in private", needs: 'prepRelease', src: 'PAGE' },
  { line: "text: 'Keep private notes for yourself", needs: 'privateNotes', src: 'PAGE' },
  { line: "text: 'Day-of desks'", needs: 'dayOfFree', src: 'PAGE' },
  { line: "text: 'One run of show; each supplier sees only their rows'", needs: 'runOfShow', src: 'FACTS' },
  { line: "text: 'Prepare in private, release when ready'", needs: 'prepRelease', src: 'FACTS' },
  { line: "text: 'Private notes, and notes the couple can read'", needs: 'privateNotes', src: 'FACTS' },
  { line: "text: 'Cue the show, part by part'", needs: 'dayOfFree', src: 'FACTS' },
  { line: "text: 'Requests inbox for every supplier'", needs: 'dayOfFree', src: 'FACTS' },
  { line: "text: 'Check-in desk and seat scanner'", needs: 'dayOfFree', src: 'FACTS' },
  { line: "text: 'Announcements on every guest’s phone'", needs: 'announcements', src: 'FACTS' },
];

/** From `at` to the start of the next list item (or the end of the list): the rest of this item. */
function restOfItem(src: string, at: number): string {
  const ends = [src.indexOf("key: '", at + 1), src.indexOf("{ text: '", at + 1), src.indexOf('];', at)].filter((i) => i > 0);
  return src.slice(at, Math.min(...ends));
}

for (const { line, needs, src } of SWITCHED_LINES) {
  test(`"${line}" is said once, and shows only while ${needs} is on`, () => {
    const body = src === 'PAGE' ? PAGE : FACTS;
    const hits = [...body.matchAll(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
    assert.equal(hits.length, 1, `"${line}" appears ${hits.length}× — expected exactly once`);
    assert.ok(
      restOfItem(body, hits[0]?.index ?? 0).includes(`needs: '${needs}'`),
      `"${line}" is not gated on ${needs}: it would show while that switch is off — a promise the app does not keep`,
    );
  });
}

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
  for (const list of ['caps', 'deskParagraph', 'ctools', 'g.items']) {
    assert.ok(PAGE.includes(`shownWith(${list}, on)`), `${list} is rendered without its switches`);
  }
  assert.doesNotMatch(PAGE, /\{(caps|deskParagraph|ctools)\.map\(/, 'a list is rendered whole, skipping its switches');
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

// ── THE DAY-OF DESK IS "FREE" ONLY WHILE THE GATE SAYS SO ─────────────────────────────────────────────

test('the requests inbox and the door read "Free" only while the floor-command desk is free', () => {
  assert.match(
    PAGE,
    /const deskTag = on\.dayOfFree \? <Pill kind="free">Free<\/Pill> : <Pill kind="plan">\{planPill\(SPECIALIZATION_MIN_TIER\)\}<\/Pill>;/,
    'the desk tag is not derived from the gate',
  );
  for (const key of ["key: 'inbox'", "key: 'door'"]) {
    const at = PAGE.indexOf(key);
    assert.ok(at > 0, `${key} not found — this check would pass vacuously`);
    assert.ok(restOfItem(PAGE, at).includes('tag: deskTag'), `${key} is tagged Free while the gate may still charge for it`);
  }
});

test('the hero and the close say the day’s tools are free only while they are', () => {
  assert.match(PAGE, /\{on\.dayOfFree \? <span>Day-of tools free<\/span> : null\}/);
  assert.match(PAGE, /\{on\.dayOfFree \? <span>Day-of desks free<\/span> : null\}/);
  assert.equal((PAGE.match(/Day-of tools free|Day-of desks free/g) ?? []).length, 2);
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
  assert.match(gate, /export const SPECIALIZATION_MIN_TIER\b/);
});
