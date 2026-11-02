/**
 * 🔒 DETAILS › SCHEDULE NEVER SHOWS A PRIVATE MOMENT (plan §11c, Step 5: "Inside each chapter, only moments with
 * Visible to guests on. Supplier times, crew calls and private moments never show.").
 *
 * The part reads chapters now: each invitation chapter, then its moments. Held by rows AND by markup, in all three
 * looks (Programme rail · Clock face · One chapter per screen): handed a list holding private moments, moments kept
 * for one audience, a coordinator's staged moment and a private chapter with a public moment inside it, the part
 * draws none of them — whatever list it was handed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { guestScheduleByChapter, invitationChapters } from './invitation-chapters';
import { BLOCKS, PRIVATE_LABELS, PUBLIC_AND_STRAYS, STAGED } from './invitation-chapters.fixture';

(globalThis as unknown as { React: unknown }).React = React;

const chapters = () => invitationChapters(BLOCKS.filter((b) => b.block_id !== STAGED) as never);

test('1 · the composer keeps the invitation’s chapters and only their public, for-everyone moments', () => {
  const rows = guestScheduleByChapter(chapters(), PUBLIC_AND_STRAYS)!;
  const labels = rows.map((r) => r.label);
  assert.deepEqual(labels, ['Ceremony', 'Procession', 'Reception', 'First dance', 'Cake cutting', 'After party']);
  for (const p of PRIVATE_LABELS) assert.ok(!labels.includes(p), `${p} must never reach the guests' schedule`);
});

test('2 · no chapter on the invitation → null (the part draws the public moments as before)', () => {
  assert.equal(guestScheduleByChapter([], PUBLIC_AND_STRAYS), null);
});

for (const sceneStyle of [null, 'one-per-screen', 'clock-face'] as const) {
  test(`3 · the part, drawn (${sceneStyle ?? 'programme-rail'}), names no private moment and says Venue TBA`, async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { ScheduleWidget } = await import('../app/[slug]/_components/schedule-widget');
    const html = renderToStaticMarkup(
      React.createElement(ScheduleWidget, {
        blocks: PUBLIC_AND_STRAYS,
        chapters: chapters(),
        eventTz: 'Asia/Manila',
        eventType: 'wedding',
        sceneStyle,
      }),
    );
    for (const p of PRIVATE_LABELS) assert.ok(!html.includes(p), `${p} drawn in ${sceneStyle ?? 'the rail'}`);
    assert.ok(html.includes('Ceremony') && html.includes('First dance'));
    // The dial shows a place on a tap; the rail and one-per-screen say it outright.
    if (sceneStyle !== 'clock-face') assert.ok(html.includes('Venue TBA'), 'a chapter with no venue says so');
    assert.ok(html.includes('Time TBA'), 'a chapter with no time says so');
    assert.doesNotMatch(html, /12:00\s?AM/, 'never a guessed midnight');
  });
}
