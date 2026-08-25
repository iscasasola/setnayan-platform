/**
 * samahan-notify.test.ts — the two rules that decide who hears a samahan.
 *
 * The fan-out itself is a database write; what is worth proving without one is
 * the decision in front of it, so `selectSamahanRecipients` is pure and this
 * file exercises it directly:
 *
 *   · you are never notified about your own post;
 *   · a person already holding an unread notice for this samahan is skipped, so
 *     twenty messages in a minute ring once, not twenty times;
 *   · a REFUSED collapse read rings EVERYBODY. Supabase resolves with { error }
 *     and an empty list, which is indistinguishable from "nobody is ringing".
 *     Reading that as "everyone is already notified" would silence the whole
 *     feature the moment the query broke — and the symptom would be an absence,
 *     which is the one symptom nobody sees.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  COLLAPSE_WINDOW_MS,
  selectSamahanRecipients,
  samahanNoticeCopy,
  samahanNoticeUrl,
} from './samahan-notice-rules';

const NOW = Date.parse('2026-08-25T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

const ANA = 'ana';
const BEN = 'ben';
const CARI = 'cari';

test('the person who posted is never told about their own post', () => {
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, CARI], ANA, [], NOW), [BEN, CARI]);
});

test('a person already holding a recent unread notice is skipped', () => {
  const recent = (id: string) => ({ userId: id, createdAt: minutesAgo(5) });
  assert.deepEqual(
    selectSamahanRecipients([ANA, BEN, CARI], ANA, [recent(BEN)], NOW),
    [CARI],
  );
  assert.deepEqual(
    selectSamahanRecipients([ANA, BEN, CARI], ANA, [recent(BEN), recent(CARI)], NOW),
    [],
  );
});

test('an OLD unread notice does not mute the group forever', () => {
  // The tray's Open button does not mark anything read — that is a separate
  // press many people never make. Collapsing on "has any unread notice" would
  // therefore have silenced a samahan permanently for anybody with one stale
  // notice, and the symptom would have been an absence nobody can see.
  const stale = { userId: BEN, createdAt: minutesAgo(COLLAPSE_WINDOW_MS / 60_000 + 1) };
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, CARI], ANA, [stale], NOW), [BEN, CARI]);
});

test('an unreadable timestamp rings rather than mutes', () => {
  const broken = { userId: BEN, createdAt: 'not a date' };
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, CARI], ANA, [broken], NOW), [BEN, CARI]);
});

test('a refused collapse read rings everybody rather than nobody', () => {
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, CARI], ANA, null, NOW), [BEN, CARI]);
});

test('a duplicated or empty roster row cannot double-ring or crash', () => {
  assert.deepEqual(selectSamahanRecipients([ANA, BEN, BEN, ''], ANA, [], NOW), [BEN]);
});

test('the notice points where the thing actually is, and that is the collapse key', () => {
  // Same string both places on purpose: the collapse asks "is there already an
  // unread notice at this URL?", so a URL that drifts from the one written is a
  // collapse that never collapses.
  assert.equal(samahanNoticeUrl('c1', 'story'), '/dashboard/samahan/c1');
  assert.equal(samahanNoticeUrl('c1', 'message'), '/dashboard/samahan/c1?tab=usapan');
});

test('the words say who, where, and how long it will be there', () => {
  const story = samahanNoticeCopy('story', 'Ana', 'Barkada');
  assert.match(story.title, /Ana/);
  assert.match(story.title, /Barkada/);
  assert.match(story.body, /24 hours/);

  const message = samahanNoticeCopy('message', 'Ana', 'Barkada');
  assert.match(message.title, /wrote in Barkada/);

  // A missing display name must never render as a blank or "undefined".
  const anon = samahanNoticeCopy('story', '  ', '');
  assert.match(anon.title, /^Someone added to your samahan$/);
});

test('nothing can carry the message text into a notice', () => {
  // 🪤 THE FIRST VERSION OF THIS TEST COULD NOT FAIL. It built a long string,
  // never passed it to anything, and then asserted the output did not contain
  // it — of course it did not: `samahanNoticeCopy` has no parameter that could
  // carry a message. Three green assertions guarding nothing. An audit of my own
  // merged work caught it.
  //
  // What actually keeps the words out is the SHAPE — the copy function has no
  // slot for them, and neither caller offers one — so that is what this asserts.
  // It matters because taking a message down is a SOFT delete: a preview copied
  // into a notification row has no inverse and would outlive the take-down in
  // every recipient's tray.
  assert.equal(
    samahanNoticeCopy.length,
    3,
    'samahanNoticeCopy grew a parameter — if it is the message text, take it back out',
  );

  const notify = stripComments(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'samahan-notify.ts'), 'utf8'),
  );
  const callAt = notify.indexOf('samahanNoticeCopy(');
  assert.ok(callAt > 0, 'samahan-notify.ts no longer calls samahanNoticeCopy');
  const call = notify.slice(callAt, notify.indexOf(');', callAt));
  // Three arguments, and the third is the samahan name — a fourth would be the
  // one thing this rule forbids.
  assert.equal(
    call.split(',').filter((part) => part.trim().length > 0).length,
    3,
    `samahanNoticeCopy is being called with something extra: ${call}`,
  );

  // And the fan-out is only ever told WHICH KIND of thing happened, never what
  // it said: both call sites pass exactly communityId, actorUserId and kind.
  for (const caller of [
    join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'api', 'samahan', 'story', 'route.ts'),
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'app',
      'dashboard',
      '(account)',
      'samahan',
      'actions.ts',
    ),
  ]) {
    const src = stripComments(readFileSync(caller, 'utf8'));
    const at = src.indexOf('notifySamahanCoMembers({');
    assert.ok(at > 0, `${caller} no longer calls the fan-out`);
    const args = src.slice(src.indexOf('{', at) + 1, src.indexOf('})', at));
    // 🪤 NOT A WORD BAN — the first cut of this rejected anything containing
    // "message", and `kind: 'message'` is the correct, required argument. A
    // guard that cries wolf teaches you to skim past the one time it is right.
    // Assert the SHAPE instead: exactly these three keys, no fourth.
    const keys = args
      .split(',')
      .map((part) => part.split(':')[0]?.trim())
      .filter((k) => k && k.length > 0)
      .sort();
    assert.deepEqual(
      keys,
      ['actorUserId', 'communityId', 'kind'],
      `${caller} hands the fan-out something beyond which samahan, who acted and what kind: ${args}`,
    );
  }
});
