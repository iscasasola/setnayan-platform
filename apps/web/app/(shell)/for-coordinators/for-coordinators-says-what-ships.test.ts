/**
 * for-coordinators-says-what-ships.test.ts — /for-coordinators names only tools the app has, promises
 * nothing the code does not do, and wears the one shared shell.
 *
 * The page is a port of the owner-approved prototype `prototypes/for_coordinators_2026-11-04.html`.
 * Building it found four places where the prototype's words and the code disagreed (calls, who moves
 * the show forward, prep-then-release, "Recommend an add-on"); the page follows the code. This file
 * keeps it that way: each tool the page names is pinned to the symbol that does it, and each corrected
 * claim is pinned shut with the fact that makes it false — so a session that genuinely ships the thing
 * knows exactly what to delete here, and why.
 *
 * SABOTAGE (run 2026-11-04 before the PR): rename `FREE_HELPER_SEATS` in lib/vendor-free-helper.ts →
 * RED; write "Free voice and video calls" into the page → RED; link `/sample/coordinator` → RED; drop
 * the route from DOORWAY_BLEED_PATHS → RED; type "₱990" into the page → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

import { ALL_SWITCHES_OFF, CLAIM_SWITCHES, countWord, shownWith, type ClaimSwitches } from './_claims';

const HERE = import.meta.dirname; // app/(shell)/for-coordinators
const APP = join(HERE, '..', '..');
const WEB = join(APP, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

/** Every tool the page names → the file and the symbol that does it. */
const TOOLS: readonly { tool: string; file: string; symbol: RegExp }[] = [
  { tool: 'Host access, part by part (the couple invites you)', file: 'lib/coordinator-grant.ts', symbol: /export async function autoInviteCoordinator\b/ },
  { tool: 'Host access, part by part (the parts)', file: 'lib/delegate-areas.ts', symbol: /export const COORDINATOR_AREAS\b/ },
  { tool: 'Access ends seven days after the event', file: 'lib/delegate-access-window.ts', symbol: /export const DELEGATE_GRACE_DAYS = 7;/ },
  { tool: 'One run-of-show, each supplier sees their rows', file: 'lib/schedule-ros.ts', symbol: /export function filterBlocksForAudience\b/ },
  { tool: 'Door check-in by scanning the pass', file: 'app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx', symbol: /export function CheckinDesk\b/ },
  { tool: 'Day-of desk · cue the show', file: 'app/_actions/run-of-show.ts', symbol: /export async function advanceScheduleBlock\b/ },
  { tool: 'Day-of desk · the requests inbox', file: 'app/vendor-dashboard/on-the-day/_components/requests-inbox.tsx', symbol: /export function RequestsInbox\b/ },
  { tool: 'Day-of desk · the seat scanner', file: 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/seat-scanner.tsx', symbol: /export function SeatScanner\b/ },
  { tool: 'Day-of desk · free, no end date', file: 'lib/vendor-dayof-free-until.ts', symbol: /export function isVendorDayOfStillFree\b/ },
  { tool: 'Auto-arrange seats', file: 'app/dashboard/[eventId]/seating/actions.ts', symbol: /export async function autoArrange\b/ },
  { tool: 'One-tap invites (Messenger · Viber · WhatsApp)', file: 'app/dashboard/[eventId]/guests/_components/send-invite.tsx', symbol: /WhatsApp[\s\S]*Viber[\s\S]*Messenger|Messenger[\s\S]*Viber[\s\S]*WhatsApp/ },
  { tool: 'One helper, free', file: 'lib/vendor-free-helper.ts', symbol: /export const FREE_HELPER_SEATS = 1;/ },
  { tool: 'Events you run', file: 'lib/events-you-run.ts', symbol: /export function eventsYouRun\b/ },
  { tool: 'Announcements on every guest’s Event Hub', file: 'lib/coordinator-broadcasts-server.ts', symbol: /export async function fetchLatestBroadcasts\b/ },
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

test('only the coordinator and the couple move the show forward — never the emcee', () => {
  const gate = read('lib/run-of-show-advance-gate.ts');
  assert.match(gate, /memberType === 'couple'\) return \{ allowed: true/, 'the couple no longer advances the show');
  assert.match(PAGE, /only you and the couple move the show forward/, 'the page lost the corrected line');
});

/** Claims the prototype made that the code contradicts — each with the fact that makes it false. */
const FALSE_CLAIMS: readonly { claim: RegExp; why: string }[] = [
  {
    claim: /(voice|video)[^.]{0,40}call|call[^.]{0,20}(voice|video)/i,
    why: 'in-app calls left the chat (owner 2026-10-28, "remove both voice and video call"); no screen calls startThreadCall',
  },
  { claim: /Recommend an add-on/i, why: 'studio/recommend-actions.ts: "NO SCREEN POSTS THESE SINCE 2026-10-02"' },
  { claim: /\/sample\/coordinator/, why: 'app/sample/[...rest] 404s it — there is no coordinator demo yet' },
  { claim: /If there is no coordinator, the couple/i, why: 'decideMayAdvance lets the couple advance at any time' },
  { claim: /₱\s?\d/, why: 'no price is typed here — a price comes from the catalogue (platform_retail_catalog_v2)' },
  {
    claim: /free (until|through|till)|until (Dec|December|2026-12-31)/i,
    why: 'the day-of desks stay free with NO end date (DECISION_LOG 2026-11-04 "DAY-OF DESKS STAY FREE")',
  },
  { claim: /celebration/i, why: 'say "event" (owner 2026-10-04)' },
];

test('the page makes none of the claims the code contradicts', () => {
  const hits = FALSE_CLAIMS.filter(({ claim }) => claim.test(PAGE)).map(
    ({ claim, why }) => `${claim} — ${why}`,
  );
  assert.deepEqual(hits, [], 'the page says something the app does not do:\n  ' + hits.join('\n  '));
});

test('every link on the page opens a real page or an anchor on it', () => {
  const hrefs = [...PAGE.matchAll(/href[:=]\s*[{]?\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1] ?? '');
  assert.ok(hrefs.length >= 6, `anti-vacuity: only ${hrefs.length} links were read`);
  const pageOnDisk = (route: string) =>
    [join(APP, route, 'page.tsx'), join(APP, '(shell)', route, 'page.tsx')].some((p) => existsSync(p));
  const dead = hrefs.filter((h) => {
    if (h.startsWith('#')) return !PAGE.includes(`id="${h.slice(1)}"`);
    if (!h.startsWith('/') || h.startsWith('/marketing/')) return false;
    return !pageOnDisk(h.split(/[?#]/)[0] ?? h);
  });
  assert.deepEqual(dead, [], 'a link on /for-coordinators goes nowhere: ' + dead.join(', '));
});

test('the call to action is the supplier door — a coordinator opens a supplier shop', () => {
  const ctas = PAGE.match(/href="\/open-shop"/g) ?? [];
  assert.equal(ctas.length, 2, 'the hero and the close each open /open-shop');
});

test('every photo the page shows is in public/marketing/2026-11-04', () => {
  const photos = [...PAGE.matchAll(/\$\{PHOTOS\}\/([a-z0-9-]+\.webp)/g)].map((m) => m[1] ?? '');
  assert.ok(photos.length >= 15, `anti-vacuity: only ${photos.length} photos were read`);
  const missing = photos.filter((f) => !existsSync(join(WEB, 'public', 'marketing', '2026-11-04', f)));
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

// ── THE FOUR SWITCHED LINES (owner 2026-11-04: "show each line only when its switch is on") ──────────


/** Each switch-dependent sentence → the switch it needs. The guard finds the item that holds it. */
const SWITCHED_LINES: readonly { line: string; needs: string }[] = [
  { line: "text: 'One run-of-show'", needs: 'runOfShow' },
  { line: "title: 'One run-of-show'", needs: 'runOfShow' },
  { line: 'Each supplier sees only their own rows', needs: 'runOfShow' },
  { line: 'Send one announcement', needs: 'announcements' },
  { line: 'Prepare schedule items in private', needs: 'prepRelease' },
  { line: 'Keep private notes for yourself', needs: 'privateNotes' },
];

/** The `{ … }` object literal (one item of a list) that contains `at`. */
function itemAround(src: string, at: number): string {
  const open = src.lastIndexOf('\n  {', at);
  const close = src.indexOf('\n  }', at);
  return src.slice(open, close);
}

test('every line that needs a switch carries it, and nothing else holds those words', () => {
  const wrong = SWITCHED_LINES.flatMap(({ line, needs }) => {
    const hits = [...PAGE.matchAll(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
    if (hits.length !== 1) return [`"${line}" appears ${hits.length}× (expected once)`];
    const item = itemAround(PAGE, hits[0]?.index ?? 0);
    return item.includes(`needs: '${needs}'`) ? [] : [`"${line}" is not gated on ${needs}`];
  });
  assert.deepEqual(wrong, [], 'a switch-dependent claim could show while its switch is off:\n  ' + wrong.join('\n  '));
});

test('the switches are read with the gates the features themselves use, and fail closed', () => {
  const reader = stripComments(readFileSync(join(HERE, '_claims.server.ts'), 'utf8'));
  for (const gate of [
    "isDataPrivacyControlActive('coordinator_run_of_show')",
    'isCoordinatorP3Enabled()',
    'isCoordinatorPrepReleaseEnabled()',
    'isCoordinatorVendorNotesEnabled()',
  ]) {
    assert.ok(reader.includes(gate), `_claims.server.ts does not read ${gate}`);
  }
  assert.equal((reader.match(/\.catch\(\(\) => false\)/g) ?? []).length, 3, 'a DB-read switch is not failing closed');
  assert.match(PAGE, /const on = await readClaimSwitches\(\);/, 'the page does not read the live switches');
  for (const list of ['FREE_LINE', 'KIT', 'PROBLEMS']) {
    assert.match(PAGE, new RegExp(`shownWith\\(${list}, on\\)`), `${list} is rendered without its switches`);
  }
  assert.doesNotMatch(PAGE, /\{(FREE_LINE|KIT|PROBLEMS)\.map\(/, 'a list is rendered whole, skipping its switches');
});

test('the headings count what is shown — "Nine tools", "Twelve problems" are never typed', () => {
  assert.doesNotMatch(PAGE, /\b(Nine|Ten|Twelve|Eleven) (tools|problems)\b/, 'a heading types its count');
  assert.match(PAGE, /countWord\(kit\.length\)/);
  assert.match(PAGE, /countWord\(problems\.length\)/);
});

test('a switched item shows only when its switch is on; an unswitched one always shows', () => {
  const items = [{ id: 'always' }, { id: 'ros', needs: 'runOfShow' as const }, { id: 'notes', needs: 'privateNotes' as const }];
  const allOn = Object.fromEntries(CLAIM_SWITCHES.map((k) => [k, true])) as unknown as ClaimSwitches;
  assert.deepEqual(shownWith(items, ALL_SWITCHES_OFF).map((i) => i.id), ['always']);
  assert.deepEqual(shownWith(items, allOn).map((i) => i.id), ['always', 'ros', 'notes']);
  assert.deepEqual(shownWith(items, { ...ALL_SWITCHES_OFF, runOfShow: true }).map((i) => i.id), ['always', 'ros']);
  assert.equal(countWord(9), 'Nine');
  assert.equal(countWord(12), 'Twelve');
  assert.equal(countWord(21), '21');
});
