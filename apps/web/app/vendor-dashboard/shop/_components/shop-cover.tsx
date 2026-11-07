'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronRight, Copy, ExternalLink, Image as ImageIcon, Pencil, Printer, QrCode, Settings, Share2, ShieldCheck, Star } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { VendorAvatar } from '@/app/_components/vendor-avatar';
import { CopyButton } from '@/app/_components/copy-button';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { useToast } from '@/app/_components/toast/toast-provider';
import type { LogoFrame } from '@/lib/open-shop-logo';
import { shareShopLink, shopPhotoCardPath } from '@/lib/share-shop-link';
import { ShopSettings } from './shop-settings';

/**
 * 🏪 SHOP'S COVER + PINNED ROW (THE ONE BUILD A3 W1–W6, lane C4; v113 `V.shop`).
 *
 *   cover band — the cover photo (Your page's pick, else the first portfolio photo — the page's own rule) · the logo
 *   (tap → its viewer) · where · the name · "✓ Verified" (or the shipped "Get verified · N of 2") · ★ · events · the plan
 *   pill · View shop ↗ · Share · Promote · QR · ⚙.
 *   pinned row — "Shop · ★ 4.8 · 120 events · View shop ↗ · ⚙", fading in over the last 48 px as the cover leaves.
 *
 * 🔑 Every sheet is the SHIPPED body, opened by the URL (`?sheet=promote|qr`, `?view=logo|cover`) so the page streams
 * it only when it is opened — the Shop ⚙'s own pattern (`?gear=1`). Share is browser-only (copy · photo card · the
 * phone's share sheet) and needs no read.
 *
 * ⚙ ONE settings door: `ShopSettings` (the shipped `MenuSettingsButton` sheet) sits on the pinned row; the cover's ⚙
 * opens the SAME sheet through the URL — never a second sheet.
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
  /** "★ 4.8 · 120 events" pieces — null = unread ("—", never 0). */
  rating: string | null;
  events: string | null;
  planLabel: string;
  /** The public page — opened in a new tab; null before the shop has an address. */
  publicPath: string | null;
  /** Couples can see the page (admin-approved). Before that, View shop opens the team preview. */
  websiteLive: boolean;
  slug: string | null;
  /** The full URL to copy and share. */
  shareUrl: string | null;
};

function useParamSheet(key: string, value: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get(key) === value;
  const set = (next: boolean) => {
    const q = new URLSearchParams(params.toString());
    if (next) q.set(key, value);
    else q.delete(key);
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };
  return [open, set] as const;
}

/** A sheet whose body the SERVER draws while the URL names it (null = still on its way). */
function ParamSheet({ param, value, title, body, data }: { param: string; value: string; title: string; body: ReactNode | null; data: string }) {
  const [open, set] = useParamSheet(param, value);
  const hid = useId();
  if (!open) return null;
  return (
    <Sheet open onClose={() => set(false)} labelledById={hid} title={title} rise>
      <div className="px-4 pb-6 pt-1" data-shop-sheet={data}>
        <h2 id={hid} className="sr-only">
          {title}
        </h2>
        {body ?? (
          <p role="status" className="py-4 text-[13.5px] text-ink/60">
            Opening…
          </p>
        )}
      </div>
    </Sheet>
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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const coverRef = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

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

  const go = (key: string, value: string) => {
    const q = new URLSearchParams(params.toString());
    q.set(key, value);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const counts = [d.rating ? `★ ${d.rating}` : null, d.events].filter(Boolean).join(' · ') || '—';

  return (
    <>
      {/* 📌 THE PINNED ROW — one row, 44 px, a soft hairline; sticky, fading in as the cover leaves. */}
      <div className="sticky top-0 z-[6] -mb-11 h-11" aria-hidden={pin < 0.5 ? true : undefined} data-shop-pin="shop" data-pinned-row="">
        <div
          className="flex h-11 items-center gap-2 px-4"
          style={{ opacity: pin, pointerEvents: pin < 0.5 ? 'none' : undefined, background: 'var(--sn-canvas)', boxShadow: pin > 0.5 ? '0 1px 0 color-mix(in srgb, var(--m-ink) 8%, transparent)' : undefined }}
        >
          <b className="text-[17px] font-semibold text-ink">Shop</b>
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink/60">{counts}</span>
          {d.publicPath ? (
            <a href={d.publicPath} target="_blank" rel="noreferrer" tabIndex={pin < 0.5 ? -1 : undefined} className="inline-flex h-9 items-center gap-1 rounded-full bg-ink px-3 text-[13px] font-semibold text-[color:var(--m-paper)]">
              View shop
              <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          ) : null}
          <ShopSettings body={gearBody} />
        </div>
      </div>

      <div ref={coverRef} className="relative overflow-hidden rounded-b-[28px] text-white" data-shop-cover="" style={{ background: '#3b3026' }}>
        {d.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a presigned display URL; next/image cannot optimise it
          <img src={d.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,14,8,.15) 0%, rgba(20,14,8,.35) 45%, rgba(20,14,8,.82) 100%)' }} aria-hidden />
        <div className="relative px-4 pb-5 pt-4">
          <div className="flex items-start justify-between">
            <button type="button" onClick={() => go('view', 'logo')} className="relative rounded-full" aria-label="Your logo — view or change" data-shop-logo="">
              <VendorAvatar
                logoUrl={d.logoUrl}
                frame={d.logoFrame}
                initials={d.initials}
                className="flex h-[54px] w-[54px] items-center justify-center rounded-full text-lg font-semibold ring-2 ring-white/90"
              />
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-white text-ink shadow">
                <Pencil aria-hidden className="h-3 w-3" strokeWidth={2} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => go('view', 'cover')}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-[12.5px] font-medium backdrop-blur"
              data-shop-cover-edit=""
            >
              <ImageIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Cover
            </button>
          </div>
          {d.logoUnavailable ? <p className="mt-1 text-[12px] text-white/80">Couldn&rsquo;t load your logo just now.</p> : null}

          {d.city ? <p className="mt-3 text-[11.5px] font-medium uppercase tracking-[0.18em] text-white/80">{d.city}</p> : <div className="mt-3" />}
          <h1 className="font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.08]" data-shop-name="">
            {d.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-white/90">
            {d.verified.isVerified ? (
              <a href="#docs" className="inline-flex items-center gap-1">
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
            <span aria-hidden>·</span>
            <Star aria-hidden className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
            <span>{counts.replace(/^★ /, '')}</span>
          </p>
          <a href="#plan" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-[13px] backdrop-blur" data-shop-plan="">
            <b className="font-semibold">{d.planLabel} plan</b>
            <span className="text-white/80">· what it includes</span>
            <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </a>

          <div className="mt-4 flex items-stretch gap-2">
            {d.publicPath ? (
              <a
                href={d.publicPath}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[58px] flex-1 flex-col justify-center rounded-2xl bg-[color:var(--m-paper)] px-4 text-ink"
                data-view-shop=""
              >
                <b className="text-[15px] font-semibold">View shop</b>
                <span className="inline-flex items-center gap-1 text-[11.5px] text-ink/60">
                  {d.websiteLive ? 'as couples see it' : 'a preview for your team'}
                  <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={2} />
                </span>
              </a>
            ) : (
              <Link href="/vendor-dashboard/profile" className="flex min-h-[58px] flex-1 items-center rounded-2xl bg-[color:var(--m-paper)] px-4 text-[13.5px] font-medium text-ink">
                Add your shop name to get your address
              </Link>
            )}
            <CoverIcon label="Share" icon={<Share2 aria-hidden className="h-5 w-5" strokeWidth={1.75} />} onClick={() => setShareOpen(true)} disabled={!d.shareUrl} data="share" />
            <CoverIcon label="Promote" icon={<Printer aria-hidden className="h-5 w-5" strokeWidth={1.75} />} onClick={() => go('sheet', 'promote')} data="promote" />
            <CoverIcon label="QR" icon={<QrCode aria-hidden className="h-5 w-5" strokeWidth={1.75} />} onClick={() => go('sheet', 'qr')} data="qr" />
            <button
              type="button"
              onClick={() => go('gear', '1')}
              aria-label="Shop settings"
              className="grid h-11 w-11 shrink-0 place-items-center self-center rounded-full border border-white/35 bg-white/10 backdrop-blur"
              data-shop-cover-gear=""
            >
              <Settings aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {shareOpen && d.shareUrl ? <ShareSheet url={d.shareUrl} slug={d.slug} name={d.name} onClose={() => setShareOpen(false)} /> : null}
      <ParamSheet param="sheet" value="promote" title="Promote" body={promoteBody} data="promote" />
      <ParamSheet param="sheet" value="qr" title="QR · scan or tap" body={qrBody} data="qr" />
      <ParamSheet param="view" value="logo" title="Logo" body={logoBody} data="logo" />
      <ParamSheet param="view" value="cover" title="Cover photo" body={coverBody} data="cover" />
    </>
  );
}

function CoverIcon({ label, icon, onClick, disabled = false, data }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; data: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[58px] w-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/30 bg-white/10 text-[11px] backdrop-blur disabled:opacity-40"
      data-shop-cover-icon={data}
    >
      {icon}
      {label}
    </button>
  );
}

/** 🔗 Share (v96): Copy your link · Photo card · the phone's share sheet. Nothing to read — browser-only. */
function ShareSheet({ url, slug, name, onClose }: { url: string; slug: string | null; name: string; onClose: () => void }) {
  const hid = useId();
  const toast = useToast();
  return (
    <Sheet open onClose={onClose} labelledById={hid} title="Share your shop" rise>
      <div className="divide-y divide-ink/10 px-4 pb-6" data-shop-sheet="share">
        <h2 id={hid} className="sr-only">
          Share your shop
        </h2>
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
            <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Share
          </button>
        </div>
      </div>
    </Sheet>
  );
}
