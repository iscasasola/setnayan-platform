'use client';

/**
 * 🧪 /dev/supplier-lab?s=library — THE REAL SUPPLIER LIBRARY on a lab shop, its writes kept in the dev server's memory
 * (`library-lab-server.ts`, which runs the shipped gates, screen and watermark), plus a stand-in for Setnayan's
 * Approve, and a door to the couple's Studio where Search ideas reads the same memory. DEV-ONLY.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StylistLibraryEditor, type ShopPhotoChoice, type StylistAsset, type StylistLibraryEditorProps } from '@/app/vendor-dashboard/moodboard-library/_components/stylist-library-editor';
import { ScreenFindingsPanel } from '@/app/admin/moodboard-library/_components/screen-findings-panel';
import { libraryLab, type LabLibraryAsset } from './library-lab-server';

export function LibraryLab({
  assets,
  shopPhotos,
  gallerySlots,
  shopName,
  view,
}: {
  assets: LabLibraryAsset[];
  shopPhotos: ShopPhotoChoice[];
  gallerySlots: StylistLibraryEditorProps['gallerySlots'];
  shopName: string;
  /** `review` = the lab's stand-in for Setnayan's queue (Approve). */
  view: 'supplier' | 'review';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // one-render: keep (no-revalidate) — the lab’s `libraryLab` stand-in revalidates nothing; this is its one render.
  const refresh = () => router.refresh();

  if (view === 'review') {
    const drafts = assets.filter((a) => !a.approved_at);
    const live = assets.filter((a) => a.approved_at);
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-6" data-library-lab="review">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Lab · stands in for /admin/moodboard-library</p>
        <h1 className="mt-1 text-2xl font-semibold">Setnayan review</h1>
        {error ? <p className="mt-3 text-sm text-danger-600">{error}</p> : null}
        <ul className="mt-4 space-y-4">
          {drafts.map((a) => (
            <li key={a.asset_id} className="space-y-2 border-t border-ink/10 pt-3" data-lab-draft={a.asset_subtype}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.public_url} alt="" className="h-40 w-full rounded object-cover" />
              <p className="text-sm">
                <b>{a.label}</b> · {gallerySlots.find((s) => s.key === a.asset_subtype)?.label ?? a.asset_subtype} · {shopName}
                {Object.keys(a.color_ranges).length === 0 ? ' · no colours tagged yet' : ''}
              </p>
              <ScreenFindingsPanel findings={a.screen_findings} />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      setError(null);
                      await libraryLab({ op: 'approve', assetId: a.asset_id });
                      refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  })
                }
                className="rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream"
              >
                Approve
              </button>
            </li>
          ))}
        </ul>
        {drafts.length === 0 ? <p className="mt-4 text-sm text-ink/60">Nothing waiting.</p> : null}
        {live.length > 0 ? (
          <p className="mt-6 text-sm text-ink/70">
            Live: {live.map((a) => gallerySlots.find((s) => s.key === a.asset_subtype)?.label ?? a.asset_subtype).join(' · ')} ·{' '}
            <Link className="underline" href="/dev/details-lab?look=1&studio=1&library=1">
              the couple’s Studio
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6" data-library-lab="supplier">
      <StylistLibraryEditor
        initialAssets={assets as unknown as StylistAsset[]}
        gallerySlots={gallerySlots}
        shopPhotos={shopPhotos}
        backCatalogueCap={20}
        importableEditorial={[]}
        importableEditorialFailed={false}
        actions={{
          uploadStylistAsset: async (fd) => {
            return (await libraryLab({ op: 'upload' }, fd)) as { assetId: string; textScreen: 'ran' | 'unavailable'; colorRanges: Record<number, { slotId: number; sampledHex: string; toleranceDe: number; regionLabel?: string }> };
          },
          saveStylistColorRanges: async (assetId, map) => {
            await libraryLab({ op: 'tags', assetId, map });
          },
          deleteStylistAsset: async (assetId) => {
            await libraryLab({ op: 'delete', assetId });
          },
        }}
      />
      <p className="mt-6 text-sm text-ink/60">
        Lab: <Link className="underline" href="/dev/supplier-lab?s=library&view=review">Setnayan review</Link> ·{' '}
        <Link className="underline" href="/dev/details-lab?look=1&studio=1&library=1">the couple’s Studio</Link>
      </p>
    </div>
  );
}
