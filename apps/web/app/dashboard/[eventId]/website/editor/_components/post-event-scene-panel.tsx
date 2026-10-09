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
 *
 * 🧾 ON THE APP'S TEMPLATES (owner 2026-10-08: *"we want the whole app to be adaptive to the same feel"*;
 * `INTERACTION_RULES.md` § 9 — it was the old inspector). Each control is one approved kind:
 *   · Shown        the ONE switch (`SwitchRow`). It was a pill whose WORDS flipped on a tap ("Shown to guests" ⇄
 *                  "Hidden from guests") — a control that cycles; a switch says one thing and is on or off;
 *   · Order        the Reorder kind's arrows, as house actions (↑ Earlier · ↓ Later). Not a drag: the panel holds
 *                  ONE scene — there is nothing in it to drag past; the list a drag belongs on is the page itself;
 *   · Its parts    house actions (each a door into the part's own sheet — a door is not a choice, so not chips);
 *   · what the scene is, what fills it, where it is fixed — quiet rows, nothing to tap;
 *   · a part's words (`PostEventWordsField`) — a typed Form row (the body a long one); tapping out or Enter keeps,
 *     ✕ leaves it; "Use the written line" is the quiet action under it, only once the couple wrote their own.
 * Every sentence the panel used to print is behind the ⓘ of the row it explains, word for word — except the one
 * that says a READ FAILED, which stays on the panel (a failure is said, never tucked away). "Saved to your draft…"
 * is gone: the count on ✓ Apply says it. WHAT EACH CONTROL SAVES, AND WHEN, IS UNCHANGED.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, PencilLine, RotateCcw } from 'lucide-react';
import { FactRow, FormRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
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
import { useMaker } from '../../../launch/_components/maker-context';
import { StageStyle } from '../../../launch/_components/stage-panel/stage-style';
import { postEventStatusWord, type PostEventTile } from './post-event-tile-words';

type DraftAction = (eventId: string, formData: FormData) => Promise<HubDraftActionResult>;
type SaveAnswer = { ok: true } | { ok: false; error: string };
const NOT_SAVED = 'That change could not be saved. Please try again — nothing was lost.';

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
  /** Answers whether the draft took it — for a row that says a refusal itself (`said`: the panel's line stays quiet). */
  const save = (
    patch: { editorial?: PostEventDraft; widgets?: Record<string, { canvas: HubSectionCanvas }> },
    draw: PostEventDrawn = {},
    said = false,
  ): Promise<SaveAnswer> => {
    // Drawn first — then the draft save runs behind it.
    setDrawn(draw);
    return new Promise<SaveAnswer>((answer) => {
      start(async () => {
        setError(null);
        try {
          const fd = new FormData();
          fd.set('intent', 'save');
          fd.set('patch', JSON.stringify(patch));
          const r = await makerSave(() => draftAction(eventId, fd), () => router.refresh());
          if (!r.ok) {
            setDrawn(null);
            if (!said) setError(r.error);
            answer({ ok: false, error: r.error });
            return;
          }
          answer({ ok: true });
        } catch {
          setDrawn(null);
          if (!said) setError(NOT_SAVED);
          answer({ ok: false, error: NOT_SAVED });
        }
      });
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
  /** 🧭 The new Maker's toolbar is on (a phone, `makerStagesStudioEnabled` — `maker-shell.tsx` `ss`). */
  const toolbar = useMaker()?.stagesStudio === true;
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
  /* Behind the scene's own ⓘ — what it is, and (where it is so) that its style is one value across stages. */
  const about: ReactNode = (
    <>
      <span>{tile.status === 'waiting' ? POST_EVENT_ABOUT.waiting : POST_EVENT_ABOUT.written}</span>
      {home ? <span>{POST_EVENT_ABOUT.sharedStyle}</span> : null}
    </>
  );

  /* 🎨 Style — the shared row (a strip of miniatures in the new Maker), free. */
  const styleRow = (
    <SceneStyleRow
      options={options.map((o) => ({ id: o.id, name: o.name, line: o.line, isDefault: o.isDefault }))}
      value={drawn?.style ?? style}
      pending={pending}
      onPick={pickStyle}
    />
  );
  /* A read that FAILED is said on the panel — never behind an ⓘ. */
  const failures = (
    <>
      {!arrangement ? (
        <p role="alert" data-post-event-unread="" className="px-1 pt-2 text-[12.5px] font-semibold text-danger-700">
          Your story’s scenes could not be read just now — open the Maker again in a moment.
        </p>
      ) : null}
      {error ? (
        <p role="alert" data-post-event-error="" className="px-1 pt-2 text-[12.5px] font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
    </>
  );
  /* 🧭 THE NEW MAKER'S TOOLBAR (a phone; owner 2026-10-09, `TOOLBAR-SPEC-2026-10-09.md`): under Style this panel is the
     scene's LOOK CARDS in the toolbar's four rows and nothing else — nothing scrolls up and down. (It was all of the
     rows below under the cards: 473 px in a 339-px room with no scroller, so "Its parts" could not be reached.) The
     scene's words, "Shown to guests" and its place are the toolbar's Edit (`stage-panel/post-event-edit.ts`, the
     same saves); what the scene is sits behind the toolbar's one ⓘ. The desktop's panel is every row, as before. */
  if (toolbar) {
    return (
      <section className="contents" data-maker-post-event-panel={scene} data-post-event-toolbar="">
        <StageStyle
          rows
          look={
            <>
              {styleRow}
              {failures}
            </>
          }
          background={null}
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col px-1" data-maker-post-event-panel={scene}>
      {styleRow}

      <FormRows data="post-event">
        {/* What this scene is — its state in a word, what fills it under it; nothing to tap but its ⓘ. */}
        <FormRow
          data="scene"
          name="This scene"
          about={{ title: tile.label, words: about }}
          note={`${tile.status === 'auto' ? 'Filled from' : tile.status === 'waiting' ? 'What fills it' : 'Why'}: ${tile.status === 'auto' ? tile.source : tile.note}`}
          attrs={{ 'data-post-event-status': tile.hidden ? 'hidden' : tile.status }}
        >
          <span className="min-w-0 text-right text-[14px] text-ink">
            {postEventStatusWord(tile)}
            {statusLine}
          </span>
        </FormRow>
        {tile.pinned ? (
          <FactRow data="place" name="Place" value="Fixed" where={`The story always ${tile.scene === 'cover' ? 'opens' : 'closes'} here.`} />
        ) : null}

        {/* 👁 Shown — free. The ONE switch: on = guests meet the scene. */}
        {arrangement && tile.switchKey ? (
          <SwitchRow
            data="shown"
            name="Shown to guests"
            about={tile.switchKey === 'gallery' ? { words: POST_EVENT_ABOUT.galleryShare } : null}
            on={!hiddenNow}
            /* Flips at the tap and saves behind it — never greyed while a save
               runs (`every-maker-edit-shows-before-it-saves` D). Read from what
               is DRAWN, so a second tap before the first answers flips back. */
            onChange={(shown) => void save({ editorial: postEventShow(arrangement, tile.switchKey!, shown) }, { hidden: !shown })}
            attrs={{ 'data-post-event-shown': hiddenNow ? 'hidden' : 'shown' }}
          />
        ) : null}

        {/* ⇅ Order — free. The arrows; a move waits for the one before it (each is built on the order as it stands). */}
        {arrangement && tile.runKey ? (
          <FormRow
            data="order"
            name="Order"
            about={tile.runKey === 'chapters' ? { words: POST_EVENT_ABOUT.chaptersMove } : null}
            note={
              drawn?.moved ? (
                <span role="status" data-post-event-moved={drawn.moved}>
                  Moved {drawn.moved}.
                </span>
              ) : null
            }
          >
            <span className="flex flex-none items-center gap-2" data-post-event-order="">
              <ActionButton tone="neutral" icon={ArrowUp} label="Earlier" disabled={pending || !earlier} data-testid="post-event-move-earlier" onClick={() => earlier && void save({ editorial: earlier }, { moved: 'earlier' })} />
              <ActionButton tone="neutral" icon={ArrowDown} label="Later" disabled={pending || !later} data-testid="post-event-move-later" onClick={() => later && void save({ editorial: later }, { moved: 'later' })} />
            </span>
          </FormRow>
        ) : null}

        {/* ✍ Its parts — each opens right here, in the part sheet. */}
        {onPart && parts.length > 0 ? (
          <FormRow
            data="parts"
            name="Its parts"
            below={
              <div className="flex flex-wrap gap-2 pb-3 pt-0.5" data-post-event-parts="">
                {parts.map((p) => (
                  <ActionButton key={p} tone="neutral" icon={PencilLine} label={HUB_ELEMENT_LABEL[p]} data-testid={`post-event-part-${p}`} onClick={() => onPart(p)} />
                ))}
              </div>
            }
          />
        ) : null}
      </FormRows>

      {failures}
    </section>
  );
}

/** The panel's own sentences — behind the ⓘ of the row each explains, word for word (they were printed on it). */
export const POST_EVENT_ABOUT = {
  waiting: 'This scene fills itself from your day. Until then your guests never meet an empty box — you see it here, waiting, in the style you pick.',
  written: 'Written from what happened. Tap any part of the scene to edit it here.',
  sharedStyle: 'This style is shared with the same scene on your other stages — pick once.',
  galleryShare: 'The day’s chapters and the gallery share one switch — hiding one hides both.',
  chaptersMove: 'The day’s chapters move together, in the order they happened.',
} as const;

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
  const { pending, save } = useDraftSave(eventId, draftAction);
  const saved = postEventLookOf(arrangement, scene).words?.[part] ?? '';
  const max = POST_EVENT_WORDS_MAX[part];
  const name = HUB_ELEMENT_LABEL[part];
  /* "Use the written line" is this row's own save too: a refusal is said under the row. */
  const [problem, setProblem] = useState<string | null>(null);
  /** Keep these words ('' or null = back to the words written from the day). The row says a refusal itself. */
  const commit = async (value: string | null): Promise<SaveAnswer> => {
    const r = postEventSetWords(arrangement, scene, part, value);
    if (!r) return { ok: true };
    if ('refused' in r) return { ok: false, error: `Keep it under ${max} characters.` };
    return save({ editorial: r }, {}, true);
  };
  return (
    <div data-post-event-words={part}>
      <FormRows data="post-event-words">
        <TypedRow
          data={`words-${part}`}
          name={name}
          value={saved}
          /* Empty, the pill says what guests read: the words written from the day. */
          empty="Written from your day"
          placeholder="The words written from your day"
          long={part === 'body'}
          maxLength={max}
          note={saved ? 'Written from what happened · edited by you' : 'Written from what happened'}
          onKeep={(text) => {
            setProblem(null);
            return commit(text);
          }}
          below={
            <>
              {saved ? (
                <div className="flex justify-end pb-2" data-post-event-words-reset="">
                  <ActionButton
                    tone="neutral"
                    quiet
                    icon={RotateCcw}
                    label="Use the written line"
                    disabled={pending}
                    onClick={() => {
                      setProblem(null);
                      void commit(null).then((r) => {
                        if (!r.ok) setProblem(`${name} did not save. ${r.error}`);
                      });
                    }}
                  />
                </div>
              ) : null}
              {problem ? (
                <p role="alert" className="pb-2.5 pl-0.5 text-[12.5px] font-semibold text-danger-700">
                  {problem}
                </p>
              ) : null}
            </>
          }
        />
      </FormRows>
    </div>
  );
}
