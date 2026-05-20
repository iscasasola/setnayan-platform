import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { LibraryEditor, type LibraryAsset } from './_components/library-editor';
import type { ColorRangeMap } from './_components/color-range-manipulator';

export const metadata = { title: 'Moodboard Library · Admin' };
export const dynamic = 'force-dynamic';

const BUCKET = 'moodboard-library';

export default async function AdminMoodboardLibraryPage() {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from('moodboard_library_assets')
    .select(
      'asset_id, asset_type, asset_subtype, label, storage_path, source, approved_at, retired_at, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Moodboard Library</h1>
        </header>
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load library — {error.message}. The migration may not be applied yet
          (run <code className="font-mono">supabase db push</code>).
        </p>
      </div>
    );
  }

  // Pull color-range tag maps in one batch
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

  const assets: LibraryAsset[] = (rows ?? []).map((r) => {
    const objectKey = r.storage_path.replace(`${BUCKET}/`, '');
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(objectKey);
    return {
      asset_id: r.asset_id,
      asset_type: r.asset_type as LibraryAsset['asset_type'],
      asset_subtype: r.asset_subtype,
      label: r.label,
      storage_path: r.storage_path,
      source: r.source as LibraryAsset['source'],
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
        href="/admin"
        className="mb-4 inline-block font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
      >
        ‹ Back to admin overview
      </Link>

      <header className="mb-6 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Setnayan · Admin · Iteration 0010
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Moodboard Library
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          The shared template library for the Visual preview pillars (Location feel + Dress codes).
          Upload a photo, tap a color in the image to sample it, adjust the tolerance, and save it
          to a palette slot. Couples will see this asset with their own palette applied to the
          tagged regions.
        </p>
        <p className="max-w-prose text-xs text-ink/50">
          V1 source = internet placeholder. V1.x = Higgsfield-generated. V1.x+ = approved stylist
          contributions. Stylist private uploads stay on the stylist&apos;s own Google Drive (not
          here).
        </p>
      </header>

      <LibraryEditor initialAssets={assets} />
    </div>
  );
}
