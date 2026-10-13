/**
 * home-public-reads.test.ts — ⚡ THE HOME PAGE REMEMBERS ITS PUBLIC READS.
 *
 * Counted, not grepped: every one of the six remembered reads is run with the
 * real service client against a stand-in database that COUNTS the requests it
 * is sent, behind a stand-in store that ages the way Next's does. What is held:
 *
 *   1 · THE COUNT AND THE DEPTH. A first view sends 21 requests for these
 *       rows, 5 deep; a second view inside 60 s sends NONE.
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
import { INVITE_THEMES } from './invite-themes';
import { withRenderScopeForTest } from './request-once';

type Answer = { data?: unknown; error?: unknown; count?: number | null };

// The reads build the REAL service client in place (`createAdminClient()`), so
// the stand-in sits one layer lower: the database's HTTP door. Every request
// supabase-js sends is counted here — nothing can be asked without passing it.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

/**
 * A database that answers per table and counts every request it is sent — and
 * how DEEP the requests ran: a request that left only after another had come
 * back is one step further down. Requests that leave together are one step.
 * That number is what a visitor waits for; the count is only what it costs.
 */
function countingDatabase(answers: Record<string, Answer | ((head: boolean, body: Record<string, unknown>) => Answer)>) {
  const sent: string[] = [];
  const depth = { deepestReturned: 0, deepest: 0 };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    assert.ok(url.pathname.startsWith('/rest/v1/'), `an unexpected request left the reads: ${url.pathname}`);
    const table = url.pathname.replace('/rest/v1/', '');
    const head = (init?.method ?? 'GET') === 'HEAD';
    sent.push(head ? `${table}(HEAD)` : table);
    const mine = depth.deepestReturned + 1;
    depth.deepest = Math.max(depth.deepest, mine);
    await new Promise((r) => setTimeout(r, 3));
    depth.deepestReturned = Math.max(depth.deepestReturned, mine);
    const a = answers[table];
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const answer = typeof a === 'function' ? a(head, body) : (a ?? { data: [] });
    if (answer.error) {
      return new Response(head ? null : JSON.stringify(answer.error), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    if (head) return new Response(null, { status: 200, headers: { 'content-range': `0-0/${answer.count ?? 0}` } });
    return new Response(JSON.stringify(answer.data ?? []), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return {
    sent,
    /** Forget what was sent and how deep — the next view is measured on its own. */
    reset: () => {
      sent.length = 0;
      depth.deepestReturned = 0;
      depth.deepest = 0;
    },
    serialDepth: () => depth.deepest,
  };
}

const EVENT_A = '00000000-0000-4000-8000-00000000000a';
const EVENT_B = '00000000-0000-4000-8000-00000000000b';

/** A theme only an owner may wear — event A saved one; event B saved nothing. */
const PRO_THEME = Object.entries(INVITE_THEMES).find(([, t]) => t.tier === 'pro')?.[0] as string;

function world(over: Record<string, Answer | ((head: boolean, body: Record<string, unknown>) => Answer)> = {}) {
  return countingDatabase({
    events: {
      data: [
        { event_id: EVENT_A, invite_theme: PRO_THEME, landing_page_hero_image_url: 'r2://setnayan-media/events/a/hero.jpg' },
        { event_id: EVENT_B, invite_theme: null },
      ],
    },
    // Nothing bought by either event. A is hosted by an internal account (it owns
    // every product); B is hosted by nobody special (it owns nothing).
    orders: { data: [] },
    bundle_components: { data: [] },
    'rpc/event_comp_active_skus': { data: [] },
    'rpc/event_host_is_internal': (_head, body) => ({ data: body.p_event_id === EVENT_A }),
    'rpc/event_host_holds_founder_seat': { data: false },
    event_type_profiles: { data: [{ event_type: 'wedding', terminology: {}, enabled_surfaces: ['website'] }] },
    event_type_vocab: { data: [{ event_type: 'wedding', label_en: 'Wedding', status: 'active', sort_order: 1 }] },
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
  /**
   * One view of `/` by a signed-out visitor, asking for these rows in the ORDER
   * AND SHAPE THE PAGE DOES (`FrontDoor` → `loadFrontDoorData` ∥ `loadDiscover`):
   * what leaves together here leaves together there. Run as one render, so the
   * ownership reads are asked once per event, as they are in production.
   */
  const view = () =>
    withRenderScopeForTest(async () => {
      const frontDoor = Promise.all([reads.rememberedLiveShopRows(8), reads.rememberedFeaturedChapters(24)]);
      const discover = (async () => {
        const [candidates, types, people] = await Promise.all([
          reads.rememberedWorldCandidates('2026-10-11'),
          reads.rememberedEventTypeRows(),
          reads.rememberedPublicPeople(13),
        ]);
        const ids = stableIds([EVENT_B, EVENT_A]);
        const hosts = await reads.rememberedHostRows(ids);
        const covers = await reads.rememberedCoverRows(ids);
        return { candidates, types, people, hosts, covers };
      })();
      const [shelves, found] = await Promise.all([frontDoor, discover]);
      return { shelves, ...found };
    });
  return { reads, view, fake };
}

test('1 · a first view sends 21 requests, 5 deep; a second view inside 60 s sends NONE', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world();
  const { view } = build(db, clock);

  const first = await view();
  assert.deepEqual(
    [...db.sent].sort(),
    [
      'bundle_components',
      'creator_chapters',
      'event_members',
      'event_type_profiles',
      'event_type_vocab',
      'events', // the world's candidates
      'events', // the shelved cards' cover rows
      'invitation_widgets',
      'orders', // event A
      'orders', // event B
      'rpc/event_comp_active_skus',
      'rpc/event_comp_active_skus',
      'rpc/event_host_holds_founder_seat', // A — leaves with the other facts since 2026-10-13
      'rpc/event_host_holds_founder_seat', // B
      'rpc/event_host_is_internal',
      'rpc/event_host_is_internal',
      'users', // people to follow
      'users', // the chapters' owners
      'users', // the hosts' public names
      'vendor_profiles',
      'vendor_profiles(HEAD)',
    ],
    'the cold view no longer sends the requests these rows cost',
  );
  /*
    THE COLD DEPTH, step by step — what a visitor waits for when nothing is
    remembered (once a minute at most):
      1 the world · both event-type tables · people · shops ×2 · chapters
      2 the chapters' owners · the hosts' memberships
      3 the hosts' names
      4 the cover rows · the hero rows
      5 each event's orders ∥ the bundle composition ∥ comp grant ∥ internal
        host ∥ founder seat — the ownership facts, both events side by side
    (7, not 8, since 2026-10-12: the bundle composition leaves WITH the orders
    read. 5, not 7, since 2026-10-13: every per-event fact leaves with them —
    `skuActiveInRender`, `lib/entitlements.ts`; +1 request, A's founder seat.)
  */
  assert.equal(db.serialDepth(), 5, 'the cold view got deeper — a read is waiting on one it does not need');
  // The facts are the REAL ownership: A (internal host, saved a Pro theme) owns it; B does not.
  assert.deepEqual(first.covers.facts[EVENT_A], { websitePro: true, logoAnimation: null });
  assert.deepEqual(first.covers.facts[EVENT_B], { websitePro: false, logoAnimation: null });

  db.reset();
  clock.now += 45_000;
  const second = await view();
  assert.deepEqual(db.sent, [], `a warm view sent ${db.sent.length} requests for rows it had just read`);
  assert.equal(db.serialDepth(), 0);
  assert.deepEqual(second.covers.facts, first.covers.facts, 'a warm view was handed different facts');
});

test('1b · a view after the hard age asks again rather than show old rows', async () => {
  const clock = { now: 1_700_000_000_000 };
  const db = world();
  const { view } = build(db, clock);
  await view();
  db.reset();
  clock.now += 301_000;
  await view();
  assert.ok(db.sent.length >= 20, `only ${db.sent.length} requests were sent for rows older than the hard age`);
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
  // 2 world reads · the cover rows + hero rows + ownership chain for [A], then for [A, B] · 2 people reads
  assert.ok(db.sent.filter((t) => t === 'invitation_widgets').length === 2 && db.sent.filter((t) => t === 'users').length === 2);
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

test('2e · a refused ownership read is "not owned" for that view and is NOT remembered', async () => {
  const clock = { now: 1_700_000_000_000 };
  let refuse = true;
  const db = world({ orders: () => (refuse ? { error: { message: 'connection refused', code: 'PGRST003' } } : { data: [] }) });
  const { reads, fake } = build(db, clock);
  const ask = () => withRenderScopeForTest(() => reads.rememberedCoverRows([EVENT_A]).then((rows) => rows, (e: unknown) => e));
  const caught = await ask();
  assert.ok(caught instanceof ReadRefused && caught.site === 'coverFacts', 'a refused orders read was not reported as a refusal');
  const partial = caught.partial as { covers: unknown[]; facts: Record<string, { websitePro: boolean | null }> };
  assert.equal(partial.facts[EVENT_A]?.websitePro, false, 'a refused ownership read drew something other than "not owned"');
  assert.equal(partial.covers.length, 2, 'the cover rows that answered were dropped');
  assert.equal(fake.entries.size, 0, '"not owned" was remembered for everybody after a read that never answered');
  refuse = false;
  const rows = await ask();
  assert.ok(!(rows instanceof ReadRefused) && !(rows instanceof Error));
  assert.equal((rows as { facts: Record<string, { websitePro: boolean | null }> }).facts[EVENT_A]?.websitePro, true);
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
