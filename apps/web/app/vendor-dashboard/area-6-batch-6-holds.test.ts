/**
 * Final check 25 Nov, area 6, batch 6 (plan A1–A3 rows still open) — each claim held by the code that makes it.
 * A6-19 · A6-29 · A6-52 · A6-57 (UI half; the SQL half is tests/db/the-supplier-group-counts-who-counts) ·
 * A6-B10 · A6-B19.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { groupCounted } from '@/lib/their-event';
import { NumbersPart } from '@/app/vendor-dashboard/clients/[eventId]/_components/their-event-parts';

// The part's JSX compiles to React.createElement under the test runner.
(globalThis as { React?: unknown }).React = React;

const raw = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('A6-52 · a schedule row says no "View" that does nothing', () => {
  assert.doesNotMatch(read('app/vendor-dashboard/clients/[eventId]/_components/their-event-part-body.tsx'), />View</);
});

test('A6-B19 · the Numbers sheet adds up: Coming + Maybe + No reply + Can’t come = Invited, all four drawn', () => {
  const pax = { invited: 20, attending: 9, maybe: 4, pending: 5, declined: 2 };
  assert.equal(pax.attending + pax.maybe + pax.pending + pax.declined, pax.invited);
  const t = text(renderToStaticMarkup(React.createElement(NumbersPart, { pax, group: null })));
  for (const [word, n] of [['Invited', 20], ['Coming', 9], ['Maybe', 4], ['No reply', 5], ['Can’t come', 2]] as const) {
    assert.match(t, new RegExp(`${word} ${n}\\b`), `${word} ${n} is not drawn`);
  }
});

test('A6-57 · the group’s number is the reader’s `counted`, never every row', () => {
  const guests = [
    { name: 'A', rsvp: 'attending', diet: null },
    { name: 'B', rsvp: 'declined', diet: null },
    { name: 'C', rsvp: null, diet: null },
  ];
  assert.equal(groupCounted({ counted: 7, guests }), 7, 'the database’s count wins');
  assert.equal(groupCounted({ counted: null, guests }), 2, 'an older answer still leaves the declined out');
  const t = text(
    renderToStaticMarkup(
      React.createElement(NumbersPart, {
        pax: { invited: 3, attending: 1, maybe: 0, pending: 1, declined: 1 },
        group: { status: 'ok', label: 'Kusina', booked: 2, counted: 2, guests },
      }),
    ),
  );
  assert.match(t, /Kusina: 2 in your group/);
});

test('A6-19 · On the day reads the media cap from lib/editorial-vendor-media — no second number', () => {
  const src = read('app/vendor-dashboard/on-the-day/page.tsx');
  assert.doesNotMatch(src, /MAX_MEDIA_PER_TYPE = \d/, 'a second media-cap number');
  assert.match(src, /const MAX_MEDIA_PER_TYPE = MAX_PER_TYPE;/);
  assert.doesNotMatch(src, /up to 3/, 'the cap is typed as words instead of read from the constant');
  assert.equal((src.match(/up to \$\{formatCount\(MAX_MEDIA_PER_TYPE\)\}/g) ?? []).length, 2);
});

test('A6-29 · the lock page says a refused date-options or shortlist read — never a silent "changes your date"', () => {
  const src = read('app/vendor/lock/[token]/page.tsx');
  assert.match(src, /data: metaRows, error: metaError/);
  assert.match(src, /const message = metaUnread\s*\?\s*`Locking in sets your event date to \$\{fmt\}\. We couldn’t check it against your date options\.`/);
  assert.match(src, /data: rows, error \} = await adminClient\s*\.from\('event_vendors'\)/);
  assert.match(src, /compat === null\s*\?\s*'We couldn’t check whether your shortlisted suppliers are free then\.'/);
  assert.doesNotMatch(src, /wedding date/, 'the date is the event’s, whatever the event type');
});

test('A6-B10 · a booked client gets no inquiry card and no "Sending our price now"', () => {
  assert.match(read('app/vendor-dashboard/clients/[eventId]/page.tsx'), /const inquiryFacts = threadId && !isBooked/);
  const thread = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(thread, /const lastFromCouple = lastThreadMessage\?\.sender_role === 'couple' && railStage !== 'booked';/);
});
