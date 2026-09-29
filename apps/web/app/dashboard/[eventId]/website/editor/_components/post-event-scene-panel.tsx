'use client';

/**
 * 🎞 POST EVENT, SCENE BY SCENE — the inspector for one Post Event scene.
 *
 * Owner, 2026-09-25 (DECISION_LOG "POST EVENT IS MANY SMALL SCENES"): *"the
 * story on that scene 1 of post event is the whole story, what we want is to
 * cut them into smaller scenes"* — and 2026-09-29 ("EVERY STYLE OF EVERY SCENE
 * SHIPS"), on the approved prototype's Maker frames: a scene tapped → its
 * panel: **Style** (ONE dropdown, free) · **Shown** · **Order** (▲ Earlier ·
 * ▼ Later) · **Filled from** — and every part is edited right here when it is
 * tapped (`PostEventWordsField` inside the part sheet). No "Edit in … ↗": the
 * old link to the story workroom is gone (no link-outs).
 *
 * 💾 EVERY CONTROL SAVES TO THE EVENT HUB DRAFT, NEVER LIVE. Each one posts the
 * one draft door (`hubDraftAction` intent=save, handed in as `draftAction`)
 * with `{ editorial: … }` — the story keys the edit changes, computed by
 * `lib/post-event-draft.ts` from the arrangement the Maker shows (live with the
 * draft laid over it) — or, for the two scenes whose style is one value with a
 * section's (Schedule, Gallery), `{ widgets: { <row>: { canvas } } }`. Guests
 * see nothing until Apply. There is no form here and no live writer.
 *
 * 💎 Show / hide, order, a style and the words are FREE (E4, and "a design pick
 * is free"); only a part's own font and animation wear ◆ — in the part sheet.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, PencilLine, RotateCcw } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { makerSave } from '@/lib/maker-refresh';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { HUB_ELEMENT_LABEL, type HubElementKey } from '@/lib/element-style';
import {
  POST_EVENT_WORDS_MAX,
  postEventLookOf,
  postEventMove,
  postEventSetStyle,
  postEventSetWords,
  postEventShow,
  type PostEventArrangement,
  type PostEventDraft,
  type PostEventPart,
} from '@/lib/post-event-draft';
import { postEventStyleHome, postEventWordParts } from '@/lib/post-event-styles';
import { postEventStyleOptions, resolvePostEventStyle } from '@/lib/post-event-style-resolve';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { SceneStyleRow } from './scene-style-row';
import { postEventStatusWord, type PostEventTile } from './post-event-tile-words';
import { IRow, ISection } from './inspector-kit';

type DraftAction = (eventId: string, formData: FormData) => Promise<HubDraftActionResult>;

/**
 * ⚡ What the panel draws AT ONCE, before the server answers — the Maker never
 * waits on the server to show a tap (`every-maker-edit-shows-before-it-saves.test.ts`).
 * Cleared when the Maker's fresh props arrive (the draft then says the same),
 * and when a save fails (the panel goes back to what is saved).
 */
type PostEventDrawn = { style?: string; hidden?: boolean; moved?: 'earlier' | 'later' };

/** Save story keys (or a section's canvas) to the Event Hub draft — the one door. */
function useDraftSave(eventId: string, draftAction: DraftAction, fresh?: unknown) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<PostEventDrawn | null>(null);
  useEffect(() => setDrawn(null), [fresh]);
  const save = (
    patch: { editorial?: PostEventDraft; widgets?: Record<string, { canvas: HubSectionCanvas }> },
    draw: PostEventDrawn = {},
  ) => {
    // Drawn first — then the draft save runs behind it.
    setDrawn(draw);
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify(patch));
        const r = await makerSave(() => draftAction(eventId, fd), () => router.refresh());
        if (!r.ok) {
          setDrawn(null);
          setError(r.error);
        }
      } catch {
        setDrawn(null);
        setError('That change could not be saved. Please try again — nothing was lost.');
      }
    });
  };
  return { pending, error, setError, save, drawn };
}

export function PostEventScenePanel({
  eventId,
  tile,
  arrangement,
  writtenAt,
  dayHappened,
  eventType,
  sectionCanvases,
  draftAction,
  onPart,
}: {
  eventId: string;
  tile: PostEventTile;
  /** Live with the draft laid over it (`readPostEventForMaker`). */
  arrangement: PostEventArrangement | null;
  writtenAt: string | null;
  dayHappened: boolean;
  eventType: string | null;
  /** Every section's canvas, drafted over live — where a shared style lives. */
  sectionCanvases: Readonly<Record<string, HubSectionCanvas>>;
  draftAction: DraftAction;
  /** Open one part of this scene in the part sheet (words, font, size, colour). */
  onPart: ((el: HubElementKey) => void) | null;
}) {
  // `tile` is new each time the Maker refreshes — the moment the draft is read back.
  const { pending, error, save, drawn } = useDraftSave(eventId, draftAction, tile);
  const scene = tile.scene;
  const hiddenNow = drawn?.hidden ?? tile.hidden;
  const home = postEventStyleHome(scene);
  const picked = home ? sectionCanvases[home]?.style : arrangement ? postEventLookOf(arrangement, scene).style : undefined;
  const style = resolvePostEventStyle(scene, picked, eventType);
  const options = postEventStyleOptions(scene, eventType);
  const def = options.find((o) => o.isDefault)?.id ?? null;
  const parts = postEventWordParts(scene, style);
  const earlier = arrangement ? postEventMove(arrangement, scene, -1) : null;
  const later = arrangement ? postEventMove(arrangement, scene, 1) : null;

  const pickStyle = (id: string) => {
    if (home) {
      /* 🔗 One value across stages — the section's own canvas, merged whole
         (the draft replaces a canvas whole), so nothing else on it moves. */
      save({ widgets: { [home]: { canvas: { ...(sectionCanvases[home] ?? {}), style: id } } } }, { style: id });
      return;
    }
    if (!arrangement) return;
    const patch = postEventSetStyle(arrangement, scene, id, def);
    if (patch) save({ editorial: patch }, { style: id });
  };

  const statusLine =
    tile.status === 'auto' && writtenAt
      ? ` · written ${new Date(writtenAt).toLocaleString('en-PH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
      : tile.status === 'waiting'
        ? ' · fills itself after the day'
        : '';

  return (
    <section className="space-y-1 px-1" data-maker-post-event-panel={scene}>
      <div className="flex items-center gap-1.5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/60">
          {postEventStatusWord(tile)}
          {statusLine}
        </p>
        <InfoTip label="" ariaLabel="About this scene" align="start">
          {tile.status === 'waiting'
            ? 'This scene fills itself from your day. Until then your guests never meet an empty box — you see it here, waiting, in the style you pick.'
            : 'Written from what happened. Tap any part of the scene to edit it here.'}
        </InfoTip>
      </div>

      {/* 🎨 Style — one dropdown, free. */}
      <SceneStyleRow
        options={options.map((o) => ({ id: o.id, name: o.name, line: o.line, isDefault: o.isDefault }))}
        value={drawn?.style ?? style}
        pending={pending}
        onPick={pickStyle}
      />

      {/* 👁 Shown — free. */}
      {arrangement && tile.switchKey ? (
        <IRow label="Shown" data="post-event-shown">
          <button
            type="button"
            role="switch"
            aria-checked={!hiddenNow}
            disabled={pending}
            data-post-event-eye={hiddenNow ? 'show' : 'hide'}
            onClick={() => save({ editorial: postEventShow(arrangement, tile.switchKey!, tile.hidden) }, { hidden: !tile.hidden })}
            className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink/5 px-3 text-sm font-semibold text-ink hover:bg-ink/10 disabled:opacity-40"
          >
            {hiddenNow ? <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.75} /> : <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            {hiddenNow ? 'Hidden from guests' : 'Shown to guests'}
          </button>
        </IRow>
      ) : null}

      {/* ⇅ Order — free. */}
      {arrangement && tile.runKey ? (
        <IRow label="Order" data="post-event-order">
          <button
            type="button"
            disabled={pending || !earlier}
            data-post-event-move="earlier"
            onClick={() => earlier && save({ editorial: earlier }, { moved: 'earlier' })}
            className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-ink/5 px-3 text-sm font-semibold text-ink hover:bg-ink/10 disabled:opacity-40"
          >
            <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Earlier
          </button>
          <button
            type="button"
            disabled={pending || !later}
            data-post-event-move="later"
            onClick={() => later && save({ editorial: later }, { moved: 'later' })}
            className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-ink/5 px-3 text-sm font-semibold text-ink hover:bg-ink/10 disabled:opacity-40"
          >
            <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Later
          </button>
        </IRow>
      ) : null}
      {drawn?.moved ? (
        <p role="status" className="px-1 text-[12px] font-medium text-ink/70" data-post-event-moved={drawn.moved}>
          Moved {drawn.moved}.
        </p>
      ) : null}

      {/* ✍ Its parts — each opens right here, in the part sheet. */}
      {onPart && parts.length > 0 ? (
        <>
          <ISection>Its parts</ISection>
          <div className="flex flex-wrap gap-2" data-post-event-parts="">
            {parts.map((p) => (
              <button
                key={p}
                type="button"
                data-post-event-part={p}
                onClick={() => onPart(p)}
                className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink/5 px-3 text-sm font-semibold text-ink hover:bg-ink/10"
              >
                <PencilLine aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                {HUB_ELEMENT_LABEL[p]}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 pt-3 text-[13px]">
        <dt className="text-ink/60">{tile.status === 'auto' ? 'Filled from' : tile.status === 'waiting' ? 'What fills it' : 'Why'}</dt>
        <dd className="text-ink">{tile.status === 'auto' ? tile.source : tile.note}</dd>
        {tile.pinned ? (
          <>
            <dt className="text-ink/60">Place</dt>
            <dd className="text-ink">Fixed — the story always {tile.scene === 'cover' ? 'opens' : 'closes'} here.</dd>
          </>
        ) : null}
      </dl>
      {tile.switchKey === 'gallery' ? (
        <p className="text-[12px] text-ink/60">The day’s chapters and the gallery share one switch — hiding one hides both.</p>
      ) : null}
      {tile.runKey === 'chapters' ? (
        <p className="text-[12px] text-ink/60">The day’s chapters move together, in the order they happened.</p>
      ) : null}
      {home ? (
        <p className="text-[12px] text-ink/60">This style is shared with the same scene on your other stages — pick once.</p>
      ) : null}
      {!arrangement ? (
        <p className="text-[12px] text-ink/60">Your story’s scenes could not be read just now — open the Maker again in a moment.</p>
      ) : (
        <p className="text-[12px] text-ink/60">
          {dayHappened ? 'Saved to your draft — guests see it after you press Apply.' : 'Saved to your draft — it goes live when you press Apply.'}
        </p>
      )}
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * ✍ ONE PART'S OWN WORDS — the field at the top of the part sheet ("the
 * headline is a field in the panel — no Edit in Words ↗", prototype Maker-3).
 * Empty = the words written from the day; "↺ use the written line" clears it.
 * Free. Drafted into the story's `sceneLooks[<scene>].words`.
 */
export function PostEventWordsField({
  eventId,
  scene,
  part,
  arrangement,
  draftAction,
}: {
  eventId: string;
  scene: string;
  part: PostEventPart;
  arrangement: PostEventArrangement;
  draftAction: DraftAction;
}) {
  const { pending, error, setError, save } = useDraftSave(eventId, draftAction);
  const saved = postEventLookOf(arrangement, scene).words?.[part] ?? '';
  const [text, setText] = useState(saved);
  const max = POST_EVENT_WORDS_MAX[part];
  const commit = (value: string | null) => {
    const r = postEventSetWords(arrangement, scene, part, value);
    if (!r) return;
    if ('refused' in r) {
      setError(`Keep it under ${max} characters.`);
      return;
    }
    save({ editorial: r });
  };
  const fieldClass =
    'mt-1 block min-h-11 w-full rounded-md bg-white px-2.5 py-2 text-[15px] text-ink shadow-[inset_0_0_0_1px_rgba(30,34,41,0.15)]';
  const onBlur = () => {
    if (text.trim() !== saved) commit(text);
  };
  return (
    <div className="border-b border-ink/[0.07] py-2.5" data-post-event-words={part}>
      <label className="block text-[12.5px] text-ink/60">
        {HUB_ELEMENT_LABEL[part]}
        {part === 'body' ? (
          <textarea
            value={text}
            maxLength={max}
            rows={4}
            placeholder="The words written from your day"
            onChange={(e) => setText(e.target.value)}
            onBlur={onBlur}
            className={fieldClass}
          />
        ) : (
          <input
            type="text"
            value={text}
            maxLength={max}
            placeholder="The words written from your day"
            onChange={(e) => setText(e.target.value)}
            onBlur={onBlur}
            className={fieldClass}
          />
        )}
      </label>
      <p className="pt-1 text-[12px] text-ink/60">
        {saved ? 'Written from what happened · edited by you' : 'Written from what happened'}
        {saved ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setText('');
              commit(null);
            }}
            className="ml-2 inline-flex min-h-11 items-center gap-1 font-semibold text-ink/75 underline-offset-2 hover:underline"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            use the written line
          </button>
        ) : null}
      </p>
      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
