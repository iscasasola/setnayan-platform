'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Camera, Check, ChevronRight, ExternalLink, Image as ImageIcon, Plus, Printer, QrCode, Settings, ShieldCheck, Star, Share } from 'lucide-react';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { PinWord } from '@/app/_components/pinned-row/pin-door';
import { VendorAvatar } from '@/app/_components/vendor-avatar';
import { CopyButton } from '@/app/_components/copy-button';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { useToast } from '@/app/_components/toast/toast-provider';
import type { LogoFrame } from '@/lib/open-shop-logo';
import { shareShopLink, shopPhotoCardPath } from '@/lib/share-shop-link';
import { ShopSettings } from './shop-settings';
import { HERO_UPLOAD_PILL, SupplierHero, type SupplierHeroPicture } from '../../_components/supplier-hero';
import { PortfolioUploadDoor } from '../../_components/portfolio-upload';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import { YOUR_PAGE_HREF } from './shop-gear-sections';

/** The cover's "★ · N reviews" — Your page › Reviews and stories (its `Fold anchor="reviews"` opens on the hash). */
const REVIEWS_HREF = `${YOUR_PAGE_HREF}#reviews`;

/**
 * 🏪 SHOP'S COVER + PINNED ROW (THE ONE BUILD A3 W1–W6, lane C4; v113 `V.shop`).
 *
 *   cover band — the cover photo (Your page's pick, else the first portfolio photo — the page's own rule) · the logo
 *   (tap → its viewer) · where · the name · "✓ Verified" (or the shipped "Get verified · N of 2") · ★ · events · the plan
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
  verified: { isVerified: boolean; inReview: boolean; stepsDone: number };
  /** "★ 4.8 · 120 events" pieces — null = the read was refused: the events piece says `EVENTS_UNREAD`, never "—" or 0. */
  rating: string | null;
  /** "38 reviews" — the trusted-review count beside the ★ (null = unread or none); with `rating` it is the link into
   *  Your page › Reviews and stories (Build 2 §10 #31). */
  reviews?: string | null;
  events: string | null;
  planLabel: string;
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
};

/**
 * Write one address param WITHOUT a request: `history.replaceState` with a fresh state (`null`), so Next.js copies its
 * own history state and keeps `useSearchParams` in step (a restore, never a fetch) — the cover's ⚙ opens the pinned
 * row's `ShopSettings` this way. `value === null` removes it. The hash is dropped, as the old `router.replace` did.
 */

/** The events count when its read was refused (house honest-read rule, `reads-are-honest.test.ts`): said, never "—" or 0
    — a "—" beside "Verified — Pro plan" read as part of that line (owner 2026-11-10). */
const EVENTS_UNREAD = 'Couldn’t load events';
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

/** The cover's four sheets and the address param that names each (a deep link, a reload, a save coming back). */
type CoverSheet = 'promote' | 'qr' | 'logo' | 'cover';
const SHEET_ADDRESS: Readonly<Record<CoverSheet, readonly [param: string, value: string]>> = {
  promote: ['sheet', 'promote'],
  qr: ['sheet', 'qr'],
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
    <RiseScreen title={title} onClose={onClose} data={`shop-${data}`}>
      <div className="px-4 pb-6 pt-3" data-shop-sheet={data}>
        {body ?? (
          <p role="status" className="py-4 text-[13.5px] text-ink/60">
            Opening…
          </p>
        )}
      </div>
    </RiseScreen>
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
  promoteBody: ReactNode | null;
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
  };
  // ⚙ The pinned row's `ShopSettings` owns the ONE settings sheet; the cover opens it through its address.
  const openGear = () => replaceAddressParam('gear', '1');
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
              className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-[rgba(20,18,14,.35)] backdrop-blur"
              data-shop-cover-gear=""
            >
              <Settings aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
          }
          title={d.name}
          titleData="shop-name"
          sub={
            <>
              {d.verified.isVerified ? (
                <a href="#docs" className="inline-flex items-center gap-1 font-semibold">
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Verified
                </a>
              ) : d.verified.inReview ? (
                <a href="#docs">Verification in review</a>
              ) : (
                <a href="#docs" className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                  <ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Get verified · {d.verified.stepsDone} of 2
                </a>
              )}
              {/* ⭐ "★ 4.8 · 38 reviews" opens Your page › Reviews and stories — the full reviews list, unchanged (§10 #31). */}
              {d.rating ? (
                <Link href={REVIEWS_HREF} className="inline-flex items-center gap-1 underline decoration-white/45 underline-offset-[3px]" data-shop-reviews-link="">
                  <Star aria-hidden className="h-3 w-3 fill-current" strokeWidth={0} />
                  {d.rating}
                  {d.reviews ? ` · ${d.reviews}` : ''}
                </Link>
              ) : null}
              <span className="text-white/75" data-shop-events={d.events == null ? 'unread' : ''}>{d.events ?? EVENTS_UNREAD}</span>
              <a href="#plan" className="inline-flex items-center gap-0.5 text-white/75" data-shop-plan="">
                {d.planLabel} plan
                <ChevronRight aria-hidden className="h-3 w-3" strokeWidth={2} />
              </a>
            </>
          }
          picture={d.hero ?? (d.coverUrl ? { url: d.coverUrl, kind: 'photo' } : null)}
          caption={d.heroCaption ?? null}
          upload={
            d.uploadFacts
              ? {
                  door: (
                    <PortfolioUploadDoor facts={d.uploadFacts} coverPick className={HERO_UPLOAD_PILL} data="supplier-hero-upload">
                      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                      Upload
                    </PortfolioUploadDoor>
                  ),
                }
              : null
          }
          data={{ 'shop-hero': '' }}
        />
      </div>
      {d.logoUnavailable ? <p className="px-4 pt-2 text-[12px] text-ink/65">Couldn&rsquo;t load your logo just now.</p> : null}

      {/* 🚪 The cover's doors, under the hero (they rode on the old cover band): the logo · View shop ↗ · Share · Promote ·
          QR · Cover. Nothing was dropped when the band became the one hero. */}
      <div className="space-y-2 px-4 pt-3" data-shop-cover-doors="">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openSheet('logo')} className="relative shrink-0 rounded-full" aria-label="Your logo — view or change" data-shop-logo="">
            <VendorAvatar
              logoUrl={d.logoUrl}
              frame={d.logoFrame}
              initials={d.initials}
              className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ring-1 ring-ink/10"
            />
            <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-raised text-ink shadow">
              <Camera aria-hidden className="h-3 w-3" strokeWidth={2} />
            </span>
          </button>
          {d.publicPath ? (
            <button
              type="button"
              onClick={() => setViewOpen(true)}
              className="flex min-h-[48px] min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-ink px-4 text-left text-[color:var(--m-paper)]"
              data-view-shop=""
            >
              <b className="text-[14.5px] font-semibold">View shop</b>
              <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11.5px] opacity-75">
                {d.websiteLive ? 'as couples see it' : 'a preview for your team'}
                <ExternalLink aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2} />
              </span>
            </button>
          ) : (
            <Link href="/vendor-dashboard/profile" className="flex min-h-[48px] min-w-0 flex-1 items-center rounded-full border border-ink/15 px-4 text-[13.5px] font-medium text-ink">
              Add your shop name to get your address
            </Link>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <CoverIcon label="Share" icon={<Share aria-hidden className="h-4 w-4" strokeWidth={1.9} />} onClick={() => setShareOpen(true)} disabled={!d.shareUrl} data="share" />
          <CoverIcon label="Promote" icon={<Printer aria-hidden className="h-4 w-4" strokeWidth={1.9} />} onClick={() => openSheet('promote')} data="promote" />
          <CoverIcon label="QR" icon={<QrCode aria-hidden className="h-4 w-4" strokeWidth={1.9} />} onClick={() => openSheet('qr')} data="qr" />
          <button type="button" onClick={() => openSheet('cover')} className={COVER_PILL} data-shop-cover-edit="">
            <ImageIcon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            Cover
          </button>
        </div>
      </div>

      {shareOpen && d.shareUrl ? <ShareSheet url={d.shareUrl} slug={d.slug} name={d.name} onClose={() => setShareOpen(false)} /> : null}
      {viewOpen && d.publicPath ? <ViewShopScreen path={d.publicPath} live={d.websiteLive} shareUrl={d.shareUrl} onClose={() => setViewOpen(false)} /> : null}
      <ParamSheet open={sheet === 'promote'} onClose={() => closeSheet('promote')} title="Promote" body={promoteBody} data="promote" />
      <ParamSheet open={sheet === 'qr'} onClose={() => closeSheet('qr')} title="QR · scan or tap" body={qrBody} data="qr" />
      <ParamSheet open={sheet === 'logo'} onClose={() => closeSheet('logo')} title="Logo" body={logoBody} data="logo" />
      <ParamSheet open={sheet === 'cover'} onClose={() => closeSheet('cover')} title="Cover photo" body={coverBody} data="cover" />
    </>
  );
}

/** The cover's equal-weight doors: one row, equal widths, a 40 px pill with an icon and a word (the house rule). */
const COVER_PILL =
  'inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-raised px-2 text-[13px] font-medium text-ink disabled:opacity-40';

function CoverIcon({ label, icon, onClick, disabled = false, data }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; data: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={COVER_PILL} data-shop-cover-icon={data}>
      {icon}
      {label}
    </button>
  );
}

/** 🔗 Share (v96): Copy your link · Photo card · the phone's share sheet. Nothing to read — browser-only. */
function ShareSheet({ url, slug, name, onClose }: { url: string; slug: string | null; name: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <RiseScreen title="Share your shop" onClose={onClose} data="shop-share">
      <div className="divide-y divide-ink/10 px-4 pb-6" data-shop-sheet="share">
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="min-w-0">
            <b className="block text-[14.5px] font-medium text-ink">Copy your link</b>
            <span className="block truncate text-[12.5px] text-ink/60">{url.replace(/^https?:\/\//, '')}</span>
          </span>
          <CopyButton value={url} label="Copy" copiedLabel="Copied" className="inline-flex h-9 items-center gap-1 rounded-full bg-ink/[0.06] px-3 text-[13px] font-medium text-ink" />
        </div>
        {slug ? (
          <div className="flex items-center justify-between gap-3 py-3">
            <span>
              <b className="block text-[14.5px] font-medium text-ink">Photo card</b>
              <span className="block text-[12.5px] text-ink/60">A ready image for Facebook and Instagram</span>
            </span>
            <SaveFileLink href={shopPhotoCardPath(slug)} filename={`${slug}-card.png`} className="inline-flex h-9 items-center rounded-full bg-ink/[0.06] px-3 text-[13px] font-medium text-ink">
              {(s) => (s === 'saving' ? 'Saving…' : 'Save')}
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
            className="inline-flex h-9 items-center gap-1 rounded-full bg-ink/[0.06] px-3 text-[13px] font-medium text-ink"
            onClick={async () => {
              const r = await shareShopLink(url, name);
              if (r === 'copied') toast.success('Link copied.');
              else if (r === 'failed') toast.error('Couldn’t share just now — copy the link instead.');
            }}
          >
            <Share aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Share
          </button>
        </div>
      </div>
    </RiseScreen>
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
  return (
    <RiseScreen
      title="Your page"
      line={`${where} · ${live ? 'as couples see it' : 'a preview for your team'}`}
      actions={
        <a href={path} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-full border border-ink/15 bg-raised px-3 text-[13px] font-medium text-ink" data-view-shop-browser="">
          Open in browser
          <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      }
      fill
      onClose={onClose}
      data="shop-view"
    >
      <iframe src={path} title={live ? 'Your shop, as couples see it' : 'Your shop, a preview for your team'} className="min-h-0 w-full flex-1 border-0 bg-cream" data-view-shop-frame="" />
    </RiseScreen>
  );
}
