'use client';

import { useState } from 'react';
import {
  SCENE_BUILT_ON_LABEL,
  SCENE_FAMILIES,
  SCENE_FAMILY_LABEL,
  sceneTemplatesIn,
  type SceneTemplate,
  type SceneThumbBox,
} from '@/lib/scene-templates';

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
}: {
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
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SceneView>(initialView);

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
      {open ? (
        <div
          role="dialog"
          aria-label={`${heading} ${stageLabel}`}
          className="mt-2 rounded-md border border-ink/10 bg-cream p-3 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-serif text-base text-ink">
              {heading} <span className="italic">{stageLabel}</span>
            </p>
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
          </div>
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
                          <Thumb boxes={t.thumb.desk} shape="desk" hideMedia={hideMediaSlots} />
                        ) : null}
                        {view !== 'desktop' ? (
                          <Thumb boxes={t.thumb.phone} shape="phone" hideMedia={hideMediaSlots} />
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
        </div>
      ) : null}
    </div>
  );
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
}: {
  boxes: readonly SceneThumbBox[];
  shape: 'desk' | 'phone';
  hideMedia: boolean;
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
            <i key={i} className="absolute text-center font-serif text-[0.55rem] not-italic leading-none text-ink/80" style={{ ...pos, width: `${w}%` }}>
              Aa
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
