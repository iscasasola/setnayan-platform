/**
 * A LIST YOU CANNOT SEE SHOULD SAY SO.
 *
 * A delegate the host never shared the guest list with reads zero guest rows,
 * and an RLS refusal is indistinguishable from an empty event: same 200, same
 * zero rows, same null error. Without this rule the guests screen tells a
 * coordinator the couple has invited nobody, and the seat plan draws an empty
 * room for a wedding with two hundred people in it.
 *
 * 🔑 THE THREE CASES ARE NOT TWO. Stranger · delegate-without-the-grant ·
 * delegate-with-it. Only the middle one gets the notice — a stranger never
 * reaches the page, and collapsing the first two would put "the couple
 * haven't shared this with you" in front of somebody with no relationship to
 * the event at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COORDINATOR_AREAS, type ModeratorPermissions } from './delegate-areas';
import { isDelegateWithoutArea, viewerAreaLevel, type EventViewer } from './event-viewer';

const COUPLE: EventViewer = { isCouple: true, delegatePermissions: null };
const STRANGER: EventViewer = { isCouple: false, delegatePermissions: null };

const seatOnly: ModeratorPermissions = {
  edit_all: false,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
  areas: { seat_plan: 'view' },
};
const SEAT_ONLY: EventViewer = { isCouple: false, delegatePermissions: seatOnly };
const COORDINATOR: EventViewer = {
  isCouple: false,
  delegatePermissions: {
    edit_all: false,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: COORDINATOR_AREAS,
  },
};

test('the couple never see the notice, whatever else is true', () => {
  assert.equal(isDelegateWithoutArea(COUPLE, 'guest_list'), false);
  assert.equal(viewerAreaLevel(COUPLE, 'guest_list'), 'edit');
  // Even for an area no delegate can hold — the couple do not resolve through
  // the delegate grid at all.
  assert.equal(viewerAreaLevel(COUPLE, 'photos'), 'edit');
});

test('a stranger does not get the notice — it would name a relationship they do not have', () => {
  assert.equal(isDelegateWithoutArea(STRANGER, 'guest_list'), false);
  assert.equal(viewerAreaLevel(STRANGER, 'guest_list'), null);
});

test('a delegate granted only the seat plan gets the notice on the guest list', () => {
  assert.equal(isDelegateWithoutArea(SEAT_ONLY, 'guest_list'), true);
  // …and not on the part they WERE given. The narrowing must not read as a
  // blanket no.
  assert.equal(isDelegateWithoutArea(SEAT_ONLY, 'seat_plan'), false);
  assert.equal(viewerAreaLevel(SEAT_ONLY, 'seat_plan'), 'view');
});

test('the default coordinator grant sees the guest list, so the notice stays out of the way', () => {
  assert.equal(isDelegateWithoutArea(COORDINATOR, 'guest_list'), false);
  assert.equal(viewerAreaLevel(COORDINATOR, 'guest_list'), 'edit');
  // The two the coordinator template deliberately withholds still notice.
  assert.equal(isDelegateWithoutArea(COORDINATOR, 'budget'), true);
  assert.equal(isDelegateWithoutArea(COORDINATOR, 'photos'), true);
});

/** Source with comments removed. A guard that matches the comment explaining
 *  the guard is a guard that cannot fail. */
function stripComments(raw: string): string {
  let out = '';
  let i = 0;
  let inBlock = false;
  let inLine = false;
  while (i < raw.length) {
    const two = raw.slice(i, i + 2);
    if (!inBlock && !inLine && two === '/*') { inBlock = true; i += 2; continue; }
    if (inBlock && two === '*/') { inBlock = false; i += 2; continue; }
    if (!inBlock && !inLine && two === '//') { inLine = true; i += 2; continue; }
    if (inLine && raw[i] === '\n') { inLine = false; out += '\n'; i += 1; continue; }
    if (!inBlock && !inLine) out += raw[i];
    i += 1;
  }
  return out;
}

/**
 * Does this page ask whether the viewer may see a guest, AND act on the answer?
 *
 * 🔑 TWO SHAPES COUNT, AND ONLY COUNTING ONE IS HOW A GUARD GOES BLIND.
 *   1. PAGE-LEVEL — it asks and returns `<NotSharedWithYou>` instead of a screen
 *      built from an empty list.
 *   2. READ-LEVEL — it asks and conditions the guest read itself on the answer.
 *      The right shape when the page has a job beyond the guest list: the
 *      stories still render, they just lose their bylines.
 *
 * ⚠ THE READ-LEVEL CHECK LOOKS AT THE CONDITION, NOT AT A WINDOW. Its first
 * version searched the 800 characters before each read for the boolean's name
 * — and a mutation that deleted the boolean from the `if` and left its
 * DECLARATION standing sailed through, 1 → 0 occurrences, all green. A window
 * cannot say which statement uses a value. This walks to the statement or the
 * enclosing block header and asks whether the read is genuinely conditioned.
 */
function guardsItsGuestRead(src: string): boolean {
  const asks = src.includes('isDelegateWithoutArea(') && src.includes("'guest_list'");
  if (!asks) return false;
  if (src.includes('<NotSharedWithYou')) return true;

  /*
    ⚠ THE HELPERS COUNT AS READS TOO. A page that reaches the guest list through
    `lib/guests.ts` rather than an inline `.from('guests')` used to have NO reads
    by this measure, so `reads.length === 0` returned false and the page was
    billed as ungated even when it gated correctly — the guard could not see the
    thing it was judging. Widened, so it judges more call sites, never fewer.
  */
  const reads = [
    ...src.matchAll(/\.from\('guests'\)|fetchGuestsByEvent(?:Measured)?\(|countGuestsByEvent\(/g),
  ].map((m) => m.index ?? 0);
  if (reads.length === 0) return false;
  return reads.every((at) => readIsConditioned(src, at));
}

/**
 * Is this guest read governed by a `may…` boolean — in its own statement, or in
 * the header of the block that encloses it?
 *
 * ⚠ IT WALKS BRACE DEPTH RATHER THAN TAKING THE NEAREST `{`. The first version
 * took the last `{` before the read, which on
 * `const { data: guests } = await admin.from('guests')` is the DESTRUCTURING
 * brace — so it read the wrong header and rejected a correctly-gated page.
 * Balanced pairs are skipped; only an unmatched opener is a block.
 */
function readIsConditioned(src: string, at: number): boolean {
  const NAMES = /\bmay[A-Z]\w*\b/;

  // 1. The same statement — the ternary shape,
  //    `guestIds.length && mayFoo ? await admin.from('guests') : …`.
  let depth = 0;
  let i = at - 1;
  let stmtStart = -1;
  for (; i >= 0; i -= 1) {
    const c = src[i];
    if (c === '}' || c === ')') depth += 1;
    else if (c === '{' || c === '(') {
      if (depth === 0) break;
      depth -= 1;
    } else if (c === ';' && depth === 0) {
      stmtStart = i;
      break;
    }
  }
  if (stmtStart >= 0 && NAMES.test(src.slice(stmtStart + 1, at))) return true;

  // 2. The enclosing block's header — `if (… && mayFoo) { … .from('guests') }`.
  //    `i` is now sitting on the unmatched opener, if there was one.
  if (i >= 0 && (src[i] === '{' || src[i] === '(')) {
    const headerStart = Math.max(
      src.lastIndexOf(';', i),
      src.lastIndexOf('{', i - 1),
      src.lastIndexOf('}', i - 1),
    );
    if (NAMES.test(src.slice(headerStart + 1, i))) return true;
  }
  return false;
}

/**
 * Pages that read a guest THROUGH THE CALLER'S OWN SESSION and are therefore
 * silently empty for a delegate the host did not grant the guest list.
 *
 * Each line is a decision that somebody looking at that screen may be told the
 * couple has invited nobody. Delete a line when the page gains the gate — the
 * check below fails in BOTH directions, so a fixed page left on the bill is
 * caught too.
 */
const UNEXPLAINED_EMPTY_BILL: Readonly<Record<string, string>> = {
  'app/dashboard/[eventId]/guests/[guestId]/page.tsx':
    'one guest, not the list — a refusal here is a missing person, not an empty roster; needs its own sentence',
  'app/dashboard/[eventId]/guests/claims/page.tsx':
    'couple-only by its own member_type gate — a delegate never reaches it',
  'app/dashboard/[eventId]/guests/invite/page.tsx':
    'couple-only by its own member_type gate',
  'app/dashboard/[eventId]/guests/new/page.tsx':
    'a form, not a list — nothing here states an absence',
  'app/dashboard/[eventId]/guests/tea-ceremony/page.tsx':
    'reads guests to build a ceremony order; empty reads as "no ceremony yet". Owed a sentence.',
  'app/dashboard/[eventId]/invitation/page.tsx':
    'tells a delegate nobody has been invited. Owed a sentence.',
  'app/dashboard/[eventId]/website/widgets/page.tsx':
    'previews one guest; empty degrades to a placeholder rather than a claim',
  'app/dashboard/[eventId]/studio/custom-qr-guest/page.tsx':
    'a paid QR pack; empty reads as "no guests to print". Owed a sentence.',
  'app/dashboard/[eventId]/studio/custom-qr-guest/print/page.tsx':
    'the print sheet for the above',
  'app/dashboard/[eventId]/invitation/print/page.tsx':
    'the print sheet for the invitation page',
  'app/dashboard/[eventId]/seating/lab/page.tsx':
    'an experimental seating sandbox behind its own flag',
  'app/dashboard/[eventId]/studio/indoor-blueprint/page.tsx':
    'a retired SKU whose orders are hard-rejected',
  'app/dashboard/[eventId]/studio/mood-board/page.tsx':
    'reads guests only for a count on a palette screen',
  'app/dashboard/[eventId]/studio/patiktok/booth/page.tsx':
    'a booth screen; the guest read feeds a picker, empty renders as no picks',
  'app/dashboard/[eventId]/live/page.tsx':
    'its only guest read is a COUNT of faceblock-enabled guests — how many asked for their face blurred, never who. A coordinator running the day needs that number; gating it on the guest list would remove a privacy counter from the person acting on it.',
  'app/dashboard/[eventId]/studio/papic/moderation/page.tsx':
    'couple-only by its own member_type check — a delegate is redirected before the read',
  'app/dashboard/[eventId]/people/page.tsx':
    'ALREADY correct — it hides the whole group rather than showing an empty one',
  'app/dashboard/[eventId]/page.tsx':
    'the dashboard overview; its counts are couple-facing and a delegate sees the same tiles',
};

test('THE GUARD: every screen that reads a guest asks whether this viewer may see one', () => {
  // 🔑 DERIVED FROM THE TREE, NOT FROM A LIST I TYPED — and the first version of
  // this test said exactly that above a hand-typed list of two. That
  // contradiction is the mechanism by which the day-of check-in desk and the
  // souvenir table shipped ungated: they were not on the list because nobody
  // thought of them. The list now comes from the code.
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const found = execSync(
    "grep -rl \"from('guests')\\|fetchGuestsByEvent\\|countGuestsByEvent\\|fetchGuestsByEventMeasured\" 'app/dashboard/[eventId]' --include=page.tsx || true",
    { encoding: 'utf8', shell: '/bin/bash' },
  )
    .split('\n')
    .filter(Boolean)
    .sort();

  // A floor, so a broken path or a renamed directory cannot make this pass by
  // sweeping nothing. Measured at 26 when this was written.
  assert.ok(found.length >= 20, `the sweep found only ${found.length} guest-reading pages — it is not sweeping`);

  const gated: string[] = [];
  const unexplained: string[] = [];
  for (const path of found) {
    const src = stripComments(readFileSync(path, 'utf8'));
    if (guardsItsGuestRead(src)) gated.push(path);
    else unexplained.push(path);
  }

  // Every page is either gated or carries a written reason. Both directions:
  // a page that gained the gate must come OFF the bill.
  const billed = Object.keys(UNEXPLAINED_EMPTY_BILL).sort();
  const missingFromBill = unexplained.filter((p) => !(p in UNEXPLAINED_EMPTY_BILL));
  const staleBillLines = billed.filter((p) => gated.includes(p));

  assert.deepEqual(
    missingFromBill,
    [],
    'a screen reads guest rows and neither explains a refusal nor carries a reason for not doing so',
  );
  assert.deepEqual(
    staleBillLines,
    [],
    'this screen now explains itself — delete its line from UNEXPLAINED_EMPTY_BILL',
  );

  // The gated set is itself floored: the two doors this wave exists for, plus
  // the two the previous one covered.
  assert.ok(gated.length >= 4, `only ${gated.length} screens explain a refusal`);
  for (const must of [
    'app/dashboard/[eventId]/guests/page.tsx',
    'app/dashboard/[eventId]/seating/page.tsx',
    'app/dashboard/[eventId]/guests/checkin/page.tsx',
    'app/dashboard/[eventId]/guests/souvenirs/page.tsx',
  ]) {
    assert.ok(gated.includes(must), `${must} must explain a refusal and does not`);
  }
});
