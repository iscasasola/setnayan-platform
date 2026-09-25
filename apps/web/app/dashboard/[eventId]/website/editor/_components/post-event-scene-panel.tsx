'use client';

/**
 * 🎞 POST EVENT, SCENE BY SCENE — the inspector for one Post Event scene, and
 * "+ Add a scene" on the Post Event stage.
 *
 * Owner, 2026-09-25 (DECISION_LOG "POST EVENT IS MANY SMALL SCENES"), verbatim:
 * *"the story on that scene 1 of post event is the whole story, what we want is
 * to cut them into smaller scenes to allow content for each part giving them
 * freedom to add new scenes."* So each scene has its own panel here: what it
 * is and what fills it, show / hide, earlier / later, and — for a scene of
 * their own — its words and a way to remove it.
 *
 * 💾 EVERY CONTROL SAVES TO THE EVENT HUB DRAFT, NEVER LIVE. Each one posts the
 * one draft door, `hubDraftAction` intent=save, with `{ editorial: … }` — the
 * story keys the edit changes, computed by `lib/post-event-draft.ts` from the
 * arrangement the Maker shows (live with the draft laid over it). Guests see
 * nothing until Apply, which writes those keys into the story's own row.
 * There is no form here and no live writer is imported
 * (`post-event-scenes-are-drafted.test.ts`).
 *
 * 🔒 A NEW SCENE OF THEIR OWN IS PRO — tried here, paid at Apply (the Apply bar
 * says so and holds it back). Show / hide, order and their words are free.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Eye, EyeOff, Trash2 } from 'lucide-react';
import { hubDraftAction } from '../../hub-draft-actions';
import { useMaker } from '../../../launch/_components/maker-context';
import { SceneTemplatePicker } from './scene-template-picker';
import type { MakerStageList } from '@/lib/maker-scene-list';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import { postEventPreset, type PostEventPresetId } from '@/lib/post-event-presets';
import { customColumnId, MAX_CUSTOM_COLUMNS, CUSTOM_COLUMN_BODY_MAX, CUSTOM_COLUMN_TITLE_MAX } from '@/app/[slug]/_components/editorial/custom-columns';
import {
  newPostEventSceneId,
  postEventAdd,
  postEventEdit,
  postEventMove,
  postEventRemove,
  postEventShow,
  type PostEventArrangement,
  type PostEventDraft,
  type PostEventEditRefusal,
} from '@/lib/post-event-draft';

export type PostEventTile = Extract<MakerStageList['shown'][number], { kind: 'post-event' }>;

/** The one word on the tile — what filled it, or why guests do not meet it. */
export function postEventStatusWord(tile: Pick<PostEventTile, 'status' | 'hidden'>): string {
  if (tile.status === 'skipped') return 'Skipped';
  if (tile.status === 'optional') return 'Optional';
  if (tile.status === 'waiting') return 'Not yet';
  if (tile.hidden) return 'Hidden';
  if (tile.status === 'own') return 'Yours';
  return 'Auto';
}

export function postEventTileLabel(tile: PostEventTile): string {
  if (tile.status === 'skipped') return `${tile.label} (skipped — ${tile.note ?? 'nothing to show yet'})`;
  if (tile.status === 'optional') return `${tile.label} (optional — ${tile.note ?? 'not chosen'})`;
  if (tile.status === 'waiting') return `${tile.label} (not yet — ${tile.note ?? 'it fills itself after the day'})`;
  if (tile.hidden) return `${tile.label} (hidden from guests)`;
  if (tile.status === 'own') return `${tile.label} (your own scene)`;
  return `${tile.label} (written for you)`;
}

/** The ⓘ under the tile: the template, and what filled it — or what will. */
export function postEventTileNote(tile: PostEventTile): string {
  const tpl = tile.template ? `${tile.template} · ${SCENE_TEMPLATES[tile.template]?.name ?? ''}` : 'Its own part of the page';
  const what = tile.status === 'auto' || tile.status === 'own' ? `Filled from: ${tile.source}` : (tile.note ?? '');
  const open = tile.open ? ' A tap opens it full screen; Back returns to the same place.' : '';
  return `${tpl}. ${what}.${open}`;
}

const REFUSAL: Record<PostEventEditRefusal, string> = {
  full: `You have all ${MAX_CUSTOM_COLUMNS} of your own scenes. Remove one you are not using to add another.`,
  unknown_preset: 'That scene could not be added. Please try again.',
  empty_title: 'Give the scene a title.',
  empty_body: 'Write a line or two — a scene with no words is not shown.',
  too_long: `Keep the title under ${CUSTOM_COLUMN_TITLE_MAX} characters and the words under ${CUSTOM_COLUMN_BODY_MAX}.`,
  bad_id: 'That scene could not be added. Please try again.',
  missing: 'That scene is no longer in your draft.',
};

/** Save story keys to the Event Hub draft — the one door. */
function useDraftSave(eventId: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (patch: PostEventDraft, after?: () => void) =>
    start(async () => {
      setError(null);
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify({ editorial: patch }));
        const r = await hubDraftAction(eventId, fd);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        after?.();
        router.refresh();
      } catch {
        setError('That change could not be saved. Please try again — nothing was lost.');
      }
    });
  return { pending, error, setError, save };
}

export function PostEventScenePanel({
  eventId,
  tile,
  arrangement,
  writtenAt,
  dayHappened,
  ownsPro,
}: {
  eventId: string;
  tile: PostEventTile;
  /** Live with the draft laid over it (`readPostEventForMaker`). */
  arrangement: PostEventArrangement | null;
  writtenAt: string | null;
  dayHappened: boolean;
  ownsPro: boolean;
}) {
  const maker = useMaker();
  const { pending, error, setError, save } = useDraftSave(eventId);
  const ownId = customColumnId(tile.scene);
  const own = ownId && arrangement ? (arrangement.customColumns.find((c) => c.id === ownId) ?? null) : null;
  const [title, setTitle] = useState(own?.title ?? '');
  const [body, setBody] = useState(own?.body ?? '');
  const preset = postEventPreset(tile.preset);

  const earlier = arrangement ? postEventMove(arrangement, tile.scene, -1) : null;
  const later = arrangement ? postEventMove(arrangement, tile.scene, 1) : null;
  const statusLine =
    tile.status === 'auto' && writtenAt
      ? ` · written ${new Date(writtenAt).toLocaleString('en-PH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
      : tile.status === 'waiting'
        ? ' · fills itself after the day'
        : '';

  return (
    <section className="space-y-3 px-1" data-maker-post-event-panel={tile.scene}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/60">
        {postEventStatusWord(tile)}
        {statusLine}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-ink/60">Template</dt>
        <dd className="text-ink">
          {tile.template ? `${tile.template} · ${SCENE_TEMPLATES[tile.template]?.name ?? ''}` : 'Its own part of the page'}
        </dd>
        <dt className="text-ink/60">
          {tile.status === 'auto' || tile.status === 'own' ? 'Filled from' : tile.status === 'waiting' ? 'What fills it' : 'Why'}
        </dt>
        <dd className="text-ink">{tile.status === 'auto' || tile.status === 'own' ? tile.source : tile.note}</dd>
        {tile.open ? (
          <>
            <dt className="text-ink/60">On the page</dt>
            <dd className="text-ink">A preview in the flow; a tap opens it full screen, and Back returns to it.</dd>
          </>
        ) : null}
        {tile.pinned ? (
          <>
            <dt className="text-ink/60">Place</dt>
            <dd className="text-ink">Fixed — the story always {tile.scene === 'cover' ? 'opens' : 'closes'} here.</dd>
          </>
        ) : !tile.runKey ? (
          <>
            <dt className="text-ink/60">Place</dt>
            <dd className="text-ink">Set — it keeps its place at the top of the story.</dd>
          </>
        ) : null}
      </dl>

      {tile.status === 'waiting' ? (
        <p className="text-[13px] text-ink/70" data-post-event-waiting="">
          Nothing to do here yet — this scene fills itself after your day. Until then your guests never meet an empty
          box; you see it here, waiting.
        </p>
      ) : tile.status === 'skipped' ? (
        <p className="text-[13px] text-ink/70">
          Nothing is shown to guests here — never an empty box. It appears on its own when something arrives.
        </p>
      ) : null}

      {/* 🎬 THEIR OWN SCENE — its words, drafted. */}
      {own ? (
        <div className="space-y-2 rounded-md bg-white/70 p-2.5" data-post-event-own={own.id}>
          {tile.isNew && !ownsPro ? (
            <p className="text-[12px] font-semibold text-ink/75">
              A scene of your own comes with Event Hub Pro — try it here; Apply asks for Pro before guests see it.
            </p>
          ) : null}
          {preset && preset.shows !== 'words' ? (
            <p className="text-[12px] text-ink/65">
              {preset.shows === 'gallery'
                ? 'Six photos from your day show beside these words.'
                : preset.shows === 'film'
                  ? 'Your livestream replay or your film shows beside these words.'
                  : preset.shows === 'wishes'
                    ? 'Your guests’ approved wishes show beside these words.'
                    : 'Each guest opens their own day from here.'}
              {!dayHappened && preset.waiting ? ` Until then: “${preset.waiting}”` : ''}
            </p>
          ) : null}
          <label className="block text-[12px] font-semibold text-ink/70">
            Title
            <input
              type="text"
              value={title}
              maxLength={CUSTOM_COLUMN_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-md border border-ink/15 bg-white px-2.5 text-[15px] font-normal text-ink"
            />
          </label>
          <label className="block text-[12px] font-semibold text-ink/70">
            Words
            <textarea
              value={body}
              rows={4}
              maxLength={CUSTOM_COLUMN_BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink/15 bg-white px-2.5 py-2 text-[15px] font-normal text-ink"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || !arrangement || (title === own.title && body === own.body)}
              data-post-event-save-words=""
              onClick={() => {
                if (!arrangement) return;
                const r = postEventEdit(arrangement, own.id, title, body);
                if ('refused' in r) setError(REFUSAL[r.refused]);
                else save(r);
              }}
              className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-cream disabled:opacity-40"
            >
              Save the words
            </button>
            <button
              type="button"
              disabled={pending || !arrangement}
              data-post-event-remove=""
              onClick={() => {
                if (!arrangement) return;
                save(postEventRemove(arrangement, own.id), () => maker?.select(null));
              }}
              className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-terracotta hover:bg-ink/5 disabled:opacity-40"
            >
              <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Remove this scene
            </button>
          </div>
        </div>
      ) : null}

      {/* 👁 SHOW / HIDE and ⇅ ORDER — free, drafted. */}
      {arrangement && (tile.switchKey || tile.runKey) ? (
        <div className="flex flex-wrap items-center gap-2" data-post-event-controls="">
          {tile.switchKey ? (
            <button
              type="button"
              disabled={pending}
              aria-pressed={!tile.hidden}
              data-post-event-eye={tile.hidden ? 'show' : 'hide'}
              onClick={() => save(postEventShow(arrangement, tile.switchKey!, tile.hidden))}
              className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/80 px-3 text-sm font-semibold text-ink hover:bg-white disabled:opacity-40"
            >
              {tile.hidden ? <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} /> : <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
              {tile.hidden ? 'Show to guests' : 'Hide from guests'}
            </button>
          ) : null}
          {tile.runKey ? (
            <>
              <button
                type="button"
                disabled={pending || !earlier}
                data-post-event-move="earlier"
                onClick={() => earlier && save(earlier)}
                className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-white/80 px-3 text-sm font-semibold text-ink hover:bg-white disabled:opacity-40"
              >
                <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Earlier
              </button>
              <button
                type="button"
                disabled={pending || !later}
                data-post-event-move="later"
                onClick={() => later && save(later)}
                className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-white/80 px-3 text-sm font-semibold text-ink hover:bg-white disabled:opacity-40"
              >
                <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Later
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {tile.switchKey === 'gallery' ? (
        <p className="text-[12px] text-ink/60">
          The day’s chapters and the gallery share one switch — hiding one hides both.
        </p>
      ) : null}
      {tile.runKey === 'chapters' ? (
        <p className="text-[12px] text-ink/60">The day’s chapters move together, in the order they happened.</p>
      ) : null}
      {!arrangement ? (
        <p className="text-[12px] text-ink/60">Your story’s scenes could not be read just now — open the Maker again in a moment.</p>
      ) : (
        <p className="text-[12px] text-ink/55">Saved to your draft — guests see it after you press Apply.</p>
      )}
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-terracotta">
          {error}
        </p>
      ) : null}
      <Link
        href={`/dashboard/${eventId}/story`}
        className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-ink/70 underline-offset-2 hover:underline"
      >
        The words of the story, the chapters’ captions and who can read it — your story workroom
        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </section>
  );
}

/**
 * "+ ADD A SCENE" ON POST EVENT — the picker, with Post Event's own presets
 * (`lib/post-event-presets.ts`), saving the new scene into the draft and
 * opening it.
 */
export function PostEventAddScene({
  eventId,
  arrangement,
  ownsPro,
  device,
}: {
  eventId: string;
  arrangement: PostEventArrangement;
  ownsPro: boolean;
  device: 'desktop' | 'phone';
}) {
  const maker = useMaker();
  const { pending, error, setError, save } = useDraftSave(eventId);
  const full = arrangement.customColumns.length >= MAX_CUSTOM_COLUMNS;
  const pick = (presetId: PostEventPresetId) => {
    const id = newPostEventSceneId();
    const r = postEventAdd(arrangement, presetId, id);
    if ('refused' in r) {
      setError(REFUSAL[r.refused]);
      return;
    }
    save(r, () => maker?.select({ kind: 'post-event', scene: `custom:${id}` }));
  };
  return (
    <div data-post-event-add="">
      <SceneTemplatePicker
        overlay
        draft
        stageLabel="Post Event"
        heading="Add a scene to"
        triggerLabel="+ Add a scene"
        initialView={device === 'phone' ? 'phone' : 'desktop'}
        postEvent={{
          onPick: pick,
          pending: pending || full,
          note: full
            ? REFUSAL.full
            : ownsPro
              ? null
              : 'Your own scenes come with Event Hub Pro — try one here; Apply asks for Pro before guests see it.',
        }}
      />
      {error ? (
        <p role="alert" className="mt-1 text-[12px] font-semibold text-terracotta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
