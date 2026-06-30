import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseStoredAsset, presignDisplayUrl } from '@/lib/uploads';
import { safeFetchImageBytes } from '@/lib/safe-image-fetch';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  computePHash,
  hammingDistance,
  phashToDbString,
  phashFromDb,
} from '@/lib/perceptual-hash';

/**
 * Reverse-image repost-watch orchestration (cross-vendor on-platform theft
 * detection). Detect-and-flag-for-admin-review ONLY — never auto-blocks,
 * auto-takes-down, or auto-deletes.
 *
 * For each newly-saved r2:// (or legacy http) vendor image ref:
 *   1. Fetch the authoritative bytes from R2 (presign + plain fetch; the SSRF
 *      guard is reserved for legacy EXTERNAL http refs).
 *   2. Compute a 64-bit DCT pHash (computePHash, lib/perceptual-hash).
 *   3. Upsert into vendor_image_hashes (denormalizing is_demo).
 *   4. Match against OTHER non-demo vendors' hashes (Hamming <= admin threshold).
 *   5. Insert a vendor_image_flags row (deduped) for each non-demo cross-vendor
 *      hit, for the /admin/repost-watch queue.
 *
 * IMPORTANT trust boundary (honest): all reads/writes here use the SERVICE-ROLE
 * admin client (createAdminClient), which BYPASSES RLS. RLS deny-by-default
 * protects VENDORS from touching these internal-integrity tables, but it is NOT
 * the guard for THIS code — the real guard is that ONLY the post-save after()
 * task and the admin rescan/resolve actions ever construct the admin client.
 *
 * Why server-side (not the client onFilePicked hook): a hostile reposter
 * controls the browser, so a client-supplied hash can be spoofed/omitted. Theft
 * evidence must be computed from the authoritative R2 bytes server-side.
 *
 * Failure posture: this whole function is best-effort. Every public entry point
 * swallows + Sentry-captures any throw so a hashing hiccup (R2 not configured in
 * dev, an undecodable byte stream, a transient network blip) never breaks the
 * vendor's save. Un-hashed images are simply re-attempted on the next save or
 * via the admin "Rescan all" backfill.
 */

export type RepostSurface = 'service_primary' | 'portfolio';

const DEFAULT_HAMMING_THRESHOLD = 10;

type HashRow = {
  vendor_profile_id: string;
  r2_ref: string;
  surface: RepostSurface;
  phash: string | number;
  is_demo: boolean;
};

/**
 * Fetch the authoritative bytes for a stored asset ref. For r2:// refs we
 * presign a GET and fetch plainly — the key is server-derived (no SSRF surface)
 * and the SSRF guard's image/* content-type requirement would false-reject an
 * object stored as application/octet-stream. For legacy EXTERNAL http(s) refs
 * (rare; mostly old logos which are out of scope) we DO route through the
 * SSRF-safe fetch. Returns null on any failure → caller skips the ref.
 */
async function fetchAssetBytes(ref: string): Promise<Uint8Array | null> {
  const parsed = parseStoredAsset(ref);
  if (!parsed) return null;
  try {
    if (parsed.kind === 'r2') {
      const url = await presignDisplayUrl(parsed.bucket, parsed.key, 300);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    }
    // Legacy external URL — defense-in-depth SSRF guard.
    return await safeFetchImageBytes(parsed.url);
  } catch {
    return null;
  }
}

async function resolveThreshold(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  try {
    const settings = await fetchPlatformSettings(admin);
    const t = settings.repost_watch_hamming_threshold;
    if (typeof t === 'number' && Number.isFinite(t) && t >= 0 && t <= 64) return t;
  } catch {
    // fall through to default
  }
  return DEFAULT_HAMMING_THRESHOLD;
}

/**
 * Hash a set of newly-saved refs for one vendor, then flag any cross-vendor,
 * non-demo perceptual matches. Idempotent: refs already hashed for this vendor
 * are skipped (no wasted R2 GET); the flag insert is deduped on
 * (flagged_r2_ref, source_r2_ref). Self-matches (same vendor) never flag.
 */
export async function hashAndScanVendorImages(args: {
  vendorProfileId: string;
  refs: ReadonlyArray<string | null | undefined>;
  surface: RepostSurface;
}): Promise<void> {
  const { vendorProfileId, surface } = args;
  const refs = Array.from(
    new Set(
      args.refs.filter(
        (r): r is string => typeof r === 'string' && r.trim().length > 0,
      ),
    ),
  );
  if (refs.length === 0) return;

  try {
    const admin = createAdminClient();

    // is_demo for THIS vendor — denormalized onto every hash row so the match
    // query can cheaply exclude demo collisions on both sides.
    const { data: vendorRow } = await admin
      .from('vendor_profiles')
      .select('is_demo')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    const thisIsDemo = Boolean(
      (vendorRow as { is_demo?: boolean | null } | null)?.is_demo,
    );

    // Skip refs we've already hashed for this vendor (idempotent rescans).
    const { data: existing } = await admin
      .from('vendor_image_hashes')
      .select('r2_ref')
      .eq('vendor_profile_id', vendorProfileId)
      .in('r2_ref', refs);
    const already = new Set(
      ((existing ?? []) as { r2_ref: string }[]).map((r) => r.r2_ref),
    );
    const toHash = refs.filter((r) => !already.has(r));
    if (toHash.length === 0) return;

    const threshold = await resolveThreshold(admin);

    for (const ref of toHash) {
      const bytes = await fetchAssetBytes(ref);
      if (!bytes) continue; // unreachable / non-image → skip cleanly
      const phash = await computePHash(bytes);
      if (phash === null) continue; // undecodable → skip cleanly

      // Upsert the hash (idempotent on the (vendor, r2_ref) unique key).
      await admin.from('vendor_image_hashes').upsert(
        {
          vendor_profile_id: vendorProfileId,
          surface,
          r2_ref: ref,
          phash: phashToDbString(phash),
          is_demo: thisIsDemo,
        },
        { onConflict: 'vendor_profile_id,r2_ref', ignoreDuplicates: false },
      );

      // Demo uploads never RAISE a flag (their own collisions are meaningless),
      // but we still store their hash so a real vendor reposting a demo image
      // could be caught the other way around once demo↔real is in scope. For
      // now, only flag when THIS upload is a real (non-demo) vendor's.
      if (thisIsDemo) continue;

      // Candidate matches: OTHER vendors, non-demo, hashed already. At
      // founder-only scale this is tens of rows; compute Hamming in JS using the
      // exact mirror of the SQL public.hamming_distance(). (When the marketplace
      // grows, swap to a BK-tree / LSH bucketing column — out of scope now.)
      const { data: candidates } = await admin
        .from('vendor_image_hashes')
        .select('vendor_profile_id, r2_ref, surface, phash, is_demo')
        .neq('vendor_profile_id', vendorProfileId)
        .eq('is_demo', false);

      const matches = ((candidates ?? []) as HashRow[])
        .map((c) => ({
          row: c,
          dist: hammingDistance(phash, phashFromDb(c.phash)),
        }))
        .filter((m) => m.dist <= threshold)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5);

      for (const m of matches) {
        // Dedup on the unique (flagged_r2_ref, source_r2_ref) pair.
        await admin.from('vendor_image_flags').upsert(
          {
            flagged_vendor_id: vendorProfileId,
            flagged_r2_ref: ref,
            flagged_surface: surface,
            source_vendor_id: m.row.vendor_profile_id,
            source_r2_ref: m.row.r2_ref,
            source_surface: m.row.surface,
            hamming_distance: m.dist,
          },
          { onConflict: 'flagged_r2_ref,source_r2_ref', ignoreDuplicates: true },
        );
      }
    }
  } catch (err) {
    // Best-effort: never let a hashing failure break the vendor's save.
    Sentry.captureException(err, {
      tags: { feature: 'vendor-image-repost-watch' },
      extra: { vendorProfileId, surface, refCount: refs.length },
    });
  }
}

/**
 * Admin backfill — hash every real (non-demo) vendor's current portfolio +
 * service-cover images and flag any cross-vendor matches. REQUIRED for the
 * feature to have any signal: hashing otherwise only fires on NEW saves, and the
 * founder-only vendor set is near-static, so without this nothing gets hashed.
 *
 * Runs entirely service-side (admin client). Returns a small summary for the
 * admin UI. Idempotent — re-running only hashes refs not yet seen.
 */
export async function rescanAllVendorImages(): Promise<{
  vendorsScanned: number;
  refsConsidered: number;
}> {
  const admin = createAdminClient();

  // Pull real vendors + their portfolio refs.
  const { data: profiles } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, portfolio_r2_keys, is_demo')
    .eq('is_demo', false);

  // Pull real vendors' service cover photos.
  const { data: services } = await admin
    .from('vendor_services')
    .select('vendor_profile_id, primary_photo_r2_key')
    .not('primary_photo_r2_key', 'is', null);

  const profileRows = (profiles ?? []) as {
    vendor_profile_id: string;
    portfolio_r2_keys: string[] | null;
    is_demo: boolean;
  }[];
  const realVendorIds = new Set(profileRows.map((p) => p.vendor_profile_id));

  let refsConsidered = 0;

  // Portfolio surface.
  for (const p of profileRows) {
    const refs = (p.portfolio_r2_keys ?? []).filter(Boolean);
    refsConsidered += refs.length;
    if (refs.length > 0) {
      await hashAndScanVendorImages({
        vendorProfileId: p.vendor_profile_id,
        refs,
        surface: 'portfolio',
      });
    }
  }

  // Service-primary surface (only for real vendors — demo services are skipped
  // by the realVendorIds gate so we never hash demo imagery here).
  const serviceRows = (services ?? []) as {
    vendor_profile_id: string;
    primary_photo_r2_key: string | null;
  }[];
  const byVendor = new Map<string, string[]>();
  for (const s of serviceRows) {
    if (!s.primary_photo_r2_key || !realVendorIds.has(s.vendor_profile_id)) continue;
    const list = byVendor.get(s.vendor_profile_id) ?? [];
    list.push(s.primary_photo_r2_key);
    byVendor.set(s.vendor_profile_id, list);
  }
  for (const [vendorProfileId, refs] of byVendor) {
    refsConsidered += refs.length;
    await hashAndScanVendorImages({
      vendorProfileId,
      refs,
      surface: 'service_primary',
    });
  }

  return { vendorsScanned: realVendorIds.size, refsConsidered };
}
