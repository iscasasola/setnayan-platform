'use server';

/**
 * recordVendorProfileView — best-effort, fire-and-forget capture of a public
 * vendor-profile view (Wave 6 Quote-to-Booking Funnel · the VIEWS stage).
 *
 * CALL IT INSIDE Next 15 after():
 *
 *     import { after } from 'next/server';
 *     after(() => recordVendorProfileView({ vendorProfileId, source, ... }));
 *
 * after() runs the work AFTER the response is flushed, so this NEVER blocks the
 * page render (cron-free per project_setnayan_cron_free). Every failure mode is
 * swallowed — a dropped view must never surface an error to the visitor.
 *
 * Privacy (project_setnayan_behavioral_data_edge):
 *   - The viewer is de-identified BEFORE it touches the DB: we pass the raw
 *     user-id / anon-session-id through hashViewer() (sha256(salt || id)) and
 *     store ONLY the hash. The raw id is never written or logged.
 *   - The INSERT runs on the service-role admin client. Anon/authenticated
 *     sessions have NO INSERT grant on vendor_profile_views (RLS is read-only
 *     for them), so a view can only be recorded through this audited path.
 */

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { hashViewer } from '@/lib/vendor-funnel';
import { recordPortfolioPhotoView } from '@/lib/record-portfolio-photo-view';
import { recordServiceCardView } from '@/lib/record-service-card-view';
import { materialViaOf, utmOf, viewCountsAsSignup } from '@/lib/material-tags';

/** Cookie that carries an opaque per-browser id for anonymous viewers. Set
 *  best-effort so repeat anonymous views from the same browser dedupe on the
 *  hash without ever identifying the person. */
const ANON_VIEWER_COOKIE = 'sn_vw';

type RecordVendorViewInput = {
  vendorProfileId: string;
  /** Entry point — mirrors event_vendors.source vocabulary. */
  source?: string | null;
  /** Raw UTM query string when present on the landing URL. */
  utm?: string | null;
  /**
   * 🏷 The material tag (`?via=card`, … — `lib/material-tags.ts`, owner 2026-11-16): which piece the shop handed out
   * brought this view. Re-validated here — only a known piece is written.
   */
  via?: string | null;
  /** Couple-event context, when a signed-in couple with an active event views. */
  eventId?: string | null;
  /**
   * 👁 A PORTFOLIO PHOTO was opened (Build 3 Lane E item 11) — count THAT photo's view through the one service-role RPC
   * (`lib/record-portfolio-photo-view.ts`) instead of a shop view. Rides this action so no new server action is added.
   */
  photoKey?: string | null;
  /**
   * 📈 A SERVICE CARD was opened into the grown card (Build 6 Lane I, "Which card sells") — count THAT card's open
   * through the one service-role RPC (`lib/record-service-card-view.ts`) instead of a shop view. Rides this action so no
   * new server action is added.
   */
  serviceId?: string | null;
};

export async function recordVendorProfileView(
  input: RecordVendorViewInput,
): Promise<void> {
  try {
    if (!input.vendorProfileId) return;
    if (input.photoKey) return await recordPortfolioPhotoView(input.vendorProfileId, input.photoKey);
    if (input.serviceId) return await recordServiceCardView(input.vendorProfileId, input.serviceId);

    // Resolve a viewer id WITHOUT persisting it raw. Prefer the auth user;
    // fall back to an opaque anon-browser cookie. Either way we only ever
    // store the hash.
    let rawViewerId: string | null = null;
    let signedIn: { userId: string; createdAt: string | null } | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) rawViewerId = `u:${user.id}`;
      if (user && !(user.is_anonymous ?? false)) signedIn = { userId: user.id, createdAt: user.created_at ?? null };
    } catch {
      // auth read is best-effort
    }

    if (!rawViewerId) {
      try {
        const jar = await cookies();
        const existing = jar.get(ANON_VIEWER_COOKIE)?.value;
        if (existing) {
          rawViewerId = `a:${existing}`;
        } else {
          // Mint a fresh opaque id. Best-effort: in a pure RSC render context
          // cookie writes are allowed during after()'s deferred work; if the
          // store is read-only we just skip the cookie (view still records,
          // simply un-deduped for this browser).
          const fresh = crypto.randomUUID();
          rawViewerId = `a:${fresh}`;
          try {
            jar.set({
              name: ANON_VIEWER_COOKIE,
              value: fresh,
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              maxAge: 60 * 60 * 24 * 365,
            });
          } catch {
            // read-only cookie store — fine
          }
        }
      } catch {
        // no cookie store — record an anonymous, un-deduped view
      }
    }

    const viewerHash = rawViewerId ? hashViewer(rawViewerId) : null;

    const via = materialViaOf(input.via);
    const utm = utmOf(input.utm);
    const admin = createAdminClient();
    await admin.from('vendor_profile_views').insert({
      vendor_profile_id: input.vendorProfileId,
      event_id: input.eventId ?? null,
      source: input.source ?? null,
      utm: input.utm ?? null,
      via,
      viewer_hash: viewerHash,
    });

    // 📝 THE SIGN-UP A PIECE BROUGHT (owner 2026-11-16; the QR-stats "Registered" column). Signing up from the shop —
    // the sign-in sheet over it, or the Google return — lands back on the same tagged address, so the first tagged
    // view of a just-made account names the piece. First one wins (primary key on the user; a later piece never
    // rewrites it). Service role only — the table is closed to every browser role.
    if (signedIn && viewCountsAsSignup({ accountCreatedAt: signedIn.createdAt, via, utm }, Date.now())) {
      await admin.from('signup_attributions').upsert(
        {
          user_id: signedIn.userId,
          vendor_profile_id: input.vendorProfileId,
          via,
          src: typeof input.source === 'string' ? input.source.slice(0, 64) : null,
          utm,
        },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
    }
  } catch {
    // Fully best-effort — a failed view capture must never break a render.
  }
}
