/**
 * 📅 FACEBOOK HOLDS THE SCHEDULE (owner, 28 Nov 2026: "schedule posts on Facebook itself and stay cron-free").
 * A slot post goes to Facebook as a SCHEDULED post — published=false + scheduled_publish_time in Unix seconds —
 * 10 minutes to ~30 days ahead; we hand over at most 7 days ahead.
 *
 * Sabotage (measured): dropping `published: 'false'` from scheduledPostFields turns "scheduled posts" red; a
 * millisecond timestamp turns it red; a 5-minute floor turns the window test red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FB_HANDOFF_HORIZON_MS,
  FB_SCHEDULE_MAX_LEAD_MS,
  FB_SCHEDULE_MIN_LEAD_MS,
  buildSinglePostRequest,
  canScheduleOnFacebook,
  scheduledPostFields,
} from './facebook-request';

const now = new Date('2026-12-01T00:00:00Z');
const plus = (m: number) => new Date(now.getTime() + m * 60_000);

test('Facebook takes a scheduled time from 10 minutes to 30 days ahead; we hand over 7 days ahead', () => {
  assert.equal(FB_SCHEDULE_MIN_LEAD_MS, 10 * 60_000);
  assert.equal(FB_SCHEDULE_MAX_LEAD_MS, 30 * 24 * 3600_000);
  assert.equal(FB_HANDOFF_HORIZON_MS, 7 * 24 * 3600_000);
  assert.equal(canScheduleOnFacebook(plus(9), now), false);
  assert.equal(canScheduleOnFacebook(plus(10), now), true);
  assert.equal(canScheduleOnFacebook(plus(30 * 24 * 60), now), true);
  assert.equal(canScheduleOnFacebook(plus(30 * 24 * 60 + 1), now), false);
  assert.equal(canScheduleOnFacebook(plus(-1), now), false);
});

test('scheduled posts: published=false plus scheduled_publish_time in Unix SECONDS', () => {
  assert.deepEqual(scheduledPostFields(new Date('2026-12-01T06:00:00Z')), {
    published: 'false',
    scheduled_publish_time: '1796104800',
  });
});

test('a photo post, a link post and a text post, each now or scheduled — never a token', () => {
  const at = new Date('2026-12-01T06:00:00Z');
  const photo = buildSinglePostRequest({ pageId: 'P', message: 'Hi', mediaUrl: 'https://cdn.example/a.jpg', scheduleAt: at });
  assert.deepEqual(photo, {
    path: '/P/photos',
    params: { url: 'https://cdn.example/a.jpg', caption: 'Hi', published: 'false', scheduled_publish_time: '1796104800' },
  });
  const link = buildSinglePostRequest({ pageId: 'P', message: 'Hi', linkUrl: 'https://setnayan.com/', mediaUrl: 'r2://x' });
  assert.deepEqual(link, { path: '/P/feed', params: { message: 'Hi', link: 'https://setnayan.com/' } });
  const text = buildSinglePostRequest({ pageId: 'P', message: 'Hi', linkUrl: 'javascript:x', scheduleAt: at });
  assert.deepEqual(text, { path: '/P/feed', params: { message: 'Hi', published: 'false', scheduled_publish_time: '1796104800' } });
  for (const r of [photo, link, text]) assert.equal('access_token' in r.params, false);
});
