/**
 * access-is-in-event-settings.test.ts — People with access lives inside Home's ⚙ Event Settings, and the ☰'s event
 * mark is a real door to it.
 *
 * Owner, 2026-10-30, on the live iPhone app: *"tapping monogram not working"* — the event's mark in the ☰ was a bare
 * `div` (the rail drops the `event` group, so the `personalization` → Event Details row the tree still names was drawn
 * nowhere), and with the Countdown card the only other way in, he could not reach People with access at all. Then,
 * verbatim: *"no. that shoud be inside home settings"* → *"move them all in the event settings"*.
 *
 * Held here, as properties:
 *   1 · the Event Settings sheet's rows mount THE `PeopleWithAccess` (one component, never a second editor), once, as
 *       the LAST section, with `returnTo="home"` so a Remove lands back on the sheet;
 *   2 · the sheet's action reads it with the same two readers Event Details uses, in the SAME `Promise.all` as the
 *       sheet's other reads (one round per open, nothing per person), and a failed read stays a failure;
 *   3 · a Remove from the sheet lands on Home with the sheet open on access; every "Change ›" link opens it there;
 *   4 · the ☰'s event mark is a `Link` to Home's sheet — not a picture, not Event Details — with a ≥44 px hit area;
 *   5 · Home opens the sheet from its address (`?settings=1&row=`), and a fresh render of Home re-reads the open sheet;
 *   6 · the sheet's one line says it holds access.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { seatReturnPath } from '@/lib/seat-return-path';
import { eventSettingsHref, peopleWithAccessHref } from '@/lib/people-with-access-href';
import { SETTINGS_ENTRY } from '@/lib/menu-settings';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

test('1 · the sheet mounts THE People with access, once, last, landing a Remove back on Home', () => {
  const rows = code('event-settings-rows.tsx');
  assert.match(rows, /from '\.\.\/details\/_components\/people-with-access'/, 'the sheet draws its own access editor — not THE one');
  assert.equal((rows.match(/<PeopleWithAccess\b/g) ?? []).length, 1, 'People with access is not mounted exactly once in the sheet');
  assert.match(rows, /<PeopleWithAccess\b[\s\S]*?returnTo="home"/, 'a Remove from the sheet would land on Event Details');
  const order = ['row="names"', 'row="date"', 'row="venues"', 'row="parents"', 'row="access"'].map((r) => rows.indexOf(r));
  assert.ok(order.every((i) => i >= 0), `a section is missing from the sheet: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'People with access is not the sheet’s last section');

  // A failed read is handed on as a failure — the section then says so, never "nobody else has access".
  assert.match(rows, /failed=\{!access\.measured\}/, 'a failed access read is drawn as an empty list');
  assert.match(rows, /rows=\{access\.measured \? access\.rows : \[\]\}/);
});

test('2 · the action reads access with Event Details’ readers, in the sheet’s one round', () => {
  const action = code('open-event-settings.tsx');
  const at = action.indexOf('const [draft, parents, people, claims, settings] = await Promise.all([');
  assert.ok(at >= 0, 'the sheet’s one round no longer reads the draft, the parents and access together');
  const round = action.slice(at, action.indexOf(']);', at));
  assert.ok(round.length > 0, 'no Promise.all in the action — this check would pass vacuously');
  assert.match(round, /loadPeopleWithAccess\(eventId, user\.id\)/, 'People with access is not read in the sheet’s round');
  assert.match(round, /readClaimAccessAsks\(supabase, eventId\)/, 'the suppliers waiting for Approve are not read in the sheet’s round');
  assert.match(round, /measured: false as const/, 'a failed access read is not kept as a failure');
  assert.match(action, /if \(!viewer\.isCouple\) return \{ ok: false/, 'a non-host gets the hosts’ sheet');
});

test('3 · a Remove and every "Change ›" land on Home with the sheet open on access', () => {
  const form = (f: Record<string, string>) => ({ get: (k: string) => f[k] ?? null });
  assert.equal(seatReturnPath(form({ return_to: 'home' }), 'E', { host_removed: '1' }), '/dashboard/E?settings=1&row=access&host_removed=1');
  assert.equal(peopleWithAccessHref('E'), '/dashboard/E?settings=1&row=access');
  assert.equal(eventSettingsHref('E'), '/dashboard/E?settings=1');
});

test('4 · the ☰’s event mark is a real link to Home’s ⚙ sheet, 44 px at least', () => {
  const rail = code('event-rail-context.tsx');
  const mark = rail.slice(rail.indexOf('className="fd-rctx-mark"'), rail.indexOf('className="fd-rctx"'));
  assert.ok(mark.length > 0, 'the mark’s element is gone — this check would pass vacuously');
  assert.match(mark, /<Link href=\{eventSettingsHref\(eventId\)\} className="fd-rctx-door"/, 'the mark is not a link to Home’s ⚙ sheet');
  assert.match(mark, /aria-label=\{SETTINGS_ENTRY\.home\.sheet\}/, 'the mark’s link is not named for the sheet it opens');
  assert.match(mark, /<EventMonogram\b/, 'the link does not hold the mark');
  const css = readFileSync(join(HERE, '../../../_components/frontdoor/front-door.css'), 'utf8');
  const rule = css.match(/\.fd-rctx-door\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(rule, /min-width:\s*44px/, 'the mark’s door is narrower than a thumb');
  assert.match(rule, /min-height:\s*44px/, 'the mark’s door is shorter than a thumb');
  // EVERY WIDTH (owner 2026-10-30: *"event details showed on desktop view but not on mobile view"*): the rail is ONE
  // component — the phone's ☰ drawer, the 72 px strip and the full desktop rail — so the mark's door is the same link at
  // each, and no rule anywhere may hide it at one of them.
  for (const r of css.match(/[^{}]+\{[^}]*\}/g) ?? []) {
    const selector = r.slice(0, r.indexOf('{'));
    if (!/\.fd-rctx-(door|mark)\b/.test(selector)) continue;
    assert.doesNotMatch(r, /display\s*:\s*none|pointer-events\s*:\s*none/, `the mark’s door is hidden or dead at some width: ${selector.trim()}`);
  }
  // The drawer closes on a link to the page you are on (only the query changes).
  const shell = code('../../../_components/frontdoor/front-door-shell.tsx');
  assert.match(shell, /onClickCapture=\{\(e\) => \{[\s\S]*?closest\?\.\('a\[href\]'\)\) closeRail\(\)/, 'a same-page drawer link leaves the drawer over the sheet');
});

test('5 · Home opens the sheet from its address, and a fresh render re-reads the open sheet', () => {
  const page = code('../page.tsx');
  assert.match(page, /open: search\.settings === '1'/, 'Home does not open its sheet from `?settings=1`');
  assert.match(page, /isEventSettingsRow\(search\.row\)/, 'Home lands on any `row=` word, not only a sheet row');
  assert.match(page, /renderKey: `\$\{Date\.now\(\)\}`/, 'a fresh render of Home carries no key — an added person would not appear in the open sheet');
  const gear = code('home-settings-gear.tsx');
  assert.match(gear, /\[open, eventId, reads, rows, renderKey, flashFrom\]/, 'the open sheet does not re-read on a fresh render');
  assert.match(gear, /window\.history\.replaceState\(/, 'closing the sheet leaves `?settings=1` in the address (Back / reload reopen it)');
});

test('6 · the sheet’s one line says it holds access', () => {
  assert.match(SETTINGS_ENTRY.home.line, /access/i, 'the Event Settings line does not say it holds who has access');
});

test('7 · the rest of what Event Details EDITS moved into the sheet — the same components — and the couple’s /details forwards', () => {
  // Owner 2026-10-30: *"move them all in the event settings"* · *"they were suppose to combine the event details and event
  // settings together on the event settings"* (DECISION_LOG 2026-10-26 "FINAL STRUCTURE" (2), "EACH MENU HAS ITS OWN SETTINGS").
  const rows = code('event-settings-rows.tsx');
  for (const [component, from] of [
    ['EventSettingsEditor', "'../details/_components/event-settings-editor'"],
    ['PlanMyselfSwitch', "'../launch/_components/plan-myself'"],
    ['OneCodeUnderGetIn', "'../studio/papic/_components/one-code'"],
    ['PutAwayCard', "'../details/_components/put-away-card'"],
  ] as const) {
    assert.ok(rows.includes(`import { ${component} } from ${from}`), `the sheet draws its own ${component} — not THE one Event Details mounts`);
    assert.equal((rows.match(new RegExp(`<${component}\\b`, 'g')) ?? []).length, 1, `${component} is not mounted exactly once in the sheet`);
  }
  // Put this away stays last and quiet.
  assert.ok(rows.indexOf('<PutAwayCard') > rows.indexOf('<PeopleWithAccess'), 'Put this away is no longer last');
  // The action reads the moved parts in the same round (no read per part, no second round).
  const action = code('open-event-settings.tsx');
  const at = action.indexOf('const [draft, parents, people, claims, settings] = await Promise.all([');
  assert.ok(at >= 0, 'the sheet’s round no longer reads the event settings with the rest');
  assert.match(action.slice(at, action.indexOf(']);', at)), /loadEventSettings\(\{ supabase, eventId, userId: user\.id \}\)/);
  assert.match(action, /select\('event_type, planning_mode, archived, display_name'\)/, 'Plan it myself / Put this away read their own extra row');
  // The couple's /details forwards to the sheet (keeping a Remove's words); a helper still reads the page.
  const details = code('../details/page.tsx');
  assert.match(details, /if \(viewer\.isCouple\) \{[\s\S]{0,400}?redirect\(eventSettingsHref\(eventId,/, 'the couple still lands on a second copy of Event Settings');
});

test('8 · the Countdown opens the Date Finder — not the sheet, not Event Details — for the couple', () => {
  // Owner 2026-10-30, verbatim: *"date finder. because we want them to find the date for their event"* (2026-10-26
  // "FINAL STRUCTURE" (3)). The sheet still holds the date's editor; the Countdown jumps straight to finding one.
  const faces = code('home-control-faces.ts');
  assert.match(faces, /export function countdownDoor\(eventId: string\): string \{\s*return dateFinderHref\(eventId\);/, 'the Countdown does not open the Date Finder');
  assert.match(code('../page.tsx'), /dateFinderOpen=\{search\.date === DATE_FINDER_VALUE\}/, 'Home does not open the Date Finder from its address');
  assert.match(code('../page.tsx'), /countdownDoor: viewerMemberType === 'couple' \? undefined : `\/dashboard\/\$\{eventId\}\/details`/, 'a helper’s Countdown changed target');
});
