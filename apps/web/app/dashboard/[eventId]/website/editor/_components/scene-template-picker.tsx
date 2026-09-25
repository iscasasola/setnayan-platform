'use client';

import { useEffect, useState } from 'react';
import {
  SCENE_BUILT_ON_LABEL,
  SCENE_FAMILIES,
  SCENE_FAMILY_LABEL,
  sceneTemplatesIn,
  type SceneTemplate,
  type SceneThumbBox,
} from '@/lib/scene-templates';
import { HubDraftField, HubSavesImmediately } from '../../_components/hub-draft-field';
import {
  POST_EVENT_PRESET_FAMILY_LABEL,
  postEventPresetsIn,
  type PostEventPresetFamily,
  type PostEventPresetId,
} from '@/lib/post-event-presets';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';

/**
 * "+" — ADD A SCENE: THE 25 TEMPLATES, IN THE VIEW YOU ARE EDITING.
 *
 * Owner, 2026-09-24 (DECISION_LOG): *"+ opens the template picker"* → *"not the
 * arrow down. we do not have the blank anymore"* → *"if mobile view then
 * templates will show as mobile"*. So: no blank tile; five families; each tile
 * drawn as it will look on a desktop, a phone, or both side by side; headed
 * with the stage the scene is added to. Drawn from the "Add a scene" sheet in
 * `prototypes/event_hub_editor_FINAL_2026-09-24.html` — the thumbnails are its
 * own boxes, read into `lib/scene-templates.ts`.
 *
 * 🔑 A TILE IS A SUBMIT BUTTON. Picking posts the SAME form the old "+ Add a
 * section" posted, plus `template` — to `addCustomSection` for a new scene, or
 * to `saveCustomSection` (`intent=template`) to change an existing one. No new
 * server action; the only script here is which view the tiles are drawn in.
 */
export type SceneView = 'desktop' | 'phone' | 'both';

export function SceneTemplatePicker({
  action,
  hidden = {},
  stageLabel,
  heading,
  triggerLabel,
  currentTemplate = null,
  initialView = 'desktop',
  hideMediaSlots = false,
  overlay = false,
  facts = null,
  draft = false,
  postEvent = null,
}: {
  /**
   * 🎞 POST EVENT'S OWN PRESETS (owner 2026-09-25: *"scene creation will have
   * different preset scenes as well. different from save the date, invitation
   * and on the day"*). When set, the sheet offers `lib/post-event-presets.ts`
   * instead of the 25 layouts, and a tile is a button that hands its preset to
   * `onPick` — the caller saves it to the Event Hub DRAFT (`hubDraftAction`
   * intent=save). No form, so nothing here posts live. The other three stages
   * never pass it and keep their set.
   */
  postEvent?: {
    onPick: (preset: PostEventPresetId) => void;
    pending?: boolean;
    /** One line under the heading — Pro, or why a scene cannot be added. */
    note?: string | null;
  } | null;
  /**
   * 💾 The tiles save to the Event Hub DRAFT (`draft=1`). True for "Change
   * template" (`saveCustomSection` `intent=template` has a draft door); false
   * for "+ Add a scene", which inserts a new row at once — and then the sheet
   * says "Saves immediately" (`every-maker-form-drafts-or-says-so.test.ts`).
   */
  draft?: boolean;
  /**
   * The event's own words for the templates built on them — the prototype's
   * note: "names, monogram and '85' are real". Absent → a neutral "Aa".
   */
  facts?: { names?: string | null; monogram?: string | null; days?: number | null } | null;
  /**
   * Draw the picker as a sheet over everything (the Event Hub Maker's
   * navigator is too narrow to hold 25 tiles inline). Inline otherwise.
   */
  overlay?: boolean;
  /** The form every tile posts — absent only for the Post Event presets (`postEvent`), which post no form. */
  action?: (formData: FormData) => void | Promise<void>;
  /** Hidden fields every tile posts (event_id, widget_id, intent, return_to). */
  hidden?: Readonly<Record<string, string>>;
  /** "the Invitation" — the stage the scene is added to. */
  stageLabel: string;
  /** "Add a scene to" / "Change this scene's template in". */
  heading: string;
  triggerLabel: string;
  currentTemplate?: number | null;
  initialView?: SceneView;
  /**
   * The app-store shell: Pro is hidden there, so a template's picture slots
   * are drawn empty-free (build plan Phase 5 "Store shell: templates that need
   * media show without a media slot").
   */
  hideMediaSlots?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SceneView>(initialView);
  // The view follows the one being edited each time the picker opens.
  useEffect(() => {
    if (open) setView(initialView);
  }, [open, initialView]);
  useEffect(() => {
    if (!open || !overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, overlay]);

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-ink/25 px-3 text-[0.7rem] font-medium text-ink/75 transition-colors duration-sn-control ease-sn hover:border-ink/45"
      >
        {triggerLabel}
      </button>
      {open && overlay ? (
        <button
          type="button"
          aria-label="Close the templates"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[90] cursor-default bg-ink/30"
        />
      ) : null}
      {open ? (
        <div
          role="dialog"
          aria-label={`${heading} ${stageLabel}`}
          className={
            overlay
              ? 'fixed inset-x-3 bottom-3 top-16 z-[91] mx-auto max-w-3xl overflow-y-auto rounded-md border border-ink/10 bg-cream p-3 shadow-lg sm:inset-x-6'
              : 'mt-2 rounded-md border border-ink/10 bg-cream p-3 shadow-sm'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-serif text-base text-ink">
              {heading} <span className="italic">{stageLabel}</span>
            </p>
            {!draft ? <HubSavesImmediately /> : null}
            <div role="group" aria-label="Show the templates as on" className="flex items-center rounded-full bg-ink/5 p-0.5">
              {(['desktop', 'phone', 'both'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`inline-flex h-7 items-center rounded-full px-2.5 text-[0.65rem] font-semibold ${
                    view === v ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  {v === 'desktop' ? 'Desktop' : v === 'phone' ? 'Phone' : 'Both'}
                </button>
              ))}
            </div>
            {overlay ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 items-center rounded-full px-3 text-[0.7rem] font-semibold text-ink/70 hover:bg-ink/5"
              >
                Close
              </button>
            ) : null}
          </div>
          {postEvent ? (
            <PostEventPresetTiles
              view={view}
              hideMedia={hideMediaSlots}
              pending={Boolean(postEvent.pending)}
              note={postEvent.note ?? null}
              onPick={(id) => {
                postEvent.onPick(id);
                setOpen(false);
              }}
            />
          ) : (
          <>
          <p className="mt-1 text-[0.62rem] text-ink/50">
            ★ the four approved arrangements · shown{' '}
            {view === 'desktop' ? 'as on a desktop' : view === 'phone' ? 'as on a phone' : 'desktop · phone'} · each
            comes with its own effect, and you can change it
          </p>
          {SCENE_FAMILIES.map((family) => (
            <div key={family} className="mt-3">
              <p className="mb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink/45">
                {SCENE_FAMILY_LABEL[family]}
              </p>
              <div
                className={`grid gap-2 ${
                  view === 'both' ? 'grid-cols-2 sm:grid-cols-3' : view === 'phone' ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                {sceneTemplatesIn(family).map((t) => (
                  <form key={t.id} action={action}>
                    {draft ? <HubDraftField /> : null}
                    {Object.entries(hidden).map(([k, v]) => (
                      <input key={k} type="hidden" name={k} value={v} />
                    ))}
                    <input type="hidden" name="template" value={String(t.id)} />
                    <button
                      type="submit"
                      aria-pressed={currentTemplate === t.id}
                      title={t.builtOn ? SCENE_BUILT_ON_LABEL[t.builtOn] : t.name}
                      className={`flex w-full flex-col gap-1 rounded-md p-1.5 text-left transition-colors duration-sn-control ease-sn ${
                        currentTemplate === t.id ? 'bg-ink/10 ring-1 ring-ink/40' : 'hover:bg-ink/5'
                      }`}
                    >
                      <span className={`flex items-start gap-1 ${view === 'both' ? '' : 'justify-center'}`}>
                        {view !== 'phone' ? (
                          <Thumb boxes={t.thumb.desk} shape="desk" hideMedia={hideMediaSlots} word={realWord(t, facts)} />
                        ) : null}
                        {view !== 'desktop' ? (
                          <Thumb boxes={t.thumb.phone} shape="phone" hideMedia={hideMediaSlots} word={realWord(t, facts)} />
                        ) : null}
                      </span>
                      <span className="text-[0.62rem] leading-tight text-ink/75">
                        {label(t)}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
          </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 🎞 POST EVENT'S PRESET TILES — drawn with the layout each one uses (one of the
 * 25, so the thumbnail is the approved drawing), named for what it is on the
 * story after the day. A tile is a plain button: `onPick` saves to the draft.
 */
function PostEventPresetTiles({
  view,
  hideMedia,
  pending,
  note,
  onPick,
}: {
  view: SceneView;
  hideMedia: boolean;
  pending: boolean;
  note: string | null;
  onPick: (id: PostEventPresetId) => void;
}) {
  const families: PostEventPresetFamily[] = ['words', 'day'];
  return (
    <>
      <p className="mt-1 text-[0.62rem] text-ink/60" data-post-event-presets="">
        Scenes made for the story after the day · each starts with words you can change · it goes into your draft,
        and guests see it after you press Apply
      </p>
      {note ? <p className="mt-1 text-[0.7rem] font-semibold text-ink/75">{note}</p> : null}
      {families.map((family) => (
        <div key={family} className="mt-3">
          <p className="mb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink/45">
            {POST_EVENT_PRESET_FAMILY_LABEL[family]}
          </p>
          <div
            className={`grid gap-2 ${
              view === 'both' ? 'grid-cols-2 sm:grid-cols-3' : view === 'phone' ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
            }`}
          >
            {postEventPresetsIn(family).map((p) => {
              const t = SCENE_TEMPLATES[p.template];
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending}
                  data-post-event-preset={p.id}
                  onClick={() => onPick(p.id)}
                  title={p.blurb}
                  className="flex min-h-11 w-full flex-col gap-1 rounded-md p-1.5 text-left transition-colors duration-sn-control ease-sn hover:bg-ink/5 disabled:opacity-50"
                >
                  <span className={`flex items-start gap-1 ${view === 'both' ? '' : 'justify-center'}`}>
                    {view !== 'phone' ? <Thumb boxes={t.thumb.desk} shape="desk" hideMedia={hideMedia} word="Aa" /> : null}
                    {view !== 'desktop' ? <Thumb boxes={t.thumb.phone} shape="phone" hideMedia={hideMedia} word="Aa" /> : null}
                  </span>
                  <span className="text-[0.7rem] font-semibold leading-tight text-ink/85">{p.name}</span>
                  <span className="text-[0.6rem] leading-snug text-ink/60">{p.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/** The real word a built-on template prints, for its tile — or "Aa". */
function realWord(
  t: SceneTemplate,
  facts: { names?: string | null; monogram?: string | null; days?: number | null } | null,
): string {
  if (t.builtOn === 'names' && facts?.names) return facts.names;
  if (t.builtOn === 'monogram' && facts?.monogram) return facts.monogram;
  if (t.builtOn === 'countdown' && typeof facts?.days === 'number') return String(facts.days);
  return 'Aa';
}

function label(t: SceneTemplate): string {
  return `${t.approved ? '★ ' : ''}${t.id} · ${t.name}`;
}

/**
 * One tile's drawing. Every box is a percentage of the tile, so the same data
 * draws at any size; a fixed frame (16:10 desktop, 9:16 phone) keeps every
 * thumbnail the same shape, content inside it.
 */
function Thumb({
  boxes,
  shape,
  hideMedia,
  word,
}: {
  boxes: readonly SceneThumbBox[];
  shape: 'desk' | 'phone';
  hideMedia: boolean;
  word: string;
}) {
  return (
    <span
      aria-hidden
      className={`relative block overflow-hidden rounded-sm border border-ink/10 bg-white ${
        shape === 'desk' ? 'aspect-[16/10] w-full' : 'aspect-[9/16] w-[46%] min-w-[2.5rem]'
      }`}
    >
      {boxes.map(([kind, x, y, w, h, tone], i) => {
        if (hideMedia && (kind === 'photo' || kind === 'play')) return null;
        const pos = { left: `${x}%`, top: `${y}%` } as React.CSSProperties;
        if (kind === 'play') {
          return <i key={i} className="absolute text-[0.5rem] not-italic leading-none text-white" style={pos}>▶</i>;
        }
        if (kind === 'dot') {
          return <i key={i} className="absolute h-[8%] w-[5%] rounded-full bg-terracotta/70" style={pos} />;
        }
        if (kind === 'txt') {
          return (
            <i key={i} className="absolute truncate px-0.5 text-center font-serif text-[0.85rem] not-italic leading-none text-ink/85" style={{ ...pos, width: `${w}%` }}>
              {word}
            </i>
          );
        }
        const fill =
          kind === 'photo'
            ? 'bg-gradient-to-br from-terracotta/35 to-ink/35'
            : kind === 'col'
              ? 'bg-paper-deep'
              : tone === 'a'
                ? 'bg-terracotta/55'
                : tone === 'l'
                  ? 'bg-white/85'
                  : 'bg-ink/25';
        return (
          <i
            key={i}
            className={`absolute ${kind === 'line' ? 'rounded-full' : 'rounded-sm'} ${fill}`}
            style={{ ...pos, width: `${w}%`, height: `${h}%` }}
          />
        );
      })}
    </span>
  );
}
