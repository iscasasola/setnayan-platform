import { ArrowDown, ArrowUp, Eye, EyeOff, Lock } from 'lucide-react';
import {
  WIDGET_CATALOG_BY_TYPE,
  type InvitationWidgetRow,
} from '@/lib/invitation-widgets';
import {
  HUB_DEFAULT_FOCAL,
  HUB_DEFAULT_ZOOM,
  HUB_FOCAL_POINTS,
  HUB_MOTION_PRESETS,
  HUB_MOTION_PRESET_LABEL,
  HUB_TIMELINE_LABEL,
  HUB_ZOOMS,
  focalToObjectPosition,
  sanitizeHubCanvas,
} from '@/lib/hub-canvas';

/**
 * SectionsPanel — show / hide / reorder every section of the website, inline
 * (Unified Website Editor · PR-7).
 *
 * The most WYSIWYG-natural control in the rail: the couple rearranges their
 * page while watching it rearrange in the preview beside them, instead of
 * opening a separate manager. Server component — each control is its own tiny
 * form posting to the SAME widgets actions the sub-page uses
 * (`toggleWidgetVisibility` / `moveWidgetUp` / `moveWidgetDown` /
 * `setSectionMode`), so the write layer is untouched and the whole thing works
 * with no JavaScript (the PH slow-4G posture the widgets editor already holds).
 *
 * Three-state mode (Auto · Shown · Hidden) is the open-browse control: Auto
 * follows content, Shown forces it on, Hidden holds it back. `Shown` is
 * disabled while a section has no content — forcing on an empty section would
 * publish a blank block to guests (the rule `setSectionMode` enforces
 * server-side too).
 */

const RETURN_TO = (eventId: string) =>
  `/dashboard/${eventId}/website/editor?open=sections-order`;

export function SectionsPanel({
  eventId,
  rows,
  contentMap,
  toggleAction,
  moveUpAction,
  moveDownAction,
  setModeAction,
  setMotionAction,
  setBackgroundAction,
  setCropAction,
  photoChoices = [],
}: {
  eventId: string;
  /** Hideable widgets in display order (always-on rows are not listed — they
   *  can never be hidden or moved, so a control would be a lie). */
  rows: InvitationWidgetRow[];
  contentMap: Partial<Record<string, boolean>>;
  toggleAction: (formData: FormData) => void | Promise<void>;
  moveUpAction: (formData: FormData) => void | Promise<void>;
  moveDownAction: (formData: FormData) => void | Promise<void>;
  setModeAction: (formData: FormData) => void | Promise<void>;
  /** How this section MOVES (owner 2026-09-23). Optional so the panel keeps
   *  working for any caller that has not wired it yet. */
  setMotionAction?: (formData: FormData) => void | Promise<void>;
  /** Set or clear one section's background photo. */
  setBackgroundAction?: (formData: FormData) => void | Promise<void>;
  /** The couple's own photos — hero first, then gallery — as
   *  `{ ref, url }`. Only these are offered, and only these are accepted
   *  server-side. */
  photoChoices?: readonly { ref: string; url: string }[];
  /** Move the crop of a section's background photo. */
  setCropAction?: (formData: FormData) => void | Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-t border-dashed border-ink/10 bg-cream/40 p-3">
        <p className="text-[0.72rem] text-ink/55">
          Your sections will appear here once your event finishes setting up.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-dashed border-ink/10 bg-cream/40 p-3">
      <p className="mb-2 text-[0.7rem] text-ink/50">
        Drag-free ordering — move a section up or down, hide it, or let{' '}
        <span className="font-semibold text-ink/70">Auto</span> show it as soon as it has
        content.
      </p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, i) => {
          const catalog = WIDGET_CATALOG_BY_TYPE[row.widget_type];
          const mode = ((row as { mode?: string }).mode ?? 'auto') as
            | 'auto'
            | 'shown'
            | 'hidden';
          const hasContent = contentMap[row.widget_type] !== false;
          return (
            <li key={row.widget_id} className="rounded-lg border border-ink/10 bg-white p-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-[0.76rem] font-semibold text-ink">
                  {catalog?.label ?? row.widget_type}
                </span>

                {/* show / hide */}
                <form action={toggleAction}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="widget_type" value={row.widget_type} />
                  <input type="hidden" name="next_visible" value={row.is_visible ? '0' : '1'} />
                  <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                  <button
                    type="submit"
                    aria-label={row.is_visible ? `Hide ${catalog?.label}` : `Show ${catalog?.label}`}
                    className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[0.65rem] font-medium ${
                      row.is_visible
                        ? 'border-success-300/70 bg-success-50 text-success-800'
                        : 'border-ink/15 bg-cream text-ink/55'
                    }`}
                  >
                    {row.is_visible ? (
                      <Eye aria-hidden className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <EyeOff aria-hidden className="h-3 w-3" strokeWidth={2} />
                    )}
                    {row.is_visible ? 'Visible' : 'Hidden'}
                  </button>
                </form>

                {/* reorder */}
                <form action={moveUpAction}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label={`Move ${catalog?.label} up`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/15 bg-cream text-ink/60 disabled:opacity-35"
                  >
                    <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </form>
                <form action={moveDownAction}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                  <button
                    type="submit"
                    disabled={i === rows.length - 1}
                    aria-label={`Move ${catalog?.label} down`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink/15 bg-cream text-ink/60 disabled:opacity-35"
                  >
                    <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </form>
              </div>

              {/* Auto · Shown · Hidden */}
              <div className="mt-1.5 flex items-center gap-1">
                {(['auto', 'shown', 'hidden'] as const).map((m) => {
                  const active = mode === m;
                  const blocked = m === 'shown' && !hasContent;
                  return (
                    <form key={m} action={setModeAction} className="flex">
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="widget_id" value={row.widget_id} />
                      <input type="hidden" name="next_mode" value={m} />
                      <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                      <button
                        type="submit"
                        disabled={active || blocked}
                        title={
                          blocked
                            ? 'Add content to this section first.'
                            : m === 'auto'
                              ? 'Show it as soon as it has content.'
                              : m === 'shown'
                                ? 'Always show it.'
                                : 'Keep it off your Event Hub.'
                        }
                        className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[0.62rem] font-semibold capitalize ${
                          active
                            ? 'border-ink bg-ink text-cream'
                            : blocked
                              ? 'cursor-not-allowed border-ink/10 bg-cream/60 text-ink/30'
                              : 'border-ink/15 bg-cream text-ink/60 hover:border-ink/30'
                        }`}
                      >
                        {blocked ? (
                          <Lock aria-hidden className="h-2.5 w-2.5" strokeWidth={2.5} />
                        ) : null}
                        {m}
                      </button>
                    </form>
                  );
                })}
              </div>

              {/* ══ HOW IT MOVES ══════════════════════════════════════════
                  Owner 2026-09-23: "we only animate the details, the functions
                  of the event hub stay as an app. But must be presented
                  properly." Four named presets rather than eight knobs —
                  "we still want it to be simple enough that they could
                  customize this" — with the one override he cared about most
                  underneath: a timed play versus one the guest scrubs.

                  🔑 IT IS A ROW OF SUBMIT BUTTONS, NOT A CLIENT WIDGET. This
                  panel is a server component and the whole editor works with no
                  JavaScript (the PH slow-4G posture the widgets editor already
                  holds). The live preview beside it reloads on the redirect, so
                  a couple taps a preset and watches their own page change.

                  ⚠ AUTO IS AN ABSENCE. The Auto chip posts `timeline=auto`,
                  which DELETES the key — so a later change to what "Editorial"
                  means still reaches a couple who never overrode it. */}
              {setMotionAction ? (
                (() => {
                  const canvas = sanitizeHubCanvas(row.config_json);
                  const preset = canvas.preset ?? null;
                  return (
                    <div className="mt-2 border-t border-dashed border-ink/10 pt-2">
                      <p className="mb-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink/45">
                        How it moves
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        {HUB_MOTION_PRESETS.map((p) => (
                          <form key={p} action={setMotionAction}>
                            <input type="hidden" name="event_id" value={eventId} />
                            <input type="hidden" name="widget_id" value={row.widget_id} />
                            <input type="hidden" name="preset" value={p} />
                            <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                            <button
                              type="submit"
                              aria-pressed={preset === p}
                              className={`inline-flex h-6 items-center rounded-full border px-2 text-[0.62rem] font-semibold ${
                                preset === p
                                  ? 'border-ink bg-ink text-cream'
                                  : 'border-ink/15 bg-cream text-ink/60 hover:border-ink/30'
                              }`}
                            >
                              {HUB_MOTION_PRESET_LABEL[p]}
                            </button>
                          </form>
                        ))}
                      </div>
                      {preset ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">
                            Timing
                          </span>
                          {(['auto', 'time', 'scrub'] as const).map((t) => {
                            const on = t === 'auto' ? !canvas.timeline : canvas.timeline === t;
                            return (
                              <form key={t} action={setMotionAction}>
                                <input type="hidden" name="event_id" value={eventId} />
                                <input type="hidden" name="widget_id" value={row.widget_id} />
                                <input type="hidden" name="preset" value={preset} />
                                <input type="hidden" name="timeline" value={t} />
                                <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                                <button
                                  type="submit"
                                  aria-pressed={on}
                                  className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.58rem] ${
                                    on
                                      ? 'border-ink/60 bg-ink/5 font-semibold text-ink'
                                      : 'border-ink/12 bg-cream text-ink/50 hover:border-ink/30'
                                  }`}
                                >
                                  {t === 'auto' ? 'Auto' : HUB_TIMELINE_LABEL[t]}
                                </button>
                              </form>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })()
              ) : null}

              {/* ══ THE BACKGROUND ══════════════════════════════════════════
                  Chosen from photos the couple ALREADY has — their hero and
                  their gallery. There is no uploader here on purpose: adding
                  one per section would put a dozen client components on a page
                  that works with no JavaScript, and they already have a place
                  to upload. Pick here, upload there.

                  🔑 THE VALUE POSTED IS THE PHOTO'S OWN REF, never its position
                  in this list. The list reorders whenever they add or remove a
                  photo, so a stored index would silently move a section's
                  background with nothing red anywhere.

                  ⛔ "None" is always offered. A couple must be able to take a
                  background back off. */}
              {setBackgroundAction && photoChoices.length > 0 ? (
                (() => {
                  const canvas = sanitizeHubCanvas(row.config_json);
                  return (
                    <div className="mt-2 border-t border-dashed border-ink/10 pt-2">
                      <p className="mb-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink/45">
                        Background
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <form action={setBackgroundAction}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="widget_id" value={row.widget_id} />
                          <input type="hidden" name="media" value="" />
                          <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                          <button
                            type="submit"
                            aria-pressed={!canvas.media}
                            className={`inline-flex h-9 items-center rounded-md border px-2 text-[0.6rem] font-semibold ${
                              !canvas.media
                                ? 'border-ink bg-ink text-cream'
                                : 'border-ink/15 bg-cream text-ink/55 hover:border-ink/30'
                            }`}
                          >
                            None
                          </button>
                        </form>
                        {photoChoices.map((photo) => {
                          const on = canvas.media === photo.ref;
                          return (
                            <form key={photo.ref} action={setBackgroundAction}>
                              <input type="hidden" name="event_id" value={eventId} />
                              <input type="hidden" name="widget_id" value={row.widget_id} />
                              <input type="hidden" name="media" value={photo.ref} />
                              <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                              <button
                                type="submit"
                                aria-pressed={on}
                                aria-label={on ? 'Current background' : 'Use this photo as the background'}
                                className={`block h-9 w-12 overflow-hidden rounded-md border-2 ${
                                  on ? 'border-ink' : 'border-transparent hover:border-ink/30'
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={photo.url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                            </form>
                          );
                        })}
                      </div>

                      {/* ══ THE CROP ════════════════════════════════════════
                          Only once a photo is actually set. A focal point with
                          nothing to crop moves no pixels, and a control that
                          stores a decision with no effect is the exact defect
                          this build exists to remove — so it is not painted,
                          and `setWidgetCrop` refuses it server-side too.

                          🔑 THE KEYPAD SITS ON THE PHOTO. Nine transparent
                          buttons over a thumbnail of their own picture, so the
                          couple is choosing a point on the image rather than
                          decoding "top-left" from a word. The live preview
                          beside the rail then reloads with the real crop.

                          ⚠ It is a 3×3 POINT, never a pixel offset — the page
                          is 375px on a phone and 1440px on a laptop, and a
                          stored offset would be a bug waiting for a guest
                          (owner 2026-09-23: "rails on"). */}
                      {setCropAction && canvas.media ? (
                        (() => {
                          const current = photoChoices.find((p) => p.ref === canvas.media);
                          const focal = canvas.focal ?? HUB_DEFAULT_FOCAL;
                          const zoom = canvas.zoom ?? HUB_DEFAULT_ZOOM;
                          return (
                            <div className="mt-2">
                              <p className="mb-1 font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">
                                What to keep in frame
                              </p>
                              <div className="flex items-start gap-3">
                                <div
                                  className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-md border border-ink/15 bg-ink/5 bg-cover"
                                  style={
                                    current
                                      ? {
                                          backgroundImage: `url("${current.url}")`,
                                          backgroundPosition: focalToObjectPosition(focal),
                                        }
                                      : undefined
                                  }
                                >
                                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                                    {HUB_FOCAL_POINTS.map((f) => (
                                      <form key={f} action={setCropAction} className="contents">
                                        <input type="hidden" name="event_id" value={eventId} />
                                        <input type="hidden" name="widget_id" value={row.widget_id} />
                                        <input type="hidden" name="focal" value={f} />
                                        <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                                        <button
                                          type="submit"
                                          aria-pressed={focal === f}
                                          aria-label={`Keep area ${f} of 9 in frame`}
                                          className={`border border-white/35 ${
                                            focal === f ? 'bg-white/70' : 'hover:bg-white/25'
                                          }`}
                                        />
                                      </form>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="mb-1 font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">
                                    How close
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {HUB_ZOOMS.map((z) => (
                                      <form key={z} action={setCropAction}>
                                        <input type="hidden" name="event_id" value={eventId} />
                                        <input type="hidden" name="widget_id" value={row.widget_id} />
                                        <input type="hidden" name="zoom" value={z} />
                                        <input type="hidden" name="return_to" value={RETURN_TO(eventId)} />
                                        <button
                                          type="submit"
                                          aria-pressed={zoom === z}
                                          className={`inline-flex h-6 items-center rounded-full border px-2 text-[0.58rem] ${
                                            zoom === z
                                              ? 'border-ink/60 bg-ink/5 font-semibold text-ink'
                                              : 'border-ink/12 bg-cream text-ink/50 hover:border-ink/30'
                                          }`}
                                        >
                                          {z === 100 ? 'As it is' : z === 120 ? 'Closer' : 'Closest'}
                                        </button>
                                      </form>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : null}
                    </div>
                  );
                })()
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
