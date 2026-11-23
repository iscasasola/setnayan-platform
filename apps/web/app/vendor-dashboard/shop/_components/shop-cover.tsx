'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, ExternalLink, Megaphone, Puzzle, Settings, ShieldCheck, Star, Share } from 'lucide-react';
import { routes } from '@/lib/routes';
import { PillSelector } from '@/app/_components/pill-selector';
import type { StorageMeter } from '@/lib/supplier-store';
import { STORAGE_UPGRADE_HREF } from '@/lib/supplier-storage';
import { ShopDoorScreen } from '@/app/vendor-dashboard/_components/shop-door-screen';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { PinWord } from '@/app/_components/pinned-row/pin-door';
import { VendorAvatar } from '@/app/_components/vendor-avatar';
import { formatCount } from '@/lib/format-number';
import { CopyButton } from '@/app/_components/copy-button';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { useToast } from '@/app/_components/toast/toast-provider';
import type { LogoFrame } from '@/lib/open-shop-logo';
import { shareShopLink, shopPhotoCardPath } from '@/lib/share-shop-link';
import { ShopSettings } from './shop-settings';
import { SupplierHero, type SupplierHeroPicture } from '../../_components/supplier-hero';
import { PhotoPickLabel, PortfolioUploadDoor } from '../../_components/portfolio-upload';
import { PickedLogoFiles } from './photo-menus';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import { YOUR_PAGE_HREF } from './shop-gear-sections';
import { ImageBadge } from '@/app/_components/image-badge';
import { badgeImageOf } from '@/lib/shop-badge-row';
import { VIEW_SHOP_CLOSE, viewShopSrc } from '@/lib/view-shop-frame';
import { verifiedBadge, type ShopBadge } from '@/lib/shop-badges';

/** The cover's "★ · N reviews" — Your page › Reviews and stories (its `Fold anchor="reviews"` opens on the hash). */
const REVIEWS_HREF = `${YOUR_PAGE_HREF}#reviews`;

/**
 * 🏪 SHOP'S COVER + PINNED ROW (THE ONE BUILD A3 W1–W6, lane C4; v113 `V.shop`).
 *
 *   cover band — the cover photo (Your page's pick, else the first portfolio photo — the page's own rule) · the logo
 *   (tap → its viewer) · where · the name · "✓ Verified" (or "Get verified · N of 3 papers" — 2026-11-14, the papers are the only step) · ★ · events · the plan
 *   pill · View shop ↗ · Share · Promote · QR · ⚙.
 *   pinned row — "Shop · ★ 4.8 · 120 events · View shop ↗ · ⚙", fading in over the last 48 px as the cover leaves.
 *
 * 🔑 Every sheet is the SHIPPED body, and every body comes WITH the page (`shop/page.tsx` streams Promote · QR · ⚙ in
 * their own <Suspense>; Logo · Cover are drawn from what the page already read) — the picked client's pattern
 * (`clients/[eventId]/_pages/switch.tsx`). Opening or closing a sheet is CLIENT STATE plus `history.replaceState` of
 * its address (`?sheet=promote|qr`, `?view=logo|cover`, `?gear=1`) — NO request, never `router.replace` (8 Nov release
 * gate: each tap used to re-run the whole Shop read; Promote showed 8.4 s after the tap). The address still opens the
 * sheet on arrival (a deep link, a reload). Share is browser-only (copy · photo card · the phone's share sheet).
 * 🔒 the-shop-sheets-open-without-a-request.test.ts.
 *
 * ⚙ ONE settings door: `ShopSettings` (the shipped `MenuSettingsButton` sheet) sits on the pinned row; the cover's ⚙
 * opens the SAME sheet through the address (`replaceAddressParam` keeps `useSearchParams` in step) — never a second
 * sheet.
 *
 * ⤴ RISE FULL SCREEN — THE SHOP TAB MAP (Build 5 · Lane A, owner 10 Nov on the Shop screenshot: *"Most of these will be
 * the fullscreen grow design"*; corpus `00-BUILD-5-PLAN.md` "Lane A · Rise full screen — the Shop tab map"). Every door
 * here opens the ONE `RiseScreen` out of the door you tapped (bars away, ✕ the exact reverse), never a popup sheet:
 * ⚙ → the Shop settings · Logo 📷 → the logo menu · View shop → the shop as couples see it, in the app (with "Open in
 * browser ↗"), no new tab · Share · Promote · QR · Cover → each its own full screen. The bodies are the same shipped
 * bodies; only the frame they open in changed.
 * L1's `CollapsingTop` (foundation) replaces the fade below when it lands — the content stays.
 */
export type CoverData = {
  name: string;
  initials: string;
  logoUrl: string | null;
  logoFrame: LogoFrame;
  logoUnavailable: boolean;
  coverUrl: string | null;
  city: string | null;
  /** `papersIn` of `papersOf` required papers (2026-11-14: verification is the papers and one Submit — no other steps). */
  /** `unread` = the application read was REFUSED (supplier audit S-3): say so, never "Get verified · 0 of 3 papers". */
  verified: { isVerified: boolean; inReview: boolean; papersIn: number; papersOf: number; unread?: boolean };
  /** "★ 4.8 · 120 events" pieces — null = the read was refused: the events piece says `EVENTS_UNREAD`, never "—" or 0. */
  rating: string | null;
  /** "38 reviews" — the trusted-review count beside the ★ (null = unread or none); with `rating` it is the link into
   *  Your page › Reviews and stories (Build 2 §10 #31). */
  reviews?: string | null;
  events: string | null;
  /** null = the shop's own row was REFUSED (audit S-2) — drawn as PLAN_UNREAD, never as "Free plan". */
  planLabel: string | null;
  /** The public page — opened in a new tab; null before the shop has an address. */
  publicPath: string | null;
  /** Couples can see the page (admin-approved). Before that, View shop opens the team preview. */
  websiteLive: boolean;
  slug: string | null;
  /** The full URL to copy and share. */
  shareUrl: string | null;
  /** 🖼 The hero's picture (Lane E 11–12): the cover photo, or the category placeholder. Absent = `coverUrl` as is. */
  hero?: SupplierHeroPicture | null;
  /** "Cover · Your page" / "Cover · first photo". */
  heroCaption?: string | null;
  /** 📂 The Upload door's facts (owner 9 Nov: Upload opens the device's picker, here). Absent = no door. */
  uploadFacts?: PortfolioUploadFacts | null;
  /**
   * 🏅 THE SHOP CARD'S EARNED BADGES (owner 17 Nov, "badges and seal is still not visible"): the milestone and award
   * circles the public shop hero draws (`shopBadges`, the same facts) — so the supplier sees on their own card what
   * couples see. null = the facts read was refused (draw nothing, never "no badges"); [] = none earned yet.
   */
  earned?: ShopBadge[] | null;
  /** "Next badge: Bronze at 5 bookings · 5 to go" — the Completed bookings tile's own goal (`shelfNextBadgeLine`); said when nothing is earned yet; null = unread. */
  nextBadge?: string | null;
  /** 💾 The Storage row (Store drawing v10, F0): what the shop stores against its plan (`storageMeter`), and the next
   *  plan that holds more (the storage sheet's "Go …"; null = none). Absent = no row. */
  storage?: { meter: StorageMeter; next: string | null };
};

/**
 * Write one address param WITHOUT a request: `history.replaceState` with a fresh state (`null`), so Next.js copies its
 * own history state and keeps `useSearchParams` in step (a restore, never a fetch) — the cover's ⚙ opens the pinned
 * row's `ShopSettings` this way. `value === null` removes it. The hash is dropped, as the old `router.replace` did.
 */

/** The events count when its read was refused (house honest-read rule, `reads-are-honest.test.ts`): said, never "—" or 0
    — a "—" beside "Verified — Pro plan" read as part of that line (owner 2026-11-10). */
const EVENTS_UNREAD = 'Couldn’t load events';
const PLAN_UNREAD = 'Couldn’t load your plan';
const VERIFY_UNREAD = 'Couldn’t load your papers';
export function replaceAddressParam(key: string, value: string | null) {
  try {
    const url = new URL(window.location.href);
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    const qs = url.searchParams.toString();
    window.history.replaceState(null, '', `${url.pathname}${qs ? `?${qs}` : ''}`);
  } catch {
    /* an address that cannot be written still shows the right sheet (the state below is what draws it) */
  }
}

/**
 * The cover's sheets and the address param that names each (a deep link, a reload, a save coming back). Promote is ONE
 * sheet with two tabs (Store drawing v10 F0b: Posters & prints · QR codes): `?sheet=promote` (and the old `prints`) open
 * it on Posters & prints, `?sheet=qr` on QR codes — links already sent still land. `?sheet=storage` = the plan chip's sheet.
 */
type CoverSheet = 'promote' | 'prints' | 'qr' | 'storage' | 'logo' | 'cover';
const SHEET_ADDRESS: Readonly<Record<CoverSheet, readonly [param: string, value: string]>> = {
  promote: ['sheet', 'promote'],
  prints: ['sheet', 'prints'],
  qr: ['sheet', 'qr'],
  storage: ['sheet', 'storage'],
  logo: ['view', 'logo'],
  cover: ['view', 'cover'],
};
function sheetInAddress(params: { get(k: string): string | null }): CoverSheet | null {
  for (const [id, [param, value]] of Object.entries(SHEET_ADDRESS) as Array<[CoverSheet, readonly [string, string]]>) {
    if (params.get(param) === value) return id;
  }
  return null;
}

/** A cover door's screen, whose body came with the page (null = still on its way) — risen full screen out of its door. */
function ParamSheet({ open, onClose, title, body, data }: { open: boolean; onClose: () => void; title: string; body: ReactNode | null; data: string }) {
  if (!open) return null;
  return (
    <ShopDoorScreen title={title} onClose={onClose} data={`shop-${data}`}>
      <div className="px-4 pb-6 pt-3" data-shop-sheet={data}>
        {body ?? (
          <p role="status" className="py-4 text-[13.5px] text-ink/60">
            Opening…
          </p>
        )}
      </div>
    </ShopDoorScreen>
  );
}

export function ShopCover({
  d,
  gearBody,
  promoteBody,
  qrBody,
  logoBody,
  coverBody,
}: {
  d: CoverData;
  gearBody: ReactNode | null;
  /** Promote › Posters & prints — the shipped Promote body (Prints · Gifts · Share your work). */
  promoteBody: ReactNode | null;
  /** Promote › QR codes — the shipped QR body ("Scan or tap"). */
  qrBody: ReactNode | null;
  logoBody: ReactNode | null;
  coverBody: ReactNode | null;
}) {
  const coverRef = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  // 👀 View shop rises the shop as couples see it, in the app — client state only (nothing to read; the page loads itself).
  const [viewOpen, setViewOpen] = useState(false);

  // The pinned row fades in over the last 48 px of the cover (v108/v110 item 2: "last 48 px crossfade").
  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const bottom = el.getBoundingClientRect().bottom;
      const v = Math.max(0, Math.min(1, (48 + 44 - bottom) / 48));
      setPin((p) => (Math.abs(p - v) < 0.01 ? p : v));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // 🗂 Which sheet is open: the address on arrival, then client state — a tap never asks the server (see the header).
  const params = useSearchParams();
  const inAddress = sheetInAddress(params);
  const [sheet, setSheet] = useState<CoverSheet | null>(inAddress);
  // The address changed under us (a save that came back to `?view=logo`, back/forward): follow it.
  useEffect(() => setSheet(inAddress), [inAddress]);
  const openSheet = (id: CoverSheet) => {
    setSheet(id);
    replaceAddressParam(...SHEET_ADDRESS[id]);
  };
  const closeSheet = (id: CoverSheet) => {
    setSheet(null);
    replaceAddressParam(SHEET_ADDRESS[id][0], null);
    if (id === 'logo') setLogoFiles(null); // the picked photo belongs to that one opening
  };
  // Promote's tab: the address names it, so a reload lands on the same tab.
  const promoteTab: 'prints' | 'qr' = sheet === 'qr' ? 'qr' : 'prints';
  const promoteOpen = sheet === 'promote' || sheet === 'prints' || sheet === 'qr';
  // ⚙ The pinned row's `ShopSettings` owns the ONE settings sheet; the cover opens it through its address.
  const openGear = () => replaceAddressParam('gear', '1');
  // 📷 THE LOGO IS THE BUTTON TOO (owner 19 Nov 2026, "same as the profile photo"): a tap opens the picker at once and the
  // Logo screen rises with the picked photo in its framer. A VERIFIED shop's logo changes by request, so there the tap
  // opens the Logo screen as before (its "Ask to change" row) — a picker whose save the server refuses would be a lie.
  const [logoFiles, setLogoFiles] = useState<File[] | null>(null);
  const logoPicks = !(d.verified.isVerified && d.logoUrl) && !d.logoUnavailable;
  const avatar = (
    <VendorAvatar
      logoUrl={d.logoUrl}
      frame={d.logoFrame}
      initials={d.initials}
      className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ring-1 ring-ink/10"
    />
  );
  const counts = [d.rating ? `★ ${d.rating}` : null, d.events ?? EVENTS_UNREAD].filter(Boolean).join(' · ');

  return (
    <>
      {/* 📌 THE PINNED ROW — one row, 44 px, a soft hairline; sticky, fading in as the cover leaves. */}
      <div className="pointer-events-none sticky top-0 z-[6] -mb-11 h-11" aria-hidden={pin < 0.5 ? true : undefined} data-shop-pin="shop" data-pinned-row="">
        <div
          className="flex h-11 items-center gap-2 px-4"
          style={{ opacity: pin, pointerEvents: pin < 0.5 ? 'none' : 'auto', background: 'var(--sn-canvas)', boxShadow: pin > 0.5 ? '0 1px 0 color-mix(in srgb, var(--m-ink) 8%, transparent)' : undefined }}
        >
          <PinWord barAbove>Shop</PinWord>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink/60">{counts}</span>
          {d.publicPath ? (
            <button type="button" onClick={() => setViewOpen(true)} tabIndex={pin < 0.5 ? -1 : undefined} className="inline-flex h-9 items-center gap-1 rounded-full bg-ink px-3 text-[13px] font-semibold text-[color:var(--m-paper)]" data-view-shop-pin="">
              View shop
              <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
          <ShopSettings body={gearBody} local />
        </div>
      </div>

      {/* 🖼 THE ONE SUPPLIER HERO (Lane E item 10) — the same part, height and gutters as Today and Portfolio. It wears
          the cover photo (Your page's pick, else the first portfolio photo), or the category placeholder (item 12). */}
      <div ref={coverRef} data-shop-cover="" data-tour="shop-details">
        <SupplierHero
          eyebrow={<>Shop{d.shareUrl ? ` · ${d.shareUrl.replace(/^https?:\/\/(www\.)?/, '')}` : d.city ? ` · ${d.city}` : ''}</>}
          gear={
            <button
              type="button"
              onClick={openGear}
              aria-label="Shop settings"
              className="sn-hit-2d grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-[rgba(20,18,14,.35)] backdrop-blur"
              data-shop-cover-gear=""
              data-tour="shop-gear"
            >
              <Settings aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
          }
          title={d.name}
          titleData="shop-name"
          sub={
            <>
              {/* 🏅 THE APP-DRAWN SEAL (owner 17 Nov: the only seal he saw was the one baked into the photo) — the SAME
                  Setnayan Verified seal the public shop hero and the Find card draw, from `verification` data. */}
              {d.verified.isVerified ? (
                <a href="#docs" className="sn-hit inline-flex items-center gap-1.5 font-semibold" data-shop-cover-seal="verified">
                  <span className="inline-flex leading-[0]">
                    <ImageBadge {...badgeImageOf(verifiedBadge())} uid="cover-verified" size={30} label="Setnayan Verified" />
                  </span>
                  Setnayan Verified
                </a>
              ) : d.verified.unread ? (
                <a href="#docs" className="sn-hit inline-flex items-center" data-shop-cover-verify="unread">{VERIFY_UNREAD}</a>
              ) : d.verified.inReview ? (
                <a href="#docs" className="sn-hit inline-flex items-center">Verification in review</a>
              ) : (
                <a href="#docs" className="sn-hit inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                  <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Get verified · {formatCount(d.verified.papersIn)} of {formatCount(d.verified.papersOf)} papers
                </a>
              )}
              {(d.earned ?? []).map((b) => (
                <a key={b.key} href="#badges" title={b.label} className="sn-hit inline-flex items-center leading-[0]" data-shop-cover-badge={b.key}>
                  <ImageBadge {...badgeImageOf(b)} uid={`cover-${b.key}`} size={30} label={b.label} />
                </a>
              ))}
              {d.earned && d.earned.length === 0 && d.nextBadge ? (
                <a href="#badges" className="sn-hit inline-flex items-center text-white/80 underline decoration-white/40 underline-offset-[3px]" data-shop-cover-next="">
                  {d.nextBadge}
                </a>
              ) : null}
              {/* ⭐ "★ 4.8 · 38 reviews" opens Your page › Reviews and stories — the full reviews list, unchanged (§10 #31). */}
              {d.rating ? (
                <Link href={REVIEWS_HREF} className="inline-flex min-h-11 items-center gap-1 underline decoration-white/45 underline-offset-[3px]" data-shop-reviews-link="">
                  <Star aria-hidden className="h-3 w-3 fill-current" strokeWidth={0} />
                  {d.rating}
                  {d.reviews ? ` · ${d.reviews}` : ''}
                </Link>
              ) : null}
              <span className="text-white/75" data-shop-events={d.events == null ? 'unread' : ''}>{d.events ?? EVENTS_UNREAD}</span>
            </>
          }
          picture={d.hero ?? (d.coverUrl ? { url: d.coverUrl, kind: 'photo' } : null)}
          caption={d.heroCaption ?? null}
          // 🖼 THE PHOTO IS THE BUTTON (owner 19 Nov 2026: "cover photo should not be an icon but the actual cover photo
          // tap that"): a tap on the picture opens the device's picker at once, then the shipped Portfolio uploader
          // with the new photo pre-picked as Your page's draft cover. No Upload pill and no Cover door beside it.
          photoDoor={
            d.uploadFacts ? (
              <span className="absolute inset-0 block" data-tour="shop-cover-photo">
                <PortfolioUploadDoor facts={d.uploadFacts} coverPick className="absolute inset-0 block" data="shop-cover-pick">
                  <span className="sr-only">Change your cover photo</span>
                </PortfolioUploadDoor>
              </span>
            ) : null
          }
          data={{ 'shop-hero': '' }}
        />
      </div>
      {d.logoUnavailable ? <p className="px-4 pt-2 text-[12px] text-ink/65">Couldn&rsquo;t load your logo just now.</p> : null}

      {/* 🚪 THE COVER'S DOORS (Store drawing `supplier_store_graphs_badges_2026-11-23` v10, F0 — owner 23 Nov 2026): the
          Storage row (what the shop stores of its plan's space; the plan chip opens the storage sheet), then ONE line —
          the logo (tap = the picker) · View shop · Toolkit · Share · Promote (v19 adds Toolkit). The QR door is a tab inside Promote now; Gifts lives
          in Promote › Posters & prints (its shipped section); the plan is the chip. 🔒 the-cover-is-the-store-drawing.test.ts */}
      <div className="space-y-3 px-4 pt-3" data-shop-cover-doors="">
        {d.storage ? (
          <StorageRow storage={d.storage} plan={d.planLabel} label={d.planLabel == null ? PLAN_UNREAD : `${d.planLabel} plan`} onOpen={() => openSheet('storage')} />
        ) : null}
        <div className="flex items-center gap-2" data-shop-cover-line="one">
          <span className="shrink-0" data-tour="shop-logo">
          {logoPicks ? (
            <PhotoPickLabel
              className="relative block shrink-0 rounded-full"
              data="shop-logo"
              onPick={(files) => {
                setLogoFiles(files);
                openSheet('logo');
              }}
            >
              <span className="sr-only">Change your logo</span>
              {avatar}
            </PhotoPickLabel>
          ) : (
            <button type="button" onClick={() => openSheet('logo')} className="relative shrink-0 rounded-full" aria-label="Your logo — view or change" data-shop-logo="">
              {avatar}
            </button>
          )}
          </span>
          {d.publicPath ? (
            <button
              type="button"
              onClick={() => setViewOpen(true)}
              aria-label={d.websiteLive ? 'View shop as couples see it' : 'View shop — a preview for your team'}
              className="sn-press flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-3 text-sn-base font-semibold text-[color:var(--m-paper)]"
              data-view-shop=""
            >
              <ExternalLink aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="truncate">View shop</span>
            </button>
          ) : (
            <Link href="/vendor-dashboard/profile" className="flex min-h-12 min-w-0 flex-1 items-center rounded-full border border-ink/15 px-4 text-sn-md font-medium text-ink">
              <span className="truncate">Add your shop name</span>
            </Link>
          )}
          {/* 🧩 Toolkit v19 (frame 0): View shop · Toolkit · Share · Promote — the Toolkit's own door from the cover. */}
          <Link href={routes.vendorDashboard.shop.store.index()} className={SHARE_PILL} data-shop-cover-icon="toolkit">
            <Puzzle aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            Toolkit
          </Link>
          <button type="button" onClick={() => setShareOpen(true)} disabled={!d.shareUrl} className={SHARE_PILL} data-shop-cover-icon="share">
            <Share aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            Share
          </button>
          <button type="button" onClick={() => openSheet('promote')} className={SHARE_PILL} data-shop-cover-icon="promote" data-shop-quick="promote">
            <Megaphone aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            Promote
          </button>
        </div>
      </div>

      {shareOpen && d.shareUrl ? <ShareSheet url={d.shareUrl} slug={d.slug} name={d.name} onClose={() => setShareOpen(false)} /> : null}
      {viewOpen && d.publicPath ? <ViewShopScreen path={d.publicPath} live={d.websiteLive} shareUrl={d.shareUrl} onClose={() => setViewOpen(false)} /> : null}
      <ParamSheet
        open={promoteOpen}
        onClose={() => closeSheet(sheet === 'qr' ? 'qr' : sheet === 'prints' ? 'prints' : 'promote')}
        title="Promote"
        body={
          <>
            <div className="pb-3" data-promote-tabs="">
              <PillSelector
                label="Promote"
                value={promoteTab}
                options={[
                  { key: 'prints', label: 'Posters & prints' },
                  { key: 'qr', label: 'QR codes' },
                ]}
                onPick={(k) => {
                  if (k === promoteTab) return;
                  replaceAddressParam('sheet', k === 'qr' ? 'qr' : 'promote');
                  setSheet(k === 'qr' ? 'qr' : 'promote');
                }}
                data="promote-tabs"
              />
            </div>
            {promoteTab === 'qr' ? qrBody : promoteBody}
          </>
        }
        data="promote"
      />
      {d.storage ? (
        <ParamSheet open={sheet === 'storage'} onClose={() => closeSheet('storage')} title="Storage" body={<StorageBody storage={d.storage} plan={d.planLabel} />} data="storage" />
      ) : null}
      <ParamSheet open={sheet === 'logo'} onClose={() => closeSheet('logo')} title="Logo" body={logoBody ? <PickedLogoFiles.Provider value={logoFiles}>{logoBody}</PickedLogoFiles.Provider> : null} data="logo" />
      <ParamSheet open={sheet === 'cover'} onClose={() => closeSheet('cover')} title="Cover photo" body={coverBody} data="cover" />
    </>
  );
}

/** Toolkit, Share and Promote: an icon over its word, a small square beside View shop (Store drawing v19, frame 0 —
 *  five compact buttons on one line, so each square is 56 px wide). */
const SHARE_PILL =
  'sn-press inline-flex min-h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-[rgb(var(--sn-frame-bg))] py-1.5 text-sn-xs font-semibold text-ink shadow-[var(--sn-frame-shadow-tile)] disabled:opacity-40'; // no-card-ok: a press (the Share and Promote buttons), not a frame

/** The plan chip's words — the plan, or that it could not be read (never "Free" on a refused read). */
function chipWord(plan: string | null): string {
  return plan == null ? PLAN_UNREAD : plan;
}

/** "12 GB of 128 GB" · "1.2 GB stored" (no limit on the plan) · "Couldn’t load" — never 0 for an unread store. */
function meterWords(m: StorageMeter): string {
  if (m.kind === 'unread') return 'Couldn’t load';
  if (m.kind === 'no_limit') return m.used ? `${m.used} stored` : 'Couldn’t load';
  return `${m.used} of ${m.total}`;
}

function StorageBar({ m, big = false }: { m: StorageMeter; big?: boolean }) {
  if (m.kind !== 'meter') return null;
  return (
    <span className={`relative block min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--m-line)] ${big ? 'h-2' : 'h-1.5'}`} aria-hidden data-storage-bar="">
      <i className={`absolute inset-y-0 left-0 block rounded-full ${m.over ? 'bg-[rgb(var(--color-warn))]' : 'bg-[rgb(var(--color-link))]'}`} style={{ width: `${Math.max(m.pct, 2)}%` }} />
    </span>
  );
}

/** 💾 The cover's Storage row: Storage · the bar · "12 GB of 128 GB" · the plan chip (→ the storage sheet). */
function StorageRow({ storage, plan, label, onOpen }: { storage: NonNullable<CoverData['storage']>; plan: string | null; label: string; onOpen: () => void }) {
  const m = storage.meter;
  return (
    <div className="flex min-h-11 items-center gap-2.5" data-shop-storage={m.kind}>
      <span className="text-sn-md font-semibold text-ink">Storage</span>
      {m.kind === 'meter' ? <StorageBar m={m} /> : <span className="flex-1" />}
      <span className={`whitespace-nowrap text-sn-md tabular-nums ${m.kind === 'unread' ? 'text-[rgb(var(--color-warn))]' : 'text-[color:var(--m-slate-2)]'}`}>{meterWords(m)}</span>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label} — storage`}
        className="sn-press inline-flex min-h-11 shrink-0 items-center rounded-full px-1"
        data-shop-plan-chip=""
      >
        <span className={`rounded-full bg-[color:var(--surface-soft)] px-2.5 py-1 text-sn-sm font-semibold ${plan == null ? 'text-[rgb(var(--color-warn))]' : 'text-ink'}`}>
          {plan == null ? 'Plan' : plan}
        </span>
      </button>
    </div>
  );
}

/**
 * 💾 THE STORAGE SHEET (drawing v10, "Storage"): the plan, what is stored of its space, the bar, and the way up. Display
 * only. The photo-at-an-event limits per plan are not drawn here: they have no home in the catalog or `TIER_CAPS` yet.
 */
function StorageBody({ storage, plan }: { storage: NonNullable<CoverData['storage']>; plan: string | null }) {
  const m = storage.meter;
  return (
    <div className="space-y-4" data-storage-sheet="">
      <div className="sn-frame space-y-2 p-4">
        <span className={`text-sn-md font-semibold ${plan == null ? 'text-[rgb(var(--color-warn))]' : 'text-[color:var(--m-slate-2)]'}`}>{chipWord(plan)}</span>
        <b className={`block text-sn-3xl font-bold tabular-nums leading-tight ${m.kind === 'unread' ? 'text-[rgb(var(--color-warn))]' : 'text-ink'}`} data-storage-words="">
          {m.kind === 'unread' ? 'Couldn’t load what you store' : meterWords(m)}
        </b>
        {m.kind === 'meter' ? (
          <span className="flex">
            <StorageBar m={m} big />
          </span>
        ) : null}
        {m.kind === 'meter' && m.over ? <p className="text-sn-base text-[rgb(var(--color-warn))]">Over your space — new files wait for room. Nothing you stored was changed.</p> : null}
      </div>
      {m.kind === 'meter' ? (
        <ul className="sn-frame sn-frame-flush px-4">
          <li className="flex min-h-14 items-center justify-between gap-3 py-2">
            <b className="text-sn-lg font-semibold text-ink">Portfolio photos</b>
            <span className="text-right text-sn-md text-[color:var(--m-slate-2)]">As many as your space holds</span>
          </li>
        </ul>
      ) : null}
      <div className="flex [&>*]:w-full">
        {storage.next ? (
          <ActionButton tone="brand" main icon={<ArrowUpRight aria-hidden strokeWidth={2} />} label={`Go ${storage.next}`} href={STORAGE_UPGRADE_HREF} />
        ) : (
          <ActionButton tone="neutral" icon={<ArrowUpRight aria-hidden strokeWidth={2} />} label="See your plan" href={STORAGE_UPGRADE_HREF} />
        )}
      </div>
    </div>
  );
}

/**
 * The Share door's three presses — Copy · Save · Share — are ONE shape at ONE width (T19, the Button Rule: owner 9 Nov
 * "buttons uniform, rows balanced"; Build 5 · Lane A slice 2 — they were three odd-width chips). Each sits at the end of
 * its own row, so they line up as one column of equal pills.
 */
const SHARE_DOOR_W = 'w-[7.25rem] shrink-0';
export const SHARE_DOOR_PRESS = actionButtonClass('neutral', { extra: SHARE_DOOR_W });

/** 🔗 Share (v96): Copy your link · Photo card · the phone's share sheet. Nothing to read — browser-only. */
function ShareSheet({ url, slug, name, onClose }: { url: string; slug: string | null; name: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <ShopDoorScreen title="Share your shop" onClose={onClose} data="shop-share">
      <div className="divide-y divide-ink/10 px-4 pb-6" data-shop-sheet="share">
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="min-w-0">
            <b className="block text-[14.5px] font-medium text-ink">Copy your link</b>
            <span className="block truncate text-[12.5px] text-ink/60">{url.replace(/^https?:\/\//, '')}</span>
          </span>
          <CopyButton value={url} label="Copy" copiedLabel="Copied" className={SHARE_DOOR_PRESS} />
        </div>
        {slug ? (
          <div className="flex items-center justify-between gap-3 py-3">
            <span>
              <b className="block text-[14.5px] font-medium text-ink">Photo card</b>
              <span className="block text-[12.5px] text-ink/60">A ready image for Facebook and Instagram</span>
            </span>
            <SaveFileLink href={shopPhotoCardPath(slug)} filename={`${slug}-card.png`} className={SHARE_DOOR_PRESS} data-share-door-save="">
              {(s) => (
                <>
                  <Share aria-hidden strokeWidth={1.9} />
                  <span className="lbl">{s === 'saving' ? 'Saving…' : 'Save'}</span>
                </>
              )}
            </SaveFileLink>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 py-3">
          <span>
            <b className="block text-[14.5px] font-medium text-ink">Send to a couple</b>
            <span className="block text-[12.5px] text-ink/60">Opens your phone&rsquo;s share sheet</span>
          </span>
          <button
            type="button"
            className={SHARE_DOOR_PRESS}
            data-share-door-share=""
            onClick={async () => {
              const r = await shareShopLink(url, name);
              if (r === 'copied') toast.success('Link copied.');
              else if (r === 'failed') toast.error('Couldn’t share just now — copy the link instead.');
            }}
          >
            <Share aria-hidden strokeWidth={1.9} />
            Share
          </button>
        </div>
      </div>
    </ShopDoorScreen>
  );
}

/**
 * 👀 VIEW SHOP — the shop as couples see it, risen full screen INSIDE the app (Shop tab map: "the public shop full screen
 * (no new tab)"; v119 `pageRise`: the page, with "Open in browser ↗" at the head). The page is the shop's own public
 * address, framed same-origin (`X-Frame-Options: SAMEORIGIN`, next.config.ts) — so it is exactly what couples get, never
 * a redrawn copy. Before the page is approved for couples it is the team preview, and the line says so.
 */
function ViewShopScreen({ path, live, shareUrl, onClose }: { path: string; live: boolean; shareUrl: string | null; onClose: () => void }) {
  const where = shareUrl ? shareUrl.replace(/^https?:\/\/(www\.)?/, '') : path;
  // ↩ The page carries "came from Shop" (its Back reads Back → Shop, in a new tab too), and inside this frame its Back
  // closes the frame — the supplier is on Shop as they left it (owner 21 Nov: "back should go back to their last screen
  // before they viewed it"). 🔒 lib/back-from-view-shop-returns-to-shop.test.ts
  const src = viewShopSrc(path);
  const frame = useRef<HTMLIFrameElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onBack = () => close.current();
    el.addEventListener(VIEW_SHOP_CLOSE, onBack);
    return () => el.removeEventListener(VIEW_SHOP_CLOSE, onBack);
  }, []);
  return (
    <ShopDoorScreen
      title="Your page"
      line={`${where} · ${live ? 'as couples see it' : 'a preview for your team'}`}
      actions={
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 bg-raised px-3 text-[13px] font-medium text-ink" data-view-shop-browser="">
          Open in browser
          <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      }
      fill
      onClose={onClose}
      data="shop-view"
    >
      <iframe ref={frame} src={src} title={live ? 'Your shop, as couples see it' : 'Your shop, a preview for your team'} className="min-h-0 w-full flex-1 border-0 bg-cream" data-view-shop-frame="" />
    </ShopDoorScreen>
  );
}
