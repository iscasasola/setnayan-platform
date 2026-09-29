'use client';

import { useRef, useState, useTransition } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PASS_CARD_DESIGNS, PASS_CARD_DESIGN_LABEL, PASS_CARD_WORDS, type PassCardDesign } from '@/lib/pass-card';
import { PrintPreview } from './print-preview';

/**
 * 🎫 THE PASS CARD'S LOOK — ONE dropdown (Classic · Ticket · Photo poster) and
 * the card drawn large beside it (owner 2026-09-29: "event pass for digital
 * downloads approved"; the controller: "on our toolbar, there is a way to
 * navigate the designs"). The pattern is `MakerHeroDesignPicker`'s: the shared
 * `PickMenu`, the pick shown AT ONCE (optimistic — the three pictures are
 * already warm), the latest pick held in a REF so two quick picks never save
 * out of order.
 *
 * 💾 SAVED THE WAY EVERY PRINTS CHOICE IS SAVED — immediately, through the
 * prints' own door (`POST /api/hub-print/pass-design`, the sibling of `words`
 * and `menu`, writing `events.print_details.pass_design`). Prints do not ride
 * the Event Hub draft / Apply. One pick drives every card: the picture a guest
 * saves, their "Save all", the couple's zip and the Phone card print.
 */
export function PassCardDesignPicker({
  eventId,
  saved,
  previews,
}: {
  eventId: string;
  saved: PassCardDesign;
  /** The card drawn in each look — `/api/hub-print/pass?…&pass_format=phone-card&pass_design=<key>`. */
  previews: Readonly<Record<PassCardDesign, string>>;
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
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('design', design);
      const ok = await fetch('/api/hub-print/pass-design', { method: 'POST', body: fd, headers: { accept: 'application/json' } })
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
        setError('That style did not save — please try again.');
      }
    });
  };

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
      <div className="w-full max-w-[240px]">
        <PrintPreview
          src={previews[shown]}
          alt={`${PASS_CARD_DESIGN_LABEL[shown]} ${PASS_CARD_WORDS.noun}`}
          label={PASS_CARD_WORDS.noun}
          prefetch={PASS_CARD_DESIGNS.filter((d) => d !== shown).map((d) => previews[d])}
        />
      </div>
      {error ? (
        <p role="alert" className="text-[12.5px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
