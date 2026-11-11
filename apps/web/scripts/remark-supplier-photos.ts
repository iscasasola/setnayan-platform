/**
 * scripts/remark-supplier-photos.ts — THE SUPPLIER PHOTO MARK JOB (Seal and plate, owner-approved 2026-11-04 ·
 * Build 6 Lane L: "Re-mark the photos already uploaded, keeping a private clean copy").
 *
 *   DRY RUN (counts only — reads, writes NOTHING):
 *     NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/remark-supplier-photos.ts --dry-run
 *
 *   APPLY (the OWNER / controller only, after review — rewrites public bytes):
 *     … R2_* … npx tsx scripts/remark-supplier-photos.ts --apply --confirm=<supabase project ref>
 *
 * Two jobs, both IDEMPOTENT (a second run finds nothing to do):
 *   1 · UNMARKED — a public supplier photo with no `supplier_photo_originals` row was published before the mark
 *       existed (`planSupplierPhotoBackfill`). Its current bytes become the private clean copy, the marked copy is
 *       written AT THE SAME KEY (no referencing column changes), and the two are paired
 *       (`publishMarkedSupplierPhoto` — the same door the album and Instagram publishes take). A run that died
 *       half-way re-reads the stored clean copy, never the already-marked public bytes, so nothing is marked twice.
 *       Clips are reported, never touched: a clip cannot be re-burned on the server; the shop re-uploads it.
 *   2 · RE-MARK — a paired photo whose shop has since gained or lost Verified (`pendingRemarks` / `remarkOne`).
 *
 * 🛑 A SESSION NEVER RUNS --apply. It rewrites public bytes in production storage; that is the owner's call.
 * The apply mode is refused unless `--confirm=` names the very project the URL points at.
 * ⚠ A photo uploaded with the OLD browser stamp (before #7246) already carries that stamp in its bytes; the backfill
 * keeps those bytes as the "clean" copy, so such a photo shows both until the shop re-uploads it.
 */
import { createAdminClient } from '../lib/supabase/admin';
import { pendingRemarks, desiredMarkKind, remarkOne, type MarkKind, type OriginalRow } from '../lib/supplier-photo-remark.server';
import { shopMarkFromRow } from '../lib/supplier-mark-spec.server';
import { describeBackfill, planSupplierPhotoBackfill, type PhotoRefRow } from '../lib/supplier-photo-backfill';

type Mode = { kind: 'dry-run' } | { kind: 'apply'; confirm: string };

function parseMode(args: readonly string[]): Mode | null {
  if (args.length === 1 && args[0] === '--dry-run') return { kind: 'dry-run' };
  if (args.length === 2 && args[0] === '--apply' && args[1]?.startsWith('--confirm=')) {
    return { kind: 'apply', confirm: args[1].slice('--confirm='.length) };
  }
  return null;
}

/** The project ref of a Supabase URL (`https://<ref>.supabase.co`). */
function projectRefOf(url: string): string | null {
  return /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url)?.[1] ?? null;
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (!mode) {
    console.error('Refused. Run with exactly `--dry-run`, or (owner only) `--apply --confirm=<supabase project ref>`.');
    process.exit(2);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(2);
  }
  if (mode.kind === 'apply' && mode.confirm !== projectRefOf(url)) {
    console.error(`Refused: --confirm=${mode.confirm} does not name the project this URL points at.`);
    process.exit(2);
  }

  // ── READ (both modes) ─────────────────────────────────────────────────────
  // The service role, through the app's one factory: the shop's renewal date is not readable by a signed-in session.
  const db = createAdminClient();
  const [originals, profiles, services, ig] = await Promise.all([
    db.from('supplier_photo_originals').select('id, vendor_profile_id, public_ref, original_ref, frame, mark_kind'),
    db.from('vendor_profiles').select('vendor_profile_id, business_name, business_slug, logo_url, verification_state, next_renewal_due_at, portfolio_r2_keys, microsite_hero_photo_key'),
    db.from('vendor_services').select('vendor_profile_id, primary_photo_r2_key, showcase_photo_r2_keys, showcase_video_r2_key'),
    db.from('vendor_ig_media').select('vendor_profile_id, r2_key, thumbnail_r2_key'),
  ]);
  for (const [name, res] of [['supplier_photo_originals', originals], ['vendor_profiles', profiles], ['vendor_services', services], ['vendor_ig_media', ig]] as const) {
    if (res.error) throw new Error(`${name} unreadable: ${res.error.message}`);
  }
  type Shop = { vendor_profile_id: string; business_name: string | null; business_slug: string | null; logo_url: string | null; verification_state: string | null; next_renewal_due_at: string | null; portfolio_r2_keys: string[] | null; microsite_hero_photo_key: string | null };
  type Svc = { vendor_profile_id: string; primary_photo_r2_key: string | null; showcase_photo_r2_keys: string[] | null; showcase_video_r2_key: string | null };
  type Ig = { vendor_profile_id: string; r2_key: string | null; thumbnail_r2_key: string | null };
  const shops = (profiles.data ?? []) as Shop[];
  const rows: PhotoRefRow[] = [];
  for (const s of shops) {
    for (const ref of s.portfolio_r2_keys ?? []) rows.push({ vendor_profile_id: s.vendor_profile_id, column: 'vendor_profiles.portfolio_r2_keys', ref });
    rows.push({ vendor_profile_id: s.vendor_profile_id, column: 'vendor_profiles.microsite_hero_photo_key', ref: s.microsite_hero_photo_key });
  }
  for (const v of (services.data ?? []) as Svc[]) {
    rows.push({ vendor_profile_id: v.vendor_profile_id, column: 'vendor_services.primary_photo_r2_key', ref: v.primary_photo_r2_key });
    for (const ref of v.showcase_photo_r2_keys ?? []) rows.push({ vendor_profile_id: v.vendor_profile_id, column: 'vendor_services.showcase_photo_r2_keys', ref });
    rows.push({ vendor_profile_id: v.vendor_profile_id, column: 'vendor_services.showcase_video_r2_key', ref: v.showcase_video_r2_key });
  }
  for (const m of (ig.data ?? []) as Ig[]) {
    rows.push({ vendor_profile_id: m.vendor_profile_id, column: 'vendor_ig_media.r2_key', ref: m.r2_key });
    rows.push({ vendor_profile_id: m.vendor_profile_id, column: 'vendor_ig_media.thumbnail_r2_key', ref: m.thumbnail_r2_key });
  }
  const paired = (originals.data ?? []) as OriginalRow[];
  const plan = planSupplierPhotoBackfill(rows, new Set(paired.map((r) => r.public_ref)));
  const desired = new Map<string, MarkKind>();
  const shopById = new Map(shops.map((s) => [s.vendor_profile_id, s]));
  for (const s of shops) desired.set(s.vendor_profile_id, desiredMarkKind(shopMarkFromRow(s).spec));
  const remarks = pendingRemarks(paired, desired);

  console.log(`[${mode.kind}] supplier photo mark job`);
  for (const line of describeBackfill(plan, remarks.length)) console.log(line);
  if (mode.kind === 'dry-run') {
    console.log('dry run — nothing was written.');
    return;
  }

  // ── APPLY (owner only, past the confirm above) ────────────────────────────
  const [{ r2GetBytes, r2Upload, R2_BUCKETS }, { publishMarkedSupplierPhoto, defaultDeps }, { parseStoredAsset }] = await Promise.all([
    import('../lib/r2'),
    import('../lib/supplier-photo-publish.server'),
    import('../lib/uploads'),
  ]);
  const painter = defaultDeps();
  let marked = 0;
  let failed = 0;
  for (const p of plan.photos) {
    try {
      const { bytes } = await r2GetBytes({ bucket: R2_BUCKETS.media, key: p.key });
      await publishMarkedSupplierPhoto({ vendorProfileId: p.vendor_profile_id, publicKey: p.key, bytes });
      marked += 1;
    } catch (err) {
      failed += 1;
      console.error(`  could not mark ${p.ref}`, err);
    }
  }
  let remarked = 0;
  for (const row of remarks) {
    if (!shopById.has(row.vendor_profile_id)) continue;
    try {
      // The shop's mark as an upload would get it — its own row, its logo coin (`specFor`, the publish door's).
      const { spec, logoPng } = await painter.specFor(row.vendor_profile_id);
      const out = await remarkOne(row, spec, {
        getBytes: async (ref) => {
          const at = parseStoredAsset(ref);
          if (!at || at.kind !== 'r2') throw new Error(`not an r2 ref: ${ref}`);
          return (await r2GetBytes({ bucket: at.bucket as typeof R2_BUCKETS.vendorVerification, key: at.key })).bytes;
        },
        putBytes: async (ref, bytes, contentType) => {
          const at = parseStoredAsset(ref);
          if (!at || at.kind !== 'r2' || at.bucket !== R2_BUCKETS.media) throw new Error(`not a media ref: ${ref}`);
          await r2Upload({ bucket: R2_BUCKETS.media, key: at.key, body: bytes, contentType });
        },
        setMarkKind: async (id, kind) => {
          const { error } = await db.from('supplier_photo_originals').update({ mark_kind: kind, marked_at: new Date().toISOString() }).eq('id', id);
          if (error) throw new Error(error.message);
        },
        mark: async (bytes, s) => painter.mark(bytes, s, logoPng),
      });
      if (out === 'remarked') remarked += 1;
    } catch (err) {
      failed += 1;
      console.error(`  could not re-mark ${row.public_ref}`, err);
    }
  }
  console.log(`applied: ${marked} marked · ${remarked} re-marked · ${failed} failed (failed ones are untouched; run again)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
