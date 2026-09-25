import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { HUB_SLOT_HEAD_MAX, HUB_SLOT_TEXT_MAX, sanitizeHubCanvas } from '@/lib/hub-canvas';
import { SCENE_BUILT_ON_LABEL, SCENE_TEMPLATES } from '@/lib/scene-templates';
import { SceneTemplatePicker, type SceneView } from './scene-template-picker';

/**
 * ONE TEMPLATE SCENE'S OWN CONTROLS — which template, what fills its slots, how
 * its clip plays (Event Hub Maker Phase 5).
 *
 * Mounted by `SectionsPanel` under a scene the couple added, in place of the
 * four-arrangement "Layout" row, which a template scene does not use. Every
 * control posts to `saveCustomSection` with its intent (`template` · `slot` ·
 * `video`); no new server action. No script: every choice is a form.
 *
 * ⛔ PRO, SAID ONCE AND NEVER A DEAD CONTROL. Putting a picture or a clip into a
 * scene is Event Hub Pro (owner: media is Pro). Without it the picture rows
 * show only what is already there and how to take it off, plus one line saying
 * what Pro adds — never a picker that the server would refuse. The words and
 * the template pick are free under the section's grandfather rule.
 */
export function SceneSlotsPanel({
  eventId,
  row,
  saveAction,
  photoChoices,
  videoChoice,
  ownsPro,
  hideLocked,
  returnTo,
  stageLabel,
  initialView,
}: {
  eventId: string;
  row: InvitationWidgetRow;
  saveAction: (formData: FormData) => void | Promise<void>;
  photoChoices: readonly { ref: string; url: string }[];
  videoChoice: { ref: string; url: string } | null;
  ownsPro: boolean;
  /** The app-store shell: a Pro control is hidden, not shown locked. */
  hideLocked: boolean;
  returnTo: string;
  stageLabel: string;
  initialView?: SceneView;
}) {
  const canvas = sanitizeHubCanvas(row.config_json);
  if (!canvas.template) return null;
  const t = SCENE_TEMPLATES[canvas.template];
  const slots = canvas.slots ?? [];
  const base = { event_id: eventId, widget_id: row.widget_id, return_to: returnTo };
  const urlOf = (ref: string | undefined) =>
    ref ? (photoChoices.find((p) => p.ref === ref)?.url ?? (videoChoice?.ref === ref ? videoChoice.url : null)) : null;
  const hasSnippet = slots.slice(0, t.media).some((s) => s.kind === 'snippet');
  const blockWords =
    t.layout === 'timeline'
      ? { head: 'When', text: 'What happened' }
      : t.layout === 'qa'
        ? { head: 'Question', text: 'Answer' }
        : { head: 'Heading', text: 'Words' };
  // Show every filled block and one empty one, up to the template's count.
  const blockCount = Math.min(
    t.blocks,
    Math.max(1, slots.slice(0, t.blocks).filter((s) => s.head || s.text).length + 1),
  );

  return (
    <div className="mt-2 space-y-2 border-t border-dashed border-ink/10 pt-2" data-scene-slots="">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink/45">Template</p>
        <p className="text-[0.7rem] font-medium text-ink/80">
          {t.approved ? '★ ' : ''}
          {t.id} · {t.name}
        </p>
      </div>
      {t.builtOn ? <p className="text-[0.62rem] text-ink/55">{SCENE_BUILT_ON_LABEL[t.builtOn]}.</p> : null}
      <SceneTemplatePicker
        overlay
        action={saveAction}
        hidden={{ ...base, intent: 'template' }}
        stageLabel={stageLabel}
        heading="Change this scene's template in"
        triggerLabel="Change template"
        currentTemplate={t.id}
        initialView={initialView}
        hideMediaSlots={hideLocked && !ownsPro}
      />

      {/* ══ THE PICTURES ══ */}
      {t.media > 0 && !(hideLocked && !ownsPro) ? (
        <div className="space-y-1.5">
          {Array.from({ length: t.media }, (_, i) => {
            const slot = slots[i] ?? {};
            const current = urlOf(slot.media);
            return (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 text-[0.62rem] text-ink/55">
                  {t.clip ? 'Clip' : t.media > 1 ? `Photo ${i + 1}` : 'Photo'}
                </span>
                {slot.media ? (
                  <form action={saveAction}>
                    {hiddenInputs({ ...base, intent: 'slot', slot: String(i), media: '' })}
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-md border border-ink/15 bg-cream px-2 text-[0.6rem] font-semibold text-ink/60 hover:border-ink/30"
                    >
                      Take it off
                    </button>
                  </form>
                ) : null}
                {current && slot.kind !== 'snippet' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current} alt="" className="h-9 w-12 rounded-md border-2 border-ink object-cover" />
                ) : slot.kind === 'snippet' ? (
                  <span className="inline-flex h-9 items-center rounded-md border-2 border-ink px-2 text-[0.6rem] font-semibold text-ink">
                    Your video
                  </span>
                ) : null}
                {ownsPro ? (
                  <>
                    {videoChoice && (t.clip || t.family === 'media' || t.family === 'media_text') ? (
                      <form action={saveAction}>
                        {hiddenInputs({ ...base, intent: 'slot', slot: String(i), media: videoChoice.ref, kind: 'snippet' })}
                        <button
                          type="submit"
                          aria-pressed={slot.kind === 'snippet'}
                          className="inline-flex h-9 items-center rounded-md border border-ink/15 bg-cream px-2 text-[0.6rem] font-semibold text-ink/60 hover:border-ink/30"
                        >
                          Your video
                        </button>
                      </form>
                    ) : null}
                    {t.clip && !videoChoice ? (
                      <span className="text-[0.6rem] text-ink/50">
                        Add a short clip at the top of your Event Hub first, then choose it here.
                      </span>
                    ) : null}
                    {photoChoices.map((photo) => {
                      const on = slot.media === photo.ref;
                      return (
                        <form key={photo.ref} action={saveAction}>
                          {hiddenInputs({ ...base, intent: 'slot', slot: String(i), media: photo.ref })}
                          <button
                            type="submit"
                            aria-pressed={on}
                            aria-label={on ? `Current ${t.media > 1 ? `photo ${i + 1}` : 'photo'}` : 'Use this photo here'}
                            className={`block h-9 w-12 overflow-hidden rounded-md border-2 ${
                              on ? 'border-ink' : 'border-transparent hover:border-ink/30'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        </form>
                      );
                    })}
                    {photoChoices.length === 0 && !t.clip ? (
                      <span className="text-[0.6rem] text-ink/50">
                        Add photos to your gallery first, then choose them here.
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
          {!ownsPro ? (
            <p className="text-[0.62rem] text-ink/55">
              Putting your own photos and clips into a scene comes with{' '}
              <a href={`/dashboard/${eventId}/studio/website-pro`} className="font-semibold underline underline-offset-2">
                Event Hub Pro
              </a>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ══ HOW A CLIP PLAYS — only once a clip is in the scene. ══ */}
      {hasSnippet && ownsPro ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">Clip</span>
          {(
            [
              ['loop', undefined, 'Loops quietly'],
              ['tap', 'fullscreen', 'Tap to play · full screen'],
              ['tap', 'inplace', 'Tap to play · in place'],
            ] as const
          ).map(([play, open, text]) => {
            const on =
              play === 'loop'
                ? !canvas.video
                : canvas.video?.play === 'tap' && (canvas.video.open ?? 'fullscreen') === open;
            return (
              <form key={text} action={saveAction}>
                {hiddenInputs({ ...base, intent: 'video', play, ...(open ? { open } : {}) })}
                <button
                  type="submit"
                  aria-pressed={on}
                  className={`inline-flex h-6 items-center rounded-full border px-2 text-[0.6rem] ${
                    on ? 'border-ink/60 bg-ink/5 font-semibold text-ink' : 'border-ink/12 bg-cream text-ink/55 hover:border-ink/30'
                  }`}
                >
                  {text}
                </button>
              </form>
            );
          })}
        </div>
      ) : null}

      {/* ══ THE WORD BLOCKS — group-of-texts templates. ══ */}
      {t.blocks > 0 ? (
        <div className="space-y-1.5">
          {Array.from({ length: blockCount }, (_, i) => {
            const slot = slots[i] ?? {};
            return (
              <form key={i} action={saveAction} className="space-y-1 rounded-md border border-ink/10 bg-white/60 p-2">
                {hiddenInputs({ ...base, intent: 'slot', slot: String(i) })}
                <label className="sr-only" htmlFor={`slot-head-${row.widget_id}-${i}`}>
                  {blockWords.head} {i + 1}
                </label>
                <input
                  id={`slot-head-${row.widget_id}-${i}`}
                  name="head"
                  type="text"
                  maxLength={HUB_SLOT_HEAD_MAX}
                  defaultValue={slot.head ?? ''}
                  placeholder={`${blockWords.head} ${i + 1}`}
                  className="min-h-[34px] w-full rounded-md border border-ink/15 bg-white px-2 text-[0.72rem] text-ink placeholder:text-ink/40"
                />
                <label className="sr-only" htmlFor={`slot-text-${row.widget_id}-${i}`}>
                  {blockWords.text} {i + 1}
                </label>
                <textarea
                  id={`slot-text-${row.widget_id}-${i}`}
                  name="text"
                  rows={2}
                  maxLength={HUB_SLOT_TEXT_MAX}
                  defaultValue={slot.text ?? ''}
                  placeholder={blockWords.text}
                  className="w-full rounded-md border border-ink/15 bg-white px-2 py-1 text-[0.72rem] leading-relaxed text-ink placeholder:text-ink/40"
                />
                <button type="submit" className="inline-flex h-7 items-center rounded-full bg-ink px-3 text-[0.62rem] font-semibold text-cream">
                  Save
                </button>
              </form>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function hiddenInputs(fields: Readonly<Record<string, string>>) {
  return Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
}
