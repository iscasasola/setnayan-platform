/**
 * 🖼 A MULTI-PHOTO POST GOES UP WHOLE, IN ORDER, OR NOT AT ALL (controller, 28 Nov 2026: many library posts carry
 * several photos). Each image uploads unpublished to /{page}/photos in the given order, then ONE /{page}/feed post
 * attaches them in that order. A failed upload or a refused feed post publishes nothing and cleans up the uploads.
 *
 * Sabotage (measured): uploading with Promise.all and attaching in completion order turns "order kept" red; making
 * the feed call after a failed upload turns "all or nothing" red; raising the cap to 30 turns the 10-photo test red;
 * dropping the failure push in cleanUp turns the clean-up test red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACEBOOK_MAX_ATTACHED_PHOTOS, attachedPhotoUrls, multiPhotoUrls, publishMultiPhoto, type GraphCall } from './facebook-multi-photo';

type Seen = { method: string; path: string; params: Record<string, string> };

/** A fake Graph: uploads answer after a delay that is LONGER for earlier photos, so completion order ≠ given order. */
function fakeGraph(opts: { failUpload?: number; failFeed?: boolean; failDelete?: string } = {}) {
  const seen: Seen[] = [];
  let upload = 0;
  const call: GraphCall = async (method, path, params) => {
    seen.push({ method, path, params });
    if (method === 'DELETE') {
      return path === `/${opts.failDelete}` ? { ok: false, error: 'Unsupported delete request' } : { ok: true, body: { success: true } };
    }
    if (path.endsWith('/photos')) {
      const n = (upload += 1);
      await new Promise((r) => setTimeout(r, (10 - n) * 2));
      if (opts.failUpload === n) return { ok: false, error: 'Invalid image URL' };
      return { ok: true, body: { id: `photo-${params.url?.split('/').pop()}` } };
    }
    if (opts.failFeed) return { ok: false, error: 'Feed refused' };
    return { ok: true, body: { id: 'page_123' } };
  };
  return { call, seen };
}

const urls = ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg', 'https://cdn.example/c.jpg'];

test('order kept: uploads in the given order, attached in the same order, unpublished', async () => {
  const g = fakeGraph();
  const res = await publishMultiPhoto(g.call, 'PAGE', 'Hello', urls);
  assert.deepEqual(res, { ok: true, externalId: 'page_123', mediaIds: ['photo-a.jpg', 'photo-b.jpg', 'photo-c.jpg'] });
  const uploads = g.seen.filter((s) => s.path === '/PAGE/photos');
  assert.deepEqual(uploads.map((u) => u.params.url), urls);
  assert.ok(uploads.every((u) => u.params.published === 'false'), 'an upload was published on its own');
  const feed = g.seen.find((s) => s.path === '/PAGE/feed');
  assert.equal(feed?.params.message, 'Hello');
  assert.deepEqual(
    [0, 1, 2].map((i) => feed?.params[`attached_media[${i}]`]),
    ['{"media_fbid":"photo-a.jpg"}', '{"media_fbid":"photo-b.jpg"}', '{"media_fbid":"photo-c.jpg"}'],
  );
});

test('all or nothing: a failed upload posts nothing and deletes the photos already uploaded', async () => {
  const g = fakeGraph({ failUpload: 2 });
  const res = await publishMultiPhoto(g.call, 'PAGE', 'Hello', urls);
  assert.equal(res.ok, false);
  assert.match(!res.ok ? res.error : '', /^Photo 2 of 3 did not upload \(Invalid image URL\); nothing was posted\./);
  assert.equal(g.seen.some((s) => s.path === '/PAGE/feed'), false, 'a half post was made');
  assert.equal(g.seen.filter((s) => s.path === '/PAGE/photos').length, 2, 'it kept uploading after a failure');
  assert.deepEqual(g.seen.filter((s) => s.method === 'DELETE').map((s) => s.path), ['/photo-a.jpg']);
});

test('all or nothing: a refused feed post reports the error and cleans up every upload', async () => {
  const g = fakeGraph({ failFeed: true });
  const res = await publishMultiPhoto(g.call, 'PAGE', 'Hello', urls);
  assert.equal(res.ok, false);
  assert.deepEqual(g.seen.filter((s) => s.method === 'DELETE').map((s) => s.path), ['/photo-a.jpg', '/photo-b.jpg', '/photo-c.jpg']);
});

test('one photo or none is not a multi-photo post (the single-photo and link paths keep it)', async () => {
  assert.equal(multiPhotoUrls(null), null);
  assert.equal(multiPhotoUrls(['https://cdn.example/a.jpg']), null);
  assert.equal(multiPhotoUrls(['https://cdn.example/a.jpg', 'slides/02.jpg']), null);
  assert.deepEqual(multiPhotoUrls(urls), urls);
  const g = fakeGraph();
  assert.equal((await publishMultiPhoto(g.call, 'PAGE', 'x', urls.slice(0, 1))).ok, false);
  assert.equal(g.seen.length, 0);
});

test('at most 10 photos a post (owner): 11 is refused before anything uploads', async () => {
  assert.equal(FACEBOOK_MAX_ATTACHED_PHOTOS, 10);
  const eleven = Array.from({ length: 11 }, (_, i) => `https://cdn.example/${i}.jpg`);
  const g = fakeGraph();
  const res = await publishMultiPhoto(g.call, 'PAGE', 'x', eleven);
  assert.equal(res.ok, false);
  assert.match(!res.ok ? res.error : '', /at most 10 photos; this one has 11/);
  assert.equal(g.seen.length, 0, 'something uploaded before the cap refused the post');
  const ten = await publishMultiPhoto(fakeGraph().call, 'PAGE', 'x', eleven.slice(0, 10));
  assert.equal(ten.ok, true);
});

test('a clean-up delete that fails is returned with its photo id, so the flush can record it', async () => {
  const g = fakeGraph({ failFeed: true, failDelete: 'photo-b.jpg' });
  const res = await publishMultiPhoto(g.call, 'PAGE', 'Hello', urls);
  assert.equal(res.ok, false);
  assert.deepEqual(!res.ok ? res.cleanupFailures : null, [{ photo_id: 'photo-b.jpg', error: 'Unsupported delete request' }]);
  // It still tried to delete every upload, not just up to the failure.
  assert.deepEqual(g.seen.filter((s) => s.method === 'DELETE').map((s) => s.path), ['/photo-a.jpg', '/photo-b.jpg', '/photo-c.jpg']);
});

test('a scheduled multi-photo post: temporary unpublished uploads, then ONE scheduled /feed post, in order', async () => {
  const g = fakeGraph();
  const at = new Date('2026-12-01T12:00:00Z');
  const res = await publishMultiPhoto(g.call, 'PAGE', 'Hello', urls, { scheduleAt: at });
  assert.equal(res.ok, true);
  const uploads = g.seen.filter((s) => s.path === '/PAGE/photos');
  assert.deepEqual(uploads.map((u) => u.params.url), urls);
  assert.ok(uploads.every((u) => u.params.published === 'false' && u.params.temporary === 'true'));
  const feed = g.seen.find((s) => s.path === '/PAGE/feed');
  assert.equal(feed?.params.published, 'false');
  assert.equal(feed?.params.scheduled_publish_time, String(at.getTime() / 1000));
  assert.equal(feed?.params['attached_media[2]'], '{"media_fbid":"photo-c.jpg"}');
  // Not scheduled: no temporary flag, no scheduled time.
  const now = fakeGraph();
  await publishMultiPhoto(now.call, 'PAGE', 'Hello', urls);
  assert.equal(now.seen.find((s) => s.path === '/PAGE/photos')?.params.temporary, undefined);
  assert.equal(now.seen.find((s) => s.path === '/PAGE/feed')?.params.scheduled_publish_time, undefined);
});

test('a scheduled multi-photo post keeps all or nothing', async () => {
  const g = fakeGraph({ failUpload: 3 });
  const res = await publishMultiPhoto(g.call, 'PAGE', 'Hello', urls, { scheduleAt: new Date('2026-12-01T12:00:00Z') });
  assert.equal(res.ok, false);
  assert.equal(g.seen.some((s) => s.path === '/PAGE/feed'), false);
  assert.deepEqual(g.seen.filter((s) => s.method === 'DELETE').map((s) => s.path), ['/photo-a.jpg', '/photo-b.jpg']);
});

test('a scheduled ONE-photo post also goes as an unpublished upload + one scheduled /feed post (so /scheduled_posts lists it)', async () => {
  const at = new Date('2026-12-01T12:00:00Z');
  const one = 'https://cdn.example/a.jpg';
  assert.deepEqual(attachedPhotoUrls({ mediaUrl: one, scheduleAt: at }), [one]);
  assert.equal(attachedPhotoUrls({ mediaUrl: one, scheduleAt: null }), null, 'a post sent now keeps the plain /photos path');
  assert.equal(attachedPhotoUrls({ mediaUrl: 'https://setnayan.com/a-page', scheduleAt: at }), null, 'not an image: a link post');
  assert.deepEqual(attachedPhotoUrls({ mediaUrls: urls, mediaUrl: one, scheduleAt: at }), urls);

  const g = fakeGraph();
  const res = await publishMultiPhoto(g.call, 'page', 'Hi', [one], { scheduleAt: at });
  assert.equal(res.ok, true);
  assert.deepEqual(g.seen.map((s) => s.path), ['/page/photos', '/page/feed']);
  const feed = g.seen[1]!.params;
  assert.equal(feed.published, 'false');
  assert.equal(feed.scheduled_publish_time, String(at.getTime() / 1000));
  assert.ok(feed['attached_media[0]']);
});

test('the time budget: past the deadline no further Graph call starts, and the uploads are cleaned up', async () => {
  const g = fakeGraph();
  let t = 0;
  const res = await publishMultiPhoto(g.call, 'page', 'Hi', urls, {
    scheduleAt: new Date('2026-12-01T12:00:00Z'),
    deadline: 2,
    clock: () => (t += 1),
  });
  assert.equal(res.ok, false);
  assert.equal(g.seen.filter((s) => s.path === '/page/feed').length, 0, 'the feed post never starts');
  assert.equal(g.seen.filter((s) => s.method === 'DELETE').length, g.seen.filter((s) => s.path === '/page/photos').length);
});
