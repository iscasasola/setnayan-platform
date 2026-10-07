/**
 * one-link-row-only-for-open.test.ts — "Your one link" (link · Copy · Share +
 * the one QR) renders ONLY for Open · Anyone with the link (owner 2026-10-07:
 * *"this will only show if the settings says one QR link only"*, G27). The two
 * request choices do not show it; the personal choices show Invitations + the
 * Digital Pass instead; the RSVP asks and Reply by show only for "They reply".
 *
 * 🛡 Sabotage: render the one-link row for every choice → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSetup } from './render-setup';

const rows = (html: string) => [...html.matchAll(/data-setup-row="([^"]+)"/g)].map((m) => m[1]);

test('each choice draws exactly its rows', async () => {
  const expected: Record<string, string[]> = {
    list: ['get-in', 'invitations', 'asks', 'reply-by', 'finalize'],
    personal: ['get-in', 'invitations', 'finalize'],
    requests: ['get-in', 'invitations', 'asks', 'reply-by', 'finalize'],
    one_qr_approve: ['get-in', 'invitations', 'finalize'],
    one_qr: ['get-in', 'one-link', 'finalize'],
  };
  for (const [getIn, want] of Object.entries(expected)) {
    const html = await renderSetup({ getIn: getIn as never });
    const got = rows(html);
    console.log(`${getIn}: ${got.join(' · ')}`);
    assert.deepEqual(got, want, `${getIn} draws the wrong rows`);
    assert.equal(html.includes('data-setup-one-qr'), getIn === 'one_qr', `${getIn}: the one QR`);
    assert.equal(html.includes('data-setup-pass'), getIn !== 'one_qr', `${getIn}: the Digital Pass`);
  }
});

test('the one-link row is the link · Copy · Share', async () => {
  const html = await renderSetup({ getIn: 'one_qr' });
  assert.match(html, /setnayan\.com\/cale-ice\/invite/);
  assert.match(html, /aria-label="Copy"/);
  assert.match(html, /aria-label="Share"/);
});
