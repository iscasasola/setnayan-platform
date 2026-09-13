import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { StoryCoverKind } from '@/lib/story-cover';

/**
 * THE COVER'S CANDIDATES — what the host may choose from (`02` §6 · 08 step 1.5).
 *
 * 🔑 RULE 0 PAID FOR ITSELF ON THE CAPTURES. "A capture can only be a cover if
 * it passed the same checks as everything else — screened, and nobody in it
 * opted out" is NOT re-implemented here. `loadEditorialChaptersForEditor`
 * already returns exactly those captures: it filters `hidden_at IS NULL` and
 * `moderation_state = 'clean'`, runs `filterPublicSafeRows`, and passes every
 * row through `publicKeyForCapture` — the one consent gate `04` rule 6 names.
 * The desk page already loads it for the chapter editor. A second query here
 * would be a second opinion about who consented, and the two would eventually
 * disagree.
 *
 * ⚠ SO THIS FILE ONLY READS THE TWO THINGS THAT LOADER DOES NOT: the living
 * hero, and the suppliers' frames.
 */

/** One thing the host can pick. `ref` is what gets stored (null for hero/monogram). */
export type CoverCandidate = {
  kind: StoryCoverKind;
  ref: string | null;
  /** What the host reads on the tile — "2:38 · Papic". */
  source: string;
  /** The name of the moment, where it has one. */
  label: string;
  /** A thumbnail to draw. Null for the monogram, which is drawn, not fetched. */
  previewUrl: string | null;
};

export type CoverCandidates = {
  items: CoverCandidate[];
  /** Sources that could not be read. An unreadable source is not an empty one. */
  unreadable: string[];
};

/** A written minute, as the chapter editor already knows it. */
export type WrittenMinute = {
  leadId: string;
  time: string;
  thumbUrl: string | null;
  title: string;
};

export async function loadCoverCandidates(args: {
  eventId: string;
  /** `events.landing_page_hero_image_url` — the living hero, already read by the page. */
  heroImageRef: string | null;
  /** `events.monogram_text` — no mark, no monogram candidate. */
  monogramText: string | null;
  /**
   * The minutes the host has actually WRITTEN, derived by the caller from the
   * chapter cards + their overrides. `02` §6 offers "any accepted capture from
   * a WRITTEN minute" — a capture the host never wrote a word about is not one.
   */
  writtenMinutes: readonly WrittenMinute[];
}): Promise<CoverCandidates> {
  const { eventId, heroImageRef, monogramText, writtenMinutes } = args;
  const items: CoverCandidate[] = [];
  const unreadable: string[] = [];

  // ── ① The living hero — the picture all three surfaces inherit today ───────
  if (heroImageRef) {
    // The website hero is couple-writable: held to the public bucket first.
    const previewUrl = await displayUrlForStoredAsset(siteMediaServeRef(heroImageRef)).catch(
      () => null,
    );
    items.push({
      kind: 'hero',
      ref: null,
      source: 'Living hero',
      label: 'The one on your site now',
      previewUrl,
    });
  }

  // ── ② The written minutes' own pictures ───────────────────────────────────
  for (const minute of writtenMinutes) {
    items.push({
      kind: 'capture',
      ref: minute.leadId,
      source: minute.time,
      label: minute.title,
      previewUrl: minute.thumbUrl,
    });
  }

  // ── ③ What a supplier sent ────────────────────────────────────────────────
  // The SAME four conditions the public page publishes a supplier frame on
  // (`data.ts` §6d): clean, accepted by the host at the desk, not hidden, and
  // its supplier still the recommended pick. A cover offered on looser terms
  // than the page below it would put on the share card a frame the story
  // withholds.
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('editorial_vendor_media')
      .select('media_id, event_vendor_id, still_r2_key, caption')
      .eq('event_id', eventId)
      .eq('moderation_state', 'clean')
      .eq('status', 'approved')
      .eq('hidden_by_couple', false)
      .order('sort_order', { ascending: true })
      .limit(24);
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const vendorIds = Array.from(
      new Set(
        rows
          .map((r) => (typeof r.event_vendor_id === 'string' ? r.event_vendor_id : null))
          .filter((v): v is string => !!v),
      ),
    );

    const recommended = new Map<string, string>();
    if (vendorIds.length > 0) {
      const { data: vendors, error: vendorError } = await admin
        .from('event_vendors')
        .select('vendor_id, vendor_name')
        .in('vendor_id', vendorIds)
        .eq('selection_match_rank', 1);
      if (vendorError) {
        logQueryError(
          'coverCandidates.vendorNames',
          vendorError,
          { event_id: eventId },
          'graceful_degrade',
        );
        // Nothing is PROVABLY the recommended pick → offer none of them. Fails
        // closed, matching the public read's own behaviour on this exact read.
        throw vendorError;
      }
      for (const v of (vendors ?? []) as Array<Record<string, unknown>>) {
        const id = typeof v.vendor_id === 'string' ? v.vendor_id : null;
        if (id) recommended.set(id, (typeof v.vendor_name === 'string' && v.vendor_name) || 'Your supplier');
      }
    }

    for (const row of rows) {
      const mediaId = typeof row.media_id === 'string' ? row.media_id : null;
      const vendorId = typeof row.event_vendor_id === 'string' ? row.event_vendor_id : null;
      const stillRef = typeof row.still_r2_key === 'string' ? row.still_r2_key : null;
      if (!mediaId || !vendorId || !stillRef) continue;
      const vendorName = recommended.get(vendorId);
      if (!vendorName) continue; // not (or no longer) the recommended pick

      const previewUrl = await displayUrlForStoredAsset(stillRef).catch(() => null);
      if (!previewUrl) continue; // nothing to show is nothing to offer

      items.push({
        kind: 'vendor_frame',
        ref: mediaId,
        source: vendorName,
        label: (typeof row.caption === 'string' && row.caption.trim()) || 'A frame they sent',
        previewUrl,
      });
    }
  } catch {
    unreadable.push('what your suppliers sent');
  }

  // ── ④ The animated monogram — drawn from their own mark, never fetched ─────
  if (monogramText && monogramText.trim()) {
    items.push({
      kind: 'monogram',
      ref: null,
      source: 'Monogram',
      label: `${monogramText.trim()}, animated`,
      previewUrl: null,
    });
  }

  return { items, unreadable };
}
