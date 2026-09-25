import { ArrowDown, ArrowUp, Eye, EyeOff, Lock } from 'lucide-react';
import {
  WIDGET_CATALOG_BY_TYPE,
  type InvitationWidgetRow,
} from '@/lib/invitation-widgets';
import {
  customSectionEditorLabel,
  customSectionHasContent,
  isCustomSectionType,
  nextFreeCustomSlot,
  sanitizeCustomSection,
  CUSTOM_COLUMN_BODY_MAX,
  CUSTOM_COLUMN_TITLE_MAX,
} from '@/lib/custom-sections';
import {
  HUB_ARRANGEMENTS,
  HUB_ARRANGEMENT_LABEL,
  HUB_DEFAULT_ARRANGEMENT,
  HUB_DEFAULT_FOCAL,
  HUB_DEFAULT_ZOOM,
  HUB_FOCAL_POINTS,
  HUB_MOTION_PRESETS,
  HUB_DIRECTIONS,
  HUB_IN,
  HUB_IN_DIRECTION_LABEL,
  HUB_IN_LABEL,
  HUB_MOTION_PRESET_LABEL,
  HUB_OUT,
  HUB_OUT_DIRECTION_LABEL,
  HUB_OUT_LABEL,
  HUB_SEQUENCE_LABEL,
  hubInMoves,
  hubOutMoves,
  resolveHubMotion,
  HUB_TIMELINE_LABEL,
  HUB_ZOOMS,
  focalToObjectPosition,
  sanitizeHubCanvas,
} from '@/lib/hub-canvas';
import { canvasHasMotion } from '@/lib/hub-look-pro';
import { HubDraftField, HubSavesImmediately } from '../../_components/hub-draft-field';
import {
  HUB_AUTO_SPEEDS,
  HUB_AUTO_SPEED_LABEL,
  HUB_DEFAULT_AUTO_SPEED,
  HUB_TRANSITIONS,
  HUB_TRANSITION_HINT,
  HUB_TRANSITION_LABEL,
  resolveTransition,
} from '@/lib/hub-scenes';

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
  transitionLocked = false,
  setBackgroundAction,
  setCropAction,
  saveCustomAction,
  addCustomAction,
  photoChoices = [],
  ownsPro = true,
  customLock = null,
  lookLock = null,
  videoChoice = null,
  colorChoices = [],
  only = null,
  returnTo = null,
  hideLocked = false,
}: {
  /**
   * THE EVENT HUB MAKER'S INSPECTOR (2026-09-25) shows ONE section at a time.
   * `only` renders just that row — but the whole list is still walked, so its
   * index, its neighbours and "is this the last section" stay true (a one-row
   * slice would call every section the last one and hide its transition).
   */
  only?: string | null;
  /** Where each write lands afterwards. Defaults to the editor's own row. */
  returnTo?: string | null;
  /**
   * The app-store shell: a Pro-only control is HIDDEN, not shown locked (owner
   * 2026-09-25 — web-bought Pro is not usable in the app yet, and a lock there
   * is a paid pitch). Free controls are untouched.
   */
  hideLocked?: boolean;
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
  /**
   * TRUE when the event does not own Event Hub Pro: Scrub and Auto-scroll are
   * shown but locked (owner 2026-09-24 — one Pro unlock covers every advanced
   * feature). A boolean, never a component — nothing callable crosses here.
   * `setWidgetMotion` refuses a free couple independently; Scroll is never
   * locked, so a look can always be taken off.
   */
  transitionLocked?: boolean;
  /** Set or clear one section's background photo. */
  setBackgroundAction?: (formData: FormData) => void | Promise<void>;
  /** The couple's own photos — hero first, then gallery — as
   *  `{ ref, url }`. Only these are offered, and only these are accepted
   *  server-side. */
  photoChoices?: readonly { ref: string; url: string }[];
  /** The couple's own hero video — the ONE snippet source an event has, so this
   *  is a single choice rather than a gallery of one pretending to be a list. */
  videoChoice?: { ref: string; url: string } | null;
  /** Their own palette. A flat ground is chosen FROM the wedding, never from a
   *  free colour wheel that invites a ground fighting every other surface. */
  colorChoices?: readonly string[];
  /** Move the crop of a section's background photo. */
  setCropAction?: (formData: FormData) => void | Promise<void>;
  /** Save one of the couple's own sections. */
  saveCustomAction?: (formData: FormData) => void | Promise<void>;
  /** Take the next free slot. Hidden once all six are in use. */
  addCustomAction?: (formData: FormData) => void | Promise<void>;
  /**
   * Does this event own Event Hub PRO? Two things in this panel are Pro (owner
   * 2026-09-22/24: "Free is the page we write. Pro is changing how it looks"):
   * a section of the couple's own, and how any section LOOKS and MOVES — its
   * photo, crop, zoom and motion. Defaults to true so a caller that has not
   * wired it keeps today's behaviour; the server actions refuse independently.
   */
  ownsPro?: boolean;
  /**
   * The lock shown in place of a Pro-only control — the page's own
   * `lockPanel(...)`, i.e. the shared `ProLockPanel`, passed in as an ELEMENT
   * (never a component or function: a server→client function prop took
   * production down on 2026-09-23).
   */
  customLock?: React.ReactNode;
  /**
   * The lock shown ONCE above the list for a free couple, naming the look
   * controls (photo, crop, motion). Same panel, same element rule.
   */
  lookLock?: React.ReactNode;
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

  const back = returnTo ?? RETURN_TO(eventId);
  return (
    <div className="border-t border-dashed border-ink/10 bg-cream/40 p-3">
      {only ? null : (
        <p className="mb-2 text-[0.7rem] text-ink/50">
          Drag-free ordering — move a section up or down, hide it, or let{' '}
          <span className="font-semibold text-ink/70">Auto</span> show it as soon as it has
          content.
        </p>
      )}
      {/* Free: order, show and hide are the page we write. How each section
          looks and moves is named and locked here ONCE — never hidden, never
          repeated on every row. What a couple already chose stays, and each row
          below still offers to take it off. */}
      {!ownsPro && lookLock && !hideLocked ? <div className="mb-2">{lookLock}</div> : null}
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, i) => {
          if (only && row.widget_id !== only) return null;
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
                  <HubDraftField />
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="widget_type" value={row.widget_type} />
                  <input type="hidden" name="next_visible" value={row.is_visible ? '0' : '1'} />
                  <input type="hidden" name="return_to" value={back} />
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
                  <HubDraftField />
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="return_to" value={back} />
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
                  <HubDraftField />
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="widget_id" value={row.widget_id} />
                  <input type="hidden" name="return_to" value={back} />
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
                      <HubDraftField />
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="widget_id" value={row.widget_id} />
                      <input type="hidden" name="next_mode" value={m} />
                      <input type="hidden" name="return_to" value={back} />
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
              {setMotionAction && !ownsPro ? (
                /* 🔓 A FREE COUPLE MAY ALWAYS TAKE A LOOK OFF. Motion chosen
                   before (or while Pro) stays until they reset it; `reset=1`
                   is the one motion write `setWidgetMotion` never gates. */
                canvasHasMotion(sanitizeHubCanvas(row.config_json)) ? (
                  <form action={setMotionAction} className="mt-2 border-t border-dashed border-ink/10 pt-2">
                    <HubDraftField />
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="widget_id" value={row.widget_id} />
                    <input type="hidden" name="reset" value="1" />
                    <input type="hidden" name="return_to" value={back} />
                    <button
                      type="submit"
                      className="inline-flex h-6 items-center rounded-full border border-ink/15 bg-cream px-2 text-[0.62rem] font-semibold text-ink/60 hover:border-ink/30"
                    >
                      Reset how it moves
                    </button>
                  </form>
                ) : null
              ) : setMotionAction ? (
                (() => {
                  const canvas = sanitizeHubCanvas(row.config_json);
                  const preset = canvas.preset ?? null;
                  return (
                    <div data-maker-part="animate" className="mt-2 border-t border-dashed border-ink/10 pt-2">
                      <p className="mb-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink/45">
                        How it moves
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        {HUB_MOTION_PRESETS.map((p) => (
                          <form key={p} action={setMotionAction}>
                            <HubDraftField />
                            <input type="hidden" name="event_id" value={eventId} />
                            <input type="hidden" name="widget_id" value={row.widget_id} />
                            <input type="hidden" name="preset" value={p} />
                            <input type="hidden" name="return_to" value={back} />
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
                      {/* ══ INTO THE NEXT SECTION — Scroll · Scrub · Auto-scroll ═
                          Owner 2026-09-24: "some can scrub some can page move"
                          ("hybrid perfect"), then "1. Scroll 2. Scrub 3.
                          Auto-scroll (can set the speed)", then "from one scene
                          to another there is a transition". So the value on a
                          row is the transition from THIS section to the NEXT;
                          the last row has no next, and gets a note instead of
                          chips that would move nothing. Independent of the
                          preset: the preset is how the section's parts arrive.
                          The preview beside this panel is the guest page.
                          ⛔ Scrub and Auto-scroll are Pro. Locked chips stay
                          VISIBLE (a feature nobody can see is a feature nobody
                          buys) and Scroll is never locked.
                          ⚠ Auto-scroll is stored now and plays as Scroll until
                          its own renderer lands — said here in the hint. */}
                      {(() => {
                        const transition = resolveTransition(canvas);
                        const speed = canvas.autoSpeed ?? HUB_DEFAULT_AUTO_SPEED;
                        if (i === rows.length - 1) {
                          return (
                            <p className="mt-1.5 text-[0.56rem] text-ink/45">
                              Last section — nothing comes after it, so there is no transition to set.
                            </p>
                          );
                        }
                        return (
                          <>
                            <div data-maker-part="transition" className="mt-1.5 flex flex-wrap items-center gap-1">
                              <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">
                                Into the next section
                              </span>
                              {HUB_TRANSITIONS.map((t) => {
                                const on = transition === t;
                                const locked = transitionLocked && t !== 'scroll' && !on;
                                if (locked && hideLocked) return null;
                                return (
                                  <form key={t} action={setMotionAction}>
                                    <HubDraftField />
                                    <input type="hidden" name="event_id" value={eventId} />
                                    <input type="hidden" name="widget_id" value={row.widget_id} />
                                    <input type="hidden" name="transition" value={t} />
                                    <input type="hidden" name="return_to" value={back} />
                                    <button
                                      type="submit"
                                      aria-pressed={on}
                                      disabled={locked}
                                      title={locked ? 'Comes with Event Hub Pro.' : HUB_TRANSITION_HINT[t]}
                                      className={`inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[0.58rem] ${
                                        on
                                          ? 'border-ink/60 bg-ink/5 font-semibold text-ink'
                                          : locked
                                            ? 'cursor-not-allowed border-ink/10 bg-cream/60 text-ink/30'
                                            : 'border-ink/12 bg-cream text-ink/50 hover:border-ink/30'
                                      }`}
                                    >
                                      {locked ? <Lock aria-hidden className="h-2.5 w-2.5" strokeWidth={2.5} /> : null}
                                      {HUB_TRANSITION_LABEL[t]}
                                    </button>
                                  </form>
                                );
                              })}
                              {transitionLocked && !hideLocked ? (
                                <a
                                  href={`/dashboard/${eventId}/studio/website-pro`}
                                  className="text-[0.58rem] font-semibold text-ink/60 underline underline-offset-2 hover:text-ink"
                                >
                                  Unlock with Event Hub Pro
                                </a>
                              ) : null}
                            </div>
                            {transition === 'auto' ? (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">
                                  Speed
                                </span>
                                {HUB_AUTO_SPEEDS.map((v) => {
                                  const on = speed === v;
                                  return (
                                    <form key={v} action={setMotionAction}>
                                      <HubDraftField />
                                      <input type="hidden" name="event_id" value={eventId} />
                                      <input type="hidden" name="widget_id" value={row.widget_id} />
                                      <input type="hidden" name="transition" value="auto" />
                                      <input type="hidden" name="auto_speed" value={v} />
                                      <input type="hidden" name="return_to" value={back} />
                                      <button
                                        type="submit"
                                        aria-pressed={on}
                                        disabled={transitionLocked && !on}
                                        className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.58rem] ${
                                          on
                                            ? 'border-ink/60 bg-ink/5 font-semibold text-ink'
                                            : 'border-ink/12 bg-cream text-ink/50 hover:border-ink/30 disabled:cursor-not-allowed disabled:text-ink/30'
                                        }`}
                                      >
                                        {HUB_AUTO_SPEED_LABEL[v]}
                                      </button>
                                    </form>
                                  );
                                })}
                                <span className="text-[0.56rem] text-ink/45">
                                  Guests see it scroll with the page until Auto-scroll launches.
                                </span>
                              </div>
                            ) : transition === 'scrub' ? (
                              <p className="mt-1 text-[0.56rem] text-ink/45">
                                {HUB_TRANSITION_HINT.scrub}
                              </p>
                            ) : null}
                          </>
                        );
                      })()}
                      {preset ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">
                            Timing
                          </span>
                          {(['auto', 'time', 'scrub'] as const).map((t) => {
                            const on = t === 'auto' ? !canvas.timeline : canvas.timeline === t;
                            return (
                              <form key={t} action={setMotionAction}>
                                <HubDraftField />
                                <input type="hidden" name="event_id" value={eventId} />
                                <input type="hidden" name="widget_id" value={row.widget_id} />
                                <input type="hidden" name="preset" value={preset} />
                                <input type="hidden" name="timeline" value={t} />
                                <input type="hidden" name="return_to" value={back} />
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
                      {/* ══ COMES IN · GOES OUT, AND WHICH WAY ═════════════
                          Owner, 2026-09-23: "different stories fade in while
                          entering from different areas and move and fade out or
                          just move out".

                          🔑 TWO AXES, NOT ONE LIST. What it does, and which
                          way. The old vocabulary welded them together — `rise`
                          was always from below and always faded — so "just move
                          out" was not a hard option, it was an ABSENT one.

                          ⛔ THE DIRECTION ROW APPEARS ONLY WHEN THE EFFECT
                          TRAVELS. A "from the left" beside a plain fade is a
                          control the couple can change with no effect on
                          anything, which is the defect this build exists to
                          remove. The writer drops it too, so the two ends
                          cannot disagree. */}
                      {preset ? (
                        (() => {
                          const m = resolveHubMotion(canvas);
                          // 🪤 `chipRow`, not `row`. The first name shadowed the
                          // WIDGET row this whole block sits inside, so
                          // `row.widget_id` resolved to the helper function.
                          // tsc caught it; a JS-only refactor would have posted
                          // `undefined` as every widget id.
                          const chipRow = (
                            label: string,
                            name: string,
                            values: readonly string[],
                            labels: Record<string, string>,
                            current: string,
                            isAuto: boolean,
                          ) => (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">
                                {label}
                              </span>
                              {(['auto', ...values] as const).map((v) => {
                                const on = v === 'auto' ? isAuto : !isAuto && current === v;
                                return (
                                  <form key={v} action={setMotionAction}>
                                    <HubDraftField />
                                    <input type="hidden" name="event_id" value={eventId} />
                                    <input type="hidden" name="widget_id" value={row.widget_id} />
                                    <input type="hidden" name="preset" value={preset} />
                                    <input type="hidden" name={name} value={v} />
                                    <input type="hidden" name="return_to" value={back} />
                                    <button
                                      type="submit"
                                      aria-pressed={on}
                                      className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.58rem] ${
                                        on
                                          ? 'border-ink/60 bg-ink/5 font-semibold text-ink'
                                          : 'border-ink/12 bg-cream text-ink/50 hover:border-ink/30'
                                      }`}
                                    >
                                      {v === 'auto' ? 'Auto' : (labels[v] ?? v)}
                                    </button>
                                  </form>
                                );
                              })}
                            </div>
                          );
                          return (
                            <>
                              {chipRow('Comes in', 'in', HUB_IN, HUB_IN_LABEL, m.in, !canvas.in)}
                              {hubInMoves(m.in)
                                ? chipRow('From', 'in_from', HUB_DIRECTIONS, HUB_IN_DIRECTION_LABEL, m.inFrom, !canvas.inFrom)
                                : null}
                              {chipRow('Goes out', 'out', HUB_OUT, HUB_OUT_LABEL, m.out, !canvas.out)}
                              {hubOutMoves(m.out)
                                ? chipRow('Toward', 'out_to', HUB_DIRECTIONS, HUB_OUT_DIRECTION_LABEL, m.outTo, !canvas.outTo)
                                : null}
                            </>
                          );
                        })()
                      ) : null}

                      {/* ══ HOW ITS PARTS ARRIVE ═══════════════════════════
                          Owner, 2026-09-23, asked for this directly. The parts
                          of a section — its small label, its heading, its words
                          — can arrive together or in turn.

                          🔑 ONE CHOICE, NOT ONE PER PART. Every part could have
                          its own effect; that is a control surface no couple
                          would finish, and it is the fastest way to a page that
                          looks worse than the default. The order they arrive in
                          is the part a guest actually feels. */}
                      {preset ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-ink/40">
                            Parts
                          </span>
                          {(['auto', 'together', 'one_after_another'] as const).map((q) => {
                            const on = q === 'auto' ? !canvas.sequence : canvas.sequence === q;
                            return (
                              <form key={q} action={setMotionAction}>
                                <HubDraftField />
                                <input type="hidden" name="event_id" value={eventId} />
                                <input type="hidden" name="widget_id" value={row.widget_id} />
                                <input type="hidden" name="preset" value={preset} />
                                <input type="hidden" name="sequence" value={q} />
                                <input type="hidden" name="return_to" value={back} />
                                <button
                                  type="submit"
                                  aria-pressed={on}
                                  className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.58rem] ${
                                    on
                                      ? 'border-ink/60 bg-ink/5 font-semibold text-ink'
                                      : 'border-ink/12 bg-cream text-ink/50 hover:border-ink/30'
                                  }`}
                                >
                                  {q === 'auto' ? 'Auto' : HUB_SEQUENCE_LABEL[q]}
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
              {/* ══ THE COUPLE'S OWN WORDS ═══════════════════════════════
                  Only for a slot they added. A heading is optional — somebody
                  who wants a bare passage between two sections should not have
                  to invent a title for it — and an empty body means the section
                  never reaches a guest, because `Auto` follows content and a
                  heading over a blank reads as a broken page. */}
              {saveCustomAction && isCustomSectionType(row.widget_type) ? (
                (() => {
                  const { title, body } = sanitizeCustomSection(row.config_json);
                  /* The grandfather rule, the same one `lockedIf` states for
                     every other Pro row: a couple who already has words here
                     keeps editing them. Only an EMPTY section is locked. */
                  const locked = !ownsPro && !customSectionHasContent(row.config_json);
                  const arrangement =
                    sanitizeHubCanvas(row.config_json).arrangement ?? HUB_DEFAULT_ARRANGEMENT;
                  const removeForm = (
                    /* ⛔ A CONFIRM THAT NEEDS NO JAVASCRIPT. This panel is a
                       server component and the editor works without script, so
                       the confirm is a disclosure: the first tap only reveals
                       the real button. The row goes and the slot is free again. */
                    <details className="mt-2 text-[0.66rem] text-ink/55">
                      <summary className="cursor-pointer select-none hover:text-ink/80">
                        Remove this section
                      </summary>
                      <form action={saveCustomAction} className="mt-1 flex items-center gap-2">
                        <HubSavesImmediately />
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="widget_id" value={row.widget_id} />
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="return_to" value={back} />
                        <span>Its words and layout go with it.</span>
                        <button
                          type="submit"
                          className="inline-flex h-7 items-center rounded-full bg-danger-600 px-3 text-[0.65rem] font-semibold text-white transition-colors hover:bg-danger-700"
                        >
                          Remove for good
                        </button>
                      </form>
                    </details>
                  );
                  if (locked) {
                    return (
                      <div className="mt-2">
                        {customLock}
                        {removeForm}
                      </div>
                    );
                  }
                  return (
                    <>
                    <form
                      action={saveCustomAction}
                      className="mt-2 space-y-1.5 border-t border-dashed border-ink/10 pt-2"
                    >
                      <HubSavesImmediately />
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="widget_id" value={row.widget_id} />
                      <input type="hidden" name="return_to" value={back} />
                      <label htmlFor={`custom-title-${row.widget_id}`} className="sr-only">
                        Heading for {customSectionEditorLabel(row.widget_type)}
                      </label>
                      <input
                        id={`custom-title-${row.widget_id}`}
                        name="title"
                        type="text"
                        maxLength={CUSTOM_COLUMN_TITLE_MAX}
                        defaultValue={title}
                        placeholder="Heading (optional)"
                        className="min-h-[36px] w-full rounded-md border border-ink/15 bg-white px-2 text-[0.74rem] text-ink placeholder:text-ink/40"
                      />
                      <label htmlFor={`custom-body-${row.widget_id}`} className="sr-only">
                        Words for {customSectionEditorLabel(row.widget_type)}
                      </label>
                      <textarea
                        id={`custom-body-${row.widget_id}`}
                        name="body"
                        rows={3}
                        maxLength={CUSTOM_COLUMN_BODY_MAX}
                        defaultValue={body}
                        placeholder="Your own words — this section stays hidden until you write something."
                        className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-[0.74rem] leading-relaxed text-ink placeholder:text-ink/40"
                      />
                      <button
                        type="submit"
                        className="inline-flex h-7 items-center rounded-full bg-ink px-3 text-[0.65rem] font-semibold text-cream"
                      >
                        Save this section
                      </button>
                    </form>

                    {/* ══ LAYOUT ══════════════════════════════════════════
                        The four chapter arrangements of the story, a closed
                        set. The photo is the one chosen under "Photo" below —
                        one photo per section, one home for it. Every layout
                        stacks to a single column on a phone. */}
                    <div className="mt-2">
                      <p className="mb-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink/45">
                        Layout
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        {HUB_ARRANGEMENTS.map((a) => (
                          <form key={a} action={saveCustomAction}>
                            <HubDraftField />
                            <input type="hidden" name="event_id" value={eventId} />
                            <input type="hidden" name="widget_id" value={row.widget_id} />
                            <input type="hidden" name="intent" value="arrange" />
                            <input type="hidden" name="arrangement" value={a} />
                            <input type="hidden" name="return_to" value={back} />
                            <button
                              type="submit"
                              aria-pressed={arrangement === a}
                              className={`inline-flex h-6 items-center rounded-full border px-2 text-[0.62rem] font-semibold transition-colors ${
                                arrangement === a
                                  ? 'border-ink bg-ink text-cream'
                                  : 'border-ink/15 bg-cream text-ink/60 hover:border-ink/30'
                              }`}
                            >
                              {HUB_ARRANGEMENT_LABEL[a]}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                    {removeForm}
                    </>
                  );
                })()
              ) : null}

              {setBackgroundAction && !ownsPro ? (
                /* 🔓 A FREE COUPLE MAY ALWAYS TAKE MEDIA OFF, AND MAY ALWAYS
                   CHOOSE A COLOUR (owner 2026-09-24: "changing background
                   color is free. making media a background is pro."). A photo
                   or video already set stays, and removing it (media='') is
                   never gated. No photo picker, no crop — putting media up or
                   moving it is Pro, named once by `lookLock` above. */
                (() => {
                  const canvas = sanitizeHubCanvas(row.config_json);
                  if (!canvas.media && colorChoices.length === 0) return null;
                  return (
                    <div className="mt-2 border-t border-dashed border-ink/10 pt-2">
                      {canvas.media ? (
                        <form action={setBackgroundAction}>
                          <HubDraftField />
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="widget_id" value={row.widget_id} />
                          <input type="hidden" name="media" value="" />
                          <input type="hidden" name="return_to" value={back} />
                          <button
                            type="submit"
                            className="inline-flex h-6 items-center rounded-full border border-ink/15 bg-cream px-2 text-[0.62rem] font-semibold text-ink/60 hover:border-ink/30"
                          >
                            {canvas.kind === 'snippet'
                              ? 'Remove this section\u2019s video'
                              : 'Remove this section\u2019s photo'}
                          </button>
                        </form>
                      ) : null}
                      <SectionColourChoices returnTo={back}
                        eventId={eventId}
                        widgetId={row.widget_id}
                        canvas={canvas}
                        colorChoices={colorChoices}
                        action={setBackgroundAction}
                        withNone
                      />
                    </div>
                  );
                })()
              ) : setBackgroundAction && photoChoices.length > 0 ? (
                (() => {
                  const canvas = sanitizeHubCanvas(row.config_json);
                  return (
                    <div className="mt-2 border-t border-dashed border-ink/10 pt-2">
                      <p className="mb-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-ink/45">
                        {/* A section of their own places its photo by Layout —
                            behind, beside, or not at all — so it is a Photo,
                            not always a background. Same field either way. */}
                        {isCustomSectionType(row.widget_type) ? 'Photo' : 'Background'}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <form action={setBackgroundAction}>
                          <HubDraftField />
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="widget_id" value={row.widget_id} />
                          <input type="hidden" name="media" value="" />
                          <input type="hidden" name="return_to" value={back} />
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
                        {/* 🎬 THEIR OWN FOOTAGE, when they have some. One choice,
                            not a gallery: `landing_page_hero_video_r2_key` is the
                            only video an event owns, so offering a list would be
                            offering a list of one and calling it a choice.
                            It posts the SAME `media` field a photo does — one
                            field, one allow-list, one ownership set. */}
                        {videoChoice ? (
                          <form action={setBackgroundAction}>
                            <HubDraftField />
                            <input type="hidden" name="event_id" value={eventId} />
                            <input type="hidden" name="widget_id" value={row.widget_id} />
                            <input type="hidden" name="media" value={videoChoice.ref} />
                            <input type="hidden" name="kind" value="snippet" />
                            <input type="hidden" name="return_to" value={back} />
                            <button
                              type="submit"
                              aria-pressed={canvas.kind === 'snippet'}
                              className={`inline-flex h-9 items-center gap-1 rounded-md border px-2 text-[0.6rem] font-semibold ${
                                canvas.kind === 'snippet'
                                  ? 'border-ink bg-ink text-cream'
                                  : 'border-ink/15 bg-cream text-ink/55 hover:border-ink/30'
                              }`}
                            >
                              Your video
                            </button>
                          </form>
                        ) : null}
                        {photoChoices.map((photo) => {
                          const on = canvas.media === photo.ref;
                          return (
                            <form key={photo.ref} action={setBackgroundAction}>
                              <HubDraftField />
                              <input type="hidden" name="event_id" value={eventId} />
                              <input type="hidden" name="widget_id" value={row.widget_id} />
                              <input type="hidden" name="media" value={photo.ref} />
                              <input type="hidden" name="return_to" value={back} />
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

                      {/* ── A FLAT COLOUR ── free for every couple; see
                          <SectionColourChoices> below. */}
                      <SectionColourChoices returnTo={back}
                        eventId={eventId}
                        widgetId={row.widget_id}
                        canvas={canvas}
                        colorChoices={colorChoices}
                        action={setBackgroundAction}
                      />

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
                                        <HubDraftField />
                                        <input type="hidden" name="event_id" value={eventId} />
                                        <input type="hidden" name="widget_id" value={row.widget_id} />
                                        <input type="hidden" name="focal" value={f} />
                                        <input type="hidden" name="return_to" value={back} />
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
                                        <HubDraftField />
                                        <input type="hidden" name="event_id" value={eventId} />
                                        <input type="hidden" name="widget_id" value={row.widget_id} />
                                        <input type="hidden" name="zoom" value={z} />
                                        <input type="hidden" name="return_to" value={back} />
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

      {/* ══ ADD ONE ═══════════════════════════════════════════════════════
          🔑 SIX IS A SHAPE, NOT A RULE SOMEBODY REMEMBERS. The control simply
          stops being offered once every slot is taken, and the database CHECK
          names the same six — so there is no seventh to create, by this button
          or by a hand-crafted POST. It says WHY it is gone rather than sitting
          there refusing. */}
      {only ? null : addCustomAction && !ownsPro && hideLocked ? null : addCustomAction && !ownsPro ? (
        /* Named and locked — never hidden. A free couple learns the feature
           exists; the lock shows exactly what every other Pro row shows. */
        <div className="mt-2">
          <p className="mb-1 text-[0.7rem] font-medium text-ink/70">A section of your own</p>
          {customLock}
        </div>
      ) : addCustomAction ? (
        nextFreeCustomSlot(rows.map((r) => r.widget_type)) ? (
          <form action={addCustomAction} className="mt-2">
            <HubSavesImmediately />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="return_to" value={back} />
            <button
              type="submit"
              className="inline-flex h-7 items-center rounded-full border border-dashed border-ink/25 px-3 text-[0.68rem] font-medium text-ink/70 hover:border-ink/45"
            >
              + Add a section of your own
            </button>
          </form>
        ) : (
          <p className="mt-2 text-[0.66rem] text-ink/45">
            You have all six of your own sections. Remove one you are not using to add another.
          </p>
        )
      ) : null}
    </div>
  );
}

/**
 * A section's COLOUR background — one row of swatches from the couple's own
 * palette, shared by the Pro picker and the free rail.
 *
 * 🔓 FREE FOR EVERY COUPLE (owner 2026-09-24: "changing background color is
 * free. making media a background is pro."). `setWidgetBackground` classifies a
 * `kind=color` write through `sectionBackgroundChange`, which never answers
 * 'add' or 'change' for a colour — so nothing this row posts is refused.
 *
 * From the couple's OWN palette, not a colour wheel: their mood board already
 * decided what this wedding looks like, and a free picker here invites a ground
 * that fights every other surface on the page.
 */
function SectionColourChoices({
  eventId,
  widgetId,
  canvas,
  colorChoices,
  action,
  withNone = false,
  returnTo,
}: {
  eventId: string;
  widgetId: string;
  canvas: ReturnType<typeof sanitizeHubCanvas>;
  colorChoices: readonly string[];
  action: (formData: FormData) => void | Promise<void>;
  /** The free rail has no "None" chip of its own, so the colour row carries one. */
  withNone?: boolean;
  /** Where the write lands — the panel's own `back`. */
  returnTo?: string;
}) {
  if (colorChoices.length === 0) return null;
  const back = returnTo ?? RETURN_TO(eventId);
  const colourOn = canvas.kind === 'color';
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-ink/35">
        Colour
      </span>
      {withNone && colourOn ? (
        <form action={action}>
          <HubDraftField />
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="widget_id" value={widgetId} />
          <input type="hidden" name="kind" value="color" />
          <input type="hidden" name="color" value="" />
          <input type="hidden" name="return_to" value={back} />
          <button
            type="submit"
            className="inline-flex h-7 items-center rounded-md border border-ink/15 bg-cream px-2 text-[0.6rem] font-semibold text-ink/55 hover:border-ink/30"
          >
            None
          </button>
        </form>
      ) : null}
      {colorChoices.map((hex) => {
        const on = colourOn && canvas.color === hex;
        return (
          <form key={hex} action={action}>
            <HubDraftField />
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="widget_id" value={widgetId} />
            <input type="hidden" name="kind" value="color" />
            <input type="hidden" name="color" value={hex} />
            <input type="hidden" name="return_to" value={back} />
            <button
              type="submit"
              aria-pressed={on}
              aria-label={on ? `Current background colour ${hex}` : `Use ${hex} as the background`}
              style={{ backgroundColor: hex }}
              className={`block h-7 w-7 rounded-md border-2 ${
                on ? 'border-ink' : 'border-ink/15 hover:border-ink/40'
              }`}
            />
          </form>
        );
      })}
    </div>
  );
}
