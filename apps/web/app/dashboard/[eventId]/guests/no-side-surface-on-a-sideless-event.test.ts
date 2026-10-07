/**
 * NO SIDE SURFACE RENDERS FOR A SIDELESS EVENT — anchored PER COMPONENT.
 *
 * Owner 2026-09-30 (DECISION_LOG "A NON-WEDDING EVENT HAS NO SIDES"): no Side
 * column, filter, sort, grouping, "Assign side…", picker or branch on any
 * event whose type's role set has no side principals (`eventHasSides`,
 * lib/guest-side-question.ts). `a-simple-event-has-no-sides.test.ts` pins the
 * Guest list's own controls; this file pins every OTHER place a side word is
 * drawn (P6a, 2026-10-01): the new-group "Team side" pick, a group chip's
 * title, the groups row, the possible-duplicate rows on both add forms, the
 * check-in desk, the request "Accept" quick add, the bulk bar, the phone row,
 * and the guest's own page.
 *
 * WHY PER COMPONENT, WITH A COUNT. A file-level match cannot say WHICH
 * component still draws a side: a file with three gated renders and one
 * ungated one passes "the file mentions hasSides". So each component's body
 * is cut out, every side render inside it is found, and each one must sit
 * behind the gate within the same expression. The counts are printed, and a
 * component whose count drops to zero fails too (it moved — re-anchor, don't
 * let the guard go inert).
 *
 * Sabotage (2026-10-01): removing `hasSides ?` from the check-in desk line, or
 * the `if (!hasSides) return null` from TeamSideSelect, turns its row red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '../../../..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A side word being DRAWN: a side-label lookup, the side editor, the team-side pick. */
const SIDE_RENDER = /\b(?:TEAM_)?SIDE_LABELS\[|<SideChipEditor\b|<TeamSideSelect\b/g;

/** The gate: the profile-derived boolean. */
const GATE = /\bhasSides\b/;

/** How far back (characters) the gate may sit from the render — one expression. */
const REACH = 260;

/**
 * Is `at` inside a still-open `{hasSides ? (` JSX block? (A labelled field is
 * longer than one expression, so the gate can sit far above its options.)
 */
function insideGatedBlock(body: string, at: number): boolean {
  const open = body.lastIndexOf('hasSides ? (', at);
  if (open < 0) return false;
  let depth = 0;
  for (const ch of body.slice(open + 'hasSides ? '.length, at)) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
  }
  return depth > 0;
}

/** The body of a top-level `function Name(` up to the next top-level function. */
function componentBody(src: string, name: string): string {
  const head = new RegExp(`\\n(?:export )?(?:default )?function ${name}\\b`);
  const m = head.exec(src);
  assert.ok(m, `function ${name} not found — it moved; re-anchor this guard`);
  const rest = src.slice(m.index + 1);
  const next = /\n(?:export )?(?:default )?(?:async )?function \w/.exec(rest.slice(1));
  return next ? rest.slice(0, next.index + 1) : rest;
}

const COMPONENTS: ReadonlyArray<{ file: string; name: string }> = [
  { file: 'app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx', name: 'RosterBulkBar' },
  { file: 'app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx', name: 'NewGroupInlineForm' },
  { file: 'app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx', name: 'MobileListRow' },
  { file: 'app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx', name: 'GroupChipList' },
  // (groups-sidebar.tsx — GroupsSidebarBody, TeamSideSelect — was deleted with
  // the retired filter row, Maker PR 4f, 2026-10-07.)
  { file: 'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx', name: 'GuestCardBody' },
  { file: 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx', name: 'GuestsScreen' },
  { file: 'app/dashboard/[eventId]/guests/_components/guest-name-fields.tsx', name: 'GuestNameFields' },
  { file: 'app/dashboard/[eventId]/guests/_components/quick-add-sheet.tsx', name: 'QuickAddSheet' },
  { file: 'app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx', name: 'CheckinDesk' },
  { file: 'app/dashboard/[eventId]/guests/claims/keep-quick-add.tsx', name: 'KeepQuickAdd' },
];

test('every side render in every listed component sits behind the hasSides gate', () => {
  const report: string[] = [];
  const ungated: string[] = [];
  for (const { file, name } of COMPONENTS) {
    const body = componentBody(read(file), name);
    let total = 0;
    let gated = 0;
    for (const m of body.matchAll(SIDE_RENDER)) {
      total += 1;
      const before = body.slice(Math.max(0, m.index - REACH), m.index);
      if (GATE.test(before) || insideGatedBlock(body, m.index) || (name === 'TeamSideSelect' && /if \(!hasSides\) return null/.test(body))) gated += 1;
      else ungated.push(`${name} (${file.split('/').pop()}): ${body.slice(m.index, m.index + 60).replace(/\s+/g, ' ')}`);
    }
    report.push(`${name}: ${gated}/${total} gated`);
    assert.ok(total > 0, `${name} draws no side word any more — it moved; re-anchor this guard`);
  }
  console.log(`[no-side-surface] ${report.join(' · ')}`);
  assert.deepEqual(ungated, [], `a side word renders on a sideless event:\n  ${ungated.join('\n  ')}`);
});

test('the guest’s own page draws a side only from the wedding-only part', () => {
  // site-body resolves sideLabel once (null unless the type has two named
  // people); the widget and the ticket line draw only through it.
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /const sideLabel: string \| null = !weddingOnly\.side_labels\s*\? null/);
  assert.match(body, /\{sideLabel \? \(\s*<>\s*\{' '\}·\{' '\}/, 'the ticket line "You’re joining us as … · Both sides" is not gated');
  const widget = read('app/[slug]/_components/hideable-widget-render.tsx');
  assert.doesNotMatch(widget, /SIDE_LABELS|'Both sides'/, 'the widget computes its own side words');
  assert.match(widget, /sideLabel \? <Detail label="Side"/);
});

test('the pages that mount them pass the gate down', () => {
  const checkin = read('app/dashboard/[eventId]/guests/checkin/page.tsx');
  assert.match(checkin, /const hasSides = eventHasSides\(await resolveRoleSetForEvent\(eventId\)\)/);
  assert.match(checkin, /<CheckinDesk[\s\S]*?hasSides=\{hasSides\}/, 'the check-in desk is not told whether the event has sides');
  const claims = read('app/dashboard/[eventId]/guests/claims/page.tsx');
  assert.match(claims, /const hasSides = eventHasSides\(\{ coupleRoles \}\)/);
  assert.match(claims, /<KeepQuickAdd[\s\S]*?hasSides=\{hasSides\}/, 'the Accept quick add is not told whether the event has sides');
  assert.match(read('app/dashboard/[eventId]/guests/new/page.tsx'), /<GuestNameFields[^>]*hasSides=\{hasSides\}/);
  // ⤷ Maker PR 4f: the Guest list is GuestsScreen (GroupsSidebar's inline mount
  // left with the retired filter row).
  assert.match(read('app/dashboard/[eventId]/guests/page.tsx'), /<GuestsScreen[\s\S]*?hasSides=\{hasSides\}/);
});

test('the door refusals name the event’s own organizer, not "the couple"', () => {
  for (const f of ['checkin/actions.ts', 'souvenirs/actions.ts']) {
    const src = read(`app/dashboard/[eventId]/guests/${f}`);
    assert.doesNotMatch(src, /'Only the couple or a coordinator/, `${f} still names a couple at every event's door`);
    assert.match(src, /eventWordsForEvent\(eventId\)/);
  }
});
