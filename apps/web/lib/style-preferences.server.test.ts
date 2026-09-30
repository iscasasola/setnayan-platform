/**
 * THE ONE READ-MERGE-WRITE FOR `events.style_preferences` — every other key of
 * the blob survives, `undefined` takes the key off, and a write that changed no
 * row is a failure, never a quiet success.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}

function fakeAdmin(row: Record<string, unknown> | null, rowsWritten = 1) {
  const writes: unknown[] = [];
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      update: (patch: unknown) => {
        writes.push(patch);
        return { eq: () => ({ select: async () => ({ data: Array.from({ length: rowsWritten }, () => ({ event_id: 'e' })), error: null }) }) };
      },
    }),
  };
  return { admin: admin as never, writes };
}

test('one key changes; every other key is kept', async () => {
  const { writeStylePreferenceKey } = await import('./style-preferences.server');
  const { admin, writes } = fakeAdmin({ style_preferences: { qr: { shape: 'circle' }, refinements: [1], scene_styles: { entourage: 'march' } } });
  const res = await writeStylePreferenceKey(admin, 'e', 'scene_styles', (cur) => ({ ...(cur as object), live_hub: 'theatre' }));
  assert.equal(res.ok, true);
  assert.deepEqual(writes, [{ style_preferences: { qr: { shape: 'circle' }, refinements: [1], scene_styles: { entourage: 'march', live_hub: 'theatre' } } }]);
});

test('undefined takes the key off', async () => {
  const { writeStylePreferenceKey } = await import('./style-preferences.server');
  const { admin, writes } = fakeAdmin({ style_preferences: { qr: {}, scene_styles: { entourage: 'march' } } });
  await writeStylePreferenceKey(admin, 'e', 'scene_styles', () => undefined);
  assert.deepEqual(writes, [{ style_preferences: { qr: {} } }]);
});

test('a write that changed no row is a failure', async () => {
  const { writeStylePreferenceKey } = await import('./style-preferences.server');
  const { admin } = fakeAdmin({ style_preferences: {} }, 0);
  const res = await writeStylePreferenceKey(admin, 'e', 'scene_styles', () => ({ entourage: 'march' }));
  assert.equal(res.ok, false);
  const missing = await writeStylePreferenceKey(fakeAdmin(null).admin, 'e', 'scene_styles', () => ({}));
  assert.equal(missing.ok, false, 'no event row → not written');
});
