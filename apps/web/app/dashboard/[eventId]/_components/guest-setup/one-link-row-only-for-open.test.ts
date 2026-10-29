/**
 * one-link-row-only-for-open.test.ts — "Your one link" (link · Copy · Share +
 * the one QR) renders ONLY for Open · Anyone with the link (owner 2026-10-07:
 * *"this will only show if the settings says one QR link only"*, G27). The two
 * request choices do not show it; no choice shows an Invitations row (gone, R4 slice 11 — sending lives on the List)
 * (no pass picture since 2026-10-28 — it lives in Prints); the RSVP asks, How
 * guests answer, Reply by and Replies open · close show only for "They reply".
 *
 * 🛡 Sabotage: render the one-link row for every choice → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSetup } from './render-setup';

const rows = (html: string) => [...html.matchAll(/data-setup-row="([^"]+)"/g)].map((m) => m[1]);

test('each choice draws exactly its rows', async () => {
  const expected: Record<string, string[]> = {
    // ⚙ Guests ⚙ (2026-10-27): Requests to join is a Replies row in every state; Finalize closes the sheet.
    // 🗂 R1 (owner 2026-10-28): How guests answer and Replies open · close joined Replies — "They reply" choices only.
    list: ['get-in', 'asks', 'answer', 'reply-by', 'replies-window', 'requests', 'finalize'],
    personal: ['get-in', 'requests', 'finalize'],
    requests: ['get-in', 'asks', 'answer', 'reply-by', 'replies-window', 'requests', 'finalize'],
    one_qr_approve: ['get-in', 'requests', 'finalize'],
    one_qr: ['get-in', 'one-link', 'requests', 'finalize'],
  };
  for (const [getIn, want] of Object.entries(expected)) {
    const html = await renderSetup({ getIn: getIn as never });
    const got = rows(html);
    console.log(`${getIn}: ${got.join(' · ')}`);
    assert.deepEqual(got, want, `${getIn} draws the wrong rows`);
    assert.equal(html.includes('data-setup-one-qr'), getIn === 'one_qr', `${getIn}: the one QR`);
    assert.equal(html.includes('data-setup-pass'), false, `${getIn}: a pass picture is drawn in Guests ⚙ (it lives in Prints since 2026-10-28)`);
  }
});

test('the one-link row is the link · Copy · Share', async () => {
  const html = await renderSetup({ getIn: 'one_qr' });
  assert.match(html, /setnayan\.com\/cale-ice\/invite/);
  assert.match(html, /aria-label="Copy"/);
  assert.match(html, /aria-label="Share"/);
});
