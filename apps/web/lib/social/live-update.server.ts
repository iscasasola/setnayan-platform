import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayServiceLabel } from '@/lib/vendors';
import { siteUrl } from '@/lib/social/urls';
import { badgePostIsNamed, parseRealCounts } from '@/lib/social/lane-s';
import {
  addPhDays,
  isPhSunday,
  phDayKey,
  slotInstant,
} from '@/lib/social/governor';
import {
  composeLiveUpdate,
  inLiveComposeWindow,
  liveUpdateSourceRef,
  type LiveFacts,
  type LiveShop,
} from '@/lib/social/live-update';

/**
 * apps/web/lib/social/live-update.server.ts — the 2 PM live composer (owner, 28 Nov 2026). Runs inside the flush,
 * after the governor has handed every waiting auto-post its 14:00 slot. If TODAY's 14:00 is still empty, it reads
 * this week's real news and composes one post for that slot; with no real news it leaves the slot empty and logs it.
 *
 *   • Window: from 10:00 to 13:50 Manila (`inLiveComposeWindow`): the news is the day's, and 13:50 is the last moment
 *     Facebook still accepts the post as a scheduled post for 14:00, so the same visit hands it over. Outside the
 *     window it does nothing.
 *   • Reads: `social_live_week_facts()` (events held, suppliers verified, test and sample data left out) and, on
 *     Sunday, `social_milestone_real_counts()` — the milestone sweep's one reader of the all-time totals.
 *   • A read that fails is a null fact, never zero. Never throws.
 */

type Admin = SupabaseClient | ReturnType<typeof createAdminClient>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The day this instance last logged an empty 2 PM, so the log says it once a day, not every flush. */
let loggedEmptyDay: string | null = null;

type ShopFact = {
  business_name: string | null;
  services: string[] | null;
  hq_region: string | null;
  location_city: string | null;
  tier_state: string | null;
  tier_expires_at: string | null;
};

function toLiveShop(row: ShopFact, now: Date): LiveShop {
  return {
    named: badgePostIsNamed(row, now),
    businessName: row.business_name ?? '',
    category: row.services?.[0] ? displayServiceLabel(row.services[0]) : 'Supplier',
    region: row.hq_region ?? row.location_city ?? 'the Philippines',
  };
}

/** This week's real news. Every fact that cannot be read is null. */
export async function readLiveFacts(admin: Admin, now: Date): Promise<LiveFacts> {
  const today = phDayKey(now);
  const facts: LiveFacts = { shopsVerified: null, eventsHeld: null, totals: null };

  const { data: week, error: weekErr } = await admin.rpc('social_live_week_facts', {
    p_from_day: addPhDays(today, -7),
    p_to_day: today,
    p_since: new Date(now.getTime() - WEEK_MS).toISOString(),
  });
  if (weekErr) {
    logQueryError('runSocialFlush (live week facts)', weekErr);
  } else if (week && typeof week === 'object' && !Array.isArray(week)) {
    const raw = week as { events_held?: unknown; shops_verified?: unknown };
    const held = typeof raw.events_held === 'string' ? Number(raw.events_held) : raw.events_held;
    facts.eventsHeld = typeof held === 'number' && Number.isInteger(held) && held >= 0 ? held : null;
    facts.shopsVerified = Array.isArray(raw.shops_verified)
      ? (raw.shops_verified as ShopFact[]).map((row) => toLiveShop(row, now))
      : null;
  }

  if (isPhSunday(today)) {
    const { data: counts, error: countErr } = await admin.rpc('social_milestone_real_counts');
    if (countErr) logQueryError('runSocialFlush (live weekly totals)', countErr);
    else facts.totals = parseRealCounts(counts);
  }
  return facts;
}


export async function sweepLiveUpdate(admin: Admin, now: Date): Promise<void> {
  try {
    if (!inLiveComposeWindow(now)) return;
    const day = phDayKey(now);
    const slotIso = slotInstant(day, 'afternoon').toISOString();

    // Is today's 14:00 already held (a planned post, an auto-post, or today's live update)?
    const { data: held, error: heldErr } = await admin
      .from('social_posts')
      .select('post_id')
      .eq('scheduled_for', slotIso)
      .in('status', ['scheduled', 'scheduled_on_fb', 'publishing', 'published'])
      .limit(1);
    if (heldErr) {
      logQueryError('runSocialFlush (live slot check)', heldErr);
      return; // cannot tell — compose nothing rather than double a slot
    }
    if ((held ?? []).length > 0) return;

    // Today's live update already exists in any state — a pulled one stays pulled, never re-drafted.
    const { data: drafted, error: draftedErr } = await admin
      .from('social_posts')
      .select('post_id')
      .eq('source_type', 'live_update')
      .eq('source_ref', liveUpdateSourceRef(day))
      .limit(1);
    if (draftedErr) {
      logQueryError('runSocialFlush (live update lookup)', draftedErr);
      return;
    }
    if ((drafted ?? []).length > 0) return;

    const post = composeLiveUpdate(await readLiveFacts(admin, now), day, isPhSunday(day));
    if (!post) {
      if (loggedEmptyDay !== day) {
        loggedEmptyDay = day;
        console.info(`[social] ${day} 14:00 left empty: no real update to post today.`);
      }
      return;
    }

    const { error } = await admin.from('social_posts').insert({
      source_type: 'live_update',
      source_ref: liveUpdateSourceRef(day),
      title: post.title,
      body: post.body,
      link_url: siteUrl(),
      slot: 'afternoon',
      scheduled_for: slotIso,
    });
    // 23505 = today's live update already exists (a concurrent flush) — expected.
    if (error && error.code !== '23505') {
      logQueryError('runSocialFlush (compose live_update)', error, { day });
    }
  } catch (err) {
    logQueryError('runSocialFlush (live update)', err);
  }
}
