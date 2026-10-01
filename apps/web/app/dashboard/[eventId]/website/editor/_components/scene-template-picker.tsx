'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SCENE_BUILT_ON_LABEL,
  SCENE_FAMILIES,
  SCENE_FAMILY_LABEL,
  sceneTemplatesIn,
  type SceneTemplate,
} from '@/lib/scene-templates';
import { HubDraftField, HubSavesImmediately } from '../../_components/hub-draft-field';
import dynamic from 'next/dynamic';
import { PickMenu } from './pick-menu';
import { SlotRows } from '../../../launch/_components/lazy-slot';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';

/* `Thumb` and `MAX_OWN_SCENES` live in `scene-thumb.tsx` so the lazy preset
   tiles (`maker-details`) can draw a tile without importing this picker — a
   first-screen module (train n: the shared-bundle runtime, see that file). */
export { MAX_OWN_SCENES, Thumb } from './scene-thumb';
import { Thumb } from './scene-thumb';
/* ⚡ Post Event's twelve preset tiles load with its sheet (the EXISTING
   `maker-details` chunk), never in the Maker's first load
   (`scripts/check-maker-js-budget.mjs`). */
const PresetTiles = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ './post-event-preset-tiles').then((m) => m.PresetTiles),
  { loading: SlotRows },
);
import type { PostEventPresetsProp } from './post-event-preset-tiles';

/** Desktop · Phone · Both — one dropdown (owner: a set of choices is one PickMenu, never a pill row). */
const SCENE_VIEW_OPTIONS = [
  { key: 'desktop', label: 'Desktop' },
  { key: 'phone', label: 'Phone' },
  { key: 'both', label: 'Both' },
] as const;

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
  hidden,
  stageLabel,
  heading,
  triggerLabel,
  currentTemplate = null,
  initialView = 'desktop',
  hideMediaSlots = false,
  overlay = false,
  facts = null,
  draft = false,
  open: openProp,
  onOpenChange,
  onPick,
  tour = null,
  presets = null,
}: {
  /**
   * 🎞 POST EVENT'S OWN "+" (owner 2026-09-25: *"scene creation will have
   * different preset scenes as well"*) — the twelve presets instead of the 25
   * templates. Each tile posts the SAME form, plus `post_event_preset`; every
   * one is ◆ Pro (E3) and a tap still places it in the draft (try-then-pay —
   * Apply is where Pro is asked). `used` = the couple's own scenes across every
   * stage (six, shared — E5).
   */
  presets?: PostEventPresetsProp | null;
  /**
   * Controlled open state, for a sheet with a second door (the Maker's toolbar
   * ＋ opens the same "Add a scene" sheet as the navigator's button). Absent →
   * the picker keeps its own.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * A tile was tapped and its form is posting (the post itself is untouched —
   * the tile stays a submit button). The Maker uses it to remember which
   * scenes it had, so it can select the one that appears.
   */
  onPick?: (template: number) => void;
  /** The first-visit tour (`MiniTour`), server-rendered and handed down; mounts with the sheet. */
  tour?: ReactNode;
  /**
   * 💾 The tiles save to the Event Hub DRAFT (`draft=1`). True for "Change
   * template" (`saveCustomSection` `intent=template`) and for the Maker's
   * "+ Add a scene" (`addCustomSection` inserts the row HIDDEN and drafts it
   * shown — guests meet it at Apply). A picker without it says "Saves
   * immediately" (`every-maker-form-drafts-or-says-so.test.ts`).
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
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden fields every tile posts (event_id, widget_id, intent, return_to). */
  hidden: Readonly<Record<string, string>>;
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
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean | ((was: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (openProp === undefined) setOwnOpen(value);
    onOpenChange?.(value);
  };
  /* ⚡ THE TAPPED TILE IS PRESSED AT ONCE (owner 2026-09-29: *"make sure 100%
     that there is no slow response on the maker"*) — not when the render its
     post brings lands. The server's `currentTemplate` takes over again as soon
     as it moves, and whenever the sheet is opened afresh. */
  const [tapped, setTapped] = useState<number | null>(null);
  useEffect(() => setTapped(null), [currentTemplate, open]);
  const pressed = tapped ?? currentTemplate;
  const [view, setView] = useState<SceneView>(initialView);
  // The view follows the one being edited each time the picker opens.
  useEffect(() => {
    if (open) setView(initialView);
  }, [open, initialView]);
  const closeRef = useRef(() => setOpen(false));
  closeRef.current = () => setOpen(false);
  useEffect(() => {
    if (!open || !overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
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
              ? /* 📱 A bottom sheet on a phone (rounded top, from the bottom
                   edge, the page still peeking above); a panel from sm up. */
                'fixed inset-x-0 bottom-0 top-auto z-[91] mx-auto max-h-[85dvh] max-w-3xl overflow-y-auto rounded-t-3xl border border-ink/10 bg-cream p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:inset-x-6 sm:bottom-3 sm:top-16 sm:max-h-none sm:rounded-md'
              : 'mt-2 rounded-md border border-ink/10 bg-cream p-3 shadow-sm'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-serif text-base text-ink">
              {heading} <span className="italic">{stageLabel}</span>
            </p>
            {!draft ? <HubSavesImmediately /> : null}
            <PickMenu
              label="Show the templates as on"
              value={view}
              options={SCENE_VIEW_OPTIONS}
              onPick={(k) => setView(k as SceneView)}
              dataAttr="data-scene-view"
            />
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
          {tour}
          {presets ? (
            <PresetTiles
              presets={presets}
              action={action}
              hidden={hidden}
              draft={draft}
              view={view}
              onPick={onPick}
            />
          ) : null}
          {presets ? null : (
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
                  <form
                    key={t.id}
                    action={action}
                    onSubmit={() => {
                      setTapped(t.id);
                      onPick?.(t.id);
                    }}
                  >
                    {draft ? <HubDraftField /> : null}
                    {Object.entries(hidden).map(([k, v]) => (
                      <input key={k} type="hidden" name={k} value={v} />
                    ))}
                    <input type="hidden" name="template" value={String(t.id)} />
                    <button
                      type="submit"
                      aria-pressed={pressed === t.id}
                      aria-busy={tapped === t.id && tapped !== currentTemplate ? true : undefined}
                      title={t.builtOn ? SCENE_BUILT_ON_LABEL[t.builtOn] : t.name}
                      className={`flex w-full flex-col gap-1 rounded-md p-1.5 text-left transition-colors duration-sn-control ease-sn ${
                        pressed === t.id ? 'bg-ink/10 ring-1 ring-ink/40' : 'hover:bg-ink/5'
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
