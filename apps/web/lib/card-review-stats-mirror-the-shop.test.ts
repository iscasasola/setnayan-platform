/**
 * 🔁 A CARD'S HOST NUMBER USES THE SHOP'S OWN FILTER (prototype 6 Nov § 4: "Stars = this card's own trusted average").
 *
 * `vendor_service_trusted_review_stats` (migration 20271316933967) copies the arm's-length filter of
 * `vendor_trusted_review_stats` word for word. If the shop's filter is ever tightened (a new self-dealing rule) and the
 * card's is not, a review the shop's overall refuses would still shine on a card — two numbers that disagree about the
 * same review, each green on its own. This reads the NEWEST definition of the shop's materialized view and requires
 * its filter, comment-stripped and whitespace-folded, inside the card view.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'supabase', 'migrations');

const fold = (sql: string) =>
  sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

function latest(marker: string): string {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const hit = files.filter((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes(marker)).pop();
  assert.ok(hit, `no migration defines ${marker}`);
  return readFileSync(join(MIGRATIONS, hit), 'utf8');
}

test('the card view carries the shop view’s arm’s-length filter, word for word', () => {
  const shopSql = latest('CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS');
  const shopBody = shopSql.slice(shopSql.indexOf('CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS'));
  const from = shopBody.indexOf('AND vr.booked_through_setnayan = true');
  const to = shopBody.indexOf('GROUP BY vp.vendor_profile_id');
  assert.ok(from > 0 && to > from, 'the shop view’s filter moved — re-anchor this guard, do not delete it');
  const shopFilter = fold(shopBody.slice(from, to));

  const cardSql = latest('CREATE VIEW public.vendor_service_trusted_review_stats AS');
  const cardBody = cardSql.slice(cardSql.indexOf('CREATE VIEW public.vendor_service_trusted_review_stats AS'));
  const cardView = fold(cardBody.slice(0, cardBody.indexOf('GROUP BY vr.vendor_profile_id, vr.service_id')));

  assert.ok(cardView.includes(shopFilter), 'the card’s host number has drifted from the shop’s trusted filter');
  assert.ok(cardView.includes('AND vr.service_id IS NOT NULL'), 'a review with no card is on no card');
});
