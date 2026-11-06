import { shopInitials } from '@/lib/shop-initials';
import { shopBadges, type ShopBadgeFacts } from '@/lib/shop-badges';
import { cardRecordRatingFromTrusted } from '@/lib/service-card-record';
import { checkADateUrl } from '@/lib/check-a-date';
import { buildVendorInviteUrl } from '@/lib/vendor-couple-invite';
import { myPagePath, myPageUrl } from '@/lib/supplier-qr-codes';
import { shopReachLine, type ShopReach } from '@/lib/shop-page-plan';
import { yearsInBusiness } from '@/lib/vendor-experience';
import type { PrintMember, PrintQr, PrintShop } from '@/lib/supplier-prints-svg';
import type { PrintQrMode } from '@/lib/supplier-prints';

/**
 * 🖨 THE FACTS A PRINT CARRIES — every one READ, never typed (prototype "Your facts": "These come from your shop — change
 * them there and every print follows. Nothing on a print is typed or moved here").
 *
 *   name     — `business_name`
 *   line     — the shop's own services, in their kind words ("Photo & video · Sound · Lights"), at most three; the
 *              tagline when the shop lists no service; nothing when it has neither (never a filler)
 *   ini      — `shopInitials(name)` (the shop's logo goes in the circle in a later part)
 *   handle   — `setnayan.com/v/<slug>` (the card back)
 *   seal · rating · badges — `shopBadges(facts)` from facts read AT PRINT TIME (`readShopBadgeFacts`, the badge
 *              print's own read): a badge un-earned since is not printed; one earned since is
 *
 * And the QR: the address of the code the supplier picked, built by the SAME helpers the Promote codes use —
 * Check a date `checkADateUrl` · Shortlist `buildVendorInviteUrl` (any event, all services) · My page `myPageUrl` ·
 * Reviews `myPageUrl` + `/review` — the WRITE door (owner 2026-11-06, "Write a review"): it sends a couple with a
 * booking ready for a review to that booking's "Leave a review", and everyone else to the page's `#reviews`
 * (`lib/shop-review-door.ts`, route `app/v/[slug]/review/route.ts`).
 *
 * Pure. 🔒 lib/supplier-prints.test.ts
 */

export function printLine(services: readonly string[], tagline: string | null | undefined, kindLabel: (k: string) => string): string {
  const words = [...new Set(services.map((s) => kindLabel(s).trim()).filter(Boolean))].slice(0, 3);
  if (words.length) return words.join(' · ');
  return tagline?.trim() ?? '';
}

/** `setnayan.com/v/<slug>` — the site's host without `www.` and the scheme. */
export function printHandle(origin: string, slug: string): string {
  const host = origin.replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^www\./, '');
  return `${host}${myPagePath(slug)}`;
}

export function printShopFrom(o: {
  name: string;
  slug: string;
  services: readonly string[];
  tagline: string | null;
  facts: ShopBadgeFacts;
  kindLabel: (k: string) => string;
  origin: string;
}): PrintShop {
  const name = o.name.trim() || 'Your shop';
  return {
    name,
    line: printLine(o.services, o.tagline, o.kindLabel),
    tagline: o.tagline?.trim() || null,
    ini: shopInitials(name),
    handle: printHandle(o.origin, o.slug),
    verified: o.facts.verified,
    rating: cardRecordRatingFromTrusted(o.facts.trusted),
    badges: shopBadges(o.facts),
  };
}

/**
 * The print's reach line (prototype "No data source" note, ruled with PRINTS BY PURPOSE AND SIZE): a print carries only
 * a CLAIM it can keep — a ring ("Serves up to 100 km around Tagaytay") or nationwide — from the page's own
 * `shopReachLine`; otherwise the city alone. Never the screen's sentence "· distance search opens once verified".
 */
export function printReachLine(reach: ShopReach, city: string | null | undefined): string | null {
  if (reach.kind === 'ring' || reach.kind === 'nationwide') return shopReachLine(reach, city);
  return city?.trim() || null;
}

/** "In business since 2016" — only a year the shop's page would count (`yearsInBusiness`: a real, past year). */
export function printSinceLine(year: number | null | undefined, nowYear: number): string | null {
  return yearsInBusiness(year, nowYear) === null ? null : `In business since ${year}`;
}

/**
 * The PERSONAL card's front from the two reads (owner 2026-11-06, "Yes"): the account name, and the Team label ONLY
 * when it is set — never the access level, never an invented title. No name (or an email standing in for one) = no card.
 */
export function printMemberFrom(displayName: string | null | undefined, teamLabel: string | null | undefined): PrintMember | null {
  const name = displayName?.replace(/\s+/g, ' ').trim();
  if (!name || name.includes('@')) return null;
  const role = teamLabel?.replace(/\s+/g, ' ').trim();
  return { name, role: role || null };
}

/** The address the printed code opens — the shop's real one, from the helpers its Promote codes already use. */
export function printQrUrl(mode: PrintQrMode, origin: string, slug: string): string {
  if (mode === 'shortlist') return buildVendorInviteUrl(slug, { eventType: null, category: null });
  if (mode === 'page') return myPageUrl(origin, slug);
  if (mode === 'reviews') return `${myPageUrl(origin, slug)}/review`;
  return checkADateUrl(origin, slug);
}

export function printQr(mode: PrintQrMode, origin: string, slug: string): PrintQr {
  return { mode, url: printQrUrl(mode, origin, slug) };
}
