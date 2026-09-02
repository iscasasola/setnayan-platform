/**
 * add-ons-catalog.ts — canonical list of Setnayan in-app service add-ons.
 *
 * Single source of truth extracted 2026-06-03 so the add-ons launcher grid
 * (/dashboard/[eventId]/studio) and the Services tab vendor page
 * (/dashboard/[eventId]/vendors) can both import it without duplication.
 *
 * Each entry's `poster` field drives the cinema-style animated poster card in
 * the add-ons page (service-poster.tsx). The same data powers the compact grid
 * section inside the Services tab.
 *
 * When a new iteration ships, add one entry here. Never add a parallel list
 * in a page file.
 */

import {
  Receipt,
  Globe2,
  Music,
  Type,
  Camera,
  Tv,
  Video,
  Gem,
  Sparkles,
  Film,
  Printer,
  ImageDown,
  QrCode,
  MapPin,
  Palette,
  LayoutGrid,
  MailCheck,
  PartyPopper,
  Newspaper,
  type LucideIcon,
} from 'lucide-react';
import type { PosterStyle } from '@/app/dashboard/[eventId]/studio/_components/service-poster';
import type { PlanGroupId } from '@/lib/wedding-plan-groups';
import type { ProfileSurface } from '@/lib/event-type-profile';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';

export type AddOnStatus = 'live' | 'web_v1' | 'coming_soon';

/**
 * Where this in-app service nests on the couple-side Vendors/Services tab
 * (Digital_Services_Cross_Surface_Map_2026-06-03.md §2 — "the Services tab
 * surfaces the services inside their canonical category, each with the ✦
 * Setnayan badge"). Resolves the 2026-06-03 lock that retired the standalone
 * launcher grid in favour of in-category placement:
 *   • a PlanGroupId → nests as a ✦ Setnayan supplementary card at the TOP of
 *     that category's rail (float-to-top), alongside the couple's vendor picks.
 *     Supplementary + non-saturating — never a "pick", no Lock/Remove.
 *   • 'digital_services' → grouped under the synthetic Design › Digital
 *     Services rail (Pakanta / Animated Monogram / Pro Website home).
 *   • 'tool' → a couple tool, not a category service (Orders / Playlist / QR /
 *     Blueprint / …). Stays out of the category pile; renders in the compact
 *     "Tools & extras" strip instead.
 */
export type InAppServiceCategory = PlanGroupId | 'digital_services' | 'tool';

/**
 * Which Studio section this add-on falls under on the couple-side Studio hub
 * (/dashboard/[eventId]/studio). Independent of `category` (which drives the
 * Services/vendors-tab placement). The 4 sections ARE Studio's docked sub-nav
 * (owner-locked 2026-06-17 customer-menu redesign — Studio absorbed Design):
 *   • setnayan_ai → plan the event: the AI planner · playlist, and (refiled
 *                   2026-08-14, sign-off #1) the planning/layout tools —
 *                   Mood Board · Seat Plan · Indoor Blueprint
 *   • website     → the public site. ONE doorway — Your Website — plus the two
 *                   parts that own their own job: Save the Date · RSVP.
 *                   Event + Editorial are chips ON the Your Website card
 *                   (2026-08-14); their entries live on under `utility`.
 *   • capture     → make a record of the day (Papic / Panood / Photo / TikTok)
 *   • branding    → the couple's identity, now honestly pure: monogram ·
 *                   custom QR · Pakanta
 *   • utility     → NOT a Studio section card; hidden from BOTH hubs while the
 *                   entry, its href and its deep links stay alive. This is how
 *                   a card is retired without stranding links (Orders ·
 *                   photo-delivery 2026-07-22 · event + editorial 2026-08-14).
 */
export type StudioGroup =
  | 'setnayan_ai'
  | 'website'
  | 'capture'
  | 'branding'
  | 'utility';

export type AddOnEntry = {
  key: string;
  label: string;
  Icon: LucideIcon;
  iteration: string;
  status: AddOnStatus;
  /** Couple-side category placement — see InAppServiceCategory. */
  category: InAppServiceCategory;
  blurb: string;
  /**
   * Short browse/filter tags (e.g. 'Photos', 'Website', 'Day-of', 'Free') shown
   * as chips on the Suite card/row and indexed by the Suite search box. Keep
   * them 1–2 words, Title Case. Optional — untagged services still render + are
   * searchable by label + blurb.
   */
  tags?: readonly string[];
  cta: string;
  poster: PosterStyle;
  /**
   * Job-to-be-done grouping for the Studio hub (/dashboard/[eventId]/studio).
   * Additive — the Services tab ignores this field. See StudioGroup.
   */
  studioGroup: StudioGroup;
  /**
   * Marks a genuinely-free add-on so the Studio card can show a "Free" chip.
   * Left unset on paid items — never a price source. Pricing is admin-managed;
   * the feature's own page shows the real price + handles purchase.
   */
  tier?: 'free';
  /**
   * For a PAID add-on that offers a no-card free taste (e.g. Papic's first 5
   * guest cameras free), a short chip label surfaced on the Studio card so
   * couples can discover the trial from the grid. Never a price source — the
   * feature page still owns the real price + purchase.
   */
  freeTrial?: string;
  /**
   * DB service_key for ownership checks on the Studio hub. Absent on free tools
   * and services with variable/multi-SKU pricing — those skip the hub-level
   * ownership badge; their detail pages handle state.
   */
  serviceKey?: string;
  /**
   * When true, the Studio card opens this service's OWN surface directly and
   * skips the /studio/about/<key> learn-more interstitial — for free, frequently-
   * revisited tools (the seat plan, the website parts) and services whose own
   * surface already IS their App Store detail (Panood). Declared here so the
   * open/learn-more decision is DATA, not a hardcoded if/else in
   * appStoreDetailHref(). A non-opensDirect, non-coming_soon service MUST have an
   * add-ons-detail.ts entry (lint-guarded) so its /about page can't 404.
   */
  opensDirect?: boolean;
  /**
   * When true, this service prices per-unit / multi-SKU (e.g. Papic's per-camera
   * Roll/Unlimited rates) so its /about page must NOT render a single flat SKU
   * price — the feature's own surface fetches the live per-unit rates and owns
   * the buy. The "Free to try" chip (freeTrial) still carries the entry signal.
   */
  variablePricing?: boolean;
  /**
   * Event-type SURFACE this add-on belongs to (0053 · 2026-06-28). When set, the
   * add-on shows in the Studio hub ONLY for event types whose profile enables
   * that surface — so a birthday (no 'website'/'save_the_date'/'rsvp'/'monogram'
   * surface) never sees the Save-the-Date, RSVP, website parts, or Animated
   * Monogram. Unset → a universal in-app service, shown for every type. Wedding
   * enables ALL surfaces, so nothing is filtered there (byte-identical).
   */
  surface?: ProfileSurface;
  /*
    ─── THIS SERVICE CAN ONLY HAPPEN DURING THE EVENT ───────────────────────

    Owner, 2026-08-21, asked what should happen to Live Studio, Papic cameras
    and Custom QR once the celebration is over: **"stop offering them."** The
    card still shows what it was; the buy path closes.

    Set it on the services that are the day itself. Leave it UNSET on the ones
    that only START after — the editorial maker, the thank-you film, photo
    preservation, the song, the monogram, handing the gallery to Drive.

    🔑 A NEW FIELD, NOT A NEW `AddOnStatus`. `status` says whether the PRODUCT
    exists (`live` / `coming_soon` / …); a fourth member would force an edit at
    every `status === 'coming_soon'` site and would be a lie about the product.

    🔑 AND NOT `tags`. Those are the browse chips the Suite search box indexes
    (see their docblock above), and they have ALREADY drifted from any such
    meaning: `custom-qr-guest` carries no 'Day-of' tag while the free `event`
    and `indoor-blueprint` both do. A gate that reads a filter chip is a gate
    somebody re-labels by accident.

    ⚠ IT IS READ BY `addOnSellableNow`, NEVER BY `addOnOfferedForEvent`. The
    latter's result is the sole parent of the couple's OWNED list, so a phase
    test there would delete a service they PAID FOR from their own shelf the
    morning after. See lib/add-on-event-scope.ts.
  */
  dayOfOnly?: true;
};

/**
 * Resolve the href for a given add-on key + event ID.
 *
 * A few keys don't live under /studio/<key>:
 *   • orders            → /orders (the order history surface).
 *   • animated-monogram → /monogram, the couple's Monogram MAKER (the free
 *     design hub — lettered lockups · Cipher Studio · Setnayan-AI Bespoke ·
 *     upload). The Studio card's label/CTA promise "design your monogram", so
 *     it must open the maker, not the paid Animated-Monogram buy page. The
 *     maker itself funnels to that paid upgrade (its "See the Animated
 *     Monogram" CTAs → /studio/animated-monogram), so the SKU page stays
 *     reachable as the upsell. (Fix 2026-06-18 — the maker was unreachable
 *     from Studio; only the buy wall showed.)
 */
export function addOnHref(key: string, eventId: string): string {
  if (key === 'orders') return `/dashboard/${eventId}/orders`;
  // Papic Pool (the flat event-level shared guest-camera pass, SKU PAPIC_GUEST)
  // has no surface of its own — it is a rung on the SAME Papic set-up page the
  // per-camera ladder is bought from. Pre-wired here so the day its status
  // flips to 'live' the card opens a real surface instead of 404ing on a
  // /studio/papic-guest route that does not exist.
  if (key === 'papic-guest') return `/dashboard/${eventId}/studio/papic`;
  if (key === 'animated-monogram') return `/dashboard/${eventId}/monogram`;
  // Features that don't own a Studio surface of their own open their real home
  // rather than a "coming soon" stub — so every Studio button lands somewhere
  // usable. `music-creator` is RETIRED (2026-07-22 · folded into Pakanta) — its
  // card is gone, but the alias stays as the "301 to Pakanta" so any lingering
  // deep link still resolves.
  //
  // ⭐ landing-page → THE EVENT HUB CONTROLLER, not the old `/website` hub
  // (owner ruling 2026-09-02, verbatim: *"i look at the roles of each. if it is
  // the same then adjust. Like in papic. when they enter an event, the menu of
  // papic description page becomes the control center of papic. i think that
  // should be the same for events hub."*). The roles were measured and they are
  // the same: this card is labelled "Event Hub" and promises "one link for your
  // whole event — the run-up page, the day itself, and the story after", which
  // is the controller's four channels stated as prose. `/website` kept its
  // route and now redirects here, so every old bookmark still resolves.
  //
  // The shape copied is `papic` — ONE page that is the shop window before the
  // couple owns it and the control centre after — not a second mechanism.
  if (key === 'landing-page') return `/dashboard/${eventId}/launch`;
  if (key === 'music-creator') return `/dashboard/${eventId}/studio/pakanta`;
  // Live Studio — the internal data key stays `live-studio-roam` (reviews/stats/
  // detail/recommendations key off it, unchanged by the route rename), but the
  // customer-facing ROUTE moved to /studio/live-studio-control (owner 2026-07-25 —
  // one unified controller, not Cast-vs-Roam). The old path 301s to the new one in
  // next.config, so a stale deep link still resolves.
  if (key === 'live-studio-roam') return `/dashboard/${eventId}/studio/live-studio-control`;
  // Seat plan opens the 3D lab by default; `NEXT_PUBLIC_SEATING_3D='false'`
  // is the kill-switch that falls back to the 2D editor (kept in lockstep with
  // the lab route's own gate). NEXT_PUBLIC_* vars are inlined server-side, and
  // the Studio hub is a server component. Both doorways keep their targets — the
  // 2026-07-15 scroll-less rebuild put the [2D · 3D · List] segment on BOTH the
  // 2D editor's command bar and the lab chrome, so the siblings cross-link and
  // neither projection is orphaned (verdict §4).
  if (key === 'seating') {
    return process.env.NEXT_PUBLIC_SEATING_3D === 'false'
      ? `/dashboard/${eventId}/seating`
      : `/dashboard/${eventId}/seating/lab`;
  }
  // The three website "parts" (RSVP · Event · Editorial) open the full-screen
  // editor jumped straight to that phase. Unified Website Editor (2026-07-25):
  // all three now open the ONE editor, whose preview carries the phase tabs —
  // so "edit the RSVP page" and "edit the After page" land in the same place the
  // couple edits everything else. Save the Date keeps its own builder
  // (/studio/save-the-date via the default below).
  if (key === 'rsvp' || key === 'event' || key === 'editorial') {
    return `/dashboard/${eventId}/website/editor`;
  }
  return `/dashboard/${eventId}/studio/${key}`;
}

/**
 * Where the Studio hub's App Store row points — the feature's detail/info page.
 *
 * Default → the catalog-driven App Store detail at /studio/about/<key>
 * (content lives in add-ons-detail.ts). The literal `about` segment is
 * deliberate: a feature like Papic has its own static /studio/papic folder,
 * and in Next.js a literal segment shadows the `[addon]` dynamic sibling
 * without backtracking — so /studio/papic/about would 404. Routing the detail
 * page under /studio/about/<key> keeps it clear of every feature folder.
 *
 * Two exceptions link straight to their own surface instead of an /about page:
 *   • panood — its /studio/panood IS already a bespoke App Store detail (the
 *     2026-05-17 pilot).
 *   • supplies-marketplace — has no add-ons-detail.ts entry, so an /about link
 *     would notFound(); its /studio/supplies-marketplace surface is the real
 *     destination.
 */
export function appStoreDetailHref(key: string, eventId: string): string {
  // landing-page: the special case that sent this key to /website/editor was
  // REMOVED 2026-08-14, and no special case replaced it. `opensDirect` routes
  // the key through addOnHref, which since 2026-09-02 lands on the Event Hub
  // CONTROLLER (`/launch`). The card's two deep-link chips were RETIRED in the
  // same change: the controller's own "set once" strip already carries both of
  // their destinations by name — "The page itself" → /website/editor and "The
  // story" → /website/editorial — so a chip beside the card would be a second
  // control for a door already visible one tap in, which is the distinction a
  // couple can see is fake that the 2026-08-14 verdict existed to remove.
  // Everything else is data-driven by the `opensDirect` catalog flag — no
  // per-feature hardcoding. opensDirect → open the service's own surface
  // (addOnHref); otherwise → the shared /studio/about/<key> learn-more page.
  const entry = ADD_ONS.find((a) => a.key === key);
  if (entry?.opensDirect) return addOnHref(key, eventId);
  return `/dashboard/${eventId}/studio/about/${key}`;
}

const BASE_ADD_ONS: ReadonlyArray<AddOnEntry> = [
  {
    key: 'setnayan-ai',
    tags: ['Setnayan AI', 'Planning', 'Vendors', 'Popular'],
    label: 'Setnayan AI',
    Icon: Gem,
    iteration: '0016',
    status: 'live',
    category: 'tool',
    blurb: 'Your whole planning office — it matches vendors to your budget and date, reminds you what’s next, and guards every deadline.',
    cta: 'Open your planner',
    studioGroup: 'setnayan_ai',
    serviceKey: 'SETNAYAN_AI',
    poster: {
      // Atelier-Glass retirement (Glass PR-4, 2026-07-15): the old purple
      // gradient + purple chip were a retired-mulberry island (owner screenshot
      // flag). Re-expressed to the kit — obsidian base with a warm gold cast, so
      // the AI hero reads as the premium tile idiom, not violet.
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #17160F 0%, #3A2E1A 55%, #6B5324 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #E8D3A0 0%, transparent 55%)',
      iconBadgeClass: 'bg-cream/20 text-cream',
    },
  },
  {
    key: 'orders',
    tags: ['Account', 'Payments'],
    label: 'Orders',
    Icon: Receipt,
    iteration: '0034',
    status: 'live',
    category: 'tool',
    blurb: 'Your in-app purchases, reference codes, and payment status — all in one place.',
    cta: 'View orders',
    studioGroup: 'utility',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(ellipse at 30% 70%, #F4D9B0 0%, #C97B4B 70%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FFEED0 0%, transparent 60%)',
      iconBadgeClass: 'bg-warn-50/30 text-warn-50',
    },
  },
  {
    key: 'save-the-date',
    // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
    dayOfOnly: true,
    tags: ['Invitation', 'Website', 'Before', 'Free'],
    surface: 'save_the_date',
    label: 'Save the Date',
    Icon: Sparkles,
    iteration: '0024',
    status: 'live',
    category: 'photography',
    blurb: 'A save-the-date film that plays itself, in your colors — free; add the cinematic reveal with Event Hub PRO.',
    cta: 'Choose your reveal',
    studioGroup: 'website',
    // The content film is FREE; the cinematic openings are a paid in-surface
    // upgrade (STD_PREMIUM_OPENINGS), so the card itself reads "Free" not "Get".
    tier: 'free',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #2B1810 0%, #4A2E1C 50%, #6B3E25 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(255, 220, 160, 0.7) 50%, transparent 100%)',
      iconBadgeClass: 'bg-warn-100/20 text-warn-100',
    },
  },
  // The other "parts" of the couple's website (the 4-path lifecycle ·
  // lib/invitation-widgets.ts).
  //
  // ⚠ THE PART-CARDS ARE NO LONGER FIVE DOORWAYS. Council verdict
  // `Event_Studio_Replot_Council_Verdict_2026-07-17.md` §2 defect 1, owner
  // sign-off #2 2026-08-14 ("yes. same as the menu on admin and shop"):
  // `landing-page` + save-the-date/rsvp/event/editorial were FIVE hub doorways
  // for ONE product. Resolution, verbatim from the verdict: one free "Your
  // Website" card with exactly TWO always-visible deep-link chips (Event page ·
  // Editorial); **Save the Date and RSVP keep standalone rows** because each
  // owns its own SKU / its own guest-tool job — chipping them would be a
  // miniaturized re-dupe of the very defect. So `rsvp` and `save-the-date`
  // stay `studioGroup: 'website'` below; `event` and `editorial` do not.
  {
    key: 'rsvp',
    tags: ['Website', 'Invitation', 'Guests', 'Free'],
    surface: 'rsvp',
    opensDirect: true,
    label: 'RSVP',
    Icon: MailCheck,
    iteration: '0002',
    status: 'live',
    category: 'tool',
    blurb: 'The run-up page — your invitation, the RSVP form, and every detail your guests need.',
    cta: 'Edit your RSVP page',
    studioGroup: 'website',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #3A1E2E 0%, #6E3A55 50%, #A8617F 100%)',
      motionBackground:
        'radial-gradient(circle at 55% 45%, #FFD4E4 0%, transparent 55%)',
      iconBadgeClass: 'bg-pink-100/15 text-pink-100',
    },
  },
  {
    key: 'event',
    // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
    dayOfOnly: true,
    tags: ['Website', 'Guests', 'Day-of', 'Free'],
    surface: 'website',
    opensDirect: true,
    label: 'Event',
    Icon: PartyPopper,
    iteration: '0031',
    status: 'live',
    category: 'tool',
    blurb: 'The live day-of page your guests open at the venue — schedule, seats, and what’s happening now.',
    cta: 'Edit your event-day page',
    // STANDALONE CARD RETIRED 2026-08-14 (verdict §2 defect 1 · owner sign-off
    // #2) — it is now the "Event page" chip on the Your Website card. Retired
    // the SAME way photo-delivery was on 2026-07-22: `studioGroup: 'utility'`
    // drops it from both hubs' section grids while the ENTRY, its key, its
    // href and its /studio/event redirect all stay alive — so no deep link,
    // recommendation target or strip config is left holding a raw slug.
    // Deleting the entry instead is what leaves raw slugs on the ~33 surfaces
    // that read this catalog.
    studioGroup: 'utility',
    tier: 'free',
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #2E2410 0%, #6E5320 50%, #B8902E 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FFE9B0 0%, transparent 55%)',
      iconBadgeClass: 'bg-warn-100/20 text-warn-100',
    },
  },
  {
    key: 'editorial',
    tags: ['Website', 'Keepsake', 'After', 'Free'],
    surface: 'website',
    opensDirect: true,
    label: 'Editorial',
    Icon: Newspaper,
    iteration: '0038',
    status: 'live',
    category: 'tool',
    blurb: 'After the day — your event told as a story, with the gallery and a thank-you note.',
    cta: 'Edit your editorial',
    // STANDALONE CARD RETIRED 2026-08-14 — now the "Editorial" chip on the Your
    // Website card. Same `utility` mechanism as `event` above; the entry and
    // every link to it stay live.
    studioGroup: 'utility',
    tier: 'free',
    poster: {
      motion: 'scan',
      baseBackground:
        'radial-gradient(circle at 40% 40%, #2A2A2E 0%, #121214 80%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(245, 240, 232, 0.55) 50%, transparent 100%)',
      iconBadgeClass: 'bg-cream/20 text-cream',
    },
  },
  // Editorial PRO standalone card RETIRED 2026-07-22 (owner: bundle-only). It is
  // now conferred ONLY by Website PRO (COUPLE_WEBSITE_PRO alias · EDITORIAL_PRO
  // catalog row is is_active=false), so it no longer has its own doorway. The
  // /studio/editorial-pro buy surface stays but upsells Website PRO for
  // non-owners (never posts the retired EDITORIAL_PRO SKU).
  {
    // Event Hub PRO — the UMBRELLA unlock, and (2026-07-22) the ONLY way to get
    // the Save-the-Date Cinematic Reveal. serviceKey COUPLE_WEBSITE_PRO.
    // opensDirect → its own /studio/website-pro buy surface.
    //
    // 🛑 CORRECTED 2026-08-29. This comment and the blurb below both listed
    // "RSVP + on-the-day + Editorial PRO" as inclusions. RSVP and on-the-day
    // are gated on NOTHING — every couple has them — and Editorial PRO went
    // FREE FOR EVERYONE on 2026-08-23 (FREE_FOR_ALL_SKUS), so it can no longer
    // be sold as part of this. The full working is in the buy surface's own
    // docblock; the rule is that a blurb may name only what a non-buyer is
    // actually refused.
    key: 'website-pro',
    tags: ['Website', 'Upgrade', 'Popular'],
    surface: 'website',
    opensDirect: true,
    label: 'Event Hub PRO',
    Icon: Globe2,
    iteration: '0002',
    status: 'live',
    category: 'digital_services',
    blurb: 'One upgrade for your whole Event Hub — the cinematic reveal, music and video, your own gallery and colours, and no watermark.',
    cta: 'Unlock Event Hub PRO',
    studioGroup: 'website',
    serviceKey: 'COUPLE_WEBSITE_PRO',
    poster: {
      motion: 'pulse',
      baseBackground:
        'radial-gradient(circle at 40% 40%, #1E3A4F 0%, #0F1F2D 80%)',
      motionBackground:
        'radial-gradient(circle at 60% 60%, #A9834B 0%, transparent 55%)',
      iconBadgeClass: 'bg-sky-100/15 text-sky-100',
    },
  },
  {
    key: 'landing-page',
    tags: ['Website', 'Free'],
    surface: 'website',
    opensDirect: true,
    // THE ONE WEBSITE DOORWAY (2026-08-14 · verdict §2 defect 1, owner
    // sign-off #2). Was "Whole website" sitting beside four part-cards that
    // were the same product.
    //
    // ⭐ AND SINCE 2026-09-02 IT IS THE SAME DOOR AS THE EVENT-MENU SLOT (owner
    // ruling: "if it is the same then adjust"). addOnHref('landing-page') now
    // resolves to `/launch` — the Event Hub controller — which the event menu's
    // "Event Hub" row also opens. The card and the menu slot are two entrances
    // to one page, which is what `papic` has always done. The old `/website`
    // ⚠ WRITE THAT PATH FAMILY AS `/website/<child>`, NEVER WITH A STAR.
    // `seat-rooms-need-seating.test.ts` strips comments from THIS FILE with
    // `/\/\*[\s\S]*?\*\//g`, so a star-slash inside prose opens a block comment
    // that swallows the rest of the file — the `custom-qr-guest` entry vanished
    // and that guard failed with "entry not found — renamed?", pointing at a
    // key nothing had touched. Cost one CI round trip on 2026-09-02.
    //
    // hub is a redirect stub to the same place; every `/website/<child>` (the
    // editor, Our Story, the invitation, privacy, Editorial and the rest) keeps
    // its route and is reached from the controller's own "set once" strip.
    label: 'Event Hub',
    Icon: Globe2,
    iteration: '0002',
    status: 'web_v1',
    category: 'tool',
    blurb: 'One link for your whole event — the run-up page, the day itself, and the story after.',
    cta: 'Open your Event Hub',
    studioGroup: 'website',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(circle at 40% 40%, #1E3A4F 0%, #0F1F2D 80%)',
      motionBackground:
        'radial-gradient(circle at 60% 60%, #5BA3C7 0%, transparent 55%)',
      iconBadgeClass: 'bg-sky-100/15 text-sky-100',
    },
  },
  // Music Creator — RETIRED 2026-07-22 (owner: fold into Pakanta ₱2,500). It
  // never had a browse surface of its own (its card already routed to Pakanta),
  // and the ~400-track songs.ts catalogue is unused. The card is removed here;
  // any lingering `music-creator` link still resolves to Pakanta via addOnHref
  // (the "301 to Pakanta"), so no doorway 404s.
  {
    key: 'playlist',
    tags: ['Music', 'Planning', 'Free'],
    label: 'Playlist',
    Icon: Music,
    iteration: '0016',
    status: 'web_v1',
    category: 'tool',
    blurb: 'The right song for every moment — built for you, and handed straight to your DJ.',
    cta: 'Build your lineup',
    studioGroup: 'setnayan_ai',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(ellipse at 50% 50%, #4A2E1C 0%, #1A1A1A 80%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #F4D9B0 0%, transparent 55%)',
      iconBadgeClass: 'bg-warn-100/20 text-warn-100',
    },
  },
  {
    // Pakanta — a custom song written for the couple. The song is composed
    // from the onboarding love story (lib/pakanta-brief.ts); the page only
    // collects the music top-up. Couple surface: /studio/pakanta.
    key: 'pakanta',
    // S1 (owner 2026-09-01): hidden on date · hangout · travel · simple_event —
    // migration 20271188752170. Rides `addOnOfferedForEvent`, the same gate the
    // Studio sidebar's Pakanta row now uses (lib/studio-rail.ts).
    surface: 'song',
    tags: ['Music', 'Keepsake'],
    label: 'Pakanta',
    Icon: Music,
    iteration: '0036',
    status: 'live',
    category: 'digital_services',
    blurb: 'An original song written from your love story — yours to keep, and it scores your videos.',
    cta: 'Create your song',
    studioGroup: 'branding',
    serviceKey: 'PAKANTA',
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #2A0E2E 0%, #5C1F4A 50%, #A03F6B 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FFC8E6 0%, transparent 50%)',
      iconBadgeClass: 'bg-pink-100/15 text-pink-100',
    },
  },
  {
    key: 'animated-monogram',
    tags: ['Branding', 'Monogram', 'Free'],
    surface: 'monogram',
    label: 'Monogram Maker',
    Icon: Type,
    iteration: '0004',
    status: 'web_v1',
    category: 'digital_services',
    blurb: 'Your monogram, drawn to life on your QR, page, and signage. PRO adds the animation.',
    cta: 'Open the maker',
    studioGroup: 'branding',
    // The maker itself is free (the lettered / cipher / upload monogram is
    // never gated) → "Free" chip. serviceKey keeps the Animated-Monogram SKU
    // ownership badge, so the chip flips to "Active" once the paid draw-on
    // animation is owned (chip priority: Active > Pending > Free). The LED
    // Live Background it used to confer (2026-07-22 → 2026-08-11) is removed:
    // that half of the ₱1,000 could never be delivered. Monogram PRO now buys
    // the animation and nothing it cannot produce.
    tier: 'free',
    serviceKey: 'ANIMATED_MONOGRAM',
    poster: {
      motion: 'pulse',
      baseBackground:
        'linear-gradient(135deg, #1A1A1A 0%, #2B2B2B 50%, #3F3F3F 100%)',
      motionBackground:
        'radial-gradient(ellipse at 50% 40%, #FAF6F0 0%, transparent 55%)',
      iconBadgeClass: 'bg-cream/20 text-cream',
    },
  },
  {
    key: 'custom-qr-guest',
    // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
    dayOfOnly: true,
    // 🪑 THE PURCHASE HALF OF THE SEAT-ROOM GATE (owner 2026-08-28). This SKU
    // prints a branded QR per guest that opens their SEAT PASS. On a kind with
    // no 'seating' surface that pass now 404s, so offering the ₱1,499 card
    // there would sell something the buyer's guests cannot open — which is the
    // defect app/[slug]/seat/page.tsx records having already been fixed once.
    // Every kind that keeps 'seating' (14 of 17, incl. every wedding) is
    // byte-identical.
    surface: 'seating',
    tags: ['Invitation', 'Guests', 'Branding'],
    label: 'Custom QR per guest',
    Icon: QrCode,
    iteration: '0002',
    status: 'web_v1',
    category: 'tool',
    blurb: 'A branded QR for every guest — your monogram and colors, print-ready on each invite.',
    cta: 'Brand my QRs',
    studioGroup: 'branding',
    serviceKey: 'CUSTOM_QR_GUEST',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #2B1810 0%, #5A2818 55%, #C97B4B 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #FAF6F0 0%, transparent 50%)',
      iconBadgeClass: 'bg-cream/20 text-cream',
    },
  },
  {
    key: 'papic',
    // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
    dayOfOnly: true,
    tags: ['Photos', 'Video', 'Capture', 'Day-of', 'Popular'],
    label: 'Papic',
    Icon: Camera,
    iteration: '0012',
    status: 'web_v1',
    category: 'photography',
    blurb: 'Your guests become the photographers — every candid and clip in your gallery by morning.',
    cta: 'Set up',
    studioGroup: 'capture',
    freeTrial: 'Free to start',
    // NO serviceKey, deliberately (2026-07-30). It used to be 'PAPIC_SEATS' —
    // the ₱2,999 five-seat pass, `is_active = false` in prod and retired by the
    // two-type lock (owner 2026-07-29), with zero orders ever placed against it.
    // A dead key here was not cosmetic: `isRecommendable()` on the Studio hub
    // requires only `Boolean(entry.serviceKey)`, so a coordinator could
    // "Recommend" a SKU no couple can buy, and `isOwned()` could never be true
    // so the owner deep-link never fired. Papic has no single SKU to point at
    // any more — it is two products across five active rows (Pool 3k/6k/10k +
    // One 50/100), which is what `variablePricing` already declares. Its own
    // surface fetches the live rungs and owns the buy. Do NOT repoint this at a
    // Pool or One SKU: that would name one rung as "the" Papic price.
    variablePricing: true,
    poster: {
      motion: 'pulse',
      baseBackground:
        'radial-gradient(circle at 50% 45%, #C97B4B 0%, #5A2818 75%)',
      motionBackground:
        'radial-gradient(circle at 50% 45%, #F4D9B0 0%, transparent 40%)',
      iconBadgeClass: 'bg-terracotta/40 text-cream',
    },
  },
  {
    // ── Papic Pool — the flat, event-level shared guest-camera pass (SKU
    // PAPIC_GUEST · renamed from "Papic Buong Araw" by the 2026-07-22 naming
    // lock, migration 20270830568357). Phase-0 gate 0h of the 2026-07-20 Papic
    // access-scope verdict: before this entry the pass had NO app-wide doorway at all — its
    // only mention outside checkout was the wedding onboarding pricing list
    // (onboarding/wedding/_components/onboarding-pricing.ts), so a couple who
    // skipped onboarding could never find it. The missing doorway, not a gate,
    // was what kept it unsold.
    //
    // `surface: 'rsvp'` is HALF the gate — it hides the card wherever the event
    // type has no RSVP surface. It does NOT scope by type on its own — every
    // non-wedding profile row enables rsvp (migration 20270804110223 added it).
    // The authoritative predicate is
    // lib/papic-event-access.ts · papicGuestPassAccess(); a surface that
    // renders this row as buyable MUST call it (it carries the phase ladder +
    // the fail-closed default for an untiered type).
    //
    // ── LIVE since 2026-07-30. It was `coming_soon` ("Soon" pill, not clickable),
    // and the flip is the owner's 2026-07-29 two-type lock catching up with the
    // doorway: Pool is deliberately on sale. Verified against prod, not assumed —
    // `PAPIC_GUEST` · `PAPIC_GUEST_6K` · `PAPIC_GUEST_10K` were (⚠ the prices this
    // line used to quote went stale on 2026-08-26 — read the catalog, never a comment)
    // all `is_active = true` (the pax-priced ₱2,999 row is `PAPIC_GUEST_TOPUP`,
    // now inactive), so the two gates this comment named as blockers are closed:
    // 0b (the repricing off the pax curve — done) and 0c (the event-scoped points
    // pool — shipped in `20271019231590` + #3847/#3848, and every event in prod
    // holds a `free_grant` row). The card was the LAST "Soon" pill on a product
    // already selling through the studio and the guest buy sheet (#3874).
    //
    // ⚠ 0d/0e (the guest-media ROPA row + DPO sign-off on the RSVP consent text)
    // are STILL OPEN — see `Papic_Access_Scope_Council_Verdict_2026-07-20.md` §0.5
    // + `Papic_Compliance_Delta_2026-07-20.md` §2.2 (`[PENDING DPO]`). They are not
    // a blocker for THIS card and never were, because the sale they gate went live
    // on 2026-07-29 without them: guests are already shooting and already buying
    // top-ups. Escalated to the owner as a live compliance item in its own right
    // (spec §5) rather than being silently absorbed by a card flip. A doorway to
    // an already-open door is not the thing to hold hostage.
    //
    // Still gated by `papicGuestPassAccess()` — that predicate is event-type
    // ELIGIBILITY, not a darkness switch. Owner 2026-08-01 ("offer Papic
    // everywhere") put ALL 16 live types in Phase 1 and removed the anniversary
    // controller split, so it denies nothing today; it still fails closed for a
    // type created after that ruling.
    key: 'papic-guest',
    // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
    dayOfOnly: true,
    // ⚠ THE KEY IS NOT THE NAME. `papic-guest` / `PAPIC_GUEST` are frozen
    // technical ids (never-rename-technical-ids lock) from before the products
    // were named. The owner's 2026-07-30 correction: **there are exactly two
    // Papic products — Papic Pool and Papic One. "Papic Guest" is not one of
    // them and must never appear in user-facing copy.** Label, blurb, CTA and
    // tags below say Pool; only the id says guest. 'Shared' is the browse tag —
    // it is the one word that distinguishes Pool from One.
    tags: ['Photos', 'Capture', 'Day-of', 'Shared'],
    surface: 'rsvp',
    opensDirect: true,
    label: 'Papic',
    Icon: Camera,
    iteration: '0012',
    status: 'web_v1',
    category: 'photography',
    // The old blurb sold the RETIRED pax pass: "every guest on the list gets a
    // camera, all day" was a per-guest promise on a product that now meters SHOTS,
    // not people — and "on the list" was the roster framing the pool doesn't use
    // (any phone that scans the event QR shoots from it). No number here: the
    // rungs and the free allowance are derived on the surface this card opens.
    blurb: 'One shared pool of credits for the whole celebration — start free, add more any time.',
    cta: 'Open the pool',
    studioGroup: 'capture',
    // Every event is auto-armed with a free shared pool (`ensureFreePapicPoolGrantAdmin`),
    // so the honest pill is the free-entry chip, not the ₱1,000 cheapest top-up —
    // which as a headline would misprice a product whose entry cost is zero. The
    // real ladder is one tap away, fully derived, on the Papic surface.
    freeTrial: 'Free to start',
    serviceKey: 'PAPIC_GUEST',
    poster: {
      motion: 'pulse',
      baseBackground:
        'radial-gradient(circle at 50% 45%, #6B5324 0%, #241A12 75%)',
      motionBackground:
        'radial-gradient(circle at 50% 45%, #F4D9B0 0%, transparent 45%)',
      iconBadgeClass: 'bg-cream/20 text-cream',
    },
  },
  {
    key: 'panood',
    // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
    dayOfOnly: true,
    // S1 (owner 2026-09-01): hidden on date · hangout · travel — migration
    // 20271188752170. Rides `addOnOfferedForEvent`, the same gate the Studio
    // sidebar's Live Studio row now uses (lib/studio-rail.ts).
    surface: 'livestream',
    tags: ['Live', 'Video', 'Day-of', 'Free'],
    opensDirect: true,
    // "Live Studio Cast" = the directed single-feed variant (owner 2026-07-23: Live
    // Studio has two variants, Cast + Roam). Key stays 'panood' / serviceKey
    // PANOOD_SYSTEM (live product; internal rename is a separate effort). ⚠ Umbrella
    // "Live Studio" copy on marketing/home/alaala/editorial is NOT reconciled here.
    label: 'Live Studio Cast',
    Icon: Tv,
    iteration: '0011',
    status: 'web_v1',
    category: 'photography',
    blurb: 'Your day streamed live so everyone who can’t be there is — free with a single camera.',
    cta: 'Set up',
    studioGroup: 'capture',
    // Single-cam live broadcast is FREE for every host (owner model 2026-06-26 —
    // "the tool is free; the premium layer is paid"), so the Studio card shows a
    // "Free" chip rather than a paid buy. Free to start; the multicam control
    // room is the paid upgrade.
    tier: 'free',
    // serviceKey is KEPT on purpose: PANOOD_SYSTEM is the PAID multi-camera
    // control room + broadcast-style overlays upgrade (the control room is BUILT
    // at /studio/panood/broadcast — foundation PR1-5). It drives the owned-state
    // plumbing, so an event that owns the upgrade flips the card to
    // Active/Pending (paid-features-auto-show). Price is admin-managed
    // (formatV2Sku) — never hardcoded. Canonical V2 code (sku-catalog-v2.ts).
    serviceKey: 'PANOOD_SYSTEM',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #1F0808 0%, #4A1212 50%, #8B1A1A 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(255, 90, 90, 0.8) 50%, transparent 100%)',
      iconBadgeClass: 'bg-danger-100/15 text-danger-50',
    },
  },
  {
    key: 'photo-delivery',
    tags: ['Photos', 'Delivery'],
    label: 'Photo Delivery',
    Icon: ImageDown,
    iteration: '0009',
    status: 'web_v1',
    category: 'tool',
    blurb: 'Your photographer’s full-resolution gallery, handed straight to your Google Drive.',
    cta: 'Set up',
    // Delivered THROUGH Papic (owner 2026-07-22: "Photo Delivery on Papic"), so
    // it is not a standalone free card. `utility` keeps the /studio/photo-delivery
    // page reachable by deep link but drops it from the Suite free layer + grids
    // (both filter `studioGroup !== 'utility'`). tier stays 'free'.
    studioGroup: 'utility',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'radial-gradient(ellipse at 30% 30%, #2E5C8A 0%, #0F2540 80%)',
      motionBackground:
        'radial-gradient(circle at 70% 60%, #A0D8F5 0%, transparent 55%)',
      iconBadgeClass: 'bg-blue-100/15 text-blue-100',
    },
  },
  {
    key: 'patiktok',
    // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
    dayOfOnly: true,
    tags: ['Video', 'Reels', 'Day-of'],
    label: 'Patiktok',
    Icon: Film,
    iteration: '0017',
    status: 'web_v1',
    category: 'photobooth',
    blurb: 'Polished vertical reels from a booth at your party — edited and ready to post.',
    cta: 'Browse templates',
    studioGroup: 'capture',
    // Paid SKU — without this the Studio card never flips to Active/Pending when
    // owned (paid-features-auto-show). Canonical V2 code (sku-catalog-v2.ts).
    serviceKey: 'PATIKTOK_COMPILER',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 50%, #2E1F4E 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(255, 100, 180, 0.7) 30%, rgba(100, 220, 255, 0.7) 70%, transparent 100%)',
      iconBadgeClass: 'bg-pink-100/15 text-pink-100',
    },
  },
  {
    // Thank-You Video — the SKU has been on sale at ₱2,499 since 2026-07-10 with
    // NO doorway, NO screen and NOTHING producing it. A couple could pay and
    // receive nothing. Owner ruled "BUILD IT" 2026-08-10; this entry is what
    // makes the maker reachable — a maker with no card in the Studio is the
    // "mechanism never proven reachable" defect, not a feature.
    key: 'thank-you',
    tags: ['Video', 'After', 'Guests'],
    opensDirect: true,
    label: 'Thank-You Video',
    Icon: Film,
    iteration: '0012',
    status: 'web_v1',
    category: 'photobooth',
    blurb: 'A short film for the people who came — made from the photos everyone agreed to share.',
    cta: 'Make the film',
    studioGroup: 'capture',
    // Paid SKU — without this the Studio card never flips to Active/Pending when
    // owned (paid-features-auto-show). Canonical V2 code (sku-catalog-v2.ts).
    serviceKey: 'PAPIC_ADDON_THANK_YOU',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #2C2A29 0%, #6B4A3A 50%, #C24E25 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(253, 251, 247, 0.75) 50%, transparent 100%)',
      iconBadgeClass: 'bg-cream/25 text-cream',
    },
  },
  {
    key: 'supplies-marketplace',
    tags: ['Print', 'Favors', 'Soon'],
    opensDirect: true,
    label: 'Paprint',
    Icon: Printer,
    iteration: '0018',
    // Coming Soon (owner default 2026-06-25): the surface is a dead-end (cart
    // with a permanently-disabled checkout over mock products), so it must not
    // present as live. Flip to 'web_v1'/'live' when real checkout ships.
    status: 'coming_soon',
    category: 'tool',
    blurb: 'Day-of print pack and favors from vetted PH suppliers, shipped to your venue.',
    cta: 'Browse Paprint',
    studioGroup: 'utility',
    poster: {
      motion: 'scan',
      baseBackground:
        'linear-gradient(135deg, #6B5638 0%, #8B7A5A 50%, #A89678 100%)',
      motionBackground:
        'linear-gradient(90deg, transparent 0%, rgba(250, 246, 240, 0.85) 50%, transparent 100%)',
      iconBadgeClass: 'bg-cream/25 text-cream',
    },
  },
  // The LED Background card was REMOVED 2026-08-11 (owner: "remove wall
  // backdrop"). It offered "Design your LED" and opened a maker whose only
  // output was a saved draft — nothing in this repo, and no server anywhere,
  // ever produced the 8K file or the posted USB the card implied. The route,
  // the save endpoint and the template module went with it.
  {
    // FREE (owner 2026-07-23: "indoor blueprint is free and uses the 2D Plan for
    // free"). The entrance→table wayfinding rides on the already-free 2D seat
    // plan, so it is never sold — no serviceKey (no ownership/price read),
    // tier:'free' surfaces the "Free" pill, and opensDirect opens the studio
    // straight away (no /about buy interstitial). Mirrors the mood-board / seat
    // plan free-tool pattern. Supersedes the retired paid ₱1,499 INDOOR_BLUEPRINT
    // SKU (catalog row stays is_active=false).
    key: 'indoor-blueprint',
    // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
    dayOfOnly: true,
    tags: ['Planning', 'Guests', 'Day-of'],
    label: 'Indoor Blueprint',
    Icon: MapPin,
    iteration: '0008',
    status: 'web_v1',
    category: 'tool',
    blurb: 'A guided path so every guest walks straight from the door to their table.',
    cta: 'Map my venue',
    // TAB-1 REFILE 2026-08-14 — verdict §2 defect 5, owner sign-off #1
    // (approved 2026-07-17, shipped only now because it was gated behind
    // sign-off #2). This is a planning/layout tool, not identity; it sat under
    // `branding` purely as an expedient (see the `seating` note below), which
    // is the defect. Branding is now honestly pure identity: monogram · QR ·
    // Pakanta. Section LABELS and the locked 4-section count are untouched.
    studioGroup: 'setnayan_ai',
    tier: 'free',
    opensDirect: true,
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #1A1410 0%, #3A281C 55%, #6B4A30 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 60%, #F4D9B0 0%, transparent 50%)',
      iconBadgeClass: 'bg-warn-100/20 text-warn-100',
    },
  },
  {
    key: 'mood-board',
    tags: ['Planning', 'Branding', 'Free'],
    label: 'Mood Board',
    Icon: Palette,
    iteration: '0010',
    status: 'web_v1',
    category: 'tool',
    blurb: 'Pick your palette — and it flows into every Setnayan piece you make.',
    cta: 'Open board',
    // TAB-1 REFILE 2026-08-14 — see indoor-blueprint above.
    studioGroup: 'setnayan_ai',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #3A2B4F 0%, #5C3A6B 50%, #8A5A8F 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #F4C8E0 0%, transparent 55%)',
      iconBadgeClass: 'bg-fuchsia-100/15 text-fuchsia-50',
    },
  },
  {
    // Free core planning tool, surfaced on the Studio hub (owner ask
    // 2026-06-21). It was nested under `branding` to match the then-existing
    // layout-tool precedent without touching the owner-locked 4-section
    // sub-nav — an expedient, never a design call, and the verdict named it
    // defect 5. REFILED to `setnayan_ai` 2026-08-14 (sign-off #1); the sub-nav
    // labels + count are still untouched. Its href is flag-aware — see
    // addOnHref (2D editor vs the 3D lab).
    key: 'seating',
    // S1 (owner 2026-09-01): hidden on date · hangout · travel — the EXISTING
    // `seating` surface those rows already exclude. Matches the sidebar's 3D
    // Plan row, which opens this same entry (lib/studio-apps.ts).
    surface: 'seating',
    tags: ['Planning', 'Guests', 'Free'],
    opensDirect: true,
    label: 'Seat Plan',
    Icon: LayoutGrid,
    iteration: '0008',
    status: 'web_v1',
    category: 'tool',
    blurb: 'Lay out your tables and seat every guest with simple drag-and-drop.',
    cta: 'Open seat plan',
    studioGroup: 'setnayan_ai',
    tier: 'free',
    poster: {
      motion: 'drift',
      baseBackground:
        'linear-gradient(135deg, #1F2A3D 0%, #2E4063 50%, #44608F 100%)',
      motionBackground:
        'radial-gradient(circle at 50% 50%, #BFD4F0 0%, transparent 55%)',
      iconBadgeClass: 'bg-sky-100/15 text-sky-50',
    },
  },
];

/**
 * Live Studio — the UNIFIED customer-facing SKU (owner 2026-07-25) that merges
 * Cast (directed single feed) + Roam (guests pick their view) into ONE switching
 * product: a directed Main Stage plus switchable guest cameras. Paid ₱3,000 per
 * event (serviceKey LIVE_STUDIO; price is admin-managed via the catalog, never
 * hardcoded here). Built on the Roam substrate — the tile keeps the internal key
 * `live-studio-roam` (like "Live Studio Cast" keeps the internal `panood` name),
 * so its route/detail/state/stats wiring is untouched.
 *
 * opensDirect → routes to the bespoke /studio/live-studio-control App Store detail
 * page, which mounts the buy drawer and, once owned, opens the switching controller.
 *
 * FLAG-GATED: appended to ADD_ONS only when NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED
 * is on (reusing the existing Roam flag as the launch switch). Until launch the flag
 * is off, LIVE_STUDIO is excluded from /pricing by name, and the old LIVE_STUDIO_ROAM
 * row is is_active=false — so Live Studio is fully dark. At launch the owner flips
 * the flag (and runs the Cast/PANOOD_SYSTEM retirement cutover).
 */
const LIVE_STUDIO_ENTRY: AddOnEntry = {
  key: 'live-studio-roam',
  // Day-of only — see `dayOfOnly` on AddOnEntry (owner 2026-08-21).
  dayOfOnly: true,
  // S1 (owner 2026-09-01): same event-type gate as the 'panood' entry it
  // replaces once NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED is on.
  surface: 'livestream',
  tags: ['Live', 'Video', 'Multi-cam', 'Day-of'],
  opensDirect: true,
  label: 'Live Studio',
  Icon: Video,
  iteration: '0011',
  status: 'web_v1',
  category: 'photography',
  blurb:
    'Stream your celebration live — direct a Main Stage between your cameras, or let remote guests pick their own view, across every angle and venue.',
  cta: 'Set up',
  studioGroup: 'capture',
  serviceKey: 'LIVE_STUDIO',
  poster: {
    motion: 'scan',
    baseBackground:
      'linear-gradient(135deg, #08131F 0%, #123A4A 50%, #1A6E7A 100%)',
    motionBackground:
      'linear-gradient(90deg, transparent 0%, rgba(90, 220, 200, 0.75) 50%, transparent 100%)',
    iconBadgeClass: 'bg-teal-100/15 text-teal-50',
  },
};

/**
 * The Studio/Suite catalog. The unified Live Studio tile is appended only behind
 * its flag so it stays dark until launch (see LIVE_STUDIO_ENTRY). Every other
 * consumer imports ADD_ONS unchanged.
 */
export const ADD_ONS: ReadonlyArray<AddOnEntry> = liveStudioRoamEnabled()
  ? [...BASE_ADD_ONS, LIVE_STUDIO_ENTRY]
  : BASE_ADD_ONS;

// `StudioFreeTool` + `studioFreeTools()` removed 2026-07-11 — dead code, imported
// nowhere (the Studio hub renders the four free planning tools via the couple
// sidebar / free-tools strip, not this factory). The free core tools (Guests /
// Seating / Budget / Schedule) remain first-class sidebar surfaces.

/**
 * The words a buy page opens with: the product's NAME and the one promise, from
 * the same record every App Store row in the Studio hub already reads.
 *
 * 🔑 IT EXISTS SO A SELLING PAGE CANNOT INVENT ITS OWN SENTENCE. Nine in-app
 * pages take money and rendered no visible headline at all; giving each one a
 * hero is the fix, and writing a fresh promise into each of them would have
 * been nine second answers to "what is this product for" — the exact drift the
 * Pakanta page's own note warns about ("a second set would give a couple two
 * different accounts of one product").
 *
 * ⚠ IT THROWS ON AN UNKNOWN KEY, DELIBERATELY. Returning a fallback would let a
 * renamed key ship a hero with no product name on it — the page would still
 * render, still take money, and simply stop saying what it sells. That is the
 * quiet kind of failure this repo keeps paying for; a build that stops is the
 * cheaper outcome. `studio-buy-hero.test.ts` pins every key a buy page names,
 * so the stop happens in CI rather than in front of a couple.
 */
export function addOnHeroCopy(key: string): { label: string; blurb: string } {
  const entry = ADD_ONS.find((a) => a.key === key);
  if (!entry) {
    throw new Error(
      `add-ons-catalog has no entry for "${key}", and a buy page opens with its words.`,
    );
  }
  return { label: entry.label, blurb: entry.blurb };
}
