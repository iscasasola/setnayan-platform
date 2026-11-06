/**
 * 🕵️ FOUND-YOU — the words and the wiring (DECISION_LOG 2026-07-27; owner 2026-11-05 "yes this is important").
 * The database half is walked in `tests/db/found-you-at-claim.db.test.ts`; this file holds:
 *   1 · `readFoundYou` — anything that is not a clean FOUND answer is NOT found (fail-safe: no alert);
 *   2 · the supplier's lead alert says when and how often, names the couple's event, carries no contact, no fee,
 *       and says "event", never "celebration";
 *   3 · the couple's nudge says when, discloses that the shop will see it, and says nothing about a fee;
 *   4 · the alert is sent IN-APP only, only after an Approve, only when found — and never by email;
 *   5 · the nudge is read from the couple-only record, once per name search, and drawn under the match.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { foundYouLeadNotice, foundYouNudgeLine, readFoundYou } from './found-you';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const NO_FEE = /\b(fee|charge|sourced|commission|billable|bill)\b/i;

test('1 · only a clean FOUND answer is found', () => {
  assert.deepEqual(readFoundYou({ found: true, first_found_at: '2026-07-12T07:40:00Z', view_count: 5 }), {
    found: true,
    firstFoundAt: '2026-07-12T07:40:00Z',
    viewCount: 5,
  });
  for (const raw of [
    null,
    undefined,
    'found',
    {},
    { found: false, why: 'new_account' },
    { found: 'true', first_found_at: '2026-07-12T07:40:00Z', view_count: 5 },
    { found: true, first_found_at: 'not a date', view_count: 5 },
    { found: true, first_found_at: '2026-07-12T07:40:00Z', view_count: 0 },
    { found: true, view_count: 3 },
  ]) {
    assert.deepEqual(readFoundYou(raw), { found: false }, `should not be found: ${JSON.stringify(raw)}`);
  }
});

test('2 · the lead alert says when, how often and for which event — no contact, no fee', () => {
  const n = foundYouLeadNotice({
    eventId: 'e1',
    eventName: 'Ice & Claire',
    eventType: 'wedding',
    eventDate: '2027-02-14',
    // 23:30 UTC on 11 Jul is 12 Jul in Manila — the alert names the Manila day.
    firstFoundAt: '2026-07-11T23:30:00Z',
    viewCount: 5,
  });
  assert.equal(n.title, 'Ice & Claire found you on Setnayan');
  assert.match(n.body, /July 12, 2026/);
  assert.match(n.body, /5 times/);
  assert.match(n.body, /their wedding on February 14, 2027/);
  assert.equal(n.relatedUrl, '/vendor-dashboard/clients/e1');
  assert.doesNotMatch(n.title + n.body, NO_FEE);
  assert.doesNotMatch(n.title + n.body, /celebration/i);
  assert.doesNotMatch(n.title + n.body, /@|\+?63\d|09\d{9}/, 'no contact detail');

  const bare = foundYouLeadNotice({ eventId: 'e2', eventName: null, eventType: 'unspecified', eventDate: null, firstFoundAt: '2026-07-12T00:00:00Z', viewCount: 1 });
  assert.equal(bare.title, 'A couple found you on Setnayan');
  assert.match(bare.body, /looked once before adding you to their event\./);
});

test('3 · the couple nudge says when, discloses the shop will see it, and says nothing about a fee', () => {
  const line = foundYouNudgeLine('2026-07-11T23:30:00Z');
  assert.equal(line, 'You found them on Setnayan on July 12, 2026. If they join from your link, they will see that.');
  assert.doesNotMatch(line, NO_FEE);
  assert.doesNotMatch(line, /celebration/i);
});

test('4 · the lead alert is in-app only, sent only after an Approve that found them', () => {
  const src = read('app/dashboard/[eventId]/access-requests/actions.ts');
  const fn = src.slice(src.indexOf('async function answerClaimAccess'));
  assert.match(fn, /approve && result\.granted \? readFoundYou\(/, 'only an Approve that granted can send it');
  assert.match(fn, /if \(found\.found\) \{/, 'only when found');
  assert.match(fn, /emitNotification\(\{ userId: ask\.requester_user_id, type: 'found_you_lead'/);
  const emit = read('lib/notification-emit.ts');
  const start = emit.indexOf('const EMAIL_ENABLED_TYPES');
  const allow = emit.slice(start, emit.indexOf(']);', start));
  assert.ok(start >= 0, 'EMAIL_ENABLED_TYPES moved — re-anchor this test');
  assert.doesNotMatch(allow, /found_you_lead/, 'no new emails (owner)');
});

test('5 · the nudge reads the couple-only record once per name search and is drawn under the match', () => {
  const actions = read('app/dashboard/[eventId]/vendors/actions.ts');
  const search = actions.slice(
    actions.indexOf('export async function searchMarketplaceVendorsByName'),
    actions.indexOf('export async function', actions.indexOf('export async function searchMarketplaceVendorsByName') + 10),
  );
  const reads = search.match(/\.from\('event_vendor_found'\)/g) ?? [];
  assert.equal(reads.length, 1, 'one read per search');
  assert.match(search, /await supabase\s*\.from\('event_vendor_found'\)/, "under the couple's own session (RLS), never the admin client");
  assert.match(search, /found_on: foundOn\.get\(/);
  const walk = read('app/dashboard/[eventId]/_components/add-your-own-walk.tsx');
  assert.match(walk, /m\.found_on \? \(/);
  assert.match(walk, /foundYouNudgeLine\(m\.found_on\)/);
});
