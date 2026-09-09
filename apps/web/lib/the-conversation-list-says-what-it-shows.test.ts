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
  isUnanswered,
  matchesCoupleFilter,
  matchesFilter,
  matchesSearch,
  previewFor,
  rowPills,
  type ConversationFilter,
  type CoupleConversationFilter,
} from '@/lib/conversation-list';
import { THREAD_STAGE_LABEL, THREAD_STAGE_TONE, type ThreadStage } from '@/lib/vendor-thread-stage';

const WEB = join(import.meta.dirname, '..');
const COLUMN = 'app/_components/chat/conversation-column.tsx';
const COUPLE_PAGE = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const BUILDER = 'lib/conversation-list.ts';
const PAGE = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the scan read real files (an empty read is a green lie)', () => {
  for (const rel of [COLUMN, BUILDER, PAGE, COUPLE_PAGE]) {
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
  const end = whole.indexOf('export async function buildCoupleConversationRows');
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
  const couple = builder.slice(builder.indexOf('export async function buildCoupleConversationRows'));
  assert.ok(couple.length > 500, 'the couple builder is gone');
  // 🔒 No service role on this side. All three stage tables carry a couple_read
  // policy — reaching for admin here would be reading past their own RLS.
  for (const forbidden of ['adminClient', 'createAdminClient', 'service_role']) {
    assert.ok(!couple.includes(forbidden), `the couple builder reached for ${forbidden}`);
  }
  // One query per fact for the WHOLE column, keyed on the one event.
  assert.equal(
    (couple.match(/\.eq\('event_id', eventId\)/g) ?? []).length,
    3,
    'a couple stage probe stopped batching on the event — that is three queries per row',
  );
  // It ranks through the shared resolver, like the other side.
  assert.equal((couple.match(/resolveThreadStage\(/g) ?? []).length, 1);
  assert.equal((couple.match(/rowReadsCompleted\(/g) ?? []).length, 1);
  assertNamesNoRung(couple, 'couple');
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
