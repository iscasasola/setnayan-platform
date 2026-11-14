/**
 * the-w2-re-walk-holds.test.ts — the couple (W2) and admin findings the 14 Nov re-walk found STILL BROKEN on live
 * c0c8ff4, one guard each. Run from apps/web: npx tsx --test lib/the-w2-re-walk-holds.test.ts
 * (The onboarding cards — F-W2-04 · 07 · 08 · 09 — are held by `wedding-cards.render.test.ts`, rendered.)
 *
 * SABOTAGE — every test below was run against origin/main's files (the fix reverted) and went RED before commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { papicCaptureCost } from '@/lib/papic-cameras-pure';
import { displayChallengePrompt } from '@/lib/papic-missions';
import { eventWordFilters } from '@/lib/ugat/data-pure';
import { displayAccountEmail, isErasedEmail } from '@/lib/erasure/display-email';
import { invitationWasSent, isToInvite } from '@/lib/guest-roster-view';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAPIC = 'app/dashboard/[eventId]/studio/papic';

test('F-W2-31 · an added photo says what it costs, read from papicCaptureCost — never "a credit, the same as a camera shot"', async () => {
  const { uploadPhotoCostWords, creditsCount } = await import(`@/${PAPIC}/_lib/upload-credits`);
  const cost = papicCaptureCost('photo', null, 'upload');
  assert.ok(cost > 1, 'the upload price is the camera price × the upload multiplier');
  assert.equal(uploadPhotoCostWords(), `Each photo added uses ${creditsCount(cost)}.`);
  for (const f of [`${PAPIC}/_components/uploads-open-choice.tsx`, `${PAPIC}/_components/papic-outcome-banners.tsx`]) {
    const src = code(f);
    assert.doesNotMatch(src, /uses a credit|same as a camera shot/, `${f} types a one-credit price`);
    assert.match(src, /uploadPhotoCostWords\(\)/, `${f} does not ask the price`);
  }
});

test('F-W2-25 · a guest marked Attending with nothing sent is never called "invited"', async () => {
  const marked = { role: 'guest', rsvp_status: 'attending', invitation_sent_at: null } as never;
  assert.equal(isToInvite(marked), false, 'an answered guest is not queued (owner 2026-10-29)');
  assert.equal(invitationWasSent(marked), false, 'an answer is not a send');
  assert.equal(invitationWasSent({ invitation_sent_at: '2026-10-01T00:00:00Z' }), true);

  const { renderGuestsScreen, guestRow } = await import('@/app/dashboard/[eventId]/guests/_components/render-guests-screen');
  const html = await renderGuestsScreen({ guests: [guestRow({ role: 'bride' }), guestRow({ rsvp_status: 'attending', invitation_sent_at: null })] });
  assert.doesNotMatch(html, /Everyone invited/, 'the card says everyone was invited when nobody was sent one');
  assert.match(html, /Nobody left to invite/);
  const sent = await renderGuestsScreen({ guests: [guestRow({ role: 'bride' }), guestRow({ rsvp_status: 'attending' })] });
  assert.match(sent, /Everyone invited/, 'a list that WAS sent its invitations stopped saying so');

  const run = code('app/dashboard/[eventId]/guests/send/_components/send-run.tsx');
  assert.match(run, /sendable\.every\(\(g\) => sentNow\(g\)\)\s*\?\s*'Everyone has their invite\.'/, 'the run says "has their invite" without checking a send');
  assert.doesNotMatch(code('app/dashboard/[eventId]/guests/_components/guests-screen.tsx'), /already invited/);
});

test('F-W2-15 · Home runs the checklist reconcile before it lists To do, and reads again when it ticked something', () => {
  const home = code('lib/home-control.server.ts');
  assert.match(home, /AUTO_COMPLETABLE_KEYS\.has\(t\.templateKey\)/, 'Home does not look for an auto-tickable open task');
  assert.match(home, /await ensureChecklistSeeded\(eventId\)/, 'Home never runs the reconcile — answered tasks stay listed');
  assert.match(home, /if \(changed > 0\) \{\s*agenda = await readAgenda\(\);/, 'Home does not read again after the reconcile');
  assert.match(code('app/dashboard/[eventId]/checklist-actions.ts'), /return inserted \+ flipped;/, 'the reconcile hides what it ticked');
});

test('F-W2-16 · Home\'s ⓘ lines are plain words, not the implementation', () => {
  const all = ['home-todo-list.tsx', 'home-control-row.tsx', 'home-control-faces.ts']
    .map((f) => code(`app/dashboard/[eventId]/_components/${f}`))
    .join('\n');
  assert.doesNotMatch(all, /never repeated here|Maker: design the page|Pick what shows chooses|Planning Stage\./);
});

test('F-W2-34 · /memories has no gesture manual and no "Blank = …"', () => {
  const gallery = code('app/_components/memories/event-memories-gallery.tsx');
  assert.doesNotMatch(gallery, /Pinch to change the columns|change the columns|remembered on this device/);
  assert.doesNotMatch(code(`${PAPIC}/_components/guest-allotments-choice.tsx`), /Blank =/);
});

test('F-W2-33 · a challenge prompt is never drawn with its raw {who} / {host} token', () => {
  const out = displayChallengePrompt('Brag about {who} for ten seconds — {hosts} day, {host}, this {event}.');
  assert.doesNotMatch(out, /[{}]/);
  const sheet = code(`${PAPIC}/_components/challenge-add-sheet.tsx`);
  assert.equal((sheet.match(/displayChallengePrompt\(/g) ?? []).length, 3, 'a prompt in the add sheet is drawn raw');
  assert.doesNotMatch(sheet, /\{(?:r|m|replacing)\.prompt\}/);
  assert.match(code(`${PAPIC}/_components/challenge-card-row.tsx`), /aria-label=\{displayChallengePrompt\(m\.prompt\)\}/);
  assert.match(code('lib/live-wall.ts'), /prompt: displayChallengePrompt\(mission\.prompt\)/, 'the live wall shows the stored token');
});

test('F-W2-36 · no "Needs wiring" / "tagged" instrumentation words on the performance page', () => {
  const words = code('app/admin/app-performance/_components/charts.tsx') + code('app/admin/app-performance/_surfaces/overview-surface.tsx');
  assert.doesNotMatch(words, /Needs wiring|Needs-wiring|is tagged|instrumentation/);
});

test('F-W2-37 · an event is found word by word, by name, address or public id — the box and the list alike', () => {
  const f = eventWordFilters('Wanda Indigo');
  assert.equal(f?.length, 2, '"Wanda Indigo" must find "Wanda & Indigo"');
  assert.match(f![0]!, /display_name\.ilike\.%Wanda%,slug\.ilike\.%Wanda%,public_id\.ilike\.%Wanda%/);
  assert.deepEqual(eventWordFilters('Wanda & Indigo'), f, 'the ampersand is not a word');
  for (const clause of eventWordFilters('Cruz, Maria') ?? []) assert.equal(clause.split(',').length, 3, 'a comma broke the filter');
  assert.equal(eventWordFilters('  '), null);
  assert.match(code('lib/ugat/data.ts'), /eventWordFilters\(q\)[\s\S]{0,200}logQueryError\('ugat search \(events\)'/);
  assert.match(code('app/admin/accounts/_surfaces/events-surface.tsx'), /eventWordFilters\(q\)/);
});

test('F-W2-38 · the admin events table fits 390: Event · Date · Actions on a phone', () => {
  const src = code('app/admin/accounts/_surfaces/events-surface.tsx');
  assert.doesNotMatch(src, /minWidth="46rem"/);
  for (const h of ['Guests', 'Face tagging']) {
    assert.match(src, new RegExp(`header: '${h}',\\s*align: 'right',\\s*hideBelow: 'md'`), `${h} still shows at 390`);
  }
  assert.doesNotMatch(src, /header: 'Date',\s*hideBelow/, 'the date was hidden instead of fitted');
});

test('F-W2-39 · an erased account reads "Erased account", never its tombstone address', () => {
  const tomb = 'erased+5f0c2c8e-1111-4a4a-9b9b-0123456789ab@erased.setnayan.invalid';
  assert.equal(isErasedEmail(tomb), true);
  assert.equal(displayAccountEmail(tomb), 'Erased account');
  assert.equal(displayAccountEmail('ana@example.com'), 'ana@example.com');
  assert.equal(displayAccountEmail(null), null);
  // The tombstone the purge writes is the one the helper knows.
  assert.match(readFileSync(join(WEB, 'lib/erasure/purge.ts'), 'utf8'), /erased\+\$\{targetUserId\}@erased\.setnayan\.invalid/);
  for (const f of ['app/admin/users/[userId]/page.tsx', 'app/admin/account-deletions/page.tsx', 'app/admin/accounts/_surfaces/vendors-surface.tsx', 'app/admin/vendors/[vendorProfileId]/team/page.tsx', 'app/admin/concierge-abuse/page.tsx']) {
    assert.match(code(f), /displayAccountEmail\(/, `${f} prints the raw email`);
  }
});

test('supplier search · the word being typed survives a remount of the box', async () => {
  const { holdTyping, typingHeld } = await import('@/app/_components/search-box');
  holdTyping('/vendor-dashboard/customers|q', 'Ana', 1_000);
  assert.equal(typingHeld('/vendor-dashboard/customers|q', 2_000), 'Ana', 'a box mounted a second later starts empty');
  assert.equal(typingHeld('/vendor-dashboard/customers|q', 10_000), null, 'an old word is held forever');
  const src = code('app/_components/search-box.tsx');
  assert.match(src, /useState\(\(\) => typingHeld\(key\) \?\? defaultValue\)/, 'a new box starts from the server\'s word');
  assert.match(src, /holdTyping\(key, v\);/);
});
