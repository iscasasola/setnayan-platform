/**
 * Onboarding background PLAYLIST — the fallback that keeps live music playing.
 *
 * `onboarding_bg_music_r2_keys` (TEXT[]) arrived via the 2026-10-11 schema-drift
 * reconcile with NO writer and NO reader. Prod today holds the real track in the
 * SINGULAR `onboarding_bg_music_r2_key` and `[]` in the array — verified against
 * the live database 2026-08-05. So a plural reader that trusts the array alone
 * would return zero tracks and silence the music that is playing right now.
 *
 * These tests pin the resolution ORDER, which is the only part that can go
 * wrong silently. The presigning and the admin client are not exercised here —
 * they are covered by the surfaces that use them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors fetchOnboardingBgMusicUrls' ref-selection, before presigning. */
function resolveRefs(s: {
  onboarding_bg_music_enabled: boolean;
  onboarding_bg_music_r2_key: string | null;
  onboarding_bg_music_r2_keys: string[] | null;
}): string[] {
  if (!s.onboarding_bg_music_enabled) return [];
  const many = (s.onboarding_bg_music_r2_keys ?? []).filter(
    (k): k is string => typeof k === 'string' && k.startsWith('r2://'),
  );
  if (many.length > 0) return many;
  return s.onboarding_bg_music_r2_key?.startsWith('r2://')
    ? [s.onboarding_bg_music_r2_key]
    : [];
}

const A = 'r2://setnayan-media/onboarding/background-music/a.mp3';
const B = 'r2://setnayan-media/onboarding/background-music/b.mp3';

test("PROD SHAPE TODAY: empty array + a singular track still plays that track", () => {
  assert.deepEqual(
    resolveRefs({
      onboarding_bg_music_enabled: true,
      onboarding_bg_music_r2_key: A,
      onboarding_bg_music_r2_keys: [],
    }),
    [A],
    'the array is empty in prod — trusting it alone would silence live music',
  );
});

test('a real playlist wins over the legacy column, in author order', () => {
  assert.deepEqual(
    resolveRefs({
      onboarding_bg_music_enabled: true,
      onboarding_bg_music_r2_key: A,
      onboarding_bg_music_r2_keys: [B, A],
    }),
    [B, A],
    'order is the authored order, not the legacy track first',
  );
});

test('the enabled flag governs BOTH shapes — one switch, as before', () => {
  assert.deepEqual(
    resolveRefs({
      onboarding_bg_music_enabled: false,
      onboarding_bg_music_r2_key: A,
      onboarding_bg_music_r2_keys: [B],
    }),
    [],
  );
});

test('non-r2 junk is dropped rather than rendered as an empty <audio>', () => {
  assert.deepEqual(
    resolveRefs({
      onboarding_bg_music_enabled: true,
      onboarding_bg_music_r2_key: A,
      // A blank string used to be a legitimate "cleared" value on this column.
      onboarding_bg_music_r2_keys: ['', 'https://example.com/x.mp3'],
    }),
    [A],
    'junk entries must not suppress the legacy fallback',
  );
});

test('a NULL array is the same as an empty one (column added mid-life)', () => {
  assert.deepEqual(
    resolveRefs({
      onboarding_bg_music_enabled: true,
      onboarding_bg_music_r2_key: A,
      onboarding_bg_music_r2_keys: null,
    }),
    [A],
  );
});

test('nothing set anywhere → no player mounts', () => {
  assert.deepEqual(
    resolveRefs({
      onboarding_bg_music_enabled: true,
      onboarding_bg_music_r2_key: null,
      onboarding_bg_music_r2_keys: [],
    }),
    [],
  );
});
