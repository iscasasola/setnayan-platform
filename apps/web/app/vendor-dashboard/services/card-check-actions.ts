'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { checkCardPhotos, matchCardPhotos } from '@/lib/card-photo-check.server';
import { REPORT_NOTE_MAX, type CardPhotoVerdict, type CardPhotoWhere } from '@/lib/service-card-checks';

/**
 * The maker's two calls for ONE PHOTO = ONE SERVICE CARD (owner 2026-10-26). Read-only for the supplier except the
 * report, which stamps a note on the repost-watch row admin already reads — a LIST on /admin/repost-watch, never a
 * review queue, and the card stays blocked either way. In-app only: nothing here sends an email.
 *
 * 🔒 Identity comes from the session; a `serviceId` is honoured only when it is this shop's own card. Neither call
 * ever returns which shop a photo is on.
 */

const SERVICE_ID = /^[0-9a-f-]{36}$/i;

async function ownShop(serviceId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;
  let ownServiceId: string | null = null;
  if (serviceId && SERVICE_ID.test(serviceId)) {
    const { data } = await supabase
      .from('vendor_services')
      .select('vendor_service_id')
      .eq('vendor_service_id', serviceId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    ownServiceId = (data as { vendor_service_id?: string } | null)?.vendor_service_id ?? null;
  }
  return { vendorProfileId: profile.vendor_profile_id as string, serviceId: ownServiceId };
}

function cleanRefs(cover: unknown, showcase: unknown): { cover: string | null; showcase: string[] } {
  const c = typeof cover === 'string' && cover.trim().length > 0 ? cover.trim().slice(0, 600) : null;
  const s = Array.isArray(showcase)
    ? showcase.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).map((r) => r.trim().slice(0, 600)).slice(0, 24)
    : [];
  return { cover: c, showcase: s };
}

/** The card's photos, each with its verdict. Asked when the SET of photos changes, never per keystroke. */
async function checkCardPhotosAction(input: {
  serviceId: string | null;
  cover: string | null;
  showcase: string[];
}): Promise<CardPhotoVerdict[]> {
  const shop = await ownShop(input?.serviceId ?? null);
  if (!shop) return [];
  const { cover, showcase } = cleanRefs(input?.cover, input?.showcase);
  return checkCardPhotos({ vendorProfileId: shop.vendorProfileId, serviceId: shop.serviceId, cover, showcase });
}

export type ReportCardPhotoResult = { ok: true } | { ok: false; message: string };

/**
 * "It's mine — report it". The match is asked AGAIN here (a browser cannot name the other photo), and the note lands
 * on that pair's repost-watch row: `supplier_reported_at` + `supplier_report_note`. Re-reporting the same photo
 * updates the note — one row per pair (UNIQUE flagged_r2_ref, source_r2_ref).
 */
async function reportCardPhotoAction(input: {
  serviceId: string | null;
  ref: string;
  where: CardPhotoWhere;
  note: string;
}): Promise<ReportCardPhotoResult> {
  const shop = await ownShop(input?.serviceId ?? null);
  if (!shop) return { ok: false, message: 'Sign in again to report this photo.' };
  const where: CardPhotoWhere = input?.where === 'showcase' ? 'showcase' : 'cover';
  const { cover } = cleanRefs(input?.ref, []);
  if (!cover) return { ok: false, message: 'Pick the photo again, then report it.' };
  const note = typeof input?.note === 'string' ? input.note.trim().slice(0, REPORT_NOTE_MAX) : '';

  const [m] = await matchCardPhotos({
    vendorProfileId: shop.vendorProfileId,
    serviceId: shop.serviceId,
    cover: where === 'cover' ? cover : null,
    showcase: where === 'showcase' ? [cover] : [],
  });
  if (!m || m.verdict.verdict !== 'another_shop' || !m.source) {
    return { ok: false, message: 'This photo isn’t on another shop’s card any more — you can use it.' };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('vendor_image_flags').upsert(
      {
        flagged_vendor_id: shop.vendorProfileId,
        flagged_r2_ref: cover,
        flagged_surface: where === 'cover' ? 'service_primary' : 'service_showcase',
        source_vendor_id: m.source.vendorProfileId,
        source_r2_ref: m.source.ref,
        source_surface: m.source.surface,
        hamming_distance: m.source.distance,
        supplier_reported_at: new Date().toISOString(),
        supplier_report_note: note.length > 0 ? note : null,
      },
      { onConflict: 'flagged_r2_ref,source_r2_ref' },
    );
    if (error) {
      console.error('[supabase-error] card-check-actions.ts · vendor_image_flags.upsert (report)', error);
      return { ok: false, message: 'We couldn’t send that just now — try again.' };
    }
  } catch (e) {
    console.error('[card-checks] report failed', e);
    return { ok: false, message: 'We couldn’t send that just now — try again.' };
  }
  return { ok: true };
}

export type CardPhotoAsk =
  | { op: 'check'; serviceId: string | null; cover: string | null; showcase: string[] }
  | { op: 'report'; serviceId: string | null; ref: string; where: CardPhotoWhere; note: string };

/**
 * ONE dispatcher for the maker's two photo calls (the server-action budget, `scripts/lint-server-action-budget.mjs`):
 * `check` returns the verdicts, `report` the report's outcome.
 */
export async function cardPhotoAction(input: CardPhotoAsk): Promise<CardPhotoVerdict[] | ReportCardPhotoResult> {
  if (input?.op === 'report') return reportCardPhotoAction(input);
  if (input?.op === 'check') return checkCardPhotosAction(input);
  return [];
}
