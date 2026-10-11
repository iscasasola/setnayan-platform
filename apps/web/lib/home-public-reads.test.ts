/**
 * home-public-reads.test.ts — ⚡ THE HOME PAGE REMEMBERS ITS PUBLIC READS.
 *
 * Counted, not grepped: every one of the six remembered reads is run with the
 * real service client against a stand-in database that COUNTS the requests it
 * is sent, behind a stand-in store that ages the way Next's does. What is held:
 *
 *   1 · THE COUNT. A first view sends 10 queries for these rows; a second view
 *       inside 60 s sends NONE.
 *   2 · A REFUSED READ IS NEVER REMEMBERED — and the half that did answer still
 *       reaches the caller (a failed shop count is "couldn't load", not zero).
 *   3 · THE ROWS ARE RAW. A host with no public profile is still in the
 *       remembered rows WITH their name — so the rule that hides it must run
 *       after, per view — and no remembered value holds a signed address.
 *
 * ⚠ THIS IS NOT THE PAGE'S NUMBER. It counts the remembered reads only. The
 * reads `/` still makes on every view (the event-type gate and labels, the
 * consented editorials, and the ownership chain behind each card's cover) are
 * not in this file, and the real before/after is unmeasured until a preview.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHomePublicReads, type FeaturedChapter, type HostRows, type LiveShopRefusal } from './home-public-reads-core';
import { ReadRefused, rememberWith, stableIds } from './remembered-read-core';
import { fakeSwrStore } from './remembered-read-fake-store';
import { createAdminClient } from './supabase/admin';

type Answer = { data?: unknown; error?: unknown; count?: number | null };

// The reads build the REAL service client in place (`createAdminClient()`), so
// the stand-in sits one layer lower: the database's HTTP door. Every request
// supabase-js sends is counted here — nothing can be asked without passing it.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

/** A database that answers per table and counts every request it is sent. */
function countingDatabase(answers: Record<string, Answer | ((head: boolean) => Answer)>) {
  const sent: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    assert.ok(url.pathname.startsWith('/rest/v1/'), `an unexpected request left the reads: ${url.pathname}`);
    const table = url.pathname.replace('/rest/v1/', '');
    const head = (init?.method ?? 'GET') === 'HEAD';
    sent.push(head ? `${table}(HEAD)` : table);
    const a = answers[table];
    const answer = typeof a === 'function' ? a(head) : (a ?? { data: [] });
    if (answer.error) {
      return new Response(head ? null : JSON.stringify(answer.error), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    if (head) return new Response(null, { status: 200, headers: { 'content-range': `0-0/${answer.count ?? 0}` } });
    return new Response(JSON.stringify(answer.data ?? []), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { sent };
}

const EVENT_A = '00000000-0000-4000-8000-00000000000a';
const EVENT_B = '00000000-0000-4000-8000-00000000000b';

function world(over: Record<string, Answer | ((head: boolean) => Answer)> = {}) {
  return countingDatabase({
    events: { data: [{ event_id: EVENT_A, landing_page_hero_image_url: 'r2://setnayan-media/events/a/hero.jpg' }, { event_id: EVENT_B }] },
    event_members: {
      data: [
        { event_id: EVENT_A, user_id: 'u-public', joined_at: '2026-01-01' },
        { event_id: EVENT_B, user_id: 'u-private', joined_at: '2026-01-02' },
      ],
    },
    users: {
      data: [
        { user_id: 'u-public', display_name: 'Maria', slug: 'maria', public_profile_enabled: true, deleted_at: null, profile_photo_url: 'r2://setnayan-media/users/u-public/p.jpg' },
        { user_id: 'u-private', display_name: 'Secret Name', slug: null, public_profile_enabled: false, deleted_at: null, profile_photo_url: null },
      ],
    },
    invitation_widgets: { data: [{ event_id: EVENT_A, config_json: { main: { kind: 'photo' } } }] },
    vendor_profiles: (head) => (head ? { count: 3 } : { data: [{ business_slug: 'shop', business_name: 'Shop', logo_url: 'r2://setnayan-media/vendors/x/logo.png' }] }),
    ...over,
  });
}

function build(db: ReturnType<typeof countingDatabase>, clock: { now: number }, chapters = { ok: true }) {
  const fake = fakeSwrStore(clock);
  const reads = makeHomePublicReads<FeaturedChapter>({
    remember: (load, opts) =>
      rememberWith(fake.store, load, { ...opts, softSeconds: 60, hardSeconds: 300, now: () => clock.now }),
    featuredChapters: async () => {
      // The real loader sends two: the chapters, then their owners.
      await createAdminClient().from('creator_chapters').select('*');
      if (!chapters.ok) return { items: [], ok: false };
      await createAdminClient().from('users').select('*');
      return { items: [], ok: true };
    },
  });
  /** One view of `/`, asking for these rows the way the page does. */
  const view = async () => {
    const ids = stableIds([EVENT_B, EVENT_A]);
    return Promise.all([
      reads.rememberedWorldCandidates('2026-10-11'),
      reads.rememberedHostRows(ids),
      reads.rememberedCoverRows(ids),
      reads.rememberedPublicPeople(13),
      reads.rememberedLiveShopRows(8),
      reads.rememberedFeaturedChapters(24),
    ]);
  };
  return { reads, view, fake };
}

test('1 · a first view sends 10 queries for these rows; a second view inside 60 s sends none', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world();
  const { view } = build(db, clock);

  await view();
  assert.deepEqual(
    [...db.sent].sort(),
    [
      'creator_chapters', 'event_members', 'events', 'events', 'invitation_widgets',
      'users', 'users', 'users', 'vendor_profiles', 'vendor_profiles(HEAD)',
    ],
    'the cold view no longer sends the ten queries these rows cost',
  );

  db.sent.length = 0;
  clock.now += 45_000;
  await view();
  assert.deepEqual(db.sent, [], `a warm view sent ${db.sent.length} queries for rows it had just read`);
});

test('1b · a view after the hard age asks again rather than show old rows', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world();
  const { view } = build(db, clock);
  await view();
  db.sent.length = 0;
  clock.now += 301_000;
  await view();
  assert.ok(db.sent.length >= 10, `only ${db.sent.length} queries were sent for rows older than the hard age`);
});

test('1c · a different day, a different set of events and a different limit are different entries', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world();
  const { reads } = build(db, clock);
  await reads.rememberedWorldCandidates('2026-10-11');
  await reads.rememberedWorldCandidates('2026-10-12');
  await reads.rememberedCoverRows([EVENT_A]);
  await reads.rememberedCoverRows([EVENT_A, EVENT_B]);
  await reads.rememberedPublicPeople(13);
  await reads.rememberedPublicPeople(14);
  assert.equal(db.sent.length, 2 + 4 + 2);
});

test('2 · a refused world read is not remembered — the next view asks again', async () => {
  const clock = { now: 1_700_000_000_000 };
  let refuse = true;
  const db = world({ events: () => (refuse ? { error: { message: 'timeout' } } : { data: [{ event_id: EVENT_A }] }) });
  const { reads } = build(db, clock);
  await assert.rejects(reads.rememberedWorldCandidates('2026-10-11'), (e: unknown) => e instanceof ReadRefused && e.site === 'world');
  refuse = false;
  const rows = await reads.rememberedWorldCandidates('2026-10-11');
  assert.equal(rows.length, 1, 'the refusal was remembered as an empty shelf');
});

test('2b · a refused shop COUNT is not remembered, and the rows that did answer still arrive', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world({
    vendor_profiles: (head) => (head ? { error: { message: 'count refused' } } : { data: [{ business_slug: 'shop' }] }),
  });
  const { reads, fake } = build(db, clock);
  const caught = await reads.rememberedLiveShopRows(8).then(() => null, (e: unknown) => e);
  assert.ok(caught instanceof ReadRefused);
  const partial = (caught as ReadRefused<LiveShopRefusal>).partial;
  assert.equal(partial?.count, null, 'a failed count became a number');
  assert.equal(partial?.rows.length, 1, 'the rows that answered were dropped');
  assert.ok(partial?.countError && !partial.rowsError);
  assert.equal(fake.entries.size, 0, 'a half-answered read was remembered');
});

test('2c · a refused hero read costs only the Main background and is not remembered', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world({ invitation_widgets: { error: { message: 'refused' } } });
  const { reads, fake } = build(db, clock);
  const caught = await reads.rememberedCoverRows([EVENT_A]).then(() => null, (e: unknown) => e);
  assert.ok(caught instanceof ReadRefused && caught.site === 'mainGrounds');
  assert.equal((caught.partial as { covers: unknown[] }).covers.length, 2, 'the cover rows that answered were dropped');
  assert.equal(fake.entries.size, 0);
});

test('2d · a failed chapters read is thrown, never remembered as "no stories"', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world();
  const { reads, fake } = build(db, clock, { ok: false });
  await assert.rejects(reads.rememberedFeaturedChapters(24), ReadRefused);
  assert.equal(fake.entries.size, 0);
});

test('3 · the remembered host rows are RAW — the rule that hides a private name must run after, per view', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world();
  const { reads } = build(db, clock);
  const rows: HostRows = await reads.rememberedHostRows(stableIds([EVENT_A, EVENT_B]));
  const hidden = rows.users.find((u) => u.user_id === 'u-private');
  assert.equal(hidden?.public_profile_enabled, false);
  assert.equal(hidden?.display_name, 'Secret Name', 'the remembered read started deciding who may be named');
});

test('3b · no remembered value holds a signed address — pictures are stored refs', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world();
  const { view, fake } = build(db, clock);
  await view();
  const everything = JSON.stringify([...fake.entries.values()]);
  assert.ok(everything.includes('r2://setnayan-media/'), 'the fixture refs were not remembered — the test is not looking at the rows');
  assert.doesNotMatch(everything, /X-Amz-|Signature=|https?:\/\//i, 'a signed or resolved address was remembered');
});
