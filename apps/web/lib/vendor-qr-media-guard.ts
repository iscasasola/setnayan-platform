import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseStoredAsset, presignDisplayUrl } from '@/lib/uploads';
import {
  safeFetchImageBytes,
  hostResolvesPublic,
} from '@/lib/safe-image-fetch';
import {
  payloadHitsGuardedPath,
  VENDOR_QR_GUARDED_PATHS,
} from '@/lib/vendor-qr-guard-shared';

/**
 * QR-in-media integrity guard — server scanner (owner-locked 2026-07-03).
 *
 * THE RULE: the QR generators (Shortlist/invite QR → /vendor-invite/<slug>,
 * Locked QR → /vendor/lock/<token>) are the ONLY free customer-import channel,
 * and they exist for in-person, already-closed clients. A vendor who embeds
 * their QR inside photos on their PUBLIC website turns the marketplace page
 * into a self-serve import funnel — visitors scan and enter as
 * `source='vendor_invite'` imports, dodging the inquiry path and cheapening
 * the "Verified booking" badge. Such media is INVALID.
 *
 * Two entry points:
 *   · vendorQrGuardRejects(refs)   — save-time gate for server actions. Fetches
 *     the authoritative R2 bytes, decodes any QR (sharp → raw RGBA → jsQR, the
 *     same decode chassis as lib/perceptual-hash), and rejects when the payload
 *     targets a funnel path — DIRECTLY or after server-side redirect resolution
 *     (closing the URL-shortener loophole: a bit.ly QR that 302s to
 *     /vendor-invite/<slug> is still the funnel). FAIL-OPEN on scanner errors:
 *     a decode hiccup must never block an honest vendor's save — the retro-scan
 *     + admin queue is the backstop.
 *   · scanAllVendorMediaForQr()    — admin retro-scan over ALREADY-uploaded
 *     website media (portfolio, logo, microsite hero, service cover + showcase
 *     photos). Flag-and-review only (vendor_qr_media_flags, migration
 *     20270504200000) — it never auto-deletes.
 *
 * Scope guard: matching is on VENDOR-FUNNEL payloads, never "any QR" — genuine
 * wedding portfolio photos legitimately contain guest/table/event QR codes
 * (Papic is QR-heavy) and must not be invalidated.
 *
 * Videos are NOT scanned here — there is no server-side frame extraction
 * (no FFmpeg infra). The ≤30s showcase clip is checked CLIENT-side at pick
 * time (lib/vendor-qr-guard-client.ts frame sampling); the report path +
 * admin spot-check cover the residual gap.
 *
 * Trust boundary: reads/writes on the flags table use the SERVICE-ROLE admin
 * client (bypasses RLS) — same posture as lib/vendor-image-repost-watch: only
 * this module and the admin actions ever construct that client here.
 */

export type VendorQrSurface =
  | 'portfolio'
  | 'logo'
  | 'microsite_hero'
  | 'service_primary'
  | 'service_showcase';

export type VendorQrHit = {
  ref: string;
  payload: string;
  /** Final URL after redirect resolution when the payload was an off-platform
   *  shortener; null when the payload itself carried the funnel path. */
  resolvedUrl: string | null;
};

/** Max redirect hops we follow when resolving a decoded URL. Shorteners are
 *  1–2 hops; anything deeper is not worth chasing at save time. */
const MAX_REDIRECT_HOPS = 4;
const REDIRECT_HOP_TIMEOUT_MS = 3500;

/**
 * Decode a QR payload from encoded image bytes. Two scales (a QR printed into
 * a large photo often decodes better downscaled; a small corner QR needs the
 * larger pass). Returns the first decoded payload, or null. sharp + jsqr are
 * both existing dependencies; sharp is dynamically imported so nothing
 * server-native leaks toward a client bundle (mirrors lib/perceptual-hash).
 */
async function decodeQrPayloadFromImage(
  bytes: Uint8Array,
): Promise<string | null> {
  const sharp = (await import('sharp')).default;
  const { default: jsQR } = await import('jsqr');
  for (const edge of [1600, 800]) {
    try {
      const { data, info } = await sharp(Buffer.from(bytes))
        .rotate() // bake EXIF orientation
        .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const code = jsQR(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        info.width,
        info.height,
        { inversionAttempts: 'attemptBoth' },
      );
      const payload = code?.data?.trim();
      if (payload) return payload;
    } catch {
      // undecodable at this scale → try the next / give up
    }
  }
  return null;
}

/**
 * Verdict for one decoded QR payload.
 *
 * 1. Direct hit: the payload string contains a guarded funnel path (works for
 *    scheme-less QR payloads like "setnayan.com/vendor-invite/x").
 * 2. Shortener hit: the payload is an http(s) URL → follow its redirect chain
 *    server-side (manual hops, SSRF-checked per hop, bounded) and flag when
 *    any hop lands on a guarded path.
 *
 * FAIL-OPEN on network trouble — the verdict is a best-effort integrity gate,
 * not a security boundary; the retro-scan + report path backstop it.
 */
export async function qrPayloadVerdict(
  payload: string,
): Promise<{ invalid: boolean; resolvedUrl: string | null }> {
  const p = payload.trim();
  if (!p) return { invalid: false, resolvedUrl: null };
  if (payloadHitsGuardedPath(p)) return { invalid: true, resolvedUrl: null };

  let current: URL;
  try {
    current = new URL(p);
  } catch {
    return { invalid: false, resolvedUrl: null }; // not a URL → not a funnel
  }
  if (current.protocol !== 'https:' && current.protocol !== 'http:') {
    return { invalid: false, resolvedUrl: null };
  }

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    // SSRF check per hop — never fetch a host that resolves privately.
    if (!(await hostResolvesPublic(current.hostname))) {
      return { invalid: false, resolvedUrl: null };
    }
    let res: Response;
    try {
      res = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(REDIRECT_HOP_TIMEOUT_MS),
        cache: 'no-store',
      });
      // Some shorteners refuse HEAD — retry the hop as GET (body ignored).
      if (res.status === 405 || res.status === 501) {
        res = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(REDIRECT_HOP_TIMEOUT_MS),
          cache: 'no-store',
        });
      }
    } catch {
      return { invalid: false, resolvedUrl: null }; // unreachable → fail-open
    }
    if (res.status < 300 || res.status >= 400) {
      return { invalid: false, resolvedUrl: null }; // chain ended, no funnel
    }
    const loc = res.headers.get('location');
    if (!loc) return { invalid: false, resolvedUrl: null };
    let next: URL;
    try {
      next = new URL(loc, current);
    } catch {
      return { invalid: false, resolvedUrl: null };
    }
    if (next.protocol !== 'https:' && next.protocol !== 'http:') {
      return { invalid: false, resolvedUrl: null };
    }
    if (
      VENDOR_QR_GUARDED_PATHS.some((g) => next.pathname.startsWith(g))
    ) {
      return { invalid: true, resolvedUrl: next.href };
    }
    current = next;
  }
  return { invalid: false, resolvedUrl: null };
}

/**
 * Fetch the authoritative bytes for a stored asset ref — r2:// refs via a
 * presigned GET (server-derived key, no SSRF surface); legacy external http(s)
 * refs via the SSRF-guarded fetch. Null on any failure → caller skips the ref.
 * (Same shape as lib/vendor-image-repost-watch's private fetcher.)
 */
async function fetchAssetBytes(ref: string): Promise<Uint8Array | null> {
  const parsed = parseStoredAsset(ref);
  if (!parsed) return null;
  try {
    if (parsed.kind === 'r2') {
      const url = await presignDisplayUrl(parsed.bucket, parsed.key, 300);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
    return await safeFetchImageBytes(parsed.url);
  } catch {
    return null;
  }
}

/** Scan a set of image refs; return every funnel-QR hit. Per-ref failures skip
 *  cleanly (best-effort). */
export async function scanImageRefsForVendorQr(
  refs: ReadonlyArray<string | null | undefined>,
): Promise<VendorQrHit[]> {
  const unique = Array.from(
    new Set(
      refs.filter(
        (r): r is string => typeof r === 'string' && r.trim().length > 0,
      ),
    ),
  );
  const hits: VendorQrHit[] = [];
  for (const ref of unique) {
    try {
      const bytes = await fetchAssetBytes(ref);
      if (!bytes) continue;
      const payload = await decodeQrPayloadFromImage(bytes);
      if (!payload) continue;
      const verdict = await qrPayloadVerdict(payload);
      if (verdict.invalid) {
        hits.push({ ref, payload, resolvedUrl: verdict.resolvedUrl });
      }
    } catch {
      // best-effort per ref
    }
  }
  return hits;
}

/**
 * Save-time gate for server actions: returns the FIRST funnel-QR hit among the
 * given image refs, or null when clean. Swallows + Sentry-captures any
 * unexpected throw and returns null (FAIL-OPEN — a scanner hiccup must never
 * block an honest vendor's save; the retro-scan is the backstop).
 */
export async function vendorQrGuardRejects(
  refs: ReadonlyArray<string | null | undefined>,
): Promise<VendorQrHit | null> {
  try {
    const hits = await scanImageRefsForVendorQr(refs);
    return hits[0] ?? null;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'vendor-qr-media-guard' },
      extra: { refCount: refs.length },
    });
    return null;
  }
}

/**
 * Admin retro-scan: sweep every real (non-demo) vendor's CURRENT website media
 * (portfolio + logo + microsite hero + service cover + showcase photos) and
 * upsert a vendor_qr_media_flags row per hit. Idempotent — the
 * (vendor_profile_id, r2_ref) unique key dedups re-runs. Flag-and-review only.
 * Showcase VIDEOS are skipped (no server-side frame extraction) — logged in
 * the summary so the admin sees the coverage boundary, not a silent gap.
 */
export async function scanAllVendorMediaForQr(): Promise<{
  vendorsScanned: number;
  refsScanned: number;
  flagsUpserted: number;
  videosSkipped: number;
}> {
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, portfolio_r2_keys, logo_url, microsite_hero_photo_key, is_demo',
    )
    .eq('is_demo', false);
  const profileRows = (profiles ?? []) as {
    vendor_profile_id: string;
    portfolio_r2_keys: string[] | null;
    logo_url: string | null;
    microsite_hero_photo_key: string | null;
    is_demo: boolean;
  }[];
  const realVendorIds = new Set(profileRows.map((p) => p.vendor_profile_id));

  const { data: services } = await admin
    .from('vendor_services')
    .select(
      'vendor_profile_id, primary_photo_r2_key, showcase_photo_r2_keys, showcase_video_r2_key',
    );
  const serviceRows = (services ?? []) as {
    vendor_profile_id: string;
    primary_photo_r2_key: string | null;
    showcase_photo_r2_keys: string[] | null;
    showcase_video_r2_key: string | null;
  }[];

  // Assemble (vendor, surface, ref) triples for every scannable IMAGE.
  const targets: { vendorProfileId: string; surface: VendorQrSurface; ref: string }[] = [];
  let videosSkipped = 0;
  for (const p of profileRows) {
    for (const ref of p.portfolio_r2_keys ?? []) {
      if (ref) targets.push({ vendorProfileId: p.vendor_profile_id, surface: 'portfolio', ref });
    }
    if (p.logo_url) {
      targets.push({ vendorProfileId: p.vendor_profile_id, surface: 'logo', ref: p.logo_url });
    }
    if (p.microsite_hero_photo_key) {
      targets.push({
        vendorProfileId: p.vendor_profile_id,
        surface: 'microsite_hero',
        ref: p.microsite_hero_photo_key,
      });
    }
  }
  for (const s of serviceRows) {
    if (!realVendorIds.has(s.vendor_profile_id)) continue; // demo vendors skip
    if (s.primary_photo_r2_key) {
      targets.push({
        vendorProfileId: s.vendor_profile_id,
        surface: 'service_primary',
        ref: s.primary_photo_r2_key,
      });
    }
    for (const ref of s.showcase_photo_r2_keys ?? []) {
      if (ref) {
        targets.push({
          vendorProfileId: s.vendor_profile_id,
          surface: 'service_showcase',
          ref,
        });
      }
    }
    if (s.showcase_video_r2_key) videosSkipped++;
  }

  let flagsUpserted = 0;
  let refsScanned = 0;
  for (const t of targets) {
    try {
      const bytes = await fetchAssetBytes(t.ref);
      if (!bytes) continue;
      refsScanned++;
      const payload = await decodeQrPayloadFromImage(bytes);
      if (!payload) continue;
      const verdict = await qrPayloadVerdict(payload);
      if (!verdict.invalid) continue;
      const { error } = await admin.from('vendor_qr_media_flags').upsert(
        {
          vendor_profile_id: t.vendorProfileId,
          r2_ref: t.ref,
          surface: t.surface,
          decoded_payload: payload.slice(0, 2048),
          resolved_url: verdict.resolvedUrl,
        },
        { onConflict: 'vendor_profile_id,r2_ref', ignoreDuplicates: true },
      );
      if (!error) flagsUpserted++;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'vendor-qr-media-guard' },
        extra: { phase: 'retro-scan', surface: t.surface },
      });
    }
  }

  return {
    vendorsScanned: realVendorIds.size,
    refsScanned,
    flagsUpserted,
    videosSkipped,
  };
}
