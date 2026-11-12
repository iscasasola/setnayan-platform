/**
 * the-quote-knows-the-event.test.ts — the quote carries the event brief, once
 * ("Their event", under Start from — it was step 1 until the quote became one
 * screen on 2026-10-14), built from the rail's own rows and the stage-1 facts.
 *
 * ⚖ OWNER, 2026-09-22: *"the vendor must see the basic information we can
 * provide to them to help them build for the event."* The rule (which rows,
 * which stage names the withheld fields) is executed in
 * `lib/quote-event-brief.test.ts`; this pins the mounts and the reads.
 *
 * 🛡 Sabotages watched red: the brief mounted in step 3 instead of step 1 ·
 * the page passing the inquiry city as the AREA · the three stage-1 columns
 * dropped from the events read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const maker = readFileSync(join(ROOT, 'app/_components/proposal-maker.tsx'), 'utf8');
const page = readFileSync(join(ROOT, 'app/vendor-dashboard/messages/[threadId]/page.tsx'), 'utf8');
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

test('the brief is mounted once, under Pick service cards ("Their event"), above the guests & hours header', () => {
  // 2026-10-14 · the quote is ONE screen (simpler supplier dashboard step 4): step 1 became a fold under Start from.
  // 2026-11-08 · THE ONE BUILD (v113, the owner's eleven steps): the fold sits under step 2 "Pick service cards",
  // right above the guests counter it informs — where v113 draws "Their event". Still one fold, still above the header.
  assert.equal(count(maker, /data-testid="quote-event-brief"/g), 1);
  // 2026-11-12 · the guests & hours moved into their own section ABOVE it ("Following their guest list", owner ruling),
  // so the fold now sits under Pick service cards, after the counts it informs.
  const from = maker.search(/<QuoteSection\s+id="cards"/);
  const to = maker.indexOf('</QuoteSection>', from);
  const start = maker.slice(from, to);
  assert.ok(from > 0, 'Pick service cards is gone');
  assert.match(start, /data-quote-their-event=""/, 'the brief lost its "Their event" fold');
  assert.match(start, /data-testid="quote-event-brief"/);
  assert.ok(maker.search(/<QuoteSection\s+id="guests"/) < from, 'the guest list section left its place above the cards');
  assert.equal(count(maker, /data-testid="quote-brief-withheld"/g), 1);
});

test('the page builds the brief from the rail\'s rows, the AREA (never the venue), and passes it once', () => {
  assert.equal(count(page, /brief=\{quoteBrief\}/g), 1);
  const build = page.slice(page.indexOf('const quoteBrief = briefForQuote({'), page.indexOf('const railProps = {'));
  assert.match(build, /facts: customerSummary\.facts/);
  assert.match(build, /area: regionLabel\(event\?\.region\)/);
  assert.doesNotMatch(build, /venue/i, 'no venue reaches the quote while quoting');
  assert.match(build, /lockedCategories: customerSummary\.lockedCategories/);
  assert.match(build, /stage: briefStage/);
  assert.doesNotMatch(page, /resolveEventFeeGate/, 'the conversation never knows the fee gate');
});

test('the events read carries the three stage-1 columns the brief needs', () => {
  assert.match(page, /select\('display_name, event_date, event_type, region, setnayan_ai_active, created_at, budget_band, mood_feel_key, ceremony_type'\)/);
});
