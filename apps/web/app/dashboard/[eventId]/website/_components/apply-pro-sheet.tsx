'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { Check, ChevronDown, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import { PaidMark } from '@/app/_components/paid-mark';
import { hubProEffectLine, unlockAndApplyHref, type HubProEffectView } from '@/lib/hub-pro-effect-view';
import type { HubDraftChangeLine } from '@/lib/hub-draft';
import { formatPhp } from '@/lib/php';
import { applySheetParts, applySheetButtons, partsBuyHref, type ApplySheetPricing } from '@/lib/apply-sheet-parts';

/** How many named changes the sheet shows before "+ N more" — a short list, never a scroll. */
export const APPLY_SHEET_MAX_LINES = 8;

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
 * ✓ EVERY APPLY OPENS IT FIRST (owner 2026-10-04, *"apply icon"* — the bar's
 * Apply is now a small ✓ circle, so a mis-tap must never publish): with no Pro
 * effect it is "Ready to apply", saying how many changes are waiting, and its
 * ONE labelled Apply is the only press that puts them live.
 *
 * 📋 …AND NAMES EACH ONE (owner 2026-10-04, *"Yes"* — DECISION_LOG "… THE
 * APPLY SHEET NAMES EACH CHANGE"): under the count, up to eight plain lines
 * grouped by where each lives — "Look · Buttons", "Event Details · Ceremony
 * time" — then "+ N more". `changes` is `HubDraftSummary.changes`, the same
 * walk the count makes (`hubDraftCountedChanges`), so the lines and the number
 * cannot disagree. A Pro line keeps its ◆. Reading it writes nothing.
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
  changeCount = 0,
  changes,
  heldOnWeb = 0,
  pricing = null,
}: {
  /**
   * 💎 PART BY PART (owner 2026-10-22): each part's catalogue price, Full Pro's, and what the event holds — the sheet
   * groups the held effects under their part, prices them, and offers everything for the rest. Null (the store shell,
   * an unread catalogue) → the shipped one-unlock sheet.
   */
  pricing?: ApplySheetPricing | null;
  effects: readonly HubProEffectView[];
  /** How many changes guests do not see yet (`HubDraftSummary.changeCount`). */
  changeCount?: number;
  /** The same changes by name (`HubDraftSummary.changes`) — absent = not read, then only the count shows. */
  changes?: readonly HubDraftChangeLine[];
  /** 📵 The store shell: how many of them can be applied on the web only. */
  heldOnWeb?: number;
  /** `formatPhp` over the live catalogue row, or null — then no figure is shown. */
  priceLabel: string | null;
  /** The one Event Hub Pro page — null in the store shell (then no effects are passed either). */
  proHref: string | null;
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
  /* 💎 Part by part (owner 2026-10-22): the held effects under their part, priced; null → the one-unlock sheet. */
  const grouped = none ? null : applySheetParts(effects, pricing);
  const buttons = applySheetButtons(grouped, pricing);
  const [openPart, setOpenPart] = useState<string | null>(null);
  /* The house modal hook: focus moves in and is trapped, Escape closes, and
     focus goes back to Apply when the sheet shuts (`lib/use-modal-a11y.ts`). */
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: dialogRef });
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/30 lg:items-center"
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
            {none ? 'Ready to apply' : grouped ? `Apply needs ${grouped.parts.length === 1 ? '1 Pro part' : `${formatCount(grouped.parts.length)} Pro parts`}` : 'Apply needs Event Hub Pro'}
          </p>
          {none ? null : (
            <InfoTip label="" ariaLabel="About Event Hub Pro effects" align="end">
              {grouped
                ? 'These are in your draft. Guests see them once their part is unlocked for this event — everyone on it. Tap one to go to it, take one off, or apply the rest now; the Pro ones stay in your draft.'
                : 'These are in your draft. Guests see them once you unlock Event Hub Pro. Take one off, or apply the rest now — the Pro ones stay in your draft.'}
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm text-ink/70" data-apply-ready="">
            <p>
              {changeCount === 1 ? '1 change' : `${formatCount(changeCount)} changes`} guests do not see yet. Apply puts{' '}
              {changeCount === 1 ? 'it' : 'them'} on your Event Hub.
            </p>
            {changes && changes.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1" data-apply-changes="">
                {changes.slice(0, APPLY_SHEET_MAX_LINES).map((c, i) => (
                  <li key={`${c.place}·${c.what}·${i}`} data-apply-change="" className="flex min-w-0 items-center gap-1.5 text-ink">
                    {c.pro ? (
                      <PaidMark state={c.held ? 'try' : 'unlocked'} bare label="Event Hub Pro" size="xs" />
                    ) : (
                      <span aria-hidden className="inline-block h-1 w-1 shrink-0 rounded-full bg-ink/30" />
                    )}
                    <span className="min-w-0 truncate">
                      <span className="text-ink/60">{c.place} · </span>
                      <span className="font-semibold">{c.what}</span>
                    </span>
                  </li>
                ))}
                {changes.length > APPLY_SHEET_MAX_LINES ? (
                  <li data-apply-change-more="" className="pl-2.5 text-ink/60">
                    + {formatCount(changes.length - APPLY_SHEET_MAX_LINES)} more
                  </li>
                ) : null}
              </ul>
            ) : null}
            {heldOnWeb > 0 ? (
              <p className="mt-1">{heldOnWeb === 1 ? 'One change' : `${formatCount(heldOnWeb)} changes`} can be applied on the web.</p>
            ) : null}
          </div>
        ) : (
          grouped ? (
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2" data-apply-pro-effects="" data-apply-parts="">
              {grouped.parts.map((g) => {
                const open = !grouped.collapsed || openPart === g.part;
                return (
                  <section key={g.part} data-apply-part={g.part} className="border-t border-ink/10 first:border-t-0">
                    {/* The part's own line — its name and price. With many parts it is a press that opens its effects. */}
                    <button
                      type="button"
                      disabled={!grouped.collapsed}
                      aria-expanded={grouped.collapsed ? open : undefined}
                      onClick={() => setOpenPart(open ? null : g.part)}
                      className="flex min-h-11 w-full items-center gap-2 rounded-2xl px-2 text-left disabled:cursor-default"
                    >
                      <PaidMark state="try" bare label="Event Hub Pro" size="xs" />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-semibold text-ink">{g.name}</span>
                        {grouped.collapsed && !open ? <span className="text-ink/60"> {g.summary}</span> : null}
                      </span>
                      {g.pricePhp !== null ? <span className="font-mono text-[13px] text-ink">{formatPhp(g.pricePhp)}</span> : null}
                      {grouped.collapsed ? <ChevronDown aria-hidden className={`h-4 w-4 text-ink/50 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} /> : null}
                    </button>
                    {open ? (
                      <ul className="pb-1">
                        {g.effects.map((e) => (
                          <li key={e.id} data-apply-pro-effect={e.id} className="flex min-h-11 items-center gap-1 pl-6">
                            {/* 🚫 No "Go to ↗" (owner 2026-10-22: no go-edit-elsewhere links) — the row itself is the press. */}
                            <button
                              type="button"
                              disabled={!e.jump}
                              onClick={() => onGo(e)}
                              aria-label={e.jump ? `Open ${hubProEffectLine(e)}` : undefined}
                              className="flex min-h-11 min-w-0 flex-1 items-center rounded-2xl px-2 text-left text-sm text-ink hover:bg-ink/5 disabled:hover:bg-transparent"
                            >
                              <span className="min-w-0 truncate">
                                <span className="font-semibold">{e.what}</span>
                                <span className="text-ink/60"> · {e.where}</span>
                              </span>
                            </button>
                            {e.removable ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => onRemove(e)}
                                aria-label={`Remove ${hubProEffectLine(e)}`}
                                title="Remove from your draft"
                                className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink disabled:opacity-40"
                              >
                                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
              {buttons ? (
                <div className="border-t border-ink/10 px-2 pt-2" data-apply-parts-total="">
                  {buttons.paidPhp > 0 ? (
                    /* The cap band — information, not a press: the raised surface, never a border (frame 2). */
                    <div data-apply-cap-band="" className="rounded-2xl bg-ink/[0.05] px-3 py-2.5 text-[13px] leading-snug text-ink/80">
                      <p>
                        You&rsquo;ve paid <strong className="text-ink">{formatPhp(buttons.paidPhp)}</strong> toward everything ({formatPhp(buttons.fullPhp)}).{' '}
                        <strong className="text-ink">{formatPhp(buttons.restPhp)} more unlocks everything</strong> — {buttons.partsWord}, the other{' '}
                        {formatCount(buttons.otherParts)} parts, and no &ldquo;Powered by Setnayan&rdquo; footer.
                      </p>
                      {buttons.ownedNames.length > 0 ? (
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-ink/55">
                          {buttons.ownedNames.map((n, i) => (
                            <span key={n}>
                              {i > 0 ? ' · ' : ''}
                              {n} <Check aria-hidden className="inline h-3 w-3" strokeWidth={2.4} />
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="flex items-baseline justify-between text-sm text-ink">
                        <span>{grouped.parts.length === 1 ? 'This part' : `These ${formatCount(grouped.parts.length)} parts`}</span>
                        <span className="font-mono font-bold">{formatPhp(buttons.subtotalPhp)}</span>
                      </p>
                      {buttons.lead === 'parts' ? (
                        <p className="mt-1 text-[13px] leading-snug text-ink/65">
                          Or everything — all {formatCount(buttons.allParts)} parts and no &ldquo;Powered by Setnayan&rdquo; footer — for{' '}
                          <strong className="text-ink">{formatPhp(buttons.morePhp)} more</strong>. What you pay counts toward it.
                        </p>
                      ) : (
                        <p className="mt-1 text-[13px] leading-snug text-ink/65">
                          Everything is only <strong className="text-ink">{formatPhp(buttons.morePhp)} more</strong> — the other{' '}
                          {formatCount(buttons.otherParts)} parts and no footer mark.
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
          <ul className="mt-2 flex-1 overflow-y-auto px-2" data-apply-pro-effects="">
            {effects.map((e) => (
              <li key={e.id} data-apply-pro-effect={e.id} className="flex min-h-12 items-center gap-2 rounded-2xl px-2 py-1">
                {/* Every row here is Pro — the diamond alone, no word repeated seven times. */}
                <PaidMark state="try" bare label="Event Hub Pro" size="xs" />
                {/* 🚫 No "Go to ↗" (owner 2026-10-22) — the row itself is the press. */}
                <button
                  type="button"
                  disabled={!e.jump}
                  onClick={() => onGo(e)}
                  aria-label={e.jump ? `Open ${hubProEffectLine(e)}` : undefined}
                  className="flex min-h-11 min-w-0 flex-1 items-center rounded-2xl text-left text-sm text-ink hover:bg-ink/5 disabled:hover:bg-transparent"
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{e.what}</span>
                    <span className="text-ink/60"> · {e.where}</span>
                  </span>
                </button>
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
          )
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
              {proHref && buttons ? (
                /* 💎 THE LEAD RULE (prototype frames 1 · 1-closer · 2, `hubApplyOffer`): parts lead while they cost less
                   than the "more"; everything leads once the "more" is no more than they cost; and the parts are not
                   offered at all once they would cost more than everything — never charged above the rest. */
                (() => {
                  const parts = (primary: boolean) => (
                    <Link
                      key="parts"
                      href={unlockAndApplyHref(partsBuyHref(proHref, buttons.partIds))}
                      data-apply-parts-unlock=""
                      className={`${primary ? 'button-primary' : 'rounded-full border border-ink/60 text-sm font-semibold text-ink hover:bg-ink/5'} sn-press inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-center`}
                    >
                      {primary
                        ? `Unlock ${buttons.partsLabel} and Apply · ${formatPhp(buttons.subtotalPhp)}`
                        : `Just ${buttons.partIds.length === 1 ? buttons.partsLabel : `these ${formatCount(buttons.partIds.length)} parts`} · ${formatPhp(buttons.subtotalPhp)}`}
                    </Link>
                  );
                  const everything = (primary: boolean) => (
                    <Link
                      key="everything"
                      href={unlockAndApplyHref(partsBuyHref(proHref, 'full'))}
                      data-apply-pro-unlock=""
                      className={`${primary ? 'button-primary' : 'rounded-full border border-ink/60 text-sm font-semibold text-ink hover:bg-ink/5'} sn-press inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-center`}
                    >
                      {primary ? `Unlock everything and Apply · ${formatPhp(buttons.restPhp)}` : `Everything instead · ${formatPhp(buttons.restPhp)}`}
                    </Link>
                  );
                  if (!buttons.showParts) return everything(true);
                  return buttons.lead === 'parts' ? [parts(true), everything(false)] : [everything(true), parts(false)];
                })()
              ) : proHref ? (
              <Link
                href={unlockAndApplyHref(proHref)}
                data-apply-pro-unlock=""
                className="button-primary sn-press inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-center"
              >
                Unlock Pro and Apply{priceLabel ? ` · ${priceLabel}` : ''}
              </Link>
              ) : null}
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
