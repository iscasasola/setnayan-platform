import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { loadRecapCardData } from '@/lib/auto-recap';
import { renderRecapOgJpeg } from '@/lib/social/recap-card';
import { isR2Configured, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';

/**
 * apps/web/lib/social/recap-post.ts — compose a Setnayan-owned social post when
 * an event's RECAP is published (the "event completed → recap" moment).
 *
 * This is the COMPOSE half only. It inserts one row into social_posts with
 * source_type='event_recap' and a deterministic source_ref=event_id, so the
 * partial-unique index (source_type, source_ref) makes it compose-ONCE per
 * event — an event can never double-post its recap. Everything downstream is
 * the EXISTING pipeline: the cadence governor assigns the § 8.3b slot, and
 * lib/social/flush.ts DISPATCHES the row to Setnayan's own Facebook Page +
 * Instagram Business account (postToFacebookPage / postToInstagramFeed), gated
 * on the master autopublish switch + per-platform enabled+configured. We do NOT
 * add a parallel posting path.
 *
 * The card image is the SAME polished recap card the /[slug]/recap OG route
 * uses (renderRecapOgJpeg · lib/social/recap-card.tsx), rendered once and
 * uploaded to R2 (setnayan-media) so media_url is a STABLE public URL — never
 * a presigned/expiring one. Facebook downloads it as a photo (the key ends in
 * .jpg, so the /photos branch fires); Instagram requires exactly this kind of
 * public image_url. When R2 isn't configured we still compose the post WITHOUT
 * a card (media_url=null) rather than dropping the recap share — the flush's
 * on-the-fly card route (/api/social/card/{postId}) is the fallback image.
 *
 * NEVER THROWS. Every failure path logs + returns quietly so a recap publish
 * (the caller's real job) can never be broken by a social-share hiccup. It is
 * always fired from `after()` — off the couple's critical path.
 */

/** True when recap auto-post is enabled (per-feature toggle · default ON when
 *  the column is pre-migration / unreadable — matches the migration default). */
async function isRecapAutopostEnabled(
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  try {
    const { data } = await admin
      .from('social_publish_settings')
      .select('recap_autopost_enabled')
      .eq('id', true)
      .maybeSingle();
    const val = (data as { recap_autopost_enabled?: boolean | null } | null)
      ?.recap_autopost_enabled;
    // NULL / missing column (pre-migration) → default ON (mirrors the DEFAULT TRUE).
    return val !== false;
  } catch {
    return true;
  }
}

/**
 * Social follow-through #2 (2026-07-16) — the recap re-post GATE, shared by
 * COMPOSE (this file) and DISPATCH (lib/social/flush.ts). A published recap may
 * be featured on Setnayan's OWN Facebook / Instagram ONLY when BOTH hold:
 *   • the couple has NOT opted out — events.recap_social_optout_at IS NULL
 *     (owner ruling "everything public initially" → NULL = allowed = default), AND
 *   • the event site is effectively PUBLIC — resolveEffectiveVisibility(event)
 *     === 'public'. A private / unlisted couple is NEVER composed into the
 *     public queue (unanimous council red line #2).
 *
 * Fail-CLOSED: any read error / missing row → NOT allowed, so a transient DB
 * hiccup can never leak a private recap. Best-effort; never throws.
 */
export async function isRecapSocialShareAllowed(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from('events')
      .select(
        'recap_social_optout_at, landing_page_visibility, scheduled_launch_at, std_launched_at',
      )
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !data) return false;
    const ev = data as {
      recap_social_optout_at?: string | null;
      landing_page_visibility?: 'public' | 'unlisted' | 'private' | null;
      scheduled_launch_at?: string | null;
      std_launched_at?: string | null;
    };
    if (ev.recap_social_optout_at) return false; // couple opted out
    return resolveEffectiveVisibility(ev) === 'public'; // private/unlisted → never
  } catch {
    return false;
  }
}

/** Render the recap card → JPEG → R2 (setnayan-media), returning a STABLE
 *  public URL. Null when R2 isn't configured or anything fails — the caller
 *  then composes the post without a baked card (the on-the-fly card route is
 *  the fallback). Best-effort; never throws. */
async function renderAndUploadRecapCard(eventId: string): Promise<string | null> {
  if (!isR2Configured()) return null;
  try {
    const card = await loadRecapCardData(eventId);
    if (!card) return null;

    const bits = [`${card.stats.photos} ${card.stats.photos === 1 ? 'photo' : 'photos'}`];
    if (card.stats.voices > 0) {
      bits.push(`${card.stats.voices} ${card.stats.voices === 1 ? 'voice' : 'voices'}`);
    }
    if (card.stats.guests && card.stats.guests > 0) bits.push(`${card.stats.guests} guests`);

    const jpeg = await renderRecapOgJpeg({
      coupleNames: card.coupleNames,
      monogramInitials: card.monogramInitials,
      monogramColor: card.monogramColor,
      dateLabel: card.dateLabel,
      statLine: bits.join(' · '),
      heroPhotoUrl: card.heroUrl,
    });

    // Deterministic key per event — a re-publish overwrites the same object, so
    // the public URL is stable and the card refreshes with the latest stats.
    // .jpg extension is load-bearing: Facebook's /photos branch only fires for
    // a URL that looks like an image (lib/social/facebook.ts asPhoto regex).
    const key = `social/recap/${eventId}.jpg`;
    return await r2Upload({
      bucket: R2_BUCKETS.media,
      key,
      body: jpeg,
      contentType: 'image/jpeg',
    });
  } catch {
    return null;
  }
}

/** Warm brand-voice caption for the recap share (≤2 hashtags, no spam). */
function recapCaption(coupleNames: string, slug: string | null): string {
  const who = coupleNames.trim() || 'one of our Setnayan couples';
  const link = slug
    ? `\n\nRelive the day → https://www.setnayan.com/${slug}/recap`
    : '';
  return (
    `The day, in their own words. ✨ ${who}'s celebration is now a living memory on Setnayan — ` +
    `photos, voices, and every moment worth keeping. Set na 'yan.${link}\n\n#Setnayan #SetNaYan`
  );
}

/**
 * Compose the recap social post for a just-published event recap. Fire from
 * `after()` in the publishRecap action. Idempotent (source_ref=event_id +
 * partial-unique index); a re-publish that already has a live row is a no-op.
 * Never throws.
 */
export async function composeRecapSocialPost(eventId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    // Per-feature gate — an admin can turn recap auto-posting off without
    // touching the master switch. (Dispatch still respects the master switch.)
    if (!(await isRecapAutopostEnabled(admin))) return;

    // Social follow-through #2 — the couple's per-event opt-out + the
    // private-site red line. Refuse to compose a recap post when the couple
    // opted out OR the event site isn't effectively public. Dispatch carries
    // the SAME gate (catches an opt-out / visibility flip after compose).
    if (!(await isRecapSocialShareAllowed(admin, eventId))) return;

    // Skip if a live (non-pulled) recap post already exists for this event —
    // avoids re-rendering the card on every re-publish. The partial-unique
    // index is the hard guarantee; this is the cheap pre-check.
    const { data: existing, error: existErr } = await admin
      .from('social_posts')
      .select('post_id, status')
      .eq('source_type', 'event_recap')
      .eq('source_ref', eventId)
      .neq('status', 'pulled')
      .maybeSingle();
    if (existErr) {
      logQueryError('composeRecapSocialPost (existing lookup)', existErr, { event_id: eventId });
      return;
    }
    if (existing) return; // already composed — nothing to do

    const card = await loadRecapCardData(eventId);
    const coupleNames = card?.coupleNames ?? '';

    const { data: ev } = await admin
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    const slug = (ev as { slug?: string | null } | null)?.slug ?? null;

    // Render the branded recap card → R2 (stable public URL). Null → the
    // on-the-fly card route (/api/social/card/{postId}) is the flush fallback.
    const mediaUrl = await renderAndUploadRecapCard(eventId);

    const { error } = await admin.from('social_posts').insert({
      source_type: 'event_recap',
      source_ref: eventId,
      title: `Recap · ${coupleNames || 'A Setnayan couple'}`,
      body: recapCaption(coupleNames, slug),
      media_url: mediaUrl,
      link_url: slug ? `https://www.setnayan.com/${slug}/recap` : 'https://www.setnayan.com',
    });
    // 23505 = a concurrent flush/publish already composed it — expected, ignore.
    if (error && error.code !== '23505') {
      logQueryError('composeRecapSocialPost (insert)', error, { event_id: eventId });
    }
  } catch (err) {
    logQueryError('composeRecapSocialPost (unexpected)', err, { event_id: eventId });
  }
}
