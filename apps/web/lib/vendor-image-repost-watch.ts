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
 *   4. Match against OTHER non-demo vendors' hashes (Hamming <= the admin-set
 *      threshold from /admin/settings · platform_settings
 *      .repost_watch_hamming_threshold; fallback DEFAULT_HAMMING_THRESHOLD).
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

// Fallback only — the live threshold is admin-managed via the "Repost-watch
// match sensitivity" field on /admin/settings (platform_settings
// .repost_watch_hamming_threshold, read by resolveThreshold below). This
// default applies only when that row is missing/out-of-range or the fetch fails.
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
 * Insert (deduped) a flag for every non-demo, cross-vendor hit of one hashed
 * row against the rest of the non-demo hash set, at `threshold`. Shared by both
 * the per-save scan (hashAndScanVendorImages) and the standalone re-match pass
 * (rematchAllVendorImages) so the matching rule lives in exactly one place.
 *
 * `candidates` is the full non-demo hash set, passed in by the caller so a
 * batch re-match fetches it ONCE rather than per row. Self-matches (same
 * vendor_profile_id) and the row itself never flag. Returns the number of flag
 * upserts attempted (for the admin summary).
 */
async function flagMatchesForHash(
  admin: ReturnType<typeof createAdminClient>,
  self: { vendorProfileId: string; ref: string; surface: RepostSurface; phash: bigint },
  candidates: ReadonlyArray<HashRow>,
  threshold: number,
): Promise<number> {
  const matches = candidates
    .filter((c) => c.vendor_profile_id !== self.vendorProfileId)
    .map((c) => ({ row: c, dist: hammingDistance(self.phash, phashFromDb(c.phash)) }))
    .filter((m) => m.dist <= threshold)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);

  for (const m of matches) {
    // Dedup on the unique (flagged_r2_ref, source_r2_ref) pair — re-runs never
    // duplicate a flag.
    await admin.from('vendor_image_flags').upsert(
      {
        flagged_vendor_id: self.vendorProfileId,
        flagged_r2_ref: self.ref,
        flagged_surface: self.surface,
        source_vendor_id: m.row.vendor_profile_id,
        source_r2_ref: m.row.r2_ref,
        source_surface: m.row.surface,
        hamming_distance: m.dist,
      },
      { onConflict: 'flagged_r2_ref,source_r2_ref', ignoreDuplicates: true },
    );
  }
  return matches.length;
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

    // Candidate set for flagging THIS vendor's new uploads: OTHER vendors,
    // non-demo, already hashed. At founder-only scale this is tens of rows;
    // fetched ONCE per call (not per ref). Only needed when this upload is a
    // real (non-demo) vendor's — demo uploads never raise a flag.
    let candidates: HashRow[] = [];
    if (!thisIsDemo) {
      const { data } = await admin
        .from('vendor_image_hashes')
        .select('vendor_profile_id, r2_ref, surface, phash, is_demo')
        .neq('vendor_profile_id', vendorProfileId)
        .eq('is_demo', false);
      candidates = (data ?? []) as HashRow[];
    }

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

      // Match this new hash against every other non-demo hash (exact JS mirror
      // of the SQL public.hamming_distance()). (When the marketplace grows, swap
      // to a BK-tree / LSH bucketing column — out of scope now.)
      await flagMatchesForHash(
        admin,
        { vendorProfileId, ref, surface, phash },
        candidates,
        threshold,
      );
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
 * Standalone RE-MATCH pass over the EXISTING hash set — decoupled from hashing.
 *
 * The per-save scan (and the hashing half of rescanAllVendorImages) only flags a
 * ref AT THE MOMENT IT IS FIRST HASHED, against the threshold in force then.
 * Once a ref is hashed it is never re-examined, so an admin WIDENING the net
 * (raising repost_watch_hamming_threshold) would otherwise have ZERO effect on
 * already-hashed images, and "Rescan all" would be a no-op for matching once
 * everything is hashed. This pass closes that gap: it re-queries EVERY real
 * (non-demo) hashed ref and re-matches it against every OTHER non-demo hash at
 * the CURRENT threshold, upserting flags. The (flagged_r2_ref, source_r2_ref)
 * dedup means re-runs never duplicate a flag — widening only ADDS the newly-
 * qualifying pairs.
 *
 * Reads the stored pHash straight from vendor_image_hashes (no R2 GET, no
 * re-decode) — pure DB + in-JS Hamming, so it is cheap to re-run on demand.
 * Best-effort: swallows + Sentry-captures any throw. Returns the count of
 * non-demo refs re-matched + flag upserts attempted, for the admin summary.
 */
export async function rematchAllVendorImages(): Promise<{
  refsRematched: number;
  flagsUpserted: number;
}> {
  try {
    const admin = createAdminClient();
    const threshold = await resolveThreshold(admin);

    // The entire real (non-demo) hash set — both the rows we re-match AND the
    // candidate pool they match against are exactly this set.
    const { data } = await admin
      .from('vendor_image_hashes')
      .select('vendor_profile_id, r2_ref, surface, phash, is_demo')
      .eq('is_demo', false);
    const hashes = (data ?? []) as HashRow[];

    let flagsUpserted = 0;
    for (const row of hashes) {
      flagsUpserted += await flagMatchesForHash(
        admin,
        {
          vendorProfileId: row.vendor_profile_id,
          ref: row.r2_ref,
          surface: row.surface,
          phash: phashFromDb(row.phash),
        },
        hashes,
        threshold,
      );
    }
    return { refsRematched: hashes.length, flagsUpserted };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'vendor-image-repost-watch' },
      extra: { phase: 'rematch-all' },
    });
    return { refsRematched: 0, flagsUpserted: 0 };
  }
}

/**
 * Admin backfill — hash every real (non-demo) vendor's current portfolio +
 * service-cover images and flag any cross-vendor matches. REQUIRED for the
 * feature to have any signal: hashing otherwise only fires on NEW saves, and the
 * founder-only vendor set is near-static, so without this nothing gets hashed.
 *
 * After hashing, runs a standalone RE-MATCH pass (rematchAllVendorImages) over
 * the FULL hash set at the current threshold — so this single "Rescan all"
 * action both (a) hashes any never-seen refs AND (b) re-evaluates every
 * already-hashed ref against the current admin threshold. Without (b), widening
 * the threshold would have no effect on previously-hashed images and the rescan
 * would be a matching no-op once everything is hashed.
 *
 * Runs entirely service-side (admin client). Returns a small summary for the
 * admin UI. Idempotent — re-hashing skips seen refs; re-matching is deduped on
 * (flagged_r2_ref, source_r2_ref).
 */
export async function rescanAllVendorImages(): Promise<{
  vendorsScanned: number;
  refsConsidered: number;
  refsRematched: number;
  flagsUpserted: number;
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

  // Re-match EVERY hashed ref at the current threshold (not just refs hashed
  // just now) — this is what makes a widened threshold take effect and what
  // makes "Rescan all" do real matching work even when nothing new was hashed.
  const rematch = await rematchAllVendorImages();

  return {
    vendorsScanned: realVendorIds.size,
    refsConsidered,
    refsRematched: rematch.refsRematched,
    flagsUpserted: rematch.flagsUpserted,
  };
}
