/**
 * 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER — the Maker draft row, through the REAL draft store, as the couple
 * (owner 2026-10-18; the pattern is `lib/merge-from-base.ts`, the pure half is `lib/two-hosts-never-overwrite.test.ts`).
 *
 * Every Maker save read the draft row, merged its change and wrote the WHOLE row back — a save that landed in between
 * was silently gone. Now every write is a compare-and-set on the version it read (`writeHubDraft`'s `expect`), and
 * `updateHubDraft` builds again on the newer draft when it loses. The version is `revision`, a counter the row's own
 * trigger raises on every UPDATE (20271275174284) — first tried on `updated_at`, whose clock ticks in whole milliseconds
 * here: two writes in one tick carried one value, and a stale write matched (this file's anti-vacuity test caught it).
 *
 * PGlite is one session, so the race is staged inside the builder: the other screen's write lands between this
 * writer's read and its write — exactly the window the old code lost.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18) — listed in the PR body.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import './supabase-over-pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { clientAs } from './pglite-client';
import { emptyHubDraft, mergeHubDraft, type HubDraft } from '../../lib/hub-draft';

let replay: ReplayResult;
let db: PGlite;
let store: typeof import('../../lib/hub-draft-store');
const F = { couple: '', cohost: '', eventId: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  store = await import('../../lib/hub-draft-store');
  F.couple = (await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ('two-hosts-a@draft.test') RETURNING id`)).rows[0]!.id;
  F.cohost = (await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ('two-hosts-b@draft.test') RETURNING id`)).rows[0]!.id;
  F.eventId = (
    await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting) VALUES ('Indalecio & Claire', 'wedding', 'catholic', 'garden') RETURNING event_id AS e`)
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple'), ($1, $3, 'couple')`, [F.eventId, F.couple, F.cohost]);
});
after(async () => {
  await db?.close();
});

const A = () => clientAs(db, F.couple) as never;
const B = () => clientAs(db, F.cohost) as never;
const drafted = async (): Promise<HubDraft | null> => store.readHubDraft(A(), F.eventId);

test('anti-vacuity: the version a read hands back is one the write can match — and a moved one it cannot', async () => {
  await store.writeHubDraft(A(), F.eventId, mergeHubDraft(emptyHubDraft(), { events: { special_message: 'one' } }));
  const row = await store.readHubDraftRow(A(), F.eventId);
  assert.ok(row.stamp, 'the draft row came back without its version');
  assert.equal(row.stamp.column, 'revision', 'the draft is versioned by the clock again, not the counter');
  await store.writeHubDraft(A(), F.eventId, mergeHubDraft(row.draft!, { events: { special_message: 'two' } }), undefined, row.stamp);
  assert.equal((await drafted())?.events.special_message, 'two', 'a write against the version it read did not land — every save would loop');
  await assert.rejects(
    store.writeHubDraft(A(), F.eventId, mergeHubDraft(row.draft!, { events: { special_message: 'three' } }), undefined, row.stamp),
    (e: unknown) => e instanceof store.HubDraftMovedError,
    'a write against a version that has moved landed anyway — the race is invisible',
  );
  assert.equal((await drafted())?.events.special_message, 'two');
  // Nobody may set the version by hand — only the trigger moves it.
  const forged = await (clientAs(db, F.couple) as unknown as { from: (t: string) => { update: (p: object) => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> } } })
    .from('event_site_drafts')
    .update({ revision: 0 })
    .eq('event_id', F.eventId);
  assert.ok(forged.error, 'a host could rewind the draft’s version and slip a stale write past the compare');
  await db.query(`DELETE FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId]);
});

test('1 · two hosts save different things at the same moment — both are in the draft (before: one was silently gone)', async () => {
  await store.writeHubDraft(A(), F.eventId, mergeHubDraft(emptyHubDraft(), { events: { special_message: 'Welcome' } }));
  let rounds = 0;
  const done = await store.updateHubDraft(A(), F.eventId, async (cur) => {
    rounds += 1;
    if (rounds === 1) {
      // Claire's save lands between Indalecio's read and his write.
      await store.updateHubDraft(B(), F.eventId, (c) => ({ next: mergeHubDraft(c ?? emptyHubDraft(), { events: { what_to_bring: 'An umbrella' } }) }));
    }
    return { next: mergeHubDraft(cur ?? emptyHubDraft(), { events: { special_message: 'Welcome, all' } }) };
  });
  assert.equal(done.written, true);
  assert.equal(rounds, 2, 'the lost round was not built again on the newer draft');
  const d = await drafted();
  assert.equal(d?.events.special_message, 'Welcome, all', 'this save was lost');
  assert.equal(d?.events.what_to_bring, 'An umbrella', 'the other host’s save was overwritten');
  await db.query(`DELETE FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId]);
});

test('2 · the first save of all, raced — two hosts both see "no draft yet": both saves are kept', async () => {
  let rounds = 0;
  await store.updateHubDraft(A(), F.eventId, async (cur) => {
    rounds += 1;
    if (rounds === 1) await store.updateHubDraft(B(), F.eventId, (c) => ({ next: mergeHubDraft(c ?? emptyHubDraft(), { events: { what_to_bring: 'Shades' } }) }));
    return { next: mergeHubDraft(cur ?? emptyHubDraft(), { events: { special_message: 'Hi' } }) };
  });
  const d = await drafted();
  assert.deepEqual([d?.events.special_message, d?.events.what_to_bring], ['Hi', 'Shades']);
  await db.query(`DELETE FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId]);
});

test('3 · the Mood Board incident through the store: a WHOLE dress code from a stale screen keeps the other host’s outfit', async () => {
  // Live: the dress code both screens opened with.
  const opened = { women: { family: { style: 'gown' } }, men: {} };
  await db.query(`UPDATE public.events SET dress_code_config = $2 WHERE event_id = $1`, [F.eventId, JSON.stringify(opened)]);
  // Claire (screen B) sets the Secondary Sponsors' outfit — sent whole, with its base, as the studio sends it.
  const save = (client: never, mine: unknown, base: unknown) =>
    store.updateHubDraft(client, F.eventId, async (cur) => {
      const c = cur ?? emptyHubDraft();
      const r = await store.rebaseOnDraft(client, F.eventId, c, { events: { dress_code_config: mine } }, { events: { dress_code_config: base } });
      return { next: mergeHubDraft(c, r.patch), said: r };
    });
  await save(B(), { women: { family: { style: 'gown' }, sponsors: { style: 'filipiniana' } }, men: {} }, opened);
  // Indalecio (screen A), still showing the board he opened, changes Immediate Family.
  const mine = await save(A(), { women: { family: { style: 'cocktail' } }, men: {} }, opened);
  const women = ((await drafted())?.events.dress_code_config as { women: Record<string, { style: string }> }).women;
  assert.equal(women.family?.style, 'cocktail', 'this save was lost');
  assert.equal(women.sponsors?.style, 'filipiniana', 'the other host’s outfit was wiped — the 2026-10-17 incident');
  assert.equal(mine.said?.moved, true, 'the stale screen is not told to show the newest');
  // Both change the same outfit: the later save wins, and it is named.
  const later = await save(B(), { women: { family: { style: 'suit' }, sponsors: { style: 'filipiniana' } }, men: {} }, { women: { family: { style: 'gown' }, sponsors: { style: 'filipiniana' } }, men: {} });
  assert.equal(((await drafted())?.events.dress_code_config as { women: Record<string, { style: string }> }).women.family?.style, 'suit');
  assert.deepEqual(later.said?.clashed, ['dress_code_config.women.family.style']);
  await db.query(`DELETE FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId]);
});

test('4 · a writer that is not a host still writes nothing — the compare-and-set did not open a door', async () => {
  const stranger = (await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ('two-hosts-x@draft.test') RETURNING id`)).rows[0]!.id;
  await assert.rejects(store.updateHubDraft(clientAs(db, stranger) as never, F.eventId, () => ({ next: mergeHubDraft(emptyHubDraft(), { events: { special_message: 'x' } }) })));
  const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId])).rows[0]!.n;
  assert.equal(n, 0);
});
