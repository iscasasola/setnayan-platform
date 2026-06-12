import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayServiceLabel } from '@/lib/vendors';
import {
  SHARE_ARTIFACT_LABEL,
  coupleCreationCaption,
  shareConsentPostableFrom,
  vendorFeatureCaption,
  type ShareArtifactType,
  type ShareCreditMode,
} from '@/lib/social-sharing';
import { nextAvailableSlot } from '@/lib/social/governor';
import { isFacebookConfigured, postToFacebookPage } from '@/lib/social/facebook';

/**
 * apps/web/lib/social/flush.ts — THE ENGINE of the social auto-publish
 * pipeline (corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8 +
 * § 8.3b · migration 20261204000000_social_autopublish).
 *
 * CRON-FREE by lock ([[project_setnayan_cron_free]]): `runSocialFlush()` is
 * fired via Next 15 `after()` from a few high-traffic server renders (admin
 * layout · admin social queue · public /vendors marketplace), so dispatch
 * piggybacks on organic traffic. A 10-minute throttle + a single-row
 * conditional-UPDATE claim on social_publish_settings.last_flush_at keep
 * concurrent renders from double-flushing.
 *
 * Two phases per flush:
 *   1. SWEEP-COMPOSE — always runs, even with autopublish off, so the admin
 *      queue shows what WOULD post: new couple-creation consents (48h pull
 *      window), unfeatured verified vendors, freshly crossed milestones
 *      (real COUNT(*) snapshots · aggregate numbers only), an evergreen
 *      content floor when the page goes quiet, take-down awareness for
 *      revoked consents, then governor slot assignment (§ 8.3b cadence).
 *   2. DISPATCH — only when autopublish_enabled AND facebook_enabled AND the
 *      Meta env is present: publish up to 3 due rows to the Facebook Page,
 *      with per-row claim (scheduled → publishing) so a concurrent flush
 *      can never double-post, and per-row try/catch so one bad row never
 *      kills the batch.
 *
 * Everything runs on the service-role client — these tables are admin-only
 * under RLS and the flush has no user session.
 */

/** Min gap between flushes — makes the after() hooks effectively free. */
const FLUSH_THROTTLE_MS = 10 * 60 * 1000;

/** Couple-creation pull window: 48h for the team/couple to pull the post. */
const CREATION_HOLD_MS = 48 * 60 * 60 * 1000;

/** Evergreen floor: repost only when the page had nothing for 3 days … */
const EVERGREEN_QUIET_MS = 3 * 24 * 60 * 60 * 1000;
/** … and never reuse an item more often than every 60 days. */
const EVERGREEN_REUSE_MS = 60 * 24 * 60 * 60 * 1000;

/** Max Facebook publishes per flush — bursts stay small even with a backlog. */
const DISPATCH_BATCH_SIZE = 3;

/** Milestone ladder — § 8: celebrate round numbers, aggregate counts only. */
const MILESTONE_LADDER = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

type AdminClient = ReturnType<typeof createAdminClient>;

type PostRow = {
  post_id: string;
  source_type: 'couple_creation' | 'vendor_feature' | 'milestone' | 'announcement' | 'evergreen';
  source_ref: string;
  body: string;
  media_url: string | null;
  link_url: string | null;
  publish_after: string | null;
  hold_until: string | null;
  scheduled_for: string | null;
  status: string;
  platform_results: Record<string, unknown>;
};

/**
 * Entry point — safe to fire-and-forget from `after()`. Never throws: every
 * failure is logged and swallowed so a flush hiccup can't surface anywhere
 * near a user-facing render.
 */
export async function runSocialFlush(): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date();

    // ── Throttle + concurrency claim ─────────────────────────────────────
    // Single-row conditional UPDATE: only the caller that successfully moves
    // last_flush_at forward owns this flush. Concurrent after() invocations
    // (or a second Vercel region) lose the claim and bail.
    const cutoffIso = new Date(now.getTime() - FLUSH_THROTTLE_MS).toISOString();
    const { data: claim, error: claimErr } = await admin
      .from('social_publish_settings')
      .update({ last_flush_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', true)
      .or(`last_flush_at.is.null,last_flush_at.lt.${cutoffIso}`)
      .select('autopublish_enabled, facebook_enabled');
    if (claimErr) {
      logQueryError('runSocialFlush (claim)', claimErr);
      return;
    }
    if (!claim || claim.length === 0) return; // throttled or lost the claim
    const settings = claim[0] as { autopublish_enabled: boolean; facebook_enabled: boolean };

    // ── Phase 1: sweep-compose (always — the queue UI shows upcoming posts
    // even while the master switch is off) ────────────────────────────────
    await sweepCoupleCreations(admin, now);
    await sweepVendorFeatures(admin, now);
    await sweepMilestones(admin);
    await sweepEvergreenFloor(admin, now);
    await sweepTakedowns(admin, now);
    await assignSchedules(admin, now);

    // ── Phase 2: dispatch (master switch + platform toggle + env) ────────
    if (settings.autopublish_enabled && settings.facebook_enabled && isFacebookConfigured()) {
      await dispatchFacebook(admin, now);
    }
  } catch (err) {
    logQueryError('runSocialFlush (unexpected)', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sweep a: couple-creation consents → posts.
// Live (un-revoked) consents that don't have a post row yet. publish_after =
// event_date + 7d (the content gate — mirrors shareConsentPublishGatePassed);
// hold_until = now + 48h (the pull window, § 8.3b). Consents on events with
// no date yet are SKIPPED, not composed — the gate has nothing to anchor to;
// the sweep picks them up automatically once the couple sets a date.
// ─────────────────────────────────────────────────────────────────────────────
async function sweepCoupleCreations(admin: AdminClient, now: Date): Promise<void> {
  const { data: consentData, error: consentErr } = await admin
    .from('marketing_share_consents')
    .select('consent_id, event_id, artifact_type, artifact_ref, credit_mode')
    .is('revoked_at', null)
    .order('consented_at', { ascending: true })
    .limit(500);
  if (consentErr) {
    logQueryError('runSocialFlush (consents sweep)', consentErr);
    return;
  }
  const consents = (consentData ?? []) as Array<{
    consent_id: string;
    event_id: string;
    artifact_type: ShareArtifactType;
    artifact_ref: string;
    credit_mode: ShareCreditMode;
  }>;
  if (consents.length === 0) return;

  const fresh = await withoutExistingPosts(
    admin,
    'couple_creation',
    consents,
    (c) => c.consent_id,
  );
  if (fresh.length === 0) return;

  // Event names + dates in one batch (no FK-joined select — relationship not
  // declared in the schema cache; matches /admin/social-queue).
  const eventIds = Array.from(new Set(fresh.map((c) => c.event_id)));
  const { data: eventData } = await admin
    .from('events')
    .select('event_id, display_name, event_date')
    .in('event_id', eventIds);
  const eventMap = new Map(
    ((eventData ?? []) as Array<{
      event_id: string;
      display_name: string | null;
      event_date: string | null;
    }>).map((e) => [e.event_id, e]),
  );

  for (const consent of fresh) {
    const ev = eventMap.get(consent.event_id);
    const postableFrom = shareConsentPostableFrom(ev?.event_date ?? null);
    if (!postableFrom) continue; // no event date yet — sweep again later

    const coupleName = ev?.display_name ?? '';
    const { error } = await admin.from('social_posts').insert({
      source_type: 'couple_creation',
      source_ref: consent.consent_id,
      title: `${SHARE_ARTIFACT_LABEL[consent.artifact_type] ?? consent.artifact_type} · ${
        coupleName || 'Setnayan couple'
      }`,
      body: coupleCreationCaption({
        artifactType: consent.artifact_type,
        creditMode: consent.credit_mode,
        coupleName,
      }),
      media_url: null, // artifact renderer is Phase B
      link_url: 'https://www.setnayan.com',
      // Content gate at PH midnight of event_date + 7d (PH has no DST —
      // fixed +08:00, same rationale as lib/social/governor.ts).
      publish_after: new Date(`${postableFrom}T00:00:00+08:00`).toISOString(),
      hold_until: new Date(now.getTime() + CREATION_HOLD_MS).toISOString(),
    });
    // Unique-index conflicts (concurrent flush) are expected — ignore quietly.
    if (error && error.code !== '23505') {
      logQueryError('runSocialFlush (compose couple_creation)', error, {
        consent_id: consent.consent_id,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sweep b: vendor verification features → posts. Unnamed (category + region)
// for Free, named for active Pro+ — the owner-locked hybrid (tiers sell
// REACH · project_setnayan_vendor_hybrid_anonymity). No hold window: vendor
// features publish at the next governor slot (§ 8.3b).
// ─────────────────────────────────────────────────────────────────────────────
async function sweepVendorFeatures(admin: AdminClient, now: Date): Promise<void> {
  const { data: vendorData, error: vendorErr } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, business_name, services, location_city, hq_region, tier_state, tier_expires_at',
    )
    .eq('public_visibility', 'verified')
    .eq('social_feature_opt_out', false)
    .is('social_featured_at', null)
    .order('created_at', { ascending: true })
    .limit(200);
  if (vendorErr) {
    logQueryError('runSocialFlush (vendors sweep)', vendorErr);
    return;
  }
  const vendors = (vendorData ?? []) as Array<{
    vendor_profile_id: string;
    business_name: string;
    services: string[];
    location_city: string | null;
    hq_region: string | null;
    tier_state: string | null;
    tier_expires_at: string | null;
  }>;
  if (vendors.length === 0) return;

  const fresh = await withoutExistingPosts(
    admin,
    'vendor_feature',
    vendors,
    (v) => v.vendor_profile_id,
  );

  for (const vendor of fresh) {
    // Same Pro+ derivation as the queue page: tier_state guarded by
    // tier_expires_at because the downgrade sweep is login-driven.
    const proActive =
      (vendor.tier_state === 'pro' || vendor.tier_state === 'enterprise') &&
      (!vendor.tier_expires_at || new Date(vendor.tier_expires_at).getTime() > now.getTime());
    const categoryLabel = vendor.services?.[0]
      ? displayServiceLabel(vendor.services[0])
      : 'vendor';
    const region = vendor.hq_region ?? vendor.location_city ?? 'the Philippines';

    const { error } = await admin.from('social_posts').insert({
      source_type: 'vendor_feature',
      source_ref: vendor.vendor_profile_id,
      title: proActive
        ? `Vendor feature · ${vendor.business_name || 'Unnamed vendor'}`
        : `Vendor feature · a new ${categoryLabel.toLowerCase()} (unnamed · Free)`,
      body: vendorFeatureCaption({
        named: proActive,
        businessName: vendor.business_name ?? '',
        categoryLabel,
        region,
      }),
    });
    if (error && error.code !== '23505') {
      logQueryError('runSocialFlush (compose vendor_feature)', error, {
        vendor_profile_id: vendor.vendor_profile_id,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sweep c: milestones. Real COUNT(*) snapshots — aggregate numbers ONLY,
// never names ([[project_setnayan_behavioral_data_edge]] posture). For each
// metric, only the HIGHEST freshly crossed rung gets celebrated; the
// social_milestones UNIQUE(metric, threshold) watermark makes this
// insert-once even across concurrent flushes.
// ─────────────────────────────────────────────────────────────────────────────
async function sweepMilestones(admin: AdminClient): Promise<void> {
  const counts = await Promise.all([
    admin.from('events').select('event_id', { count: 'exact', head: true }),
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id', { count: 'exact', head: true })
      .eq('public_visibility', 'verified'),
    admin.from('guests').select('guest_id', { count: 'exact', head: true }),
  ]);

  const metrics: Array<{ metric: string; count: number | null; caption: (n: number) => string }> = [
    {
      metric: 'events_created',
      count: counts[0].count,
      caption: (n) =>
        `🎉 ${n.toLocaleString('en-PH')}+ celebrations now planned on Setnayan — from "will you?" to "Set na 'yan." Thank you for trusting us with your big days. ✨\n\n#Setnayan #SetNaYan`,
    },
    {
      metric: 'vendors_verified',
      count: counts[1].count,
      caption: (n) =>
        `✅ ${n.toLocaleString('en-PH')}+ verified vendors on the Setnayan marketplace — every single one vetted by our team before they meet your big day.\n\n#Setnayan #SetNaYan`,
    },
    {
      metric: 'guests_invited',
      count: counts[2].count,
      caption: (n) =>
        `💌 ${n.toLocaleString('en-PH')}+ guests invited through Setnayan — QR invitations, RSVPs, and seats, all sorted. Set na 'yan.\n\n#Setnayan #SetNaYan`,
    },
  ];
  for (const [i, res] of counts.entries()) {
    if (res.error) {
      logQueryError('runSocialFlush (milestone count)', res.error, {
        metric: metrics[i]?.metric ?? `index_${i}`,
      });
    }
  }

  const { data: watermarkData, error: watermarkErr } = await admin
    .from('social_milestones')
    .select('metric, threshold');
  if (watermarkErr) {
    logQueryError('runSocialFlush (milestone watermarks)', watermarkErr);
    return;
  }
  const recorded = new Set(
    ((watermarkData ?? []) as Array<{ metric: string; threshold: number }>).map(
      (w) => `${w.metric}:${w.threshold}`,
    ),
  );

  for (const { metric, count, caption } of metrics) {
    if (count === null || count === undefined) continue; // count query failed — skip, never guess
    const crossed = MILESTONE_LADDER.filter((t) => t <= count);
    const highest = crossed[crossed.length - 1];
    if (highest === undefined) continue;
    if (recorded.has(`${metric}:${highest}`)) continue;

    // Watermark FIRST — UNIQUE(metric, threshold) is the idempotency gate.
    const { error: insertErr } = await admin
      .from('social_milestones')
      .insert({ metric, threshold: highest });
    if (insertErr) {
      if (insertErr.code !== '23505') {
        logQueryError('runSocialFlush (milestone watermark insert)', insertErr, { metric });
      }
      continue; // another flush got here first
    }

    const { data: postData, error: postErr } = await admin
      .from('social_posts')
      .insert({
        source_type: 'milestone',
        source_ref: `${metric}:${highest}`,
        title: `Milestone · ${metric.replace(/_/g, ' ')} reached ${highest.toLocaleString('en-PH')}`,
        body: caption(highest),
        link_url: 'https://www.setnayan.com',
      })
      .select('post_id')
      .single();
    if (postErr) {
      if (postErr.code !== '23505') {
        logQueryError('runSocialFlush (compose milestone)', postErr, { metric });
      }
      continue;
    }

    await admin
      .from('social_milestones')
      .update({ post_id: (postData as { post_id: string }).post_id })
      .eq('metric', metric)
      .eq('threshold', highest);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sweep d: evergreen content floor. If the page has had nothing published or
// scheduled for 3 days, repost the least-recently-used active evergreen item
// (never the same item within 60 days) so the page never looks abandoned.
// ─────────────────────────────────────────────────────────────────────────────
async function sweepEvergreenFloor(admin: AdminClient, now: Date): Promise<void> {
  const quietCutoff = new Date(now.getTime() - EVERGREEN_QUIET_MS).toISOString();
  const { count: recentCount, error: recentErr } = await admin
    .from('social_posts')
    .select('post_id', { count: 'exact', head: true })
    .in('status', ['scheduled', 'publishing', 'published'])
    .or(`created_at.gte.${quietCutoff},scheduled_for.gte.${quietCutoff}`);
  if (recentErr) {
    logQueryError('runSocialFlush (evergreen quiet check)', recentErr);
    return;
  }
  if ((recentCount ?? 0) > 0) return; // the page isn't quiet — no floor needed

  const reuseCutoff = new Date(now.getTime() - EVERGREEN_REUSE_MS).toISOString();
  const { data: itemData, error: itemErr } = await admin
    .from('social_evergreen_items')
    .select('item_id, title, body, media_url, link_url, last_used_at, times_used')
    .eq('is_active', true)
    .or(`last_used_at.is.null,last_used_at.lt.${reuseCutoff}`)
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .limit(1);
  if (itemErr) {
    logQueryError('runSocialFlush (evergreen pick)', itemErr);
    return;
  }
  const item = (itemData ?? [])[0] as
    | {
        item_id: string;
        title: string;
        body: string;
        media_url: string | null;
        link_url: string | null;
        times_used: number;
      }
    | undefined;
  if (!item) return;

  const { error: composeErr } = await admin.from('social_posts').insert({
    source_type: 'evergreen',
    source_ref: item.item_id,
    title: item.title,
    body: item.body,
    media_url: item.media_url,
    link_url: item.link_url,
  });
  if (composeErr) {
    logQueryError('runSocialFlush (compose evergreen)', composeErr, { item_id: item.item_id });
    return;
  }

  await admin
    .from('social_evergreen_items')
    .update({
      last_used_at: now.toISOString(),
      times_used: item.times_used + 1,
      updated_at: now.toISOString(),
    })
    .eq('item_id', item.item_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sweep e: take-down awareness. A couple revoking consent must pull the post
// BEFORE it goes out — un-published rows flip to 'pulled' here. (Revokes
// after publishing stay the manual take-down lane in the admin Social Queue,
// 24h SLA — an API delete is Phase B.)
// ─────────────────────────────────────────────────────────────────────────────
async function sweepTakedowns(admin: AdminClient, now: Date): Promise<void> {
  const { data: pendingData, error: pendingErr } = await admin
    .from('social_posts')
    .select('post_id, source_ref')
    .eq('source_type', 'couple_creation')
    .in('status', ['scheduled', 'publishing'])
    .limit(500);
  if (pendingErr) {
    logQueryError('runSocialFlush (takedown scan)', pendingErr);
    return;
  }
  const pending = (pendingData ?? []) as Array<{ post_id: string; source_ref: string }>;
  if (pending.length === 0) return;

  const { data: revokedData, error: revokedErr } = await admin
    .from('marketing_share_consents')
    .select('consent_id')
    .in('consent_id', pending.map((p) => p.source_ref))
    .not('revoked_at', 'is', null);
  if (revokedErr) {
    logQueryError('runSocialFlush (takedown revoked lookup)', revokedErr);
    return;
  }
  const revoked = new Set(
    ((revokedData ?? []) as Array<{ consent_id: string }>).map((r) => r.consent_id),
  );
  const toPull = pending.filter((p) => revoked.has(p.source_ref));
  if (toPull.length === 0) return;

  const { error: pullErr } = await admin
    .from('social_posts')
    .update({ status: 'pulled', updated_at: now.toISOString() })
    .in('post_id', toPull.map((p) => p.post_id))
    .in('status', ['scheduled', 'publishing']);
  if (pullErr) {
    logQueryError('runSocialFlush (takedown pull)', pullErr);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Governor pass: every 'scheduled' row without a slot gets the next § 8.3b
// slot (PH prime window · FB ≤3/day · ≥3h spacing). The eligibility floor is
// max(now, publish_after, hold_until) so a slot is never burned on a row
// that couldn't dispatch there anyway.
// ─────────────────────────────────────────────────────────────────────────────
async function assignSchedules(admin: AdminClient, now: Date): Promise<void> {
  const { data: unscheduledData, error: unscheduledErr } = await admin
    .from('social_posts')
    .select('post_id, publish_after, hold_until')
    .eq('status', 'scheduled')
    .is('scheduled_for', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (unscheduledErr) {
    logQueryError('runSocialFlush (unscheduled scan)', unscheduledErr);
    return;
  }
  const unscheduled = (unscheduledData ?? []) as Array<{
    post_id: string;
    publish_after: string | null;
    hold_until: string | null;
  }>;
  if (unscheduled.length === 0) return;

  // Taken slots = everything scheduled or published in the last 24h plus the
  // whole forward queue (anything with scheduled_for ≥ now − 24h).
  const takenCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: takenData, error: takenErr } = await admin
    .from('social_posts')
    .select('scheduled_for')
    .in('status', ['scheduled', 'publishing', 'published'])
    .gte('scheduled_for', takenCutoff);
  if (takenErr) {
    logQueryError('runSocialFlush (taken slots)', takenErr);
    return;
  }
  const takenSlots = ((takenData ?? []) as Array<{ scheduled_for: string | null }>)
    .map((r) => (r.scheduled_for ? new Date(r.scheduled_for) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));

  for (const row of unscheduled) {
    const floor = new Date(
      Math.max(
        now.getTime(),
        row.publish_after ? new Date(row.publish_after).getTime() : 0,
        row.hold_until ? new Date(row.hold_until).getTime() : 0,
      ),
    );
    const slot = nextAvailableSlot('facebook', takenSlots, floor);
    const { error } = await admin
      .from('social_posts')
      .update({ scheduled_for: slot.toISOString(), updated_at: now.toISOString() })
      .eq('post_id', row.post_id)
      .eq('status', 'scheduled');
    if (error) {
      logQueryError('runSocialFlush (assign slot)', error, { post_id: row.post_id });
      continue;
    }
    takenSlots.push(slot); // later rows in this pass must respect this slot
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch: publish due rows to the Facebook Page. Per-row claim
// (scheduled → publishing, conditional UPDATE … RETURNING) means a
// concurrent flush can never double-post; per-row try/catch means one bad
// row never kills the batch.
// ─────────────────────────────────────────────────────────────────────────────
async function dispatchFacebook(admin: AdminClient, now: Date): Promise<void> {
  const nowIso = now.toISOString();
  const { data: dueData, error: dueErr } = await admin
    .from('social_posts')
    .select(
      'post_id, source_type, source_ref, body, media_url, link_url, publish_after, hold_until, scheduled_for, status, platform_results',
    )
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso)
    .or(`publish_after.is.null,publish_after.lte.${nowIso}`)
    .or(`hold_until.is.null,hold_until.lte.${nowIso}`)
    .order('scheduled_for', { ascending: true })
    .limit(DISPATCH_BATCH_SIZE);
  if (dueErr) {
    logQueryError('runSocialFlush (due scan)', dueErr);
    return;
  }
  const due = (dueData ?? []) as PostRow[];

  for (const post of due) {
    try {
      // Claim — only the flush that flips scheduled → publishing owns the row.
      const { data: claimed, error: claimErr } = await admin
        .from('social_posts')
        .update({ status: 'publishing', updated_at: new Date().toISOString() })
        .eq('post_id', post.post_id)
        .eq('status', 'scheduled')
        .select('post_id');
      if (claimErr) {
        logQueryError('runSocialFlush (row claim)', claimErr, { post_id: post.post_id });
        continue;
      }
      if (!claimed || claimed.length === 0) continue; // another flush owns it

      const result = await postToFacebookPage({
        message: post.body,
        linkUrl: post.link_url,
        mediaUrl: post.media_url,
      });
      const stampedAt = new Date().toISOString();

      if (result.ok) {
        await admin
          .from('social_posts')
          .update({
            status: 'published',
            platform_results: {
              ...post.platform_results,
              facebook: {
                status: 'published',
                external_id: result.externalId,
                post_url: result.postUrl,
                posted_at: stampedAt,
                error: null,
              },
            },
            updated_at: stampedAt,
          })
          .eq('post_id', post.post_id);

        // Side-effects back onto the consent substrate — same stamps the
        // manual Social Queue actions write, guarded so a manual stamp wins.
        if (post.source_type === 'couple_creation') {
          await admin
            .from('marketing_share_consents')
            .update({ posted_at: stampedAt, post_url: result.postUrl, updated_at: stampedAt })
            .eq('consent_id', post.source_ref)
            .is('posted_at', null);
        } else if (post.source_type === 'vendor_feature') {
          await admin
            .from('vendor_profiles')
            .update({
              social_featured_at: stampedAt,
              social_post_url: result.postUrl,
              updated_at: stampedAt,
            })
            .eq('vendor_profile_id', post.source_ref)
            .is('social_featured_at', null);
        }
      } else {
        await admin
          .from('social_posts')
          .update({
            status: 'failed',
            platform_results: {
              ...post.platform_results,
              facebook: {
                status: 'failed',
                external_id: null,
                posted_at: null,
                error: result.error,
              },
            },
            updated_at: stampedAt,
          })
          .eq('post_id', post.post_id);
      }
    } catch (err) {
      // One bad row must never kill the flush — stamp it failed and move on.
      logQueryError('runSocialFlush (dispatch row)', err, { post_id: post.post_id });
      await admin
        .from('social_posts')
        .update({
          status: 'failed',
          platform_results: {
            ...post.platform_results,
            facebook: {
              status: 'failed',
              external_id: null,
              posted_at: null,
              error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown dispatch error',
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('post_id', post.post_id)
        .eq('status', 'publishing');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: filter a candidate list down to those WITHOUT an existing
// social_posts row for (source_type, ref). The partial-unique index is the
// hard guarantee; this pre-filter just avoids hammering it with conflicting
// inserts every flush. ('pulled' rows DO block re-compose here even though
// the index exempts them — a deliberate pull shouldn't resurrect next flush.)
// ─────────────────────────────────────────────────────────────────────────────
async function withoutExistingPosts<T>(
  admin: AdminClient,
  sourceType: PostRow['source_type'],
  candidates: T[],
  refOf: (candidate: T) => string,
): Promise<T[]> {
  const refs = candidates.map(refOf);
  const { data, error } = await admin
    .from('social_posts')
    .select('source_ref')
    .eq('source_type', sourceType)
    .in('source_ref', refs);
  if (error) {
    logQueryError('runSocialFlush (existing posts lookup)', error, { source_type: sourceType });
    return []; // can't tell what exists — compose nothing rather than duplicate
  }
  const existing = new Set(
    ((data ?? []) as Array<{ source_ref: string }>).map((r) => r.source_ref),
  );
  return candidates.filter((c) => !existing.has(refOf(c)));
}
