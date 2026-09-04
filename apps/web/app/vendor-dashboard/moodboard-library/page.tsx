import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMoodboardLibraryAccess } from '@/lib/moodboard-library-access';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { SUPPLIER_GALLERY_ASSET_TYPE } from '@/lib/moodboard-gallery';
import {
  StylistLibraryEditor,
  type StylistAsset,
} from './_components/stylist-library-editor';
import {
  listImportableEditorialMedia,
  type ImportableEditorialPhoto,
} from './actions';
import type { ColorRangeMap } from '@/app/admin/moodboard-library/_components/color-range-manipulator';

export const metadata = { title: 'Moodboard Library · My Designs' };
export const dynamic = 'force-dynamic';

const BUCKET = 'moodboard-library';

export default async function StylistMoodboardLibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 🔑 ONE PREDICATE, SHARED WITH actions.ts. The page used to ask "do you own
  // a shop AND is `reception_decor` among your services"; the save asked
  // `users.account_type === 'vendor'`. Two predicates for one question is a bug
  // with a UI — the page rendered and the upload threw. See
  // lib/moodboard-library-access.ts for the whole story, including why the
  // trade gate is now DERIVED from MB10's slot→trade map rather than pinned to
  // one service key that excluded every gown designer, florist and cake maker.
  const access = await resolveMoodboardLibraryAccess(supabase, user.id);
  if (!access.allowed) {
    if (access.reason === 'no_shop') redirect('/vendor-dashboard');
    redirect('/vendor-dashboard/shop');
  }
  const { profile, slots } = access;

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('moodboard_library_assets')
    .select(
      'asset_id, asset_type, asset_subtype, label, storage_path, approved_at, retired_at, created_at, source_event_id',
    )
    .eq('uploaded_by', user.id)
    .order('created_at', { ascending: false });

  const assetIds = (rows ?? []).map((r) => r.asset_id);
  const colorRangesByAsset = new Map<string, ColorRangeMap>();
  if (assetIds.length > 0) {
    const { data: ranges } = await admin
      .from('moodboard_asset_color_ranges')
      .select('asset_id, slot_id, sampled_hex, tolerance_de, region_label')
      .in('asset_id', assetIds);
    for (const r of ranges ?? []) {
      const existing = colorRangesByAsset.get(r.asset_id) ?? {};
      existing[r.slot_id] = {
        slotId: r.slot_id,
        sampledHex: r.sampled_hex,
        toleranceDe: Number(r.tolerance_de),
        regionLabel: r.region_label ?? undefined,
      };
      colorRangesByAsset.set(r.asset_id, existing);
    }
  }

  const assets: StylistAsset[] = (rows ?? []).map((r) => {
    const key = r.storage_path.replace(`${BUCKET}/`, '');
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(key);
    return {
      asset_id: r.asset_id,
      asset_type: r.asset_type as StylistAsset['asset_type'],
      asset_subtype: r.asset_subtype,
      label: r.label,
      storage_path: r.storage_path,
      approved_at: r.approved_at,
      retired_at: r.retired_at,
      created_at: r.created_at,
      source_event_id: r.source_event_id ?? null,
      public_url: pub.publicUrl,
      color_ranges: colorRangesByAsset.get(r.asset_id) ?? {},
    };
  });

  // The quota's own numbers, computed the same way the server action computes
  // them, so the screen states the true remaining count rather than a guess.
  // Event-linked rows are excluded here for exactly the reason they are
  // excluded there: they are never rationed.
  const { data: tierRow } = await admin
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const cap = tierCaps(
    (tierRow as { tier_state?: string | null } | null)?.tier_state ?? null,
  ).galleryBackCatalogPhotos;
  const { count: backCatalogueUsed } = await admin
    .from('moodboard_library_assets')
    .select('asset_id', { count: 'exact', head: true })
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('asset_type', SUPPLIER_GALLERY_ASSET_TYPE)
    .is('source_event_id', null)
    .is('retired_at', null);

  // 🔑 A FAILED READ MUST NOT RENDER AS AN ABSENCE. `.catch(() => [])` here
  // would tell a supplier who worked six weddings that they have no day-of
  // photos to add — byte-identical to the honest empty state, and the exact
  // defect `app/vendor-dashboard/reads-are-honest.test.ts` exists for. The
  // error is bound and the difference reaches the render.
  let importable: ImportableEditorialPhoto[] = [];
  let importableFailed = false;
  try {
    importable = await listImportableEditorialMedia();
  } catch {
    importableFailed = true;
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/vendor-dashboard"
        className="mb-4 inline-block font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta-700"
      >
        ‹ Back to shop dashboard
      </Link>

      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          My moodboard designs
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Upload photos of your real work, tag the color regions, and Setnayan
          will review them for the shared inspiration library. Once approved,
          couples browsing that part of their mood board see your photo with
          your shop credited underneath — and can walk straight from it to you.
        </p>
        <p className="max-w-prose text-xs text-ink/50">
          Every photo is watermarked with SETNAYAN on our side before it is
          stored, and screened for QR codes and your own contact details — those
          would take couples around Setnayan rather than through it, and your
          shop is already named under every photo.
        </p>
      </header>

      <StylistLibraryEditor
        initialAssets={assets}
        gallerySlots={slots}
        backCatalogueCap={cap}
        backCatalogueUsed={backCatalogueUsed ?? 0}
        importableEditorial={importable}
        importableEditorialFailed={importableFailed}
      />
    </div>
  );
}
