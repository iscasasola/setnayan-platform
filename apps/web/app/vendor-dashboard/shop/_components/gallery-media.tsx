'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Images, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { FileUpload } from '@/app/_components/file-upload';
import { useToast } from '@/app/_components/toast/toast-provider';
import { InstagramConnectCard } from '@/app/vendor-dashboard/_components/instagram-connect-card';
import { VideoLinksEditor } from '@/app/vendor-dashboard/_components/video-links-editor';
import type { VendorIgConnectionStatus, VendorIgMediaRow } from '@/lib/vendor-instagram-status';
import { updateVendorProfileField } from '../../actions';
import { PORTFOLIO_ALLOWANCE_UNREAD } from '@/lib/vendor-tier-caps';
import { SHOP_WALLET_HREF } from '@/lib/shop-wallet';
import {
  portfolioCounter,
  portfolioMaxFiles,
  portfolioQuote,
  portfolioSaveLabel,
  portfolioSavedText,
} from '@/lib/shop-portfolio-credits';
import { CouldNotLoad } from './could-not-load';

/*
 * GALLERY & MEDIA — MOVED, NOT REWRITTEN, out of `website-editor.tsx` (simpler supplier dashboard step 5,
 * 2026-10-14). The website editor's curation controls became Your page's parts (`website/_components/page-parts.tsx`,
 * a draft and one Apply); the three media editors — portfolio photos, featured videos, Instagram — are what a
 * supplier ADDS, so they are Your collections' "Add photos" (`#gallery-media`, the Instagram callback's landing).
 * Each keeps its own Save: an upload is storing a photo, not publishing the page — whether the gallery shows is the
 * page's Photos switch.
 */
/* ─── Gallery & media (ALL TIERS) ───────────────────────────────────────────
 * The three editors relocated from the retired /vendor-dashboard/profile page
 * (2026-07-05): portfolio photos, featured videos, and Instagram. Every vendor
 * (Free included) can curate their gallery — these are NOT tier-gated.
 *
 * Portfolio + videos persist via the single-field `updateVendorProfileField`
 * action (the SAME parse/tier-cap/QR-guard/repost-hash the retired full form
 * used), each with an inline Save button that appears when the field is dirty
 * (matches the About/address save pattern in this editor). Instagram keeps its
 * own OAuth connect/callback/sync routes UNCHANGED. */
export function GalleryMedia({
  vendorProfileId,
  portfolioRefs,
  portfolioDisplayMap,
  portfolioMax,
  portfolioAllowanceUnread = false,
  walletBalance = null,
  labPicked,
  galleryVideoLinks,
  igConfigured,
  igConnection,
  igUnavailable,
  igMedia,
  igFlash,
}: {
  vendorProfileId: string;
  portfolioRefs: string[];
  portfolioDisplayMap: Record<string, string>;
  portfolioMax: number;
  /** The shop's own allowance could not be read: say so — never "first 50 free" in its place. */
  portfolioAllowanceUnread?: boolean;
  /** 💳 The shop wallet the portfolio spends past its free room (owner 2026-10-23). `null` = unread — never 0. */
  walletBalance?: number | null;
  /** Dev lab only: refs already picked but not saved (frame port-spend). Production never passes it. */
  labPicked?: string[];
  galleryVideoLinks: string[];
  igConfigured: boolean;
  igConnection: VendorIgConnectionStatus | null;
  /* `connection: null` is ALSO what "never connected" looks like, so the card
     cannot tell the two apart on its own. */
  igUnavailable?: boolean;
  igMedia: VendorIgMediaRow[];
  igFlash: { kind: 'ok' | 'error'; message: string } | null;
}) {
  const toast = useToast();

  return (
    <section
      className="space-y-5"
    >
      <div className="flex items-center gap-1.5">
        <Images
          className="h-4 w-4"
          strokeWidth={1.75}
          aria-hidden
          style={{ color: 'var(--m-orange-2)' }}
        />
        <h3 className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          Portfolio &amp; media
        </h3>
      </div>

      {/* Portfolio photos — same <FileUpload> the retired /profile page used (multiple · watermark · qrGuard), now
          priced: the free room, then the shop wallet (owner 2026-10-23, prototype shop_wallet_portfolio_credits). */}
      <PortfolioForm
        vendorProfileId={vendorProfileId}
        storedRefs={portfolioRefs}
        displayMap={portfolioDisplayMap}
        free={portfolioMax}
        allowanceUnread={portfolioAllowanceUnread}
        walletBalance={walletBalance}
        labPicked={labPicked}
        toast={toast}
      />

      {/* Featured videos — same <VideoLinksEditor> (all tiers · gallery_video_links).
          Paste YouTube/Vimeo (inline players) or Instagram/Facebook/TikTok (link-out). */}
      <GalleryForm
        field="gallery_videos"
        toast={toast}
        successToast="Videos saved."
        title="Featured videos"
        hint="YouTube, Vimeo, Instagram, Facebook or TikTok"
      >
        <VideoLinksEditor name="gallery_video_links" initial={galleryVideoLinks} />
      </GalleryForm>

      {/* Instagram — same card + OAuth flow (unchanged routes under
          /api/vendor/instagram/**). Inert ("Coming soon") until the Meta App
          env is set. Synced posts flow into the SAME unified public gallery. */}
      <div className="border-t pt-4" style={{ borderColor: 'var(--m-line)' }}>
        {igUnavailable ? <CouldNotLoad what="your Instagram connection" /> : null}
        <InstagramConnectCard
          configured={igConfigured}
          connection={igConnection}
          media={igMedia}
          flash={igFlash}
        />
      </div>
    </section>
  );
}

/**
 * 💳 THE PORTFOLIO — THE FREE ROOM, THEN THE SHOP WALLET (owner 2026-10-23, option A; frames port-48 · port-50 ·
 * port-spend · port-saved · F1 · F3). The counter and bar say how much of the free room is used; the line names the
 * price and the wallet (a door to its one home on Money); the Save button carries the exact charge BEFORE the tap.
 * The number on the button is a quote (`lib/shop-portfolio-credits.ts`, the SQL's formula); the save itself is
 * `shop_portfolio_commit`, which charges under the wallet's lock and refuses — writing nothing — what the wallet
 * cannot cover. An unread wallet pays for nothing: only the free room can be saved, and the page says so.
 */
function PortfolioForm({
  vendorProfileId,
  storedRefs,
  displayMap,
  free,
  allowanceUnread,
  walletBalance,
  labPicked,
  toast,
}: {
  vendorProfileId: string;
  storedRefs: string[];
  displayMap: Record<string, string>;
  free: number;
  allowanceUnread: boolean;
  walletBalance: number | null;
  labPicked?: string[];
  toast: ReturnType<typeof useToast>;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateVendorProfileField, null);
  const initial = useMemo(() => [...storedRefs, ...(labPicked ?? [])], [storedRefs, labPicked]);
  const [refs, setRefs] = useState<string[]>(initial);
  const [short, setShort] = useState<string | null>(null);
  const dirty = refs.length !== storedRefs.length || refs.some((r, i) => r !== storedRefs[i]);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      const p = state.portfolio;
      toast.success(p ? portfolioSavedText(p.added, p.charged, p.balance) : 'Portfolio saved.');
      setShort(null);
      router.refresh();
    } else {
      toast.error(state.error);
      setShort(state.walletShort ? state.error : null);
    }
  }, [state, toast, router]);

  const quote = portfolioQuote(storedRefs, refs, free);
  const counter = portfolioCounter(quote, free);
  const save = portfolioSaveLabel(quote, walletBalance);
  const pct = free > 0 ? Math.min(100, Math.round((quote.freeUsed / free) * 100)) : 100;
  const n = (x: number) => x.toLocaleString('en-PH');

  return (
    <section className="border-t pt-4" style={{ borderColor: 'var(--m-line)' }} data-portfolio-credits="">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <InfoTip label="Portfolio photos" labelAs="h3" labelClassName="text-sm font-medium" align="start">
          {`The first ${n(free)} are free. After that each photo uses 1 Papic credit from your shop wallet — paid once, kept while your shop exists. Taking one off frees a free spot.`}
        </InfoTip>
        <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          5 MB each
        </span>
      </div>

      {allowanceUnread ? (
        <p className="mb-2 text-xs" style={{ color: 'var(--m-slate-3)' }} role="status">
          {PORTFOLIO_ALLOWANCE_UNREAD}
        </p>
      ) : null}

      <div className="flex items-baseline justify-between gap-2 text-sm" data-portfolio-counter={counter.full ? 'full' : 'open'}>
        <b className="font-semibold" style={{ color: 'var(--m-ink)' }}>{counter.left}</b>
        <span
          className={counter.full ? 'font-semibold' : ''}
          style={{ color: counter.full ? 'var(--m-orange-2)' : 'var(--m-slate-3)' }}
        >
          {counter.right}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--m-line)' }} aria-hidden>
        <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--m-ink)' }} />
      </div>

      {walletBalance == null ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--m-slate-3)' }} role="status" data-portfolio-wallet="unread">
          Your shop wallet couldn&rsquo;t be read, so only free photos can be saved right now.{' '}
          <button type="button" onClick={() => router.refresh()} className="underline" style={{ color: 'var(--m-ink)' }}>
            Retry
          </button>
        </p>
      ) : (
        <p className="mt-2 text-xs" style={{ color: 'var(--m-slate-3)' }} data-portfolio-wallet="read">
          Then 1 credit a photo ·{' '}
          <a href={SHOP_WALLET_HREF} className="font-semibold underline" style={{ color: 'var(--m-ink)' }}>
            Shop wallet · {n(walletBalance)}
          </a>
        </p>
      )}

      {short ? (
        <p className="mt-2 text-xs font-medium text-danger-700" role="alert" data-portfolio-short="">
          {short}
        </p>
      ) : null}

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="field" value="portfolio" />
        <FileUpload
          bucket="media"
          pathPrefix={`vendors/${vendorProfileId}/portfolio`}
          name="portfolio_r2_keys"
          unsavedHint="press Save below"
          currentValue={initial}
          initialDisplayUrls={displayMap}
          multiple
          onChange={(v) => setRefs(Array.isArray(v) ? v : v ? [v] : [])}
          // Everything on the page, the free room still open, and what the wallet can pay for (unread → free only).
          maxFiles={portfolioMaxFiles(storedRefs.length, free, walletBalance)}
          limitMessage={
            walletBalance == null
              ? 'Your shop wallet couldn’t be read — only free photos can be added right now.'
              : `That’s all your shop wallet covers (${n(walletBalance)} credits). Buy a pack on Money to add more.`
          }
          maxSizeMB={5}
          acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
          variant="wide"
          watermark
          qrGuard
          stallMs={20000}
        />
        {!dirty ? (
          <ActionButton tone="brand" main disabled icon={Check} label="Save" className="w-full" />
        ) : save.blocked && save.reason === 'short' ? (
          <ActionButton tone="brand" main href={SHOP_WALLET_HREF} icon={Wallet} label={save.label} className="w-full" />
        ) : save.blocked ? (
          <ActionButton tone="brand" main waiting icon={Check} label={save.label} className="w-full" />
        ) : (
          <SupplierSubmit
            tone="brand"
            main
            icon={<Check aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
            label={save.label}
            pendingLabel="Saving…"
            className="w-full"
          />
        )}
      </form>
    </section>
  );
}

/**
 * One relocated media editor wrapped in a save form. Uses `updateVendorProfileField`
 * (single-column patch — never nulls the other fields). Toasts the result and
 * only shows the Save button once the child inputs are dirty (tracked by
 * comparing the serialized FormData snapshot on input).
 */
function GalleryForm({
  field,
  title,
  hint,
  successToast,
  toast,
  children,
}: {
  field: 'portfolio' | 'gallery_videos';
  title: string;
  hint?: string;
  successToast: string;
  toast: ReturnType<typeof useToast>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(updateVendorProfileField, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);

  // Toast the action result. On success, the field is clean again (the server
  // is now the source of truth for what was just saved).
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(successToast);
      setDirty(false);
    } else {
      toast.error(state.error);
    }
  }, [state, successToast, toast]);

  return (
    <Row title={title} hint={hint}>
      <form
        ref={formRef}
        action={formAction}
        onInput={() => setDirty(true)}
        onChange={() => setDirty(true)}
        className="space-y-3"
      >
        <input type="hidden" name="field" value={field} />
        {children}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!dirty || pending}
            className="rounded-md px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-40"
            style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Row>
  );
}

/* ─── Flat, hairline-divided section ────────────────────────────────────── */
function Row({
  title,
  hint,
  tight,
  children,
}: {
  title: string;
  hint?: string;
  tight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={tight ? '' : 'border-t pt-4'}
      style={tight ? undefined : { borderColor: 'var(--m-line)' }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h3>
        {hint ? (
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

