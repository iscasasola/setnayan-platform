import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Creator Economy PR-C — chapter→inquiry ATTRIBUTION + inquiry provenance.
 *
 * Paper locks honored (owner 2026-07-16):
 *   • CTA-CLICK attribution — the chapter whose Book CTA started the thread is
 *     the ONE credited chapter. Stamped once at thread creation, validated
 *     server-side (never trust the query param alone), never overwritten.
 *   • audience_rate_terms is the ONLY offer field this module lets a public/
 *     couple-facing surface read. creator_rate_terms is never selected here for
 *     public rendering (the vendor-private thread surface reads it via the
 *     vendor's own RLS-scoped offers, not through this module).
 *   • "inquiries driven" — the only public metric: a raw count of DISTINCT
 *     events whose attributed thread the vendor UNLOCKED, with exactly two
 *     guards (council verdict §2.1): exclude unlocks by a vendor the creator
 *     owns; dedup per couple/event (COUNT DISTINCT event_id).
 *
 * All reads run on the service-role admin client and filter in app code — the
 * same public-read pattern as lib/creator-public.ts.
 */

// ---------------------------------------------------------------------------
// Book-CTA referral validation.
// ---------------------------------------------------------------------------

export type ReferringChapter = {
  chapterId: string;
  chapterPublicId: string;
  creatorUserId: string;
};

/**
 * Validate a `ref_chapter` public id (S89C-…) against the vendor being
 * inquired on. The stamp is only honest when:
 *   1. the chapter exists and is PUBLISHED,
 *   2. its owner's public profile is enabled (a published chapter on a public
 *      profile IS the creator surface), and
 *   3. the chapter's shoppable substrate actually CREDITS this vendor (by
 *      business_slug or vendor public_id) — a forged/stale param must not
 *      manufacture attribution.
 * Any failure returns null → the inquiry proceeds unattributed (website).
 */
export async function resolveReferringChapter(
  chapterPublicId: string | null | undefined,
  vendorProfileId: string,
): Promise<ReferringChapter | null> {
  const publicId = String(chapterPublicId ?? '').trim();
  if (!publicId || !vendorProfileId) return null;
  try {
    const admin = createAdminClient();
    const { data: chapter } = await admin
      .from('creator_chapters')
      .select('chapter_id, public_id, user_id, status, substrate')
      .eq('public_id', publicId)
      .eq('status', 'published')
      .maybeSingle();
    if (!chapter) return null;

    const { data: owner } = await admin
      .from('users')
      .select('public_profile_enabled')
      .eq('user_id', chapter.user_id as string)
      .maybeSingle();
    if (owner?.public_profile_enabled !== true) return null;

    // Substrate credit check — vendor_ids holds business_slug OR public_id.
    const substrate = (chapter.substrate ?? {}) as { vendor_ids?: unknown };
    const ids = Array.isArray(substrate.vendor_ids)
      ? substrate.vendor_ids.filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        )
      : [];
    if (ids.length === 0) return null;

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('business_slug, public_id')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (!vendor) return null;
    const credited =
      (vendor.business_slug && ids.includes(vendor.business_slug as string)) ||
      (vendor.public_id && ids.includes(vendor.public_id as string));
    if (!credited) return null;

    return {
      chapterId: chapter.chapter_id as string,
      chapterPublicId: chapter.public_id as string,
      creatorUserId: chapter.user_id as string,
    };
  } catch {
    return null; // best-effort — never block the inquiry
  }
}

// ---------------------------------------------------------------------------
// Returning-customer signal (companion flag, never an origin).
// ---------------------------------------------------------------------------

/**
 * TRUE when a couple member of this event has a prior vendor_event_unlocks row
 * with THIS vendor on a DIFFERENT event — the same returning=1-token predicate
 * the token bands used (the retired FLAT-1 resync branch / get_returning_client_
 * flags' resync_flat, migration 20261201000000). Best-effort: any error → false.
 */
export async function resolveIsReturning(
  vendorProfileId: string,
  eventId: string,
): Promise<boolean> {
  if (!vendorProfileId || !eventId) return false;
  try {
    const admin = createAdminClient();
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');
    const userIds = [
      ...new Set(
        ((members ?? []) as Array<{ user_id: string | null }>)
          .map((m) => m.user_id)
          .filter((v): v is string => !!v),
      ),
    ];
    if (userIds.length === 0) return false;

    const { data: prior } = await admin
      .from('event_members')
      .select('event_id')
      .in('user_id', userIds)
      .eq('member_type', 'couple')
      .neq('event_id', eventId);
    const priorEventIds = [
      ...new Set(
        ((prior ?? []) as Array<{ event_id: string | null }>)
          .map((r) => r.event_id)
          .filter((v): v is string => !!v),
      ),
    ];
    if (priorEventIds.length === 0) return false;

    const { count } = await admin
      .from('vendor_event_unlocks')
      .select('event_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .in('event_id', priorEventIds);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Provenance stamp — once, at thread creation, on the admin client (the couple
// shouldn't need UPDATE rights on provenance columns; the calling action has
// already authenticated + created the thread).
// ---------------------------------------------------------------------------

export async function stampThreadProvenance(
  threadId: string,
  provenance: {
    referringChapterId?: string | null;
    inquirySource?: string | null;
    isReturning?: boolean;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (provenance.referringChapterId) {
    patch.referring_chapter_id = provenance.referringChapterId;
  }
  if (provenance.inquirySource) patch.inquiry_source = provenance.inquirySource;
  if (provenance.isReturning) patch.is_returning = true;
  if (Object.keys(patch).length === 0) return;
  try {
    const admin = createAdminClient();
    // CTA-click lock: only a thread with NO provenance yet takes the stamp —
    // a resumed thread keeps the chapter/source that started it. (The caller
    // already gates on brand-new threads; this is the belt under it.)
    await admin
      .from('chat_threads')
      .update(patch)
      .eq('thread_id', threadId)
      .is('referring_chapter_id', null)
      .is('inquiry_source', null);
  } catch {
    // best-effort — the inquiry already landed; provenance is decoration
  }
}

// ---------------------------------------------------------------------------
// Viewer promo — audience_rate_terms ONLY (public whitelist).
// ---------------------------------------------------------------------------

/**
 * For a chapter's shoppable vendor cards: the ACCEPTED offers between this
 * chapter's creator and the given vendors that carry an audience rate.
 * Returns vendor_profile_id → audience_rate_terms. SELECTS ONLY the whitelisted
 * audience_rate_terms — creator_rate_terms never travels through this path.
 */
export async function fetchAudienceRatesForCreatorVendors(
  creatorUserId: string,
  vendorProfileIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(vendorProfileIds.filter(Boolean))];
  if (!creatorUserId || ids.length === 0) return out;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('vendor_creator_offers')
      .select('vendor_id, audience_rate_terms')
      .eq('creator_user_id', creatorUserId)
      .eq('status', 'accepted')
      .in('vendor_id', ids)
      .not('audience_rate_terms', 'is', null);
    for (const row of (data ?? []) as Array<{
      vendor_id: string;
      audience_rate_terms: string | null;
    }>) {
      const terms = row.audience_rate_terms?.trim();
      if (terms && !out.has(row.vendor_id)) out.set(row.vendor_id, terms);
    }
  } catch {
    /* best-effort */
  }
  return out;
}

// ---------------------------------------------------------------------------
// Vendor-side thread attribution (PRIVATE to the vendor).
// ---------------------------------------------------------------------------

export type ThreadAttribution = {
  chapterTitle: string;
  chapterPublicId: string;
  creatorUserId: string;
  creatorName: string;
  creatorSlug: string | null;
  /** The promo this vendor promised the creator's viewers (accepted offer). */
  audienceRateTerms: string | null;
};

/**
 * Resolve the "Referred by [Storyteller] · via [chapter]" block for a vendor's
 * attributed thread + the audience rate the vendor promised. Admin client;
 * the caller has already ownership-gated the thread to this vendor.
 */
export async function fetchThreadAttribution(thread: {
  referring_chapter_id?: string | null;
  vendor_profile_id: string;
}): Promise<ThreadAttribution | null> {
  const chapterId = thread.referring_chapter_id;
  if (!chapterId) return null;
  try {
    const admin = createAdminClient();
    const { data: chapter } = await admin
      .from('creator_chapters')
      .select('chapter_id, public_id, title, user_id')
      .eq('chapter_id', chapterId)
      .maybeSingle();
    if (!chapter) return null;

    const [{ data: creator }, rates] = await Promise.all([
      admin
        .from('users')
        .select('display_name, slug')
        .eq('user_id', chapter.user_id as string)
        .maybeSingle(),
      fetchAudienceRatesForCreatorVendors(chapter.user_id as string, [
        thread.vendor_profile_id,
      ]),
    ]);

    return {
      chapterTitle: (chapter.title as string) || 'a chapter',
      chapterPublicId: chapter.public_id as string,
      creatorUserId: chapter.user_id as string,
      creatorName:
        (creator?.display_name as string | null)?.trim() || 'A Setnayan storyteller',
      creatorSlug: (creator?.slug as string | null) ?? null,
      audienceRateTerms: rates.get(thread.vendor_profile_id) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * "Creator collab active" marker (build plan § Price separation): TRUE when the
 * given user (the INQUIRER) holds an ACCEPTED collab with THIS vendor — the
 * thread/quote shows "your agreed creator rate applies". Per-vendor: a collab
 * with the florist buys nothing at the caterer.
 */
export async function fetchInquirerCollabActive(
  vendorProfileId: string,
  inquirerUserId: string | null | undefined,
): Promise<boolean> {
  if (!vendorProfileId || !inquirerUserId) return false;
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from('vendor_creator_offers')
      .select('offer_id', { count: 'exact', head: true })
      .eq('vendor_id', vendorProfileId)
      .eq('creator_user_id', inquirerUserId)
      .eq('status', 'accepted');
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// "Inquiries driven" — the ONE public metric (raw integer, renders nothing at 0).
// ---------------------------------------------------------------------------

/**
 * Count, per creator, the DISTINCT events whose chapter-attributed thread the
 * vendor actually UNLOCKED (vendor_event_unlocks row exists for the thread's
 * (vendor, event) pair). The two council-locked WHERE guards:
 *   1. exclude unlocks by a vendor the creator OWNS (vendor_profiles.user_id),
 *   2. dedup per couple/event (COUNT DISTINCT event_id).
 * No tiers, no bands — the raw number.
 */
export async function fetchInquiriesDrivenForCreators(
  creatorUserIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(creatorUserIds.filter(Boolean))];
  if (ids.length === 0) return out;
  try {
    const admin = createAdminClient();

    // 1. The creators' chapters.
    const { data: chapters } = await admin
      .from('creator_chapters')
      .select('chapter_id, user_id')
      .in('user_id', ids);
    const chapterOwner = new Map<string, string>();
    for (const c of (chapters ?? []) as Array<{ chapter_id: string; user_id: string }>) {
      chapterOwner.set(c.chapter_id, c.user_id);
    }
    if (chapterOwner.size === 0) return out;

    // 2. Attributed threads over those chapters.
    const { data: threads } = await admin
      .from('chat_threads')
      .select('event_id, vendor_profile_id, referring_chapter_id, created_by_user_id')
      .in('referring_chapter_id', [...chapterOwner.keys()]);
    const threadRows = (threads ?? []) as Array<{
      event_id: string;
      vendor_profile_id: string;
      referring_chapter_id: string;
      created_by_user_id: string | null;
    }>;
    if (threadRows.length === 0) return out;

    // 3. Which of those (vendor, event) pairs were UNLOCKED.
    const eventIds = [...new Set(threadRows.map((t) => t.event_id))];
    const vendorIds = [...new Set(threadRows.map((t) => t.vendor_profile_id))];
    const [{ data: unlocks }, { data: vendorOwners }] = await Promise.all([
      admin
        .from('vendor_event_unlocks')
        .select('vendor_profile_id, event_id')
        .in('event_id', eventIds)
        .in('vendor_profile_id', vendorIds),
      // Guard 1 — self-owned-vendor unlocks never count.
      admin
        .from('vendor_profiles')
        .select('vendor_profile_id, user_id')
        .in('vendor_profile_id', vendorIds),
    ]);
    const unlocked = new Set(
      ((unlocks ?? []) as Array<{ vendor_profile_id: string; event_id: string }>).map(
        (u) => `${u.vendor_profile_id}:${u.event_id}`,
      ),
    );
    const vendorOwner = new Map(
      ((vendorOwners ?? []) as Array<{ vendor_profile_id: string; user_id: string | null }>).map(
        (v) => [v.vendor_profile_id, v.user_id],
      ),
    );

    // Guard 2 — dedup per couple/event: DISTINCT event_id per creator.
    const eventsByCreator = new Map<string, Set<string>>();
    for (const t of threadRows) {
      if (!unlocked.has(`${t.vendor_profile_id}:${t.event_id}`)) continue;
      const creator = chapterOwner.get(t.referring_chapter_id);
      if (!creator) continue;
      if (vendorOwner.get(t.vendor_profile_id) === creator) continue; // guard 1
      // Guard 2b (G2 defense-in-depth) — a creator self-referring through their
      // own chapter never ticks their own count, even if a legacy/forged row
      // slipped a self-referral stamp past the action-level drop.
      if (t.created_by_user_id && t.created_by_user_id === creator) continue;
      let set = eventsByCreator.get(creator);
      if (!set) {
        set = new Set<string>();
        eventsByCreator.set(creator, set);
      }
      set.add(t.event_id);
    }
    for (const [creator, events] of eventsByCreator) out.set(creator, events.size);
  } catch {
    /* best-effort — surfaces render nothing at 0/absent */
  }
  return out;
}

/** Single-creator convenience over fetchInquiriesDrivenForCreators. */
export async function fetchCreatorInquiriesDriven(userId: string): Promise<number> {
  const map = await fetchInquiriesDrivenForCreators([userId]);
  return map.get(userId) ?? 0;
}

// ---------------------------------------------------------------------------
// Req #3a — the creator's payoff notification, emitted on unlock of an
// attributed thread (existing pipeline; in-app only — chapter_drove_inquiry is
// not on the email allowlist, so no email fires regardless of consent).
// ---------------------------------------------------------------------------

export async function notifyChapterDroveInquiry(thread: {
  referring_chapter_id?: string | null;
  vendor_profile_id: string;
}): Promise<void> {
  const chapterId = thread.referring_chapter_id;
  if (!chapterId) return;
  try {
    const admin = createAdminClient();
    const { data: chapter } = await admin
      .from('creator_chapters')
      .select('title, user_id')
      .eq('chapter_id', chapterId)
      .maybeSingle();
    if (!chapter?.user_id) return;

    // Self-owned-vendor guard (same as the counter): a creator unlocking their
    // own vendor's lead is not a payoff moment.
    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', thread.vendor_profile_id)
      .maybeSingle();
    if (vendor?.user_id && vendor.user_id === chapter.user_id) return;

    const title = ((chapter.title as string) || 'your chapter').slice(0, 80);
    await emitNotification({
      userId: chapter.user_id as string,
      type: 'chapter_drove_inquiry',
      title: 'Your chapter drove an inquiry',
      // Names the chapter + the fact of the unlock — never the couple.
      body: `A vendor unlocked an inquiry that came through “${title}”. Your inquiries-driven count just went up.`,
      relatedUrl: '/dashboard/creator',
    });
  } catch {
    /* fail-soft — never blocks the accept */
  }
}
