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
  /** Couple-event context, when a signed-in couple with an active event views. */
  eventId?: string | null;
};

export async function recordVendorProfileView(
  input: RecordVendorViewInput,
): Promise<void> {
  try {
    if (!input.vendorProfileId) return;

    // Resolve a viewer id WITHOUT persisting it raw. Prefer the auth user;
    // fall back to an opaque anon-browser cookie. Either way we only ever
    // store the hash.
    let rawViewerId: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) rawViewerId = `u:${user.id}`;
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

    const admin = createAdminClient();
    await admin.from('vendor_profile_views').insert({
      vendor_profile_id: input.vendorProfileId,
      event_id: input.eventId ?? null,
      source: input.source ?? null,
      utm: input.utm ?? null,
      viewer_hash: viewerHash,
    });
  } catch {
    // Fully best-effort — a failed view capture must never break a render.
  }
}
