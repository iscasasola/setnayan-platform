import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  StylistLibraryEditor,
  type StylistAsset,
} from './_components/stylist-library-editor';
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

  // Align with the vendor-dashboard layout's gate (vendor-profile ownership
  // via hasVendorAccess), NOT the rigid `account_type === 'vendor'` check.
  // The old account_type gate 404'd dual-role owners (e.g. a §10a internal
  // account that also owns a vendor_profile for dogfooding) even though the
  // layout + every sibling surface grant them access. Mirror the sibling
  // pattern (payment-options / tokens): fetch the caller's own vendor
  // profile, bounce to the dashboard root if they don't own one.
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('moodboard_library_assets')
    .select(
      'asset_id, asset_type, asset_subtype, label, storage_path, approved_at, retired_at, created_at',
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
      public_url: pub.publicUrl,
      color_ranges: colorRangesByAsset.get(r.asset_id) ?? {},
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/vendor-dashboard"
        className="mb-4 inline-block font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
      >
        ‹ Back to shop dashboard
      </Link>

      <header className="mb-6 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Setnayan · Stylist tools · Iteration 0010
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          My moodboard designs
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Upload photos of your real wedding setups, tag the color regions, and
          Setnayan will review them for the shared template library. Once approved,
          hosts will see your work rendered in their own palette and can pick it
          for their moodboard.
        </p>
        <p className="max-w-prose text-xs text-ink/50">
          Every photo you upload here is auto-watermarked with SETNAYAN. Your
          original photos stay on your device; the watermarked copy is what we
          store. (Google-Drive-direct uploads — where your masters stay on your
          own Drive — land in V1.x.)
        </p>
      </header>

      <StylistLibraryEditor initialAssets={assets} />
    </div>
  );
}
