/**
 * 🚚 A RE-QUOTE KEEPS "QUOTED AFTER SITE CHECK" (owner screenshot 17 Nov 2026, "Debut 18"; controller-approved fix,
 * landed beside CHAT-31 because both edit lib/quote-revision-seed.ts).
 *
 * The sent quote carried "Transportation · Quoted after site check" — no amount, because the supplier prices it after
 * the site check. A null amount otherwise seeds as a freebie, so "Update this quote" turned it into a free
 * "Transportation" line and the revision told the couple transport was free. Now the line is not seeded; the builder
 * reopens in its distance mode and writes the SAME line again on send. No amount changes.
 *
 * 🛡 SABOTAGE (seen RED, then restored): the seed's site-check branch removed → test 1 RED; the builder's transport
 * initialiser back to a bare 'included' → test 2 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SITE_CHECK_TRANSPORT_DETAIL, seedQuoteRevision } from './quote-revision-seed';
import { stripComments } from './strip-comments';

const ROW = {
  public_id: 'S89P-SITECHECK1',
  title: 'Testnayan W1 Lights — your event',
  total_centavos: 2_675_000,
  status: 'accepted',
  sent_at: null,
  rendered_body: '',
  valid_until: null,
  payment_method_ids: [],
  merge_snapshot: null,
  line_items: [
    { basis: 'flat', label: 'Lights & Sound (banquet)', detail: null, card_id: 'card-a', amount_centavos: 2_500_000 },
    { label: 'Stage lights and operator', detail: 'Complimentary', card_id: 'card-a', amount_centavos: null },
    { label: 'Crew meal', detail: '5 crew × ₱350/head', amount_centavos: 175_000 },
    { label: 'Transportation', detail: 'Quoted after site check', amount_centavos: null },
  ],
};

test('1 · the seed does not turn the site-check transport into a free line — it reopens the distance mode', () => {
  const seed = seedQuoteRevision(ROW as never);
  assert.equal(seed.transportAfterSiteCheck, true, 'the seed forgot the transport was quoted after a site check');
  assert.equal(
    seed.lines.some((l) => /^transportation$/i.test(l.label)),
    false,
    'the site-check transport seeded as a line of its own — it would send as "Complimentary"',
  );
  // Anti-vacuity: a true freebie still seeds as one, and no amount moved.
  assert.equal(seed.lines.find((l) => l.label === 'Stage lights and operator')?.free, true);
  assert.equal(seed.lines.reduce((s, l) => s + (l.free ? 0 : l.flatPhp), 0), 26_750);
  // A quote without that line reopens as before.
  const plain = seedQuoteRevision({ ...ROW, line_items: ROW.line_items.slice(0, 3) } as never);
  assert.equal(plain.transportAfterSiteCheck, false);
});

test('2 · the builder reopens in distance mode and writes the SAME line on send', () => {
  const src = stripComments(readFileSync(path.join(__dirname, '..', 'app', '_components', 'proposal-maker.tsx'), 'utf8'));
  assert.match(
    src,
    /useState<Transport>\(\{ mode: revision\?\.transportAfterSiteCheck \? 'distance' : 'included',/,
    'a revision does not reopen the transport it was quoted with',
  );
  assert.match(
    src,
    /transport\.mode === 'distance'\) \{\s*li\.push\(\{ label: 'Transportation', detail: SITE_CHECK_TRANSPORT_DETAIL, amount_centavos: null \}\);/,
    'the distance mode no longer writes the line the seed recognises',
  );
  assert.equal(SITE_CHECK_TRANSPORT_DETAIL, 'Quoted after site check', 'the stored words changed — old quotes would not round-trip');
});
