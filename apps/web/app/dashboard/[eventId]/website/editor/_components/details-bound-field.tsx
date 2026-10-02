'use client';

import { HUB_DRAFT_BAR_FIELD, makerSave } from '@/lib/maker-refresh';
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
import type { HubDraftPatch } from '@/lib/hub-draft';
import { useSceneWordsBox } from './canvas-words';

/**
 * A SCENE'S DETAILS FACT, EDITED ON THE SCENE — and the one question it asks.
 *
 * Owner, 2026-09-25 (DECISION_LOG "DETAILS IS THE SOURCE; A SCENE EDIT ASKS"):
 * *"if the edit that part on the scene itself, they will ask if do you want to
 * update details and apply to all or just here."*
 *
 * The scene's Content tab shows what the scene shows — its own version, or the
 * Details value — and, when the couple changes it, asks once:
 *   · "Change it everywhere" — primary; Details' value in the
 *     draft, and every bound scene follows;
 *   · "Just this scene" — this scene's own version (`canvas.details`), shown
 *     with a quiet "Edited here · ↺ Use your message" chip that takes it off.
 *     (Named "Details" until 2026-09-28 — owner: "EVERY TEXT IS TYPED WHERE IT
 *     LIVES"; Details no longer shows the message, so the words stopped naming it.)
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
 *
 * ✍ THE MAKER IS THE EDITOR (owner 2026-09-27: *"this is the editor, so we can
 * edit here"* · *"needs to show on the scene editor"*). This is the scene's ONE
 * words box — it took the Content tab's place from the plain `TextPanel`, and
 * keeps that box's starting point (AP-11 `invitationWordsDraft`, handed in as
 * `startingPoint` with its hint): what is typed is on the canvas scene as it is
 * typed (`canvas-words.tsx`), a tap on the scene's words focuses it, and
 * nothing is saved until Save.
 */
export function DetailsBoundField({
  eventId,
  widgetType,
  fact,
  canvas,
  detailsValue,
  draftAction,
  onOpenDetails,
  onStyle,
  onSaving,
  startingPoint = null,
  startingHint,
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
  /** Open the words' font · colour · size sheet (a tap on them now opens this box). */
  onStyle?: () => void;
  /**
   * ⚡ Called just before the save, with what is being saved — the shell uses it
   * to keep the canvas page (the words are already on it) instead of reloading.
   */
  onSaving?: (patch: HubDraftPatch, choice: DetailsEditChoice, text: string) => void;
  /** AP-11 · the box starts somewhere when nothing is written — never saved by itself. */
  startingPoint?: string | null;
  startingHint?: string;
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
  /* Nothing written anywhere → the box opens on the starting point (AP-11). */
  const opening = shown || startingPoint || '';
  const [text, setText] = useState(opening);
  const canvasJson = JSON.stringify(canvas);
  const box = useRef<HTMLTextAreaElement>(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const preview = useSceneWordsBox(`w:${widgetType}`, box, () => shownRef.current);

  /* A fresh canvas / Details value from the server (after the refresh) is the truth again. */
  useEffect(() => {
    latest.current = canvas;
    const next = sceneBoundText(fact, canvas, detailsValue).text ?? '';
    setText(next || startingPoint || '');
    setAsking(false);
    // The box opened on words the canvas does not show yet — show them there.
    if (!next && startingPoint) preview(startingPoint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasJson, detailsValue, fact, widgetType]);

  const label = DETAILS_FACT[fact].label;
  const onStartingPoint = !shown && Boolean(startingPoint) && text === startingPoint;
  const changed = text.trim() !== shown.trim();
  const blank = text.trim().length === 0;

  const answer = (choice: DetailsEditChoice) => {
    setError(null);
    const patch = detailsEditPatch({ choice, fact, text, widgetType, canvas: latest.current });
    const nextCanvas = patch.widgets?.[widgetType]?.canvas;
    if (nextCanvas) latest.current = nextCanvas;
    onSaving?.(patch, choice, text);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify(patch));
      /* ⚡ Words the bridge drew bring no Maker render — the Apply count comes back with the save. */
      fd.set(HUB_DRAFT_BAR_FIELD, '1');
      /* `held`: the shell decides in `onSaving` (above) — it holds the canvas
         for words the bridge drew, and releases it (one render for the burst,
         `makerNeedsRender`) for what it could not. */
      const res = await makerSave(() => draftAction(eventId, fd), () => router.refresh(), { held: true });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAsking(false);
    });
  };

  const fieldId = `details-bound-${widgetType}-${fact}`;
  return (
    <section className="space-y-2.5 px-1" data-details-bound={fact} data-details-bound-scene={widgetType} aria-busy={pending}>
      {tour}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
          {DETAILS_FACT[fact].boxLabel}
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
            Use {DETAILS_FACT[fact].boxLabel.toLowerCase()}
          </button>
        ) : (
          <span className="ml-auto text-[12px] font-medium text-ink/55" data-details-from="">
            <InfoTip label="Everywhere" align="end">
              Your {label.toLowerCase()} is written once, and every scene that shows it follows. Change it here and we
              ask whether it changes everywhere or only in this scene.
            </InfoTip>
          </span>
        )}
      </div>

      <textarea
        id={fieldId}
        ref={box}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setAsking(false);
          preview(e.target.value);
        }}
        rows={4}
        maxLength={DETAILS_OVERRIDE_MAX}
        placeholder="A heartfelt note to everyone joining you…"
        className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-[16px] leading-relaxed text-ink"
      />
      {onStartingPoint && startingHint ? <p className="text-[12px] text-ink/55">{startingHint}</p> : null}

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
            Change it everywhere
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
              setText(opening);
              setAsking(false);
              preview(opening);
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
          {/* Only once the words are saved: the sheet or the Details page takes
              this panel's place, and unsaved words would go with it. */}
          {onStyle && !changed ? (
            <button
              type="button"
              data-details-style=""
              onClick={onStyle}
              className="sn-press inline-flex min-h-11 items-center px-2 text-[13px] font-semibold text-ink/70 underline underline-offset-2 hover:text-ink"
            >
              Font, colour &amp; size
            </button>
          ) : null}
          {onOpenDetails && !changed ? (
            <button
              type="button"
              onClick={onOpenDetails}
              className="sn-press inline-flex min-h-11 items-center px-2 text-[13px] font-semibold text-ink/70 underline underline-offset-2 hover:text-ink"
            >
              Open Event Details
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
