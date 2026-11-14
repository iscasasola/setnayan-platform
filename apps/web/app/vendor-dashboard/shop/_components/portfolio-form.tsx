'use client';

/**
 * portfolio-form.tsx — the Portfolio's uploader, MOVED, NOT REWRITTEN, out of `gallery-media.tsx` (Supplier Build 3
 * integration, 9 Nov 2026). Portfolio's "Add photos" still draws it (`GalleryMedia` imports it from here, unchanged),
 * and the Upload doors (`app/vendor-dashboard/_components/portfolio-upload.tsx`) draw it straight from here.
 *
 * 📦 WHY ITS OWN FILE. A door that imported `gallery-media.tsx` carried everything ELSE that file imports — the
 * Instagram card (and with it `next/image`), the video links editor — none of which the uploader draws. Imported from
 * here, a door carries only the uploader (#7416 measured the alternatives against the 202.3 KB shared-bundle lock).
 */
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { FileUpload } from '@/app/_components/file-upload';
import type { useToast } from '@/app/_components/toast/toast-provider';
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

/**
 * 💳 THE PORTFOLIO — THE FREE ROOM, THEN THE SHOP WALLET (owner 2026-10-23, option A; frames port-48 · port-50 ·
 * port-spend · port-saved · F1 · F3). The counter and bar say how much of the free room is used; the line names the
 * price and the wallet (a door to its one home on Money); the Save button carries the exact charge BEFORE the tap.
 * The number on the button is a quote (`lib/shop-portfolio-credits.ts`, the SQL's formula); the save itself is
 * `shop_portfolio_commit`, which charges under the wallet's lock and refuses — writing nothing — what the wallet
 * cannot cover. An unread wallet pays for nothing: only the free room can be saved, and the page says so.
 */
export function PortfolioForm({
  vendorProfileId,
  storedRefs,
  displayMap,
  free,
  allowanceUnread,
  walletBalance,
  labPicked,
  toast,
  addOnly = false,
  pickedFiles = null,
  onSaved,
}: {
  vendorProfileId: string;
  storedRefs: string[];
  displayMap: Record<string, string>;
  free: number;
  allowanceUnread: boolean;
  walletBalance: number | null;
  labPicked?: string[];
  toast: ReturnType<typeof useToast>;
  /**
   * 📂 The Upload doors' sheet (Today's and Shop's heroes, Shop › Cover photo — `_components/portfolio-upload.tsx`):
   * only the NEW photos are drawn; the stored ones ride as hidden refs before them, so the save is the same
   * replace-the-list `portfolio` write, priced the same. Default false: Portfolio's page exactly as it was.
   */
  addOnly?: boolean;
  /** What the door's picker chose — handed to the one `FileUpload` (`pickedFiles`). */
  pickedFiles?: readonly File[] | null;
  /** After a save that went through, the refs it ADDED (the Cover menu pre-picks the first as the cover). */
  onSaved?: (added: string[]) => void;
}) {
  const [state, formAction] = useActionState(updateVendorProfileField, null);
  const initial = useMemo(() => [...storedRefs, ...(labPicked ?? [])], [storedRefs, labPicked]);
  const [refs, setRefs] = useState<string[]>(initial);
  const [short, setShort] = useState<string | null>(null);
  const dirty = refs.length !== storedRefs.length || refs.some((r, i) => r !== storedRefs[i]);
  // The save's own moment reads the list as it was pressed — never re-fired by a later edit.
  const savedRef = useRef({ refs, storedRefs, onSaved });
  savedRef.current = { refs, storedRefs, onSaved };

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      const p = state.portfolio;
      toast.success(p ? portfolioSavedText(p.added, p.charged, p.balance) : 'Portfolio saved.');
      setShort(null);
      const cur = savedRef.current;
      cur.onSaved?.(cur.refs.filter((r) => !cur.storedRefs.includes(r)));
    } else {
      toast.error(state.error);
      setShort(state.walletShort ? state.error : null);
    }
  }, [state, toast]);

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
        <p className="mt-2 text-sm font-medium" style={{ color: 'rgb(var(--color-warn))' }} role="status" data-portfolio-wallet="unread">
          Your shop wallet couldn&rsquo;t be read, so only free photos can be saved right now.{' '}
          <button type="button" onClick={() => window.location.reload()} className="underline" style={{ color: 'var(--m-ink)' }}>
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
        {addOnly ? initial.map((r) => <input key={r} type="hidden" name="portfolio_r2_keys" value={r} />) : null}
        <FileUpload
          bucket="media"
          pathPrefix={`vendors/${vendorProfileId}/portfolio`}
          name="portfolio_r2_keys"
          unsavedHint="press Save below"
          currentValue={addOnly ? [] : initial}
          initialDisplayUrls={addOnly ? {} : displayMap}
          multiple
          pickedFiles={pickedFiles}
          onChange={(v) => {
            const picked = Array.isArray(v) ? v : v ? [v] : [];
            setRefs(addOnly ? [...initial, ...picked] : picked);
          }}
          // Everything on the page, the free room still open, and what the wallet can pay for (unread → free only).
          maxFiles={portfolioMaxFiles(storedRefs.length, free, walletBalance) - (addOnly ? initial.length : 0)}
          limitMessage={
            walletBalance == null
              ? 'Your shop wallet couldn’t be read — only free photos can be added right now.'
              : `That’s all your shop wallet covers (${n(walletBalance)} credits). Buy a pack on Money to add more.`
          }
          maxSizeMB={5}
          // 🗜 Uploads compress in the browser (owner rule 2026-09-25; THE ONE BUILD A3 W16) — after the watermark,
          // inside FileUpload's own order (`file-upload-compress-first.test.ts`).
          compressImage
          acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
          variant="wide"
          mark="supplier"
          frame="square"
          previews="portfolio"
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
