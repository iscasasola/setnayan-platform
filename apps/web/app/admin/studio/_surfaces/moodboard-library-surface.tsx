import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { LibraryEditor, type LibraryAsset } from '@/app/admin/moodboard-library/_components/library-editor';
import type { ColorRangeMap } from '@/app/admin/moodboard-library/_components/color-range-manipulator';
import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * MoodboardLibrarySurface — the Moodboard Library body, re-homed byte-identical
 * from app/admin/moodboard-library/page.tsx into the tabbed /admin/studio
 * studio (Studio Studio slice 2). Behaviour is unchanged: the shared template
 * library for the Visual preview pillars — upload a photo, sample a color, tag
 * it to a palette slot (all via the LibraryEditor client component, imported
 * from its unchanged @/app/admin/moodboard-library/_components location).
 *
 * No searchParams and no server-action forms at this level (LibraryEditor holds
 * its own client mutations). The only mechanical change is that the outer
 * max-w-6xl container is dropped from both the error and main branches (the
 * studio shell provides layout).
 */

const BUCKET = 'moodboard-library';

export async function MoodboardLibrarySurface() {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from('moodboard_library_assets')
    .select(
      'asset_id, asset_type, asset_subtype, label, storage_path, source, approved_at, retired_at, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    logQueryError('AdminMoodboardLibraryPage (moodboard_library_assets)', error);
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Moodboard Library</h1>
        </header>
        <p className="rounded-lg border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          The moodboard library couldn&apos;t load right now. We&apos;ve logged the issue —
          refresh in a moment or check Sentry for the full detail.
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
    <div>
      <PageMasthead
        title="Moodboard Library"
      />

      <LibraryEditor initialAssets={assets} />
    </div>
  );
}
