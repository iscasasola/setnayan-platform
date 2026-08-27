/**
 * THE WAKE EVENT TYPE EXISTS, AND IT IS SOLEMN — migrations
 * 20271163083797_the_words_follow_the_occasion (which created it as `funeral`)
 * and 20271173859461_the_event_is_a_wake (which corrected the name), asserted
 * against the replayed schema rather than trusted from their own comments.
 *
 * ⚖ THE NAME IS THE OWNER'S, 2026-08-27: "Wake is the viewing (our event not
 * funeral). Funeral is the ceremony until burial." The wake is the stretch a
 * family plans here; the funeral is the ceremony on its closing day and keeps
 * that word on the run-of-show, in onboarding and as a supplier category. If a
 * later sweep tries to make this file say "funeral" again, it is undoing a
 * distinction, not fixing a typo.
 *
 * (original header) — migration
 * 20271163083797_the_words_follow_the_occasion, asserted against the replayed
 * schema rather than trusted from its own comments.
 *
 * Owner ruling 2026-08-17 ("yes to all four"): the type is approved as a new
 * event type, a wake MAY accept money with gentler wording, and the build
 * is a TONE change across the guest tree. The tone switch is the profile's
 * `register: 'solemn'` — so this file pins the DATA that every solemn branch
 * in the app hangs from. If the row drifts (an admin save that rebuilds the
 * terminology blob, a careless re-seed), the wake's page silently reverts to
 * "The celebration is underway", which is the entire defect.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the vocab row exists, enabled, with its own emoji', async () => {
  const r = await db.query<{
    label_en: string;
    enabled: boolean;
    status: string;
    emoji: string;
    sort_order: number;
  }>(
    `SELECT label_en, enabled, status, emoji, sort_order
       FROM public.event_type_vocab WHERE event_type = 'wake'`,
  );
  assert.equal(r.rows.length, 1, 'no wake row in event_type_vocab');
  const row = r.rows[0]!;
  assert.equal(row.label_en, 'Wake');
  assert.equal(row.enabled, true);
  assert.equal(row.status, 'active');
  assert.equal(row.emoji, '🕊️');
  // 🕯️ is christening's — the two must not collide on the picker.
  const clash = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_type_vocab
      WHERE emoji = '🕊️' AND event_type <> 'wake'`,
  );
  assert.equal(clash.rows[0]!.n, 0, 'another type shares the wake emoji');
});

test('the profile carries the solemn register and the family’s words', async () => {
  const r = await db.query<{
    terminology: Record<string, unknown>;
    enabled_surfaces: string[];
    event_class: string;
    multi_day: boolean;
    marketplace_enabled: boolean;
  }>(
    `SELECT terminology, enabled_surfaces, event_class, multi_day, marketplace_enabled
       FROM public.event_type_profiles WHERE event_type = 'wake'`,
  );
  assert.equal(r.rows.length, 1, 'no wake row in event_type_profiles');
  const row = r.rows[0]!;
  const t = row.terminology;
  assert.equal(t.register, 'solemn');
  assert.equal(t.occasion_noun, 'gathering');
  assert.equal(t.organizer_noun, 'family');
  assert.equal(t.event_word, 'wake');
  assert.equal(t.vip_tier_label, 'Immediate family');
  // No save-the-date and no monogram — a wake never meets the wedding film.
  assert.ok(!row.enabled_surfaces.includes('save_the_date'));
  assert.ok(!row.enabled_surfaces.includes('monogram'));
  assert.ok(row.enabled_surfaces.includes('website'));
  assert.ok(row.enabled_surfaces.includes('rsvp'));
  // A lamay runs for days; a funeral is personal; suppliers exist for it.
  assert.equal(row.multi_day, true);
  assert.equal(row.event_class, 'personal');
  assert.equal(row.marketplace_enabled, true);
});

test('the onboarding welcome is seeded in the quiet voice', async () => {
  const r = await db.query<{ intro: Record<string, unknown> }>(
    `SELECT intro FROM public.event_type_onboarding WHERE event_type = 'wake'`,
  );
  assert.equal(r.rows.length, 1, 'no wake row in event_type_onboarding');
  const intro = r.rows[0]!.intro;
  // Shape-complete, or resolveOnboardingSpec's isIntro() rejects the whole
  // override and the family gets "shape a plan made for your celebration".
  assert.equal(typeof intro.eyebrow, 'string');
  assert.equal(typeof intro.headline, 'string');
  assert.equal(typeof intro.subcopy, 'string');
  assert.ok(!String(intro.headline).toLowerCase().includes('celebrat'));
});

test('the wake names its own onboarding pack in the column', async () => {
  // It shipped NULL — the only enabled type with no value here — so the flow
  // resolved the pack key 'generic' and everything authored for a wake was
  // unreachable, while the admin editor (which falls back to the event type)
  // showed HQ a pack the visitor never got. Asserted BY THE OBJECT, not by
  // schema_migrations.
  const r = await db.query<{ onboarding_flow_key: string | null }>(
    `SELECT onboarding_flow_key FROM public.event_type_profiles WHERE event_type = 'wake'`,
  );
  assert.equal(r.rows.length, 1, 'no wake profile row');
  assert.equal(r.rows[0]!.onboarding_flow_key, 'wake');
});

test('the marketplace reaches the wake through its seven scoped tiles', async () => {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM public.service_categories
      WHERE 'wake' = ANY(applicable_event_types) ORDER BY id`,
  );
  const ids = r.rows.map((row) => row.id);
  // FLOORED — an empty sweep must not pass — and exact, so a silent widening
  // of the wake's marketplace is a decision someone makes here, on purpose.
  assert.deepEqual(ids, [
    'catering',
    'choir',
    'coordinator',
    'florist',
    'guest_shuttle',
    'photo_video',
    'printing',
  ]);
});

test('an event can BE a wake — and a community can never own one', async () => {
  // The FK accepts the registered type.
  const ok = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Paalam, Lolo', 'wake', DATE '2026-09-04') RETURNING event_id`,
  );
  assert.equal(ok.rows.length, 1);

  // events_community_class_consistency lists the community-eligible types and
  // 'wake' is not among them — a personal milestone stays personal (owner
  // lock 2026-07-15). Assert the refusal so a future widening is deliberate.
  const community = await db.query<{ community_id: string }>(
    `INSERT INTO public.communities (name) VALUES ('Samahan Test') RETURNING community_id`,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.events (display_name, event_type, event_date, community_id)
       VALUES ('A community wake', 'wake', DATE '2026-09-05', $1)`,
      [community.rows[0]!.community_id],
    ),
    /events_community_class_consistency|check constraint/i,
  );
});
