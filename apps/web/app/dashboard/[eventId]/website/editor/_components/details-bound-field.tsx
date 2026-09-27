'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { WidgetType } from '@/lib/invitation-widgets';
import {
  DETAILS_FACT,
  DETAILS_OVERRIDE_MAX,
  detailsEditPatch,
  sceneBoundText,
  type DetailsEditChoice,
  type DetailsFact,
} from '@/lib/details-bound';
import type { ElementDraftAction } from './element-sheet';

/**
 * A SCENE'S DETAILS FACT, EDITED ON THE SCENE — and the one question it asks.
 *
 * Owner, 2026-09-25 (DECISION_LOG "DETAILS IS THE SOURCE; A SCENE EDIT ASKS"):
 * *"if the edit that part on the scene itself, they will ask if do you want to
 * update details and apply to all or just here."*
 *
 * The scene's Content tab shows what the scene shows — its own version, or the
 * Details value — and, when the couple changes it, asks once:
 *   · "Change it everywhere (updates Details)" — primary; Details' value in the
 *     draft, and every bound scene follows;
 *   · "Just this scene" — this scene's own version (`canvas.details`), shown
 *     with a quiet "Edited here · ↺ Use Details" chip that takes it off.
 *
 * 💾 THE DRAFT, NEVER LIVE. Every answer is ONE `hubDraftAction` intent=save
 * (the patch from `detailsEditPatch`, `lib/details-bound.ts`). Guests see none
 * of it until Apply. Words are free: nothing here is a Pro look key.
 *
 * 🔑 THE LATEST CANVAS IS A REF (the element sheet's rule): two quick answers
 * must not both build on the canvas from before the first save.
 *
 * Phone first: stacked, full-width, 44 px targets; the question replaces the
 * Save row in place — no pop-up over the scene.
 */
export function DetailsBoundField({
  eventId,
  widgetType,
  fact,
  canvas,
  detailsValue,
  draftAction,
  onOpenDetails,
  tour = null,
}: {
  eventId: string;
  widgetType: WidgetType;
  fact: DetailsFact;
  /** The scene's canvas as the canvas draws it — the draft laid over live. */
  canvas: HubSectionCanvas;
  /** Details' value, drafted over live. */
  detailsValue: string | null;
  draftAction: ElementDraftAction;
  /** Open the Details page in the Maker body. */
  onOpenDetails?: () => void;
  /** The first-visit tour (`MiniTour`), server-rendered and handed down. */
  tour?: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const latest = useRef<HubSectionCanvas>(canvas);
  const bound = sceneBoundText(fact, canvas, detailsValue);
  const shown = bound.text ?? '';
  const [text, setText] = useState(shown);
  const canvasJson = JSON.stringify(canvas);

  /* A fresh canvas / Details value from the server (after the refresh) is the truth again. */
  useEffect(() => {
    latest.current = canvas;
    setText(sceneBoundText(fact, canvas, detailsValue).text ?? '');
    setAsking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasJson, detailsValue, fact, widgetType]);

  const label = DETAILS_FACT[fact].label;
  const changed = text.trim() !== shown.trim();
  const blank = text.trim().length === 0;

  const answer = (choice: DetailsEditChoice) => {
    setError(null);
    const patch = detailsEditPatch({ choice, fact, text, widgetType, canvas: latest.current });
    const nextCanvas = patch.widgets?.[widgetType]?.canvas;
    if (nextCanvas) latest.current = nextCanvas;
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify(patch));
      const res = await draftAction(eventId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAsking(false);
      router.refresh();
    });
  };

  const fieldId = `details-bound-${widgetType}-${fact}`;
  return (
    <section className="space-y-2.5 px-1" data-details-bound={fact} data-details-bound-scene={widgetType} aria-busy={pending}>
      {tour}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {bound.overridden ? (
          <button
            type="button"
            data-details-use-details=""
            onClick={() => answer('use-details')}
            disabled={pending}
            className="sn-press ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink/5 px-3 text-[12.5px] font-semibold text-ink/75 transition-colors duration-300 ease-in-out hover:bg-ink/10 disabled:opacity-50"
          >
            <span className="font-normal text-ink/55">Edited here ·</span>
            <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Use Details
          </button>
        ) : (
          <span className="ml-auto text-[12px] font-medium text-ink/55" data-details-from="">
            <InfoTip label="From Details" align="end">
              Your {label.toLowerCase()} is written once, in Details, and every scene that shows it follows. Change it
              here and we ask whether it changes everywhere or only in this scene.
            </InfoTip>
          </span>
        )}
      </div>

      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setAsking(false);
        }}
        rows={4}
        maxLength={DETAILS_OVERRIDE_MAX}
        placeholder="A heartfelt note to everyone joining you…"
        className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-[15px] leading-relaxed text-ink"
      />

      {asking && changed ? (
        <div role="group" aria-label={`Where should this change to your ${label.toLowerCase()} go?`} data-details-ask="" className="space-y-2 rounded-xl bg-ink/[0.04] p-3">
          <p className="text-[13px] font-semibold text-ink">Change it where?</p>
          <button
            type="button"
            data-details-choice="everywhere"
            onClick={() => answer('everywhere')}
            disabled={pending}
            className="sn-press flex min-h-11 w-full items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-cream transition-colors duration-300 ease-in-out hover:bg-ink/90 disabled:opacity-50"
          >
            Change it everywhere (updates Details)
          </button>
          <button
            type="button"
            data-details-choice="here"
            onClick={() => answer('here')}
            disabled={pending || blank}
            className="sn-press flex min-h-11 w-full items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)] transition-colors duration-300 ease-in-out hover:bg-ink/5 disabled:opacity-50"
          >
            Just this scene
          </button>
          {blank ? (
            <p className="text-[12px] text-ink/60">A scene of its own needs words. To clear the message, change it everywhere.</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setText(shown);
              setAsking(false);
            }}
            className="sn-press flex min-h-10 w-full items-center justify-center text-[13px] font-semibold text-ink/65 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-details-save=""
            onClick={() => setAsking(true)}
            disabled={!changed || pending}
            className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-cream transition-colors duration-300 ease-in-out hover:bg-ink/90 disabled:opacity-40"
          >
            Save
          </button>
          {onOpenDetails ? (
            <button
              type="button"
              onClick={onOpenDetails}
              className="sn-press inline-flex min-h-11 items-center px-2 text-[13px] font-semibold text-ink/70 underline underline-offset-2 hover:text-ink"
            >
              Open Details
            </button>
          ) : null}
        </div>
      )}

      <p className="text-[12px] text-ink/55">In your draft — guests see it after you Apply.</p>
      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
