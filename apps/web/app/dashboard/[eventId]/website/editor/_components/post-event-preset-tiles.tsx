'use client';

import { PaidMark } from '@/app/_components/paid-mark';
import { InfoTip } from '@/app/_components/info-tip';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import { formatCount } from '@/lib/format-number';
import type { PostEventPreset } from '@/lib/post-event-presets';
import { HubDraftField } from '../../_components/hub-draft-field';
import { MAX_OWN_SCENES, Thumb, type SceneView } from './scene-template-picker';

/**
 * THE TWELVE, as tiles — a real mini picture of the template each is drawn
 * with, its name, the template's name small, ◆ (Pro — never a padlock: a tap
 * still places it), and ⓘ for its purpose. The used slots are dots, not a
 * warning; with all six used the tiles say so and post nothing.
 */
export function PresetTiles({
  presets,
  action,
  hidden,
  draft,
  view,
  onPick,
}: {
  presets: { items: readonly PostEventPreset[]; used: number; ownsPro: boolean; storeShell: boolean };
  action: (formData: FormData) => void | Promise<void>;
  hidden: Readonly<Record<string, string>>;
  draft: boolean;
  view: SceneView;
  onPick?: (template: number) => void;
}) {
  const full = presets.used >= MAX_OWN_SCENES;
  // 💎 #6091's Maker mark: ◆ PRO while tried, the diamond once owned; in the
  // store shell a couple without Pro never reaches here (`makerProUsable`).
  const mark = makerProMark({ owns: presets.ownsPro, storeShell: presets.storeShell });
  return (
    <div data-post-event-presets="">
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[0.7rem] font-semibold text-ink">Six slots</span>
        <span aria-label={`${formatCount(presets.used)} of ${formatCount(MAX_OWN_SCENES)} used`} className="flex gap-1">
          {Array.from({ length: MAX_OWN_SCENES }, (_, i) => (
            <span key={i} aria-hidden className={`h-2 w-2 rounded-full ${i < presets.used ? 'bg-ink' : 'bg-ink/15'}`} />
          ))}
        </span>
        <span className="text-[0.7rem] text-ink/60">{presets.used} used · shared with your other stages</span>
      </div>
      <p className="mt-1 text-[0.7rem] text-ink/65" data-post-event-presets-note="">
        {full
          ? 'You have all six of your own scenes. Remove one you are not using to add another.'
          : presets.ownsPro
            ? 'Each goes into your draft — guests see it when you press Apply.'
            : 'Every preset is part of Event Hub Pro — try it now; Pro is asked for when you press Apply.'}
      </p>
      <div className={`mt-2 grid gap-2 ${view === 'desktop' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {presets.items.map((p) => {
          const t = SCENE_TEMPLATES[p.template];
          return (
            <form key={p.id} action={action} onSubmit={() => onPick?.(p.template)} className="relative">
              {draft ? <HubDraftField /> : null}
              {Object.entries(hidden).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <input type="hidden" name="template" value={String(p.template)} />
              <input type="hidden" name="post_event_preset" value={p.id} />
              <button
                type="submit"
                disabled={full}
                data-post-event-preset={p.id}
                className="flex min-h-11 w-full flex-col gap-1 rounded-md p-1.5 text-left transition-colors duration-sn-control ease-sn hover:bg-ink/5 disabled:opacity-45"
              >
                <span className="flex justify-center">
                  <Thumb boxes={view === 'desktop' ? t.thumb.desk : t.thumb.phone} shape={view === 'desktop' ? 'desk' : 'phone'} hideMedia={false} word={p.name} />
                </span>
                <span className="flex items-center gap-1 pr-7 text-[0.7rem] font-semibold leading-tight text-ink">
                  {/* ◆ marks what Pro covers — the diamond, never a padlock: the tap still places it (2026-09-29). */}
                  {mark ? <PaidMark state={mark} size="xs" label={paidMarkLabel(mark, 'Event Hub Pro')} /> : null}
                  {p.name}
                </span>
                <span className="text-[0.62rem] leading-tight text-ink/60">{p.fields}</span>
              </button>
              <span className="absolute right-1 top-[calc(100%-2.6rem)]">
                <InfoTip label="" ariaLabel={`About ${p.name}`} align="end">
                  {p.purpose}
                </InfoTip>
              </span>
            </form>
          );
        })}
      </div>
    </div>
  );
}
