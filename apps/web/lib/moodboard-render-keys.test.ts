/**
 * A RENDER NAMES ONE OBJECT — ITS OWN (lib/moodboard-render-keys.ts).
 *
 * The behaviour of the pure gate every render read goes through, the pool
 * shaper that sits in front of the cross-couple signer, and the one thing a
 * unit test can say about the SQL: that the database's equality lists name the
 * same shapes the writer mints (a drift there would make the database refuse
 * every render — or, widened, admit a forged one).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  RENDER_IMAGE_EXTENSIONS,
  canonicalRenderId,
  isOwnRenderGalleryKey,
  isOwnRenderImageKey,
  isPooledRenderGalleryKey,
  renderGalleryKey,
  renderImageExtension,
  renderImageKey,
} from './moodboard-render-keys';
import { shapeRenderPoolPage, type RawPoolRow } from './moodboard-render-pool';

const E = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const R = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_E = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_R = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test('the builders mint exactly the shapes the database compares against, in lowercase', () => {
  assert.equal(renderImageKey(E, R, 'image/png'), `renders/${E}/${R}.png`);
  assert.equal(renderImageKey(E, R, 'image/jpeg'), `renders/${E}/${R}.jpg`);
  assert.equal(renderImageKey(E, R, 'image/webp'), `renders/${E}/${R}.webp`);
  assert.equal(renderGalleryKey(E, R), `render-gallery/${E}/${R}.jpg`);
  // A URL can carry an upper-case event id; Postgres prints a uuid lowercase,
  // and the key must match what the database derives from the row.
  assert.equal(renderImageKey(E.toUpperCase(), R, 'image/png'), `renders/${E}/${R}.png`);
  assert.equal(renderGalleryKey(E.toUpperCase(), R.toUpperCase()), `render-gallery/${E}/${R}.jpg`);
  assert.throws(() => renderImageKey('event-1', R, 'image/png'));
  assert.throws(() => renderGalleryKey(E, '../x'));
  assert.equal(canonicalRenderId(` ${E}`), null, 'no trimming — an id with a space is not an id');
});

test('an own image key is admitted in every extension the writer can mint', () => {
  for (const ext of RENDER_IMAGE_EXTENSIONS) {
    assert.equal(isOwnRenderImageKey(`renders/${E}/${R}.${ext}`, { eventId: E, renderId: R }), true, ext);
  }
  // …including from an upper-case URL event id (the key is still lowercase).
  assert.equal(isOwnRenderImageKey(`renders/${E}/${R}.png`, { eventId: E.toUpperCase(), renderId: R }), true);
  // Every mime the writer handles maps into the admitted list.
  for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream']) {
    assert.ok((RENDER_IMAGE_EXTENSIONS as readonly string[]).includes(renderImageExtension(mime)), mime);
  }
});

const HOSTILE_IMAGE_KEYS = (e: string, r: string): Array<[string, unknown]> => [
  ['a stranger’s payment proof', `payment-proof/events/${OTHER_E}/proof.png`],
  ['a chat attachment', `chat/${OTHER_E}/receipt.png`],
  ['another event’s folder', `renders/${OTHER_E}/${r}.png`],
  ['another render of the same event', `renders/${e}/${OTHER_R}.png`],
  ['a leading space', ` renders/${e}/${r}.png`],
  ['a trailing space', `renders/${e}/${r}.png `],
  ['a no-break space', `\u00a0renders/${e}/${r}.png`],
  ['an upper-case extension', `renders/${e}/${r}.PNG`],
  ['an upper-case event segment', `renders/${e.toUpperCase()}/${r}.png`],
  ['a dot-dot escape', `renders/${e}/../${OTHER_E}/${r}.png`],
  ['a doubled slash', `renders//${e}/${r}.png`],
  ['an extension never minted', `renders/${e}/${r}.gif`],
  ['a scheme-qualified ref', `r2://setnayan-thread-files/renders/${e}/${r}.png`],
  ['the gallery copy', `render-gallery/${e}/${r}.jpg`],
  ['not a string', 42],
  ['null', null],
];

test('SABOTAGE-SHAPED: every forged image key is refused', () => {
  for (const [why, key] of HOSTILE_IMAGE_KEYS(E, R)) {
    assert.equal(isOwnRenderImageKey(key, { eventId: E, renderId: R }), false, why);
  }
  // A row whose ids are not uuids admits nothing.
  assert.equal(isOwnRenderImageKey(`renders/e/r.png`, { eventId: 'e', renderId: 'r' }), false);
});

test('an own gallery key is admitted; the unmarked copy and every forgery are not', () => {
  assert.equal(isOwnRenderGalleryKey(`render-gallery/${E}/${R}.jpg`, { eventId: E, renderId: R }), true);
  for (const bad of [
    `renders/${E}/${R}.jpg`,
    `render-gallery/${OTHER_E}/${R}.jpg`,
    `render-gallery/${E}/${OTHER_R}.jpg`,
    `render-gallery/${R}.jpg`,
    ` render-gallery/${E}/${R}.jpg`,
    `render-gallery/${E}/${R}.png`,
    `payment-proof/events/${OTHER_E}/p.jpg`,
  ]) {
    assert.equal(isOwnRenderGalleryKey(bad, { eventId: E, renderId: R }), false, bad);
  }
});

test('the pooled variant holds the render segment to THIS row and the event segment to one uuid', () => {
  assert.equal(isPooledRenderGalleryKey(`render-gallery/${E}/${R}.jpg`, R), true);
  assert.equal(isPooledRenderGalleryKey(`render-gallery/${OTHER_E}/${R}.jpg`, R), true, 'the pool hides the event');
  for (const bad of [
    `render-gallery/${E}/${OTHER_R}.jpg`, // someone else's render
    `render-gallery/${E}/x/${R}.jpg`, // an extra segment
    `render-gallery/${E.toUpperCase()}/${R}.jpg`, // not how Postgres prints it
    `render-gallery//${R}.jpg`, // no event at all
    `render-gallery/../${R}.jpg`,
    `render-gallery/${E}/${R}.jpg `,
    `payment-proof/events/${E}/${R}.jpg`,
    `renders/${E}/${R}.jpg`,
  ]) {
    assert.equal(isPooledRenderGalleryKey(bad, R), false, bad);
  }
  assert.equal(isPooledRenderGalleryKey(`render-gallery/${E}/${R}.jpg`, 'not-a-uuid'), false);
});

test('SERVE: the pool shaper withholds a forged key and NEVER hands it to the signer', async () => {
  const row = (over: Partial<RawPoolRow>): RawPoolRow => ({
    render_id: R,
    part_id: 'room:ceiling',
    gallery_image_key: `render-gallery/${E}/${R}.jpg`,
    swatches: ['#a83f2b'],
    created_at: '2026-09-10T00:00:00Z',
    total_count: 2,
    ...over,
  });
  const signed: string[] = [];
  const out = await shapeRenderPoolPage(
    [
      row({}),
      row({ render_id: OTHER_R, gallery_image_key: `payment-proof/events/${OTHER_E}/proof.jpg` }),
    ],
    async (key, renderId) => {
      signed.push(`${renderId}:${key}`);
      return `https://signed/${key}`;
    },
  );
  assert.equal(out.renders.length, 1);
  assert.equal(out.withheld, 1);
  assert.deepEqual(signed, [`${R}:render-gallery/${E}/${R}.jpg`], 'the forged key reached the signer');
});

/**
 * The SQL and the TypeScript describe one rule. The migration's equality lists
 * must name every extension the writer can mint (else the database refuses a
 * real render and the couple is refunded for nothing) and no other (else a
 * forged extension is storable).
 */
test('the migration’s equality lists name exactly the writer’s shapes', () => {
  const dir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_a_render_key_is_its_own.sql'));
  assert.ok(file, 'the migration that pins render keys must exist');
  const sql = readFileSync(join(dir, file), 'utf8');
  const tableExts = [...sql.matchAll(/'renders\/' \|\| event_id::text \|\| '\/' \|\| render_id::text \|\| '\.(\w+)'/g)].map(
    (m) => m[1],
  );
  assert.deepEqual([...tableExts].sort(), [...RENDER_IMAGE_EXTENSIONS].sort(), 'CHECK list');
  const rpcExts = [...sql.matchAll(/v_own \|\| '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual([...rpcExts].sort(), [...RENDER_IMAGE_EXTENSIONS].sort(), 'finish_render list');
  assert.match(sql, /'render-gallery\/' \|\| event_id::text \|\| '\/' \|\| render_id::text \|\| '\.jpg'/);
  assert.match(sql, /'render-gallery\/' \|\| v_event_id::text \|\| '\/' \|\| p_render_id::text \|\| '\.jpg'/);
});
