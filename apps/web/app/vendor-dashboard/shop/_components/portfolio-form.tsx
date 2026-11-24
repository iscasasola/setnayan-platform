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
import { Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { FileUpload } from '@/app/_components/file-upload';
import type { useToast } from '@/app/_components/toast/toast-provider';
import { updateVendorProfileField } from '../../actions';
import {
  PORTFOLIO_RULE,
  portfolioAdded,
  portfolioCounter,
  portfolioSaveLabel,
  portfolioSavedText,
} from '@/lib/shop-portfolio-credits';

/**
 * 📸 THE PORTFOLIO — NO COUNT, NO PRICE (owner 2026-11-23, *"Yes, drop it"*: the 50-photo cap is dropped and storage is
 * the only limit). The counter says how many photos are on the page and "No limit"; the save is `shop_portfolio_commit`,
 * which writes the list and charges nothing. `/api/upload` refuses a file the plan's storage cannot hold, with the way up.
 * (The free room, the bar and the shop-wallet lines left with the cap — owner 2026-10-23's option A is retired.)
 */
export function PortfolioForm({
  vendorProfileId,
  storedRefs,
  displayMap,
  labPicked,
  toast,
  addOnly = false,
  pickedFiles = null,
  onSaved,
}: {
  vendorProfileId: string;
  storedRefs: string[];
  displayMap: Record<string, string>;
  /** Retired 2026-11-23 with the portfolio cap — not read. Kept optional so a caller still passing them compiles. */
  free?: number;
  /** Retired 2026-11-23 — not read. */
  allowanceUnread?: boolean;
  /** Retired 2026-11-23 — the portfolio no longer spends the shop wallet; not read. */
  walletBalance?: number | null;
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
  const dirty = refs.length !== storedRefs.length || refs.some((r, i) => r !== storedRefs[i]);
  // The save's own moment reads the list as it was pressed — never re-fired by a later edit.
  const savedRef = useRef({ refs, storedRefs, onSaved });
  savedRef.current = { refs, storedRefs, onSaved };

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      const p = state.portfolio;
      toast.success(portfolioSavedText(p?.added ?? 0));
      const cur = savedRef.current;
      cur.onSaved?.(cur.refs.filter((r) => !cur.storedRefs.includes(r)));
    } else {
      toast.error(state.error);
    }
  }, [state, toast]);

  const counter = portfolioCounter(new Set(refs.filter(Boolean)).size);
  const saveLabel = portfolioSaveLabel(portfolioAdded(storedRefs, refs));

  return (
    <section className="border-t pt-4" style={{ borderColor: 'var(--m-line)' }} data-portfolio-credits="">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <InfoTip label="Portfolio photos" labelAs="h3" labelClassName="text-sm font-medium" align="start">
          {PORTFOLIO_RULE}
        </InfoTip>
        <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          5 MB each
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2 text-sm" data-portfolio-counter="open">
        <b className="font-semibold" style={{ color: 'var(--m-ink)' }}>{counter.left}</b>
        <span style={{ color: 'var(--m-slate-3)' }}>{counter.right}</span>
      </div>

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
          // 🔓 No count (owner 2026-11-23) — the plan's storage is the only limit, checked by /api/upload per file.
          maxFiles={Infinity}
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
          <ActionButton tone="brand" main disabled icon={Check} label="Save" className="w-full !h-11" />
        ) : (
          <SupplierSubmit
            tone="brand"
            main
            icon={<Check aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
            label={saveLabel}
            pendingLabel="Saving…"
            className="w-full"
          />
        )}
      </form>
    </section>
  );
}
