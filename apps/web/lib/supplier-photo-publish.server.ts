/**
 * THE ONE SERVER DOOR A SUPPLIER PHOTO TAKES TO BECOME PUBLIC WITHOUT A BROWSER
 * (Seal and plate, owner-approved 2026-11-04 · Build 6 Lane L, owner 10 Nov:
 * "yes build 6").
 *
 * `FileUpload` marks a supplier photo in the browser (`app/_components/upload-mark.ts`).
 * A few photos reach the shop's public folder WITHOUT a browser: an event-album
 * photo published to the page after the guests' 7 days
 * (`lib/supplier-page-notice.server.ts`), an Instagram post re-hosted on a sync
 * (`app/vendor-dashboard/instagram-actions.ts`), and every photo uploaded before
 * the mark existed (the backfill, `scripts/mark-supplier-photos.ts`). Each of
 * them goes through `publishMarkedSupplierPhoto` — the same shop facts
 * (`shopMarkFacts`, read from the shop's own row), the same painter
 * (`markPhotoBytes`, the shared geometry), the same private clean copy and the
 * same pairing row (`supplier_photo_originals`) as a browser upload.
 *
 * 🔒 FAILS CLOSED. Every step throws; nothing here catches. The public object is
 * written only AFTER its clean copy is safely stored and only with MARKED bytes.
 * A caller that catches must drop the photo (album: stays waiting · Instagram:
 * the post drops out of the sync) — never fall back to the raw bytes.
 * `lib/every-supplier-photo-is-marked.test.ts` holds that.
 *
 * 🔁 IDEMPOTENT. The clean copy lives at a key DERIVED from the public key
 * (`cleanCopyKeyFor`). When it already exists it is the source, so a run that
 * died after writing the marked public copy never re-marks those marked bytes
 * as if they were the original (a double mark).
 */
import type { MarkSpec } from './photo-mark-geometry';

const MEDIA = 'setnayan-media';
const ORIGINALS = 'setnayan-vendor-verification';

/** The private clean copy's key for a public `vendors/<shop>/…` key — one per public key, always the same. */
export function cleanCopyKeyFor(publicKey: string): string {
  const m = /^vendors\/([^/]+)\/(.+)$/.exec(publicKey);
  if (!m || m[2]!.includes('..')) throw new Error(`supplier photo: ${publicKey} is not a vendors/<shop>/… key`);
  return `vendor-originals/${m[1]}/server/${m[2]}`;
}

export type PublishDeps = {
  /** The clean copy, or null when none is stored yet. Throws on any other failure. */
  getOriginal: (key: string) => Promise<Uint8Array | null>;
  putOriginal: (key: string, bytes: Buffer) => Promise<void>;
  putPublic: (key: string, bytes: Buffer) => Promise<void>;
  /** The shop's mark, from its own row — throws when unreadable. */
  specFor: (vendorProfileId: string) => Promise<{ spec: Extract<MarkSpec, { kind: 'supplier' }>; logoPng: Buffer | null }>;
  mark: (bytes: Uint8Array, spec: MarkSpec, logoPng: Buffer | null) => Promise<Buffer>;
  /** Web-size the clean copy (upright JPEG), the same size the public copy is drawn at. */
  normalise: (bytes: Uint8Array) => Promise<Buffer>;
  pair: (row: { vendor_profile_id: string; public_ref: string; original_ref: string; mark_kind: 'setnayan' | 'verified' }) => Promise<void>;
};

export type Published = { publicRef: string; originalRef: string; markKind: 'setnayan' | 'verified'; source: 'stored-original' | 'given-bytes' };

/**
 * Mark `bytes` with the shop's Seal and plate and publish them at `publicKey`
 * (inside `vendors/<shop>/` of the media bucket), keeping the private clean
 * copy and pairing the two. Returns the public r2:// ref. THROWS on any failure.
 */
export async function publishMarkedSupplierPhoto(
  args: { vendorProfileId: string; publicKey: string; bytes: Uint8Array },
  deps: PublishDeps = defaultDeps(),
): Promise<Published> {
  const { vendorProfileId, publicKey } = args;
  if (!vendorProfileId || !publicKey.startsWith(`vendors/${vendorProfileId}/`)) {
    throw new Error(`supplier photo: ${publicKey} is not inside vendors/${vendorProfileId}/`);
  }
  const originalKey = cleanCopyKeyFor(publicKey);
  // 1 · THE CLEAN COPY FIRST. A stored one wins (a re-run never marks marked bytes again).
  const stored = await deps.getOriginal(originalKey);
  let clean: Uint8Array;
  if (stored) {
    clean = stored;
  } else {
    const normalised = await deps.normalise(args.bytes);
    await deps.putOriginal(originalKey, normalised);
    clean = normalised;
  }
  // 2 · THE MARK, from the shop's own row. A throw here publishes nothing.
  const { spec, logoPng } = await deps.specFor(vendorProfileId);
  const marked = await deps.mark(clean, spec, logoPng);
  if (!marked || marked.byteLength === 0) throw new Error('supplier photo: the mark produced no bytes');
  // 3 · THE PUBLIC COPY — marked bytes only — then the pairing.
  await deps.putPublic(publicKey, marked);
  const publicRef = `r2://${MEDIA}/${publicKey}`;
  const originalRef = `r2://${ORIGINALS}/${originalKey}`;
  const markKind = spec.verified ? 'verified' : 'setnayan';
  await deps.pair({ vendor_profile_id: vendorProfileId, public_ref: publicRef, original_ref: originalRef, mark_kind: markKind });
  return { publicRef, originalRef, markKind, source: stored ? 'stored-original' : 'given-bytes' };
}

/** The real storage, painter and table. Lazy imports keep sharp/opentype out of any caller that only needs the key math. */
export function defaultDeps(): PublishDeps {
  return {
    getOriginal: async (key) => {
      const { r2HeadOutcome, r2GetBytes } = await import('./r2');
      const head = await r2HeadOutcome({ bucket: ORIGINALS, key });
      if (head.kind === 'absent') return null;
      if (head.kind !== 'present') throw new Error(`supplier photo: clean copy ${key} could not be checked`);
      return (await r2GetBytes({ bucket: ORIGINALS, key })).bytes;
    },
    putOriginal: async (key, bytes) => {
      const { r2Upload } = await import('./r2');
      await r2Upload({ bucket: ORIGINALS, key, body: bytes, contentType: 'image/jpeg' });
    },
    putPublic: async (key, bytes) => {
      const { r2Upload } = await import('./r2');
      await r2Upload({ bucket: MEDIA, key, body: bytes, contentType: 'image/jpeg' });
    },
    specFor: async (vendorProfileId) => {
      const [{ createAdminClient }, { shopMarkFacts, shopLogoBytes }, { logoCoinPng }] = await Promise.all([
        import('./supabase/admin'),
        import('./supplier-mark-spec.server'),
        import('./photo-mark-server'),
      ]);
      const facts = await shopMarkFacts(createAdminClient(), vendorProfileId);
      const logo = facts.spec.hasLogo ? await shopLogoBytes(facts.logoRef) : null;
      const coin = logo ? await logoCoinPng(logo, facts.logoRef) : null;
      // A verified shop whose logo cannot be read is still marked verified — with no coin, never someone else's.
      return { spec: { ...facts.spec, hasLogo: coin !== null }, logoPng: coin };
    },
    mark: async (bytes, spec, logoPng) => {
      const { markPhotoBytes } = await import('./photo-mark-server');
      return (await markPhotoBytes(bytes, spec, { logoPng })).bytes;
    },
    normalise: async (bytes) => {
      const { default: sharp } = await import('sharp');
      return sharp(bytes).rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    },
    pair: async (row) => {
      const { createAdminClient } = await import('./supabase/admin');
      const { error } = await createAdminClient().from('supplier_photo_originals').upsert(row, { onConflict: 'public_ref' });
      if (error) throw new Error(`supplier photo: supplier_photo_originals upsert failed: ${error.message}`);
    },
  };
}
