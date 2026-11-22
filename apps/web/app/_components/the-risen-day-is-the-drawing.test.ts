/**
 * 🔒 THE RISEN DAY IS THE DRAWING, ON BOTH SIDES (Unichat part F parity, 22 Nov; drawing `unichat_live_v3_2026-11-20.html`
 * `riseBody('next')`). The supplier's "Your part of the day" and the hosts' "The whole day" rise from the chat and draw
 * ONE set of parts (`day-rise-parts.tsx`) — never two copies that drift apart again:
 *
 *   1 · the parts are the drawing's sizes: a 36 px date tile (11 px month, 13 px day), an 11 px pill, a Done fold with
 *       no caret in full ink, the day as a timeline (dot · line · ⏱), a phone-width column on a computer; no hex;
 *   2 · both lists wear them, rise with ‹ Back to chat over the page's grey, and keep no local copy of a row;
 *   3 · the hosts' list: "The whole day", "Edit on the event Schedule", this shop's moments askable through the SHIPPED
 *       ask, the venue line in the hosts' words; reached from the ⋯ menu's Schedule and read only then.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PARTS = read('app/_components/day-rise-parts.tsx');
const SUPPLIER = read('app/vendor-dashboard/clients/[eventId]/_components/agenda-rise.tsx');
const HOSTS = read('app/_components/chat/whole-day-rise.tsx');

test('1 · the parts are the drawing’s sizes', () => {
  assert.match(PARTS, /h-9 w-9[^"`]*rounded-lg[^"`]*\$\{k\.tile\}/, 'the date tile is not 36 px');
  assert.match(PARTS, /<small className="text-\[11px\] font-bold uppercase">\{r\.mon\}<\/small>/, 'the tile’s month is not 11 px');
  assert.match(PARTS, /<b className="text-\[13px\] font-bold">\{r\.d\}<\/b>/, 'the tile’s day is not 13 px');
  assert.match(PARTS, /rounded-full px-2 py-px text-\[11px\] font-bold leading-4 \$\{pill\}/, 'the status pill is not the drawing’s 11 px pill');
  // The Done fold: no caret, full ink.
  const fold = PARTS.slice(PARTS.indexOf('<details data-agenda-done'), PARTS.indexOf('</details>'));
  assert.ok(fold.length > 0, 'the Done fold is gone');
  assert.doesNotMatch(fold, /Chevron/, 'the Done fold grew a caret again');
  assert.match(fold, /<summary className="[^"]*list-none[^"]*text-\[13px\] font-bold text-ink [^"]*webkit-details-marker\]:hidden/, 'the Done fold is not full ink, or shows the browser’s marker');
  // The day as a timeline.
  assert.match(PARTS, /grid-cols-\[64px_minmax\(0,1fr\)_auto\]/, 'the timeline’s 64 px clock column is gone');
  assert.match(PARTS, /data-timeline-dot=\{it\.onPick \? 'mine' : 'other'\}/, 'the dots no longer tell an askable moment from the rest');
  assert.match(PARTS, /data-timeline-line=""/, 'the line between the dots is gone');
  assert.match(PARTS, /<Timer aria-hidden/, 'an askable moment lost the drawing’s stopwatch');
  assert.match(PARTS, /export const DAY_COLUMN = 'mx-auto grid w-full max-w-\[\d+px\]/, 'the list stretches across a computer screen');
  assert.doesNotMatch(PARTS, /#[0-9a-fA-F]{3,8}\b/, 'a hex colour — the kind tokens carry light and dark');
});

test('2 · both lists wear the one set of parts, risen with ‹ Back to chat', () => {
  for (const [who, src] of [['the supplier’s list', SUPPLIER], ['the hosts’ list', HOSTS]] as const) {
    assert.match(src, /from '@\/app\/_components\/day-rise-parts'/, `${who} does not draw from day-rise-parts`);
    for (const part of ['<AgendaRows', '<DayTimeline', 'className={DAY_COLUMN}']) assert.ok(src.includes(part), `${who} lost ${part}`);
    assert.match(src, /<RiseScreen [^>]*back="Back to chat"/, `${who} rises with ✕, not the drawing’s ‹ Back to chat`);
    assert.doesNotMatch(src, /function Row\b|ChevronDown/, `${who} keeps its own copy of a row or the fold’s caret`);
  }
  assert.match(SUPPLIER, /<DayHead>Your part of the day<\/DayHead>/);
  const screen = read('app/_components/rise/rise-screen.tsx');
  assert.match(screen, /<ChevronLeft aria-hidden/, 'the rise screen has no back chevron');
  assert.match(screen, /\$\{back \? ' bg-page' : ''\}/, 'a screen risen from a chat is not on the page’s grey');
});

test('3 · the hosts’ whole day, from the ⋯ menu', () => {
  assert.match(HOSTS, /<DayHead>The whole day<\/DayHead>/);
  assert.match(HOSTS, /href=\{`\/dashboard\/\$\{eventId\}\/schedule`\}[\s\S]{0,400}Edit on the event Schedule/, 'no way to the event Schedule that owns the day');
  assert.match(HOSTS, /<AskSupplierSection\b/, 'a shop moment does not open the shipped ask');
  assert.match(HOSTS, /moment_op', 'ask_supplier'/, 'the ask goes through a door of its own');
  assert.match(HOSTS, /hostsWindowWords\(head\.hoursHeldBy\)/, 'the venue line is not in the hosts’ words');
  const page = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(page, /href: `\/dashboard\/\$\{eventId\}\/messages\/\$\{threadId\}\?day=1`, label: 'Schedule'/, 'the ⋯ menu’s Schedule does not raise the whole day');
  assert.match(page, /const wholeDayRead[^=]*= wantWholeDay\s*\?/, 'the whole day is read on every chat load, not only when asked');
  const loader = read('lib/hosts-whole-day.server.ts');
  assert.match(loader, /time_tba/, 'the loader reads no time_tba — a TBA chapter would draw as 12:00 AM');
  assert.match(loader, /\? null\s*: buildSupplierDay\(/, 'a refused read is drawn as an empty day');
});
