'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { ArrowUpRight, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { hubProEffectLine, unlockAndApplyHref, type HubProEffectView } from '@/lib/hub-pro-effects';

/**
 * 💎 THE APPLY SHEET — Apply is where Event Hub Pro is asked for.
 *
 * Owner, 2026-09-28, verbatim: *"they can edit it with pro features. but need
 * to upgrade to pro when clicked on apply and point out the effect chosen that
 * caused them to upgrade to pro"* (DECISION_LOG "A FREE COUPLE MAY USE EVERY PRO
 * FEATURE IN THE MAKER — PRO IS ASKED FOR AT APPLY …").
 *
 * A free couple may try every Pro control in the Maker; the picks live in the
 * DRAFT. When they press Apply and the draft holds any, THIS opens instead of
 * the write, and lists each effect by what and where — "Font · Names on the
 * Hero", "Animation · Schedule", "Theme · Velvet". Each row can take the couple
 * to it, or take it off the draft. The first action is the one Event Hub Pro
 * page, at the catalogue's price (`priceLabel` — read live, never typed); the
 * second is the Apply that already shipped: everything free goes live, the Pro
 * effects stay in the draft (#6075's split).
 *
 * 🔑 NO SECOND LIST. `effects` is `HubDraftBarData.proEffects`, derived on the
 * server from the SAME plan Apply runs (`lib/hub-pro-effects.ts`).
 *
 * 📵 Never in the app-store shell: the bar passes no effects there, and no
 * price or link reaches it (App Review 3.1.1).
 *
 * No server imports — its actions come in as props, so a test can mount it.
 */
export function ApplyProSheet({
  effects,
  priceLabel,
  proHref,
  pending,
  onGo,
  onRemove,
  onApplyFree,
  onClose,
  tour = null,
}: {
  effects: readonly HubProEffectView[];
  /** `formatPhp` over the live catalogue row, or null — then no figure is shown. */
  priceLabel: string | null;
  proHref: string;
  pending: boolean;
  onGo: (effect: HubProEffectView) => void;
  onRemove: (effect: HubProEffectView) => void;
  /** The existing Apply: free changes go live, the Pro effects stay in the draft. */
  onApplyFree: () => void;
  onClose: () => void;
  /** First visit only (`customer_apply_pro_v1`) — shown while the sheet names effects. */
  tour?: ReactNode;
}) {
  const titleId = 'maker-apply-pro-title';
  const none = effects.length === 0;
  /* The house modal hook: focus moves in and is trapped, Escape closes, and
     focus goes back to Apply when the sheet shuts (`lib/use-modal-a11y.ts`). */
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: dialogRef });
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 lg:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-apply-pro-sheet=""
        aria-busy={pending}
        className="flex max-h-[80dvh] w-full flex-col rounded-t-3xl outline-none bg-cream pb-[max(env(safe-area-inset-bottom),12px)] shadow-xl lg:max-w-md lg:rounded-3xl"
      >
        <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink/15 lg:hidden" />
        <div className="flex items-center gap-2 px-4 pt-3">
          <p id={titleId} className="min-w-0 flex-1 font-serif text-lg text-ink">
            {none ? 'Ready to apply' : 'Apply needs Event Hub Pro'}
          </p>
          {none ? null : (
            <InfoTip label="" ariaLabel="About Event Hub Pro effects" align="end">
              These are in your draft. Guests see them once you unlock Event Hub Pro. Take one off, or apply
              the rest now — the Pro ones stay in your draft.
            </InfoTip>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {none ? null : tour}
        {none ? (
          <p className="px-4 py-3 text-sm text-ink/70">Nothing in your draft needs Event Hub Pro now.</p>
        ) : (
          <ul className="mt-2 flex-1 overflow-y-auto px-2" data-apply-pro-effects="">
            {effects.map((e) => (
              <li key={e.id} data-apply-pro-effect={e.id} className="flex min-h-12 items-center gap-2 rounded-2xl px-2 py-1">
                {/* Every row here is Pro — the diamond alone, no word repeated seven times. */}
                <PaidMark state="try" bare label="Event Hub Pro" size="xs" />
                <span className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold">{e.what}</span>
                  <span className="text-ink/60"> · {e.where}</span>
                </span>
                {e.jump ? (
                  <button
                    type="button"
                    onClick={() => onGo(e)}
                    aria-label={`Go to ${hubProEffectLine(e)}`}
                    className="sn-press inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-[13px] font-semibold text-ink/70 hover:bg-ink/5 hover:text-ink"
                  >
                    Go to
                    <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                ) : null}
                {e.removable ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onRemove(e)}
                    aria-label={`Remove ${hubProEffectLine(e)}`}
                    title="Remove from your draft"
                    className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink disabled:opacity-40"
                  >
                    <X aria-hidden className="h-4 w-4" strokeWidth={2} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 px-4 pt-3">
          {none ? (
            <button type="button" disabled={pending} onClick={onApplyFree} className="button-primary sn-press min-h-11 w-full">
              {pending ? 'Applying…' : 'Apply'}
            </button>
          ) : (
            <>
              {/* Owner 2026-09-28, verbatim: "Unlock Pro and Apply". The one
                  purchase page, asked to come back and finish the Apply
                  (`unlockAndApplyOnReturn`); the price is the catalogue's. */}
              <Link
                href={unlockAndApplyHref(proHref)}
                data-apply-pro-unlock=""
                className="button-primary sn-press inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-center"
              >
                Unlock Pro and Apply{priceLabel ? ` · ${priceLabel}` : ''}
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={onApplyFree}
                data-apply-pro-without=""
                className="sn-press min-h-11 w-full rounded-full text-sm font-semibold text-ink/70 hover:bg-ink/5 hover:text-ink disabled:opacity-40"
              >
                {pending ? 'Applying…' : 'Apply without the Pro effects'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
