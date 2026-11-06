import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { effectiveSeoTier } from '@/lib/vendor-seo-tier';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { micrositeCan, micrositeFromRow, MICROSITE_COLUMNS } from '@/lib/vendor-microsite';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { ownWebAddress, shopReach } from '@/lib/shop-page-plan';
import { printMemberFrom, printReachLine, printSinceLine } from '@/lib/supplier-prints-shop';
import type { PrintImage, PrintMember, PrintShop } from '@/lib/supplier-prints-svg';
import type { PrintPieceId } from '@/lib/supplier-prints';

/**
 * 🖨 THE FACTS PRINTS BY PURPOSE AND SIZE ADDS (owner 2026-11-06, "Yes ship it") — read AT PRINT TIME for the
 * signed-in supplier's OWN shop (the route proved `vendor_profile_id` with `fetchOwnVendorProfile` first), each from
 * the field the approved prototype's content table names, by the SAME gate the public shop page uses:
 *
 *   logo     `vendor_profiles.logo_url` (public bucket only — `displayUrlForStoredAsset`)
 *   services `vendor_services.title`, active, in their order — NAMES ONLY (no price on any print)
 *   since    `in_business_since_year` → "In business since 2016"
 *   area     `shopReach` → a ring or nationwide; otherwise the city alone (never the screen's "opens once verified")
 *   photo    the Page hero where the page shows it (Pro+, `premiumPage`), else `portfolio_r2_keys[0]`
 *   about    `microsite_about` where the page shows it (`micrositeCan(...).canPersonalize`, flag-aware)
 *   domain   `custom_domains`, verified, where the plan shows it (`customWebsiteName`)
 *
 * 🔑 A REFUSED READ DROPS ITS BLOCK — it never prints a zero or an empty box; the print is still true, only shorter.
 * Pictures are fetched only for the pieces that carry them and embedded as `data:` URIs (a print shop's machine, and
 * an SVG shown in an <img>, load nothing from outside the file). Nothing is stored.
 */

type OwnRow = {
  vendor_profile_id: string;
  tagline?: string | null;
  logo_url?: string | null;
  portfolio_r2_keys?: string[] | null;
  location_city?: string | null;
  in_business_since_year?: number | null;
};

/** The pieces that carry a picture (the content table: logo on every piece but the door; the photo on the roll-up and backdrop). */
const LOGO_PIECES: readonly PrintPieceId[] = ['card', 'standee', 'table', 'tarp', 'rollup', 'backdrop'];
const PHOTO_PIECES: readonly PrintPieceId[] = ['rollup', 'backdrop'];

const imageCache = new Map<string, { at: number; img: PrintImage | null }>();
const IMAGE_TTL_MS = 10 * 60_000;

/** A stored picture as a `data:` URI — screen-sized for the sheet, print-sized for Save. Null when it cannot be read. */
async function storedImage(ref: string | null | undefined, kind: 'logo' | 'photo', mode: 'screen' | 'print'): Promise<PrintImage | null> {
  const value = ref?.trim();
  if (!value) return null;
  const key = `${kind}:${mode}:${value}`;
  const hit = imageCache.get(key);
  if (hit && Date.now() - hit.at < IMAGE_TTL_MS) return hit.img;
  let img: PrintImage | null = null;
  try {
    const url = await displayUrlForStoredAsset(value);
    if (url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const sharp = (await import('sharp')).default;
        const src = Buffer.from(await res.arrayBuffer());
        const width = kind === 'logo' ? (mode === 'print' ? 1200 : 400) : mode === 'print' ? 2400 : 900;
        const out =
          kind === 'logo'
            ? await sharp(src, { density: 300 }).resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
            : await sharp(src).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: mode === 'print' ? 90 : 72 }).toBuffer();
        const meta = await sharp(out).metadata();
        if (meta.width && meta.height) img = { href: `data:${kind === 'logo' ? 'image/png' : 'image/jpeg'};base64,${out.toString('base64')}`, w: meta.width, h: meta.height };
      }
    }
  } catch (err) {
    console.error('[supplier-prints] picture unavailable', { kind, err: String(err) });
  }
  if (imageCache.size > 64) imageCache.clear();
  imageCache.set(key, { at: Date.now(), img });
  return img;
}

export async function readPrintShopExtras(
  admin: SupabaseClient,
  own: OwnRow,
  opts: { piece: PrintPieceId; mode: 'screen' | 'print'; at?: Date },
): Promise<Pick<PrintShop, 'logo' | 'services' | 'since' | 'area' | 'photo' | 'about' | 'ownDomain'>> {
  const now = opts.at ?? new Date();
  const id = own.vendor_profile_id;
  const [plan, services] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select(`tier_state, tier_expires_at, verification_state, outer_radius_km, ${MICROSITE_COLUMNS}`)
      .eq('vendor_profile_id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) logQueryError('supplierPrints.plan', error, { vendorProfileId: id }, 'graceful_degrade');
        return (data as Record<string, unknown> | null) ?? null;
      }),
    admin
      .from('vendor_services')
      .select('title')
      .eq('vendor_profile_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) logQueryError('supplierPrints.services', error, { vendorProfileId: id }, 'graceful_degrade');
        return ((data ?? []) as Array<{ title: string | null }>).map((s) => s.title?.trim() ?? '').filter(Boolean);
      }),
  ]);

  const tier = plan ? effectiveSeoTier({ tier_state: (plan.tier_state as string | null) ?? null, tier_expires_at: (plan.tier_expires_at as string | null) ?? null }) : null;
  const caps = tierCaps(tier);
  const microsite = micrositeFromRow(plan);
  const verified = plan?.verification_state === 'verified';
  const reach = shopReach({ verified, tier, declaredOuterKm: (plan?.outer_radius_km as number | null) ?? null });

  let ownDomain: string | null = null;
  if (plan && caps.customWebsiteName && ['card', 'tarp', 'rollup', 'backdrop'].includes(opts.piece)) {
    const { data, error } = await admin
      .from('custom_domains')
      .select('domain, verified_at')
      .eq('owner_type', 'vendor')
      .eq('owner_id', id)
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) logQueryError('supplierPrints.customDomain', error, { vendorProfileId: id }, 'graceful_degrade');
    const d = data as { domain?: string | null; verified_at?: string | null } | null;
    ownDomain = ownWebAddress({ planAllows: true, domain: d?.domain, verifiedAt: d?.verified_at });
  }

  // The page's own gates: the hero is a Pro pick (`premiumPage`), the About a Solo+ pick (`canPersonalize`) — both
  // flag-aware through `vendorPaywallApplies`, so a print never carries what the shop's own page does not show.
  const heroShows = plan !== null && !vendorPaywallApplies(caps.premiumPage) && Boolean(microsite.heroPhotoKey);
  const aboutShows = plan !== null && !vendorPaywallApplies(micrositeCan(tier).canPersonalize);
  const photoRef = heroShows ? microsite.heroPhotoKey : (own.portfolio_r2_keys ?? []).find((k) => k?.trim()) ?? null;

  const [logo, photo] = await Promise.all([
    LOGO_PIECES.includes(opts.piece) ? storedImage(own.logo_url, 'logo', opts.mode) : Promise.resolve(null),
    PHOTO_PIECES.includes(opts.piece) ? storedImage(photoRef, 'photo', opts.mode) : Promise.resolve(null),
  ]);

  return {
    logo,
    services,
    since: printSinceLine(own.in_business_since_year ?? null, now.getFullYear()),
    area: printReachLine(reach, own.location_city ?? null),
    photo,
    about: aboutShows ? microsite.about : null,
    ownDomain,
  };
}

/**
 * The PERSONAL calling card's front (owner 2026-11-06, "Yes"): the signed-in member's account name
 * (`users.display_name`) and, ONLY when set, their Team label (`vendor_team_members.team_label`) — never the access
 * level (owner · admin · agent · viewer), never an invented title. Null when the account has no name: then there is
 * no card to print (the sheet does not offer it).
 */
export async function readPrintMember(admin: SupabaseClient, vendorProfileId: string, userId: string): Promise<PrintMember | null> {
  const [user, seat] = await Promise.all([
    admin
      .from('users')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) logQueryError('supplierPrints.member', error, { userId }, 'graceful_degrade');
        return (data as { display_name: string | null } | null) ?? null;
      }),
    admin
      .from('vendor_team_members')
      .select('team_label, deactivated_at')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) logQueryError('supplierPrints.memberSeat', error, { vendorProfileId, userId }, 'graceful_degrade');
        return (data as { team_label: string | null; deactivated_at: string | null } | null) ?? null;
      }),
  ]);
  return printMemberFrom(user?.display_name ?? null, seat && !seat.deactivated_at ? seat.team_label : null);
}
