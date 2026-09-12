/**
 * THE CONVERSATION COLUMN SAYS WHAT IT SHOWS.
 *
 * ── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────
 * The list beside a conversation carries four facts per row — who the couple
 * is, the last thing said, the stage, and whether a reply is owed — and three
 * of the four already have owners elsewhere in this app. Every failure mode
 * here is SILENT: a row whose stage is decided by a second private ranking, a
 * blank preview that reads as a message which failed to load, an "Unanswered"
 * filter that quietly omits the one conversation the whole product is waiting
 * on, or an empty list that says "no conversations" when it means "none match
 * this chip".
 *
 * So the pure rules are pinned by behaviour, and the wiring by source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  CONVERSATION_FILTERS,
  COUPLE_CONVERSATION_FILTERS,
  initialsFor,
  isDateTagWorthShowing,
  isUnanswered,
  matchesCoupleFilter,
  matchesFilter,
  matchesSearch,
  previewFor,
  rowPills,
  serviceTagVaries,
  type ConversationFilter,
  type CoupleConversationFilter,
} from '@/lib/conversation-list';
import { THREAD_STAGE_LABEL, THREAD_STAGE_TONE, type ThreadStage } from '@/lib/vendor-thread-stage';

const WEB = join(import.meta.dirname, '..');
const COLUMN = 'app/_components/chat/conversation-column.tsx';
const COUPLE_PAGE = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const BUILDER = 'lib/conversation-list.ts';
const PAGE = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const BOOKINGS = 'app/vendor-dashboard/bookings/surface.tsx';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the scan read real files (an empty read is a green lie)', () => {
  for (const rel of [COLUMN, BUILDER, PAGE, COUPLE_PAGE, BOOKINGS]) {
    assert.ok(read(rel).length > 500, `${rel} came back empty — the scan is not reading it`);
  }
});

test('🔑 1 · the preview never renders a blank line', () => {
  assert.equal(previewFor({ sender_role: 'vendor', body: 'Yes we are free' }), 'You: Yes we are free');
  assert.equal(previewFor({ sender_role: 'couple', body: 'Are you free?' }), 'Are you free?');
  // A thread with no messages says so. An empty string would leave a blank line
  // that reads as a message which failed to load.
  assert.equal(previewFor(null), 'No messages yet');
  assert.equal(previewFor(undefined), 'No messages yet');
  // A message can legitimately carry no text — an attachment. Same trap.
  assert.equal(previewFor({ sender_role: 'vendor', body: '' }), 'You sent an attachment');
  assert.equal(previewFor({ sender_role: 'couple', body: '   ' }), 'Sent an attachment');
  // Newlines are flattened; a preview is one line by construction.
  assert.equal(previewFor({ sender_role: 'couple', body: 'a\n\nb' }), 'a b');
});

test('🔑 2 · "Unanswered" includes the one conversation the product waits on', () => {
  // A PENDING inquiry is the loudest case: nobody can even write in it until
  // the supplier accepts. Leaving it out would hide it from the chip built to
  // surface it.
  assert.equal(isUnanswered('pending', null), true);
  assert.equal(isUnanswered('pending', { sender_role: 'vendor' }), true);
  // Accepted: whoever spoke last decides.
  assert.equal(isUnanswered('accepted', { sender_role: 'couple' }), true);
  assert.equal(isUnanswered('accepted', { sender_role: 'vendor' }), false);
  // Accepted with nothing said yet is still owed a first word.
  assert.equal(isUnanswered('accepted', null), true);
  // A conversation that ended is owed nothing.
  for (const dead of ['declined', 'withdrawn', 'expired', 'displaced']) {
    assert.equal(isUnanswered(dead, { sender_role: 'couple' }), false, dead);
  }
  assert.equal(isUnanswered(null, null), false);
});

test('🔑 3 · every chip filters to what its own name says', () => {
  const stages: ThreadStage[] = ['inquiry', 'quoted', 'booked', 'completed', 'cancelled'];
  for (const stage of stages) {
    for (const unanswered of [true, false]) {
      const row = { stage, unanswered };
      assert.equal(matchesFilter(row, 'all'), true, `all dropped ${stage}`);
      assert.equal(matchesFilter(row, 'unanswered'), unanswered, `unanswered wrong for ${stage}`);
      for (const other of stages) {
        if (other === 'inquiry') continue; // not offered as a chip
        assert.equal(
          matchesFilter(row, other as ConversationFilter),
          stage === other,
          `${other} chip matched a ${stage} row`,
        );
      }
    }
  }
});

test('🔑 4 · every stage-shaped chip names a stage that exists', () => {
  const axes = new Set(['all', 'unanswered']);
  const stageKeys = new Set(Object.keys(THREAD_STAGE_LABEL));
  const unknown = CONVERSATION_FILTERS
    .map((f) => f.key as string)
    .filter((k) => !axes.has(k) && !stageKeys.has(k));
  assert.deepEqual(unknown, [], 'a chip filters on a stage the ladder does not have');
  assert.ok(CONVERSATION_FILTERS.length >= 6, 'the chip list shrank');
});

test('🔑 5 · search reads what the row actually shows', () => {
  const row = { displayName: 'Cale & Ice', preview: 'You: sent a quote', labels: ['Live band', '18 Dec'] };
  assert.equal(matchesSearch(row, ''), true, 'an empty box must not hide everything');
  assert.equal(matchesSearch(row, '   '), true);
  assert.equal(matchesSearch(row, 'cale'), true);
  assert.equal(matchesSearch(row, 'QUOTE'), true, 'search must be case-insensitive');
  assert.equal(matchesSearch(row, 'live band'), true, 'a label the row shows must be searchable');
  assert.equal(matchesSearch(row, 'catering'), false);
});

test('🔑 6 · one derivation of a couple’s initials, shared with the rail', () => {
  assert.equal(initialsFor('Cale & Ice'), 'CI');
  assert.equal(initialsFor('Ana  Maria  Santos'), 'AM');
  assert.equal(initialsFor(''), 'C', 'a nameless row still needs a letter');
  // The thread page must not keep a second copy — that is how one screen came
  // to show `CI` beside another showing `C`.
  const page = read(PAGE);
  assert.equal(
    (page.match(/initialsFor\(/g) ?? []).length,
    1,
    'the thread page stopped using the shared initials helper',
  );
  assert.ok(
    !/\.map\(\(w: string\) => w\[0\]/.test(page),
    'the thread page grew its own initials derivation again',
  );
});

test('🔑 7 · the column decides nothing — it renders rows built on the server', () => {
  const column = read(COLUMN);
  // No data access in the column: a second read here could rank a row
  // differently from the pill on the thread it opens.
  for (const forbidden of ['createClient', 'createAdminClient', ".from('"]) {
    assert.ok(!column.includes(forbidden), `the column started fetching (${forbidden})`);
  }
  assert.equal((column.match(/matchesFilter\(/g) ?? []).length, 1, 'the column filters some other way');
  assert.equal((column.match(/matchesSearch\(/g) ?? []).length, 1, 'the column searches some other way');
  // ⚠ Two different empties. "No conversations yet" over a filtered list is a
  // much worse sentence than "none are unanswered", and only one of them is true.
  assert.ok(column.includes('No conversations yet'), 'the truly-empty state is gone');
  assert.ok(/Nothing matches/.test(column), 'the searched-empty state is gone');
});

test('🔑 8 · the list ranks through the shared resolver, not its own', () => {
  // ⚠ SCOPED TO THE SUPPLIER'S BUILDER, not the file. The module holds two
  // builders now, and a file-wide count cannot say WHICH one grew a private
  // ranking — it would read 2 whichever half went wrong.
  const whole = read(BUILDER);
  const start = whole.indexOf('export async function buildVendorConversationRows');
  // ⚠ THE WINDOW ENDS AT THE SHARED READER, NOT AT THE COUPLE BUILDER. The
  // three couple-side probes were extracted into `readCoupleStageFacts` when
  // the shortlist bench became their second consumer (2026-09-09), and that
  // helper sits BETWEEN the two builders — so the old bound swept it into the
  // supplier's window and counted its `rowReadsCompleted` as a second copy the
  // supplier had grown. A window that faces the wrong code is a guard that
  // accuses correct work, which is how a real one comes to be edited away.
  const end = whole.indexOf('async function readCoupleStageFacts');
  assert.ok(start > 0 && end > start, 'the supplier builder moved — this window faces nothing');
  const builder = whole.slice(start, end);
  assert.equal(
    (builder.match(/resolveThreadStage\(/g) ?? []).length,
    1,
    'the list stopped ranking through the shared resolver',
  );
  assert.equal(
    (builder.match(/rowReadsCompleted\(/g) ?? []).length,
    1,
    'the list grew its own definition of a finished booking',
  );
  // The probes are batched: one query for the list, never one per row.
  assert.ok(
    /\.in\('event_id', eventIds\)/.test(builder),
    'a stage probe stopped batching — that is three queries per conversation',
  );
  assert.ok(
    !/completion_status\s*===\s*'(confirmed|auto_confirmed)'/.test(builder),
    'the list inlines the completion predicate again',
  );
  assertNamesNoRung(builder, 'supplier');
});

const ALL_STAGES: ThreadStage[] = ['inquiry', 'quoted', 'booked', 'completed', 'cancelled'];

/**
 * ⚠ THIS EXISTS BECAUSE COUNTING THE RESOLVER'S CALLS WAS NOT ENOUGH.
 * Mutation-tested: `const stage = completed.has(id) ? 'completed' : resolveThreadStage({…})`
 * leaves the call site intact — one call, still there — while deciding the
 * answer before it. The count stayed at 1 and the guard stayed green through
 * its own sabotage.
 *
 * A rung's NAME is the thing a private ranking cannot avoid writing. Neither
 * builder has any business spelling one: the five words live in
 * `THREAD_STAGE_LABEL`, and a builder's job is to hand facts to the resolver.
 */
function assertNamesNoRung(window: string, which: string) {
  for (const stage of ALL_STAGES) {
    assert.ok(
      !window.includes(`'${stage}'`) && !window.includes(`"${stage}"`),
      `the ${which} builder wrote the rung "${stage}" itself — that is a second ranking, whatever the resolver call below it says`,
    );
  }
}

test('🔑 9 · "You:" belongs to whoever is READING the column', () => {
  const fromVendor = { sender_role: 'vendor', body: 'Sending the quote now' };
  const fromCouple = { sender_role: 'couple', body: 'Are you free on the 18th?' };
  // The supplier's column.
  assert.equal(previewFor(fromVendor, 'vendor'), 'You: Sending the quote now');
  assert.equal(previewFor(fromCouple, 'vendor'), 'Are you free on the 18th?');
  // The couple's column — the SAME two messages, the other way round. A
  // hard-coded 'vendor' here is how a couple reads their own words as the
  // supplier's, and the supplier's words as their own.
  assert.equal(previewFor(fromCouple, 'couple'), 'You: Are you free on the 18th?');
  assert.equal(previewFor(fromVendor, 'couple'), 'Sending the quote now');
  // Attachments take the same side.
  assert.equal(previewFor({ sender_role: 'couple', body: '' }, 'couple'), 'You sent an attachment');
  assert.equal(previewFor({ sender_role: 'vendor', body: '' }, 'couple'), 'Sent an attachment');
});

test('🔑 10 · the couple’s five chips reach every rung of the ladder', () => {
  // Their words are not the ladder's words, so the mapping is the thing that
  // can rot. A rung no chip reaches is a conversation the couple can only find
  // by scrolling — and would never know was missing.
  const reachable = new Set<ThreadStage>();
  for (const stage of ALL_STAGES) {
    for (const chip of COUPLE_CONVERSATION_FILTERS) {
      if (chip.key !== 'all' && matchesCoupleFilter({ stage }, chip.key)) reachable.add(stage);
    }
  }
  assert.deepEqual(
    [...reachable].sort(),
    [...ALL_STAGES].sort(),
    'a rung of the ladder is reachable from no couple chip',
  );
  // Every stage a chip names must be a stage that exists.
  for (const chip of COUPLE_CONVERSATION_FILTERS) {
    for (const st of chip.stages ?? []) {
      assert.ok(st in THREAD_STAGE_LABEL, `couple chip "${chip.key}" names a stage that does not exist: ${st}`);
    }
  }
  // And each chip shows ONLY what its own name says.
  for (const stage of ALL_STAGES) {
    assert.equal(matchesCoupleFilter({ stage }, 'all'), true, 'All dropped a row');
    assert.equal(matchesCoupleFilter({ stage }, 'quoted'), stage === 'quoted');
    assert.equal(matchesCoupleFilter({ stage }, 'booked'), stage === 'booked');
    assert.equal(matchesCoupleFilter({ stage }, 'waiting'), stage === 'inquiry');
    assert.equal(
      matchesCoupleFilter({ stage }, 'closed'),
      stage === 'completed' || stage === 'cancelled',
      'Closed must mean done with — completed OR cancelled',
    );
  }
  // An unknown chip key must not silently hide the whole list.
  assert.equal(matchesCoupleFilter({ stage: 'booked' }, 'nope' as CoupleConversationFilter), true);
});

test('🔑 11 · a row is never tagless, and an unanswered booking wears both', () => {
  const v = (stage: ThreadStage, unanswered: boolean) =>
    rowPills({ stage, unanswered }, { showUnanswered: true }).map((p) =>
      p.kind === 'unanswered' ? 'Unanswered' : THREAD_STAGE_LABEL[p.stage],
    );
  // The prototype's own first two rows, in order.
  assert.deepEqual(v('booked', true), ['Unanswered', 'Booked']);
  assert.deepEqual(v('inquiry', true), ['Unanswered']);
  // Answered rows name their stage.
  assert.deepEqual(v('booked', false), ['Booked']);
  assert.deepEqual(v('quoted', false), ['Quoted']);
  // ⚠ THE ONE THAT MATTERS: an answered conversation still at Inquiry. Drawing
  // nothing there reads as a tag that failed to load.
  assert.deepEqual(v('inquiry', false), ['Inquiry']);
  for (const stage of ALL_STAGES) {
    for (const unanswered of [true, false]) {
      assert.ok(
        rowPills({ stage, unanswered }, { showUnanswered: true }).length > 0,
        `a ${stage}/${unanswered} row wore no pill at all`,
      );
      // The couple's column never says "Unanswered" — it is the supplier's word
      // for work they owe, and nobody designed its mirror image.
      const couple = rowPills({ stage, unanswered }, { showUnanswered: false });
      assert.deepEqual(couple, [{ kind: 'stage', stage }], `couple pills wrong for ${stage}`);
    }
  }
});

test('🔑 12 · ONE column renders both sides, and it knows both vocabularies', () => {
  const column = read(COLUMN);
  // Two components would be two places a row is drawn — this repo's recurring
  // failure. The couple's page and the supplier's page must mount the same one.
  const vendorPage = read(PAGE);
  const couplePage = read(COUPLE_PAGE);
  for (const [name, src] of [['supplier', vendorPage], ['couple', couplePage]] as const) {
    assert.ok(
      src.includes("from '@/app/_components/chat/conversation-column'"),
      `the ${name} page stopped mounting the shared column`,
    );
    assert.ok(/<ConversationColumn/.test(src), `the ${name} page stopped rendering the column`);
  }
  assert.ok(/side="vendor"/.test(vendorPage), 'the supplier page stopped asking for the supplier chips');
  assert.ok(/side="couple"/.test(couplePage), 'the couple page stopped asking for their own chips');
  // Both chip sets are reachable from the one component.
  assert.ok(column.includes('CONVERSATION_FILTERS'), 'the column lost the supplier chips');
  assert.ok(column.includes('COUPLE_CONVERSATION_FILTERS'), 'the column lost the couple chips');
  assert.equal((column.match(/matchesCoupleFilter\(/g) ?? []).length, 1, 'the column filters the couple some other way');
  assert.equal((column.match(/rowPills\(/g) ?? []).length, 1, 'the column decides its own pills again');
  // The stage pill wears the stage's OWN tone — never a second palette that can
  // disagree with the pill on the thread the row opens.
  assert.ok(
    column.includes('THREAD_STAGE_TONE['),
    'the column stopped using the shared stage tone',
  );
  assert.equal(Object.keys(THREAD_STAGE_TONE).length, ALL_STAGES.length, 'a stage lost its tone');
  // ⚠ An inline span cannot ellipsis — the preview must be a block. The
  // prototype paid a whole revision for this one.
  assert.ok(
    /block truncate/.test(column),
    'the preview stopped being a block — `truncate` cannot ellipsis an inline span',
  );
});

test('🔑 13 · the couple’s side reads with the couple’s own session, batched', () => {
  const builder = read(BUILDER);
  // Bounded at the bench reader below it for the same reason test 8 is bounded
  // at the shared helper above it: `buildBenchStandings` legitimately calls the
  // resolver once of its own, and an open-ended slice would read that as the
  // couple builder ranking twice.
  const couple = builder.slice(
    builder.indexOf('export async function buildCoupleConversationRows'),
    builder.indexOf('export async function buildBenchStandings'),
  );
  assert.ok(couple.length > 500, 'the couple builder is gone');
  // 🔒 No service role on this side. All three stage tables carry a couple_read
  // policy — reaching for admin here would be reading past their own RLS.
  for (const forbidden of ['adminClient', 'createAdminClient', 'service_role']) {
    assert.ok(!couple.includes(forbidden), `the couple builder reached for ${forbidden}`);
  }
  // ⚠ THE THREE PROBES MOVED, AND THE CLAIM DID NOT. They now live in
  // `readCoupleStageFacts` because the shortlist bench became their SECOND
  // consumer (2026-09-09) — a bench card and the conversation it opens
  // disagreeing about the same supplier is the defect this module exists to
  // prevent, so they read the same facts or none. What is still asserted is
  // exactly what was asserted before: one batched query per fact for the whole
  // surface, on the couple's own session. `the-bench-says-where-you-stand.test.ts`
  // pins the helper itself and that BOTH consumers go through it.
  assert.ok(
    couple.includes('readCoupleStageFacts('),
    'the couple builder stopped reading the shared stage facts — it has grown its own probes again',
  );
  const helper = builder.slice(
    builder.indexOf('async function readCoupleStageFacts'),
    builder.indexOf('type CoupleThreadInput'),
  );
  assert.ok(helper.length > 500, 'the shared stage-facts reader is gone');
  assert.equal(
    (helper.match(/\.eq\('event_id', eventId\)/g) ?? []).length,
    3,
    'a couple stage probe stopped batching on the event — that is three queries per row',
  );
  for (const forbidden of ['adminClient', 'createAdminClient', 'service_role']) {
    assert.ok(!helper.includes(forbidden), `the shared stage-facts reader reached for ${forbidden}`);
  }
  // It ranks through the shared resolver, like the other side.
  assert.equal((couple.match(/resolveThreadStage\(/g) ?? []).length, 1);
  assert.equal((helper.match(/rowReadsCompleted\(/g) ?? []).length, 1);
  assertNamesNoRung(couple, 'couple');
  assertNamesNoRung(helper, 'the shared stage-facts reader');
});

test('🔑 14 · a masked supplier’s real name never reaches the column', () => {
  // 🔒 The couple's Messages list and thread header both put every vendor
  // through `resolveVendorDisplayName`; a third surface printing business_name
  // straight would reveal a free vendor's real name before the reveal.
  const couplePage = read(COUPLE_PAGE);
  assert.ok(
    /listDisplayNames\.set\(/.test(couplePage),
    'the couple page stopped resolving the column’s names',
  );
  assert.ok(
    couplePage.includes('resolveVendorDisplayName'),
    'the column’s names stopped going through the anonymity resolver',
  );
  // The column and the builder must not know what a business_name or a logo is.
  for (const rel of [COLUMN, BUILDER]) {
    // ⚠ RAW, not comment-stripped. `stripComments` would swallow a leak written
    // beside a comment, and the point here is that these two files never touch
    // a raw identity field at all.
    const raw = readFileSync(join(WEB, rel), 'utf8');
    for (const field of ['business_name', 'logo_url', 'screen_name', 'name_revealed_at']) {
      assert.ok(!raw.includes(field), `${rel} touches a raw identity field (${field})`);
    }
    // Naming the resolver in a docblock is documentation; CALLING it here would
    // mean this file decides who may be named. Only the call is forbidden.
    assert.ok(
      !/resolveVendorDisplayName\s*\(/.test(read(rel)),
      `${rel} started resolving the name itself`,
    );
  }
});

test('🔑 15 · unread is not unanswered', () => {
  // Two different facts that a single boolean would quietly merge: "somebody
  // spoke since you looked" vs "you owe a reply". The column draws a dot for
  // one and a pill for the other.
  const builder = read(BUILDER);
  assert.ok(/unread: unreadThreadIds\.has\(/.test(builder), 'unread stopped being its own fact');
  assert.equal(
    (builder.match(/unread: unreadThreadIds\.has\(/g) ?? []).length,
    2,
    'one of the two builders stopped reporting unread',
  );
  const column = read(COLUMN);
  assert.ok(/aria-label="Unread"/.test(column), 'the unread dot lost its label');
  // Both pages compare the last word against the viewer\'s own read marker.
  for (const rel of [PAGE, COUPLE_PAGE]) {
    const src = read(rel);
    assert.ok(src.includes("from('chat_thread_reads')"), `${rel} stopped reading the read markers`);
    assert.ok(
      /new Date\(said\) > new Date\(r\.last_read_at\)/.test(src),
      `${rel} stopped comparing the last word to the read marker`,
    );
  }
});

test('🔑 16 · a generated card writes a fact-first line, a person’s own words never get rewritten', () => {
  // Real templates, copied byte-for-byte from where each card is authored —
  // `lib/proposal-send.ts`, `app/_components/negotiation-actions.ts`,
  // `lib/chat-actions.ts` — so this breaks the moment a writer's wording
  // drifts from what this column knows how to shorten.
  assert.equal(
    previewFor({ sender_role: 'vendor', body: '📄 Proposal — “Intimate 50 — your event” · ₱187,500. Tap to review and accept.' }),
    'You: Quote ₱187,500 sent',
  );
  assert.equal(
    previewFor(
      { sender_role: 'vendor', body: '📄 Proposal — “Intimate 50 — your event” · Price on request. Tap to review and accept.' },
      'couple',
    ),
    'Quote Price on request sent',
  );
  assert.equal(
    previewFor({ sender_role: 'couple', body: '📅 Meeting request: Venue walkthrough' }, 'couple'),
    'You: 📅 Meeting: Venue walkthrough',
  );
  assert.equal(
    previewFor({
      sender_role: 'system',
      body: '**Setnayan Exclusive unlocked 🎁** Free engagement shoot: Book within 48 hours and the studio throws in a complimentary engagement session — offer good through the end of the month.',
    }),
    '🎁 Perk: Free engagement shoot',
  );
  // The whole point: the quote line fits the measured ~32-character desktop
  // budget where the raw card body ("📄 Proposal — … Tap to review and
  // accept.") ran to 80+. The meeting line is a shorter WRAPPER around a
  // person-typed label — the wrapper is what shrank; a long label still gets
  // the ellipsis, same as any other person's words.
  assert.ok('You: Quote ₱187,500 sent'.length <= 32, 'the quote line still runs past the desktop budget');
  assert.ok(
    'You: 📅 Meeting: Venue walkthrough'.length < 'You: 📅 Meeting request: Venue walkthrough'.length,
    'the meeting wrapper did not actually shrink',
  );
  // A message a PERSON typed is untouched, even one that starts with a digit
  // or a symbol that could otherwise collide with a card prefix.
  assert.equal(
    previewFor({ sender_role: 'couple', body: 'Can we do a tasting first?' }),
    'Can we do a tasting first?',
  );
  // Already-short generated bodies (the offer card, the attachment fallback)
  // are left exactly as their own writer wrote them — nothing here re-derives
  // what is already a fact-first line.
  assert.equal(previewFor({ sender_role: 'vendor', body: 'Offered: Live Band' }), 'You: Offered: Live Band');
});

test('🔑 17 · a tag that never varies costs a line and says nothing', () => {
  // The couple's own column is not asked this question — see test 13's
  // neighbour, `buildCoupleConversationRows`'s labels contract: every row
  // there is the SAME wedding, so a date tag is never drawn on that side at
  // all, and the service tag legitimately varies vendor to vendor. This is
  // the supplier's OWN inbox: one shop, many weddings.
  assert.equal(serviceTagVaries(['Catering', 'Catering', 'Catering']), false, 'a caterer with only catering inquiries should not tag every row "Catering"');
  assert.equal(serviceTagVaries(['Catering', null, 'Catering']), false, 'nulls must not manufacture a second value');
  assert.equal(serviceTagVaries(['Catering', 'Photography']), true, 'a multi-service inbox is exactly when the tag distinguishes rows');
  assert.equal(serviceTagVaries([]), false, 'an empty inbox has nothing to vary');
  assert.equal(serviceTagVaries([null, undefined]), false);

  const now = Date.parse('2026-09-09T00:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;
  assert.equal(isDateTagWorthShowing(null, now), false);
  assert.equal(isDateTagWorthShowing(undefined, now), false);
  assert.equal(isDateTagWorthShowing('not-a-date', now), false);
  // A date-only column ('2026-12-18') must be read as UTC midnight, the same
  // discipline `dayMonth` documents — not the machine's own timezone.
  assert.equal(isDateTagWorthShowing(new Date(now + 10 * DAY).toISOString().slice(0, 10), now), true, '10 days out is live context');
  assert.equal(isDateTagWorthShowing(new Date(now - 10 * DAY).toISOString().slice(0, 10), now), true, 'recently past is still live context');
  assert.equal(isDateTagWorthShowing(new Date(now + 61 * DAY).toISOString().slice(0, 10), now), false, '61 days out is noise, not context');
  assert.equal(isDateTagWorthShowing(new Date(now - 61 * DAY).toISOString().slice(0, 10), now), false);
  assert.equal(isDateTagWorthShowing(new Date(now + 60 * DAY).toISOString().slice(0, 10), now), true, 'exactly 60 days is still in the window');

  // Wired into the supplier's own row-tag construction — not left as a helper
  // nobody calls.
  const page = read(PAGE);
  assert.ok(page.includes('serviceTagVaries('), 'the supplier page stopped asking whether its service tag varies');
  assert.ok(page.includes('isDateTagWorthShowing('), 'the supplier page stopped gating its date tag by proximity');
  assert.ok(
    /if \(service && showServiceTag\)/.test(page),
    'the service tag stopped being conditional on it actually varying',
  );
});

test('🔑 18 · the OTHER shipped inbox gets the same preview, sender included, and a bounded fetch', () => {
  // `app/vendor-dashboard/bookings/surface.tsx` is a second, independent list
  // over the same threads — the one a supplier's phone nav points at and
  // where every new-inquiry notification lands. It had its own preview logic
  // that rendered `last?.body` raw, with no "You:" and no fact-first
  // shortening, so a couple's question and the supplier's own reply read
  // identically. Fixed by REUSING `previewFor`, not forking a second copy.
  const bookings = read(BOOKINGS);
  assert.ok(
    bookings.includes("from '@/lib/conversation-list'") && bookings.includes('previewFor'),
    'the bookings inbox stopped reusing the one preview builder',
  );
  assert.ok(
    /lastMessagePreview:\s*last\s*\?\s*previewFor\(last, 'vendor'\)\s*:\s*null/.test(bookings),
    'the bookings inbox stopped passing the reader’s role through previewFor',
  );
  // The raw, unprefixed read this replaced must actually be gone, not just
  // shadowed — a second assignment further down would silently win.
  assert.ok(
    !/lastMessagePreview:\s*last\?\.body\s*\?\?\s*null/.test(bookings),
    'the old sender-blind preview line is still there',
  );
  // ⚠ MEASURED: this fetched every message of every thread on every load, with
  // no cap. `.limit(600)` mirrors the ceiling `VendorThreadPage` already
  // accepts for the identical "latest message per thread" read.
  const fetchBlock = bookings.slice(
    bookings.indexOf("from('chat_messages')"),
    bookings.indexOf("from('chat_messages')") + 400,
  );
  assert.ok(/\.order\(\s*'created_at'/.test(fetchBlock), 'the bookings message read lost its newest-first order');
  assert.ok(/\.limit\(\s*600\s*\)/.test(fetchBlock), 'the bookings message read is still unbounded');
});
