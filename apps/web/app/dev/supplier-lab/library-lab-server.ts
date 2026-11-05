'use server';

/**
 * 🧪 THE INSPIRATION LIBRARY'S ROUND TRIP, IN THE LAB (DEV-ONLY — `/dev/supplier-lab?s=library` →
 * `/dev/details-lab?look=1&studio=1&library=1`). Owner 2026-10-19, DECISION_LOG "SUPPLIERS FILL THE INSPIRATION
 * LIBRARY WITHOUT AN EVENT": a supplier adds a photo to a part → Setnayan approves it → the couple's Search ideas on
 * THAT part lists it, credited to the shop.
 *
 * 🔑 THE SHIPPED DECISIONS RUN; ONLY THE DATABASE IS STOOD IN FOR. An upload here goes through the same gates
 * `uploadStylistAsset` runs, in the same order — the rights tick, `slotUploadVerdict` (the shop's trades), the
 * per-category `backCatalogueQuotaVerdict`, the REAL content screen (`screenGalleryImage`: the QR decode and the
 * shop's own logo match run locally; the text read needs `ANTHROPIC_API_KEY`, which the lab does not have, so it
 * reports "could not read" exactly as production would without it) and the REAL server watermark. The couple's read
 * goes through `normalizeGalleryQuery` + `shapeGalleryPage`, the two halves `fetchGalleryAssets` wraps around its
 * query. What is NOT real, said rather than hidden: the rows live in this dev server's memory (a restart forgets
 * them), there is no theft scan (it writes hashes to the database), and "Approve" is the lab's button, not
 * `/admin/moodboard-library`'s (that page's editor imports its actions directly).
 *
 * ⚠ ONE EXPORT, ON PURPOSE: every exported "use server" function is a Vercel route (`lint-server-action-budget`).
 * The first statement of every call refuses in production; the route also 404s there.
 */

import { headers } from 'next/headers';
import { backCatalogueQuotaVerdict, libraryPartLabel, slotUploadVerdict, RIGHTS_WARRANTY_VERSION } from '@/lib/moodboard-gallery-upload';
import { normalizeGalleryQuery, shapeGalleryPage, type GalleryPage, type RawGalleryRow } from '@/lib/moodboard-gallery';
import { screenGalleryImage } from '@/lib/moodboard-gallery-screen.server';
import { markVariantForSource, watermarkImageBytes } from '@/lib/watermark-server';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { autoColourRanges } from '@/lib/extract-palette.server';
import type { ScreenFindings } from '@/lib/moodboard-screen-findings';
import type { ColorRangeMap } from '@/lib/color-recolor';
import { LAB_LIBRARY_SHOP, LAB_SHOP_PHOTOS } from './library-lab-fixture';
import { fallbackInspirationParts } from '@/lib/inspiration-parts';

/** 🧪 The lab reaches no database, so it reads the consts — named, never defaulted (③0-b). */
const LAB_PARTS = fallbackInspirationParts();

export type LabLibraryAsset = {
  asset_id: string;
  asset_type: 'supplier_gallery';
  asset_subtype: string;
  label: string;
  storage_path: string;
  approved_at: string | null;
  retired_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  source_event_id: null;
  public_url: string;
  color_ranges: ColorRangeMap;
  screen_findings: ScreenFindings | null;
  rights_warranty_version: string;
};

type Store = { assets: LabLibraryAsset[]; seq: number };
const STORE_KEY = '__setnayanLibraryLab';
function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  return (g[STORE_KEY] ??= { assets: [], seq: 0 });
}

export type LibraryLabOp =
  | { op: 'state' }
  | { op: 'reset' }
  | { op: 'upload' }
  | { op: 'tags'; assetId: string; map: ColorRangeMap }
  | { op: 'delete'; assetId: string }
  | { op: 'approve'; assetId: string }
  | { op: 'pick'; assetId: string }
  | { op: 'gallery'; slotKey: string; offset?: number; limit?: number; q?: string; from?: string; near?: string };

export async function libraryLab(input: LibraryLabOp, form?: FormData): Promise<unknown> {
  if (process.env.NODE_ENV === 'production') throw new Error('The lab does not run in production.');
  const s = store();

  switch (input.op) {
    case 'state':
      return { assets: s.assets, shopPhotos: LAB_SHOP_PHOTOS, shop: LAB_LIBRARY_SHOP };
    case 'reset':
      s.assets = [];
      return { ok: true };
    case 'tags': {
      const a = s.assets.find((x) => x.asset_id === input.assetId);
      if (!a) throw new Error('asset not found');
      a.color_ranges = input.map;
      return { ok: true };
    }
    case 'delete':
      s.assets = s.assets.filter((x) => x.asset_id !== input.assetId);
      return { ok: true };
    case 'approve': {
      const a = s.assets.find((x) => x.asset_id === input.assetId);
      if (!a) throw new Error('asset not found');
      a.approved_at = new Date().toISOString();
      a.rejected_at = null;
      a.rejection_reason = null;
      return { ok: true };
    }
    case 'pick': {
      /* The couple saves the photo onto their part — the board row is the lab's; the photo and its credit are the library's. */
      const a = s.assets.find((x) => x.asset_id === input.assetId && x.approved_at && !x.retired_at);
      return a ? { status: 'ok', imageUrl: a.public_url } : { status: 'error', message: 'That photo is no longer available.' };
    }
    case 'gallery': {
      /* The couple's Search ideas — the shipped clamp, then the shipped shaping (credit, withholding). */
      const query = normalizeGalleryQuery(input, LAB_PARTS);
      if (!query) throw new Error('No supplier Inspiration for that slot');
      const published = s.assets.filter((a) => a.asset_subtype === query.slotKey && a.approved_at && !a.retired_at && (!query.q || a.label.toLowerCase().includes(query.q.toLowerCase())));
      const range = published.slice(query.offset, query.offset + query.limit);
      const rows: RawGalleryRow[] = range.map((a) => ({
        asset_id: a.asset_id,
        label: a.label,
        storage_path: a.public_url,
        vendor_profile_id: LAB_LIBRARY_SHOP.vendor_profile_id,
        shop: { business_name: LAB_LIBRARY_SHOP.business_name, services: LAB_LIBRARY_SHOP.services, business_slug: LAB_LIBRARY_SHOP.business_slug },
        ranges: Object.values(a.color_ranges).map((r) => ({ slot_id: r.slotId, sampled_hex: r.sampledHex })),
        is_event_linked: false,
      }));
      const { assets, withheld } = shapeGalleryPage(query.slotKey, rows, LAB_PARTS);
      const page: GalleryPage = {
        assets,
        total: published.length,
        withheld,
        offset: query.offset,
        limit: query.limit,
        hasMore: query.offset + query.limit < published.length,
      };
      return page;
    }
    case 'upload': {
      if (!form) throw new Error('form required');
      /* ── the SAME gates `uploadStylistAsset` runs, in its order ── */
      const picked = form.get('file');
      const file = picked instanceof File && picked.size > 0 ? picked : null;
      const shopPhotoRef = String(form.get('shopPhotoRef') ?? '').trim() || null;
      const label = String(form.get('label') ?? '').trim();
      const assetSubtype = String(form.get('assetSubtype') ?? '').trim();
      const rightsWarranted = String(form.get('rightsWarranted') ?? '') === '1';
      if (!file && !shopPhotoRef) throw new Error('Pick a photo — a file, or one from your shop.');
      if (file && shopPhotoRef) throw new Error('Pick one photo at a time.');
      if (!label) throw new Error('label required');
      if (!rightsWarranted) throw new Error('Please confirm you hold the rights to publish this photo before uploading.');
      const slot = slotUploadVerdict(assetSubtype, LAB_LIBRARY_SHOP.services, LAB_PARTS);
      if (!slot.allowed) throw new Error(slot.message);
      const used = s.assets.filter((a) => a.asset_subtype === slot.slotKey && !a.retired_at).length;
      const quota = backCatalogueQuotaVerdict({
        mode: 'back_catalogue',
        cap: tierCaps(null).galleryBackCatalogPhotosPerCategory,
        backCatalogueUsed: used,
        categoryLabel: libraryPartLabel(slot.slotKey, LAB_PARTS) ?? 'that category',
      });
      if (!quota.allowed) throw new Error(quota.message);

      let bytes: Uint8Array;
      if (file) bytes = new Uint8Array(await file.arrayBuffer());
      else {
        /* The shop's own photo: checked against the shop's OWN list, never trusted as sent. */
        if (!LAB_SHOP_PHOTOS.some((p) => p.ref === shopPhotoRef)) throw new Error('That photo isn’t one of your shop’s photos.');
        /* Fetched from this dev server itself (the photo is a file it serves) — never read off disk, so the server
           function carries no part of public/ (`no-server-file-carries-public.test.ts`). */
        const host = (await headers()).get('host') ?? 'localhost:3000';
        const r = await fetch(`http://${host}${shopPhotoRef}`);
        if (!r.ok) throw new Error('That photo could not be opened.');
        bytes = new Uint8Array(await r.arrayBuffer());
      }

      const screen = await screenGalleryImage({
        bytes,
        profile: {
          business_name: LAB_LIBRARY_SHOP.business_name,
          contact_phone: LAB_LIBRARY_SHOP.contact_phone,
          contact_email: LAB_LIBRARY_SHOP.contact_email,
          website: LAB_LIBRARY_SHOP.website,
        },
        logoBytes: null,
      });
      if (screen.blocked) throw new Error(screen.message);
      const marked = await watermarkImageBytes(bytes, markVariantForSource(null));
      /* The photo's own colours, tagged at upload — the same `autoColourRanges` the shipped action writes. */
      const colorRanges = await autoColourRanges(bytes);
      s.seq += 1;
      const assetId = `lab-asset-${s.seq}`;
      s.assets.unshift({
        asset_id: assetId,
        asset_type: 'supplier_gallery',
        asset_subtype: slot.slotKey,
        label,
        storage_path: `moodboard-library/lab/${assetId}.jpg`,
        approved_at: null,
        retired_at: null,
        rejected_at: null,
        rejection_reason: null,
        created_at: new Date().toISOString(),
        source_event_id: null,
        public_url: `data:${marked.contentType};base64,${Buffer.from(marked.bytes).toString('base64')}`,
        color_ranges: colorRanges,
        screen_findings: screen.findings,
        rights_warranty_version: RIGHTS_WARRANTY_VERSION,
      });
      return { assetId, textScreen: screen.textScreen, colorRanges };
    }
  }
}
