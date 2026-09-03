/**
 * every-film-of-your-day.test.ts
 *
 * 🎞 THE ₱2,500 PAGE PROMISED THIS BEFORE IT EXISTED.
 *
 * Migration `20271194920190` rewrote the LIVE_STUDIO description to the owner's ruling:
 * "One unlock covers the whole event — unlimited streams, unlimited video-link uploads,
 * no day limit." The first and third were true. The second was not — nothing let a
 * COUPLE attach a video link. `video-links-editor.tsx` is vendor-dashboard only.
 *
 * These pin the four ways the feature could quietly stop being true.
 *
 * 🛡 Comments stripped with the repo's ONE canonical stripper — a new file with its own
 * would fail `scripts/lint-one-comment-stripper.mjs`.
 *
 * Run from apps/web: `npx tsx --test lib/every-film-of-your-day.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { filmInsertFromLink, filmFromRow, filmsFromRows, FILM_LABEL_MAX } from './event-films';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => stripComments(readFileSync(resolve(HERE, '..', p), 'utf8'));

test('⭐ a pasted YouTube or Vimeo link becomes a storable film', () => {
  const yt = filmInsertFromLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Same-Day Edit');
  assert.equal(yt?.provider, 'youtube');
  assert.equal(yt?.video_id, 'dQw4w9WgXcQ');
  assert.equal(yt?.label, 'Same-Day Edit');

  // The unlisted share form is the one a videographer actually sends. Losing the hash
  // silently turns a working private link into a video nobody can play.
  const vi = filmInsertFromLink('https://vimeo.com/76979871/abc123def4');
  assert.equal(vi?.provider, 'vimeo');
  assert.equal(vi?.video_id, '76979871');
  assert.equal(vi?.video_hash, 'abc123def4', 'the unlisted Vimeo hash was dropped');
});

test('🔴 anything that is not YouTube or Vimeo is refused, not stored', () => {
  // Providers are owner-locked (2026-07-03). A Drive link reaching an iframe src is the
  // failure this guards; returning null is what keeps it out of the table entirely.
  for (const bad of [
    'https://drive.google.com/file/d/abc/view',
    'https://example.com/video.mp4',
    'javascript:alert(1)',
    '',
    null,
  ]) {
    assert.equal(filmInsertFromLink(bad), null, `${String(bad)} was accepted`);
  }
});

test('🔒 a stored row is RE-VALIDATED before it reaches an iframe', () => {
  // The row was checked on write, but values also arrive by admin edit, restore, or
  // migration — and this is the last step before an embed. Same posture panood-watch.ts
  // takes for the live replay.
  assert.equal(filmFromRow({ provider: 'ftp', video_id: 'x', video_hash: null, label: null }), null);
  assert.equal(filmFromRow({ provider: 'youtube', video_id: 'not a real id!!', video_hash: null, label: null }), null);

  const ok = filmFromRow({ provider: 'youtube', video_id: 'dQw4w9WgXcQ', video_hash: null, label: null });
  assert.match(ok!.embedUrl, /youtube-nocookie\.com\/embed\//, 'the embed is not the nocookie host');

  const vimeo = filmFromRow({ provider: 'vimeo', video_id: '76979871', video_hash: 'abc123def4', label: null });
  assert.match(vimeo!.embedUrl, /player\.vimeo\.com\/video\/76979871\?dnt=1&h=abc123def4/, 'unlisted Vimeo loses its hash on the way out');
});

test('⭐ an unusable row is DROPPED, never rendered as a broken frame', () => {
  const films = filmsFromRows([
    { provider: 'youtube', video_id: 'dQw4w9WgXcQ', video_hash: null, label: 'Prenup' },
    { provider: 'ftp', video_id: 'x', video_hash: null, label: 'bad' },
  ]);
  assert.equal(films.length, 1, 'a bad row survived into the render list');
  assert.equal(films[0]!.label, 'Prenup');
});

test('🔒 the label cap matches the column CHECK — both refuse the same input', () => {
  // If these drift, the UI accepts what the database then rejects, and the couple loses
  // what they typed to an error they cannot act on.
  const mig = src('../../supabase/migrations/20271200391597_couples_attach_every_film_of_their_day.sql');
  assert.match(mig, new RegExp(`length\\(label\\) <= ${FILM_LABEL_MAX}`), 'lib and migration disagree on the label cap');
  const long = filmInsertFromLink('dQw4w9WgXcQ', 'x'.repeat(FILM_LABEL_MAX + 40));
  assert.equal(long?.label?.length, FILM_LABEL_MAX, 'an over-long label is not trimmed to the column cap');
});

test('🔴 the films table carries RLS, and grants anon nothing', () => {
  // The public story page reads through createAdminClient() (service role), so anon needs
  // no policy — and giving it one would widen the public surface for a read that already
  // happens as service_role.
  const mig = src('../../supabase/migrations/20271200391597_couples_attach_every_film_of_their_day.sql');
  // 🪤 ASSERT ON THE POLICY, NOT THE FILE. `stripComments` strips JS `//` and `/* */`;
  // SQL uses `--`, so a .sql file reaches these assertions WITH ITS PROSE INTACT. The
  // first version of this test matched `current_event_ids()` anywhere in the file and
  // passed on three occurrences that were all inside comments explaining which helper
  // NOT to use — green while asserting nothing. Slice the CREATE POLICY statement.
  const policy = mig.slice(mig.indexOf('CREATE POLICY event_films_host_all'));
  assert.ok(policy.length > 0, 'the host policy is gone');

  assert.match(mig, /ENABLE ROW LEVEL SECURITY/, 'RLS is not enabled on event_films');
  // current_COUPLE_event_ids, not current_event_ids: the latter returns events for ANY
  // member_type, so a policy named `_host_` using it would let a GUEST attach films to
  // the couple's story. `couple-host-policy-scope.db.test.ts` caught exactly that here.
  assert.match(policy, /current_couple_event_ids\(\)/, 'the host policy is not couple-scoped');
  assert.ok(
    !/[^_]current_event_ids\(\)/.test(policy),
    'the host policy resolves through the member-wide helper — a guest would get couple access',
  );
  assert.ok(!/TO anon/i.test(mig), 'event_films grants anon a policy it does not need');
});
