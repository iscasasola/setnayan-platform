'use client';

import { useRef, useState, useTransition } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PASS_CARD_DESIGNS, PASS_CARD_DESIGN_LABEL, PASS_CARD_WORDS, type PassCardDesign } from '@/lib/pass-card';
import { passDesignDraftPatch } from '@/lib/pass-design-save';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { PrintPreview } from './print-preview';
import { SP_LAYOUT_CARD } from '@/lib/maker-stage-room';

/**
 * 🎫 THE TICKET STYLE — ONE dropdown (Classic · Ticket · Photo poster) and
 * the card drawn large beside it (owner 2026-09-29: "event pass for digital
 * downloads approved"; the controller: "on our toolbar, there is a way to
 * navigate the designs"). The pattern is `MakerHeroDesignPicker`'s: the shared
 * `PickMenu`, the pick shown AT ONCE (optimistic — the three pictures are
 * already warm), the latest pick held in a REF so two quick picks never save
 * out of order.
 *
 * 💾 A PICK WAITS FOR APPLY (owner 2026-10-02 Q7, *"the pass look waits for
 * Apply"*; built 2026-10-05): saved into the Event Hub DRAFT
 * (`passDesignDraftPatch` → `events.print_details` as `{ pass_design }`), never
 * the live row — guests' cards, their "Save all", the couple's zip and the
 * Phone card print keep the live look until the couple presses Apply, which
 * merges it into `print_details.pass_design` (`hub-draft-actions.ts`). The
 * old live door (`POST /api/hub-print/pass-design`) is gone.
 *
 * Drawn in two places, one component: the Guest's ticket scene's sheet (the
 * dropdown alone — the ticket is drawn on the page above it, `preview={false}`,
 * `onShown` tells the page which) and Prints (dropdown + picture).
 */
export function PassCardDesignPicker({
  eventId,
  saved,
  previews,
  preview = true,
  onShown,
  cards = false,
}: {
  eventId: string;
  /** The look the couple is editing — the drafted one when the draft holds it, else the live one. */
  saved: PassCardDesign;
  /** The card drawn in each look — `/api/hub-print/pass?…&pass_format=phone-card&pass_design=<key>`. */
  previews: Readonly<Record<PassCardDesign, string>>;
  /** Draw the card beside the dropdown (Prints). Off where the page above already draws it (the Guest's ticket scene). */
  preview?: boolean;
  /** The look on screen — every pick at once, and a refused one put back. */
  onShown?: (design: PassCardDesign) => void;
  /** 🧭 The new Maker's Style › Look: the looks as a row of PICTURES (each card its own ticket), not a dropdown. */
  cards?: boolean;
}) {
  const [shown, setShown] = useState<PassCardDesign>(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef<PassCardDesign>(saved);
  const stored = useRef<PassCardDesign>(saved);

  const pick = (key: string) => {
    const design = PASS_CARD_DESIGNS.find((d) => d === key);
    if (!design || design === latest.current) return;
    latest.current = design;
    setShown(design);
    onShown?.(design);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify(passDesignDraftPatch(design)));
      const ok = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh)
        .then((r) => r.ok)
        .catch(() => false);
      if (ok) {
        stored.current = design;
        return;
      }
      // Only the LATEST pick is put back — an older failure never undoes a newer choice.
      if (latest.current === design) {
        latest.current = stored.current;
        setShown(stored.current);
        onShown?.(stored.current);
        setError('That style did not save — please try again.');
      }
    });
  };

  if (cards) {
    return (
      <div className="flex flex-col gap-1" data-pass-card-design={shown} aria-busy={pending || undefined}>
        <div
          role="radiogroup"
          aria-label={PASS_CARD_WORDS.style}
          data-style-carousel=""
          className="-mx-[2px] flex shrink-0 snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden px-[2px] pb-1 pt-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PASS_CARD_DESIGNS.map((d) => {
            const on = d === shown;
            return (
              <button key={d} type="button" role="radio" aria-checked={on} data-style-card={d} data-pass-card-design-pick={d} onClick={() => pick(d)} className={SP_LAYOUT_CARD}>
                <span
                  data-style-card-preview=""
                  className={`relative block h-[104px] shrink-0 overflow-hidden rounded-lg bg-[var(--sp-page)] ${
                    on ? 'border-2 border-[var(--sp-cta)] shadow-[0_0_0_3px_var(--sp-cta-wash)]' : 'border border-[var(--sp-line)]'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- the drawn ticket PNG, already warm */}
                  <img src={previews[d]} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain p-1" loading="eager" />
                </span>
                <span className={`block h-[18px] truncate text-center text-[13px] font-semibold leading-[18px] ${on ? 'text-[var(--sp-ink)]' : 'text-[var(--sp-ink2)]'}`}>
                  {PASS_CARD_DESIGN_LABEL[d]}
                </span>
              </button>
            );
          })}
        </div>
        {error ? (
          <p role="alert" className="px-1 text-[12.5px] text-terracotta-700">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-pass-card-design={shown} aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">{PASS_CARD_WORDS.style}</span>
        <PickMenu
          label={PASS_CARD_WORDS.style}
          value={shown}
          options={PASS_CARD_DESIGNS.map((d) => ({ key: d, label: PASS_CARD_DESIGN_LABEL[d], thumb: previews[d] }))}
          onPick={pick}
          dataAttr="data-pass-card-design-pick"
        />
      </div>
      {preview ? (
        <div className="w-full max-w-[240px]">
          <PrintPreview
            src={previews[shown]}
            alt={`${PASS_CARD_DESIGN_LABEL[shown]} ${PASS_CARD_WORDS.noun}`}
            label={PASS_CARD_WORDS.noun}
            prefetch={PASS_CARD_DESIGNS.filter((d) => d !== shown).map((d) => previews[d])}
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[12.5px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
