/**
 * apps/web/lib/details-bound.ts
 *
 * DETAILS IS THE SOURCE; A SCENE EDIT ASKS "EVERYWHERE OR JUST HERE".
 *
 * Owner, 2026-09-25 (DECISION_LOG), verbatim: *"any edits on details will
 * reflect across the stages and prints. but if the edit that part on the scene
 * itself, they will ask if do you want to update details and apply to all or
 * just here."*
 *
 * So a scene that shows a fact Details owns does not COPY it — it is BOUND to
 * it. A Details edit reaches every bound scene. Editing the fact ON a scene asks
 * once: "Change it everywhere (updates Details)" writes the Details source;
 * "Just this scene" stores a per-scene override, shown with a quiet
 * "Edited here · ↺ Use Details" chip that clears it. An override does NOT follow
 * later Details edits — that is what "just here" means.
 *
 * ── WHERE IT LIVES ─────────────────────────────────────────────────────────
 * The Details value: its own `events` column (the one Details already edits).
 * The override: the scene's EXISTING canvas, `config_json.canvas.details`
 * (`HubSectionCanvas.details`, `lib/hub-canvas.ts`) — the same contract the
 * per-element styles use. No table, no column, no migration. And because it is
 * the canvas, it is DRAFTED like every other canvas key (`hubDraftAction`
 * intent=save replaces a canvas whole) and reaches guests only at Apply.
 *
 * 🔓 WORDS, NEVER LOOK. `details` is deliberately NOT in `HUB_CANVAS_LOOK_KEYS`
 * (`lib/hub-look-pro.ts`), so `canvasLookChange` never asks for Pro over it — a
 * couple's own words are free, the same as `HUB_WORDS_EVENT_COLUMNS`.
 *
 * ── WHICH FACTS (v1) ───────────────────────────────────────────────────────
 * Only a fact that Details OWNS (the Maker's Details page edits it) and that a
 * scene both SHOWS and lets the couple EDIT:
 *
 *   message → `events.special_message` — Details' "Special message". Shown by
 *             the Special message scene and by a Letter scene (template 11,
 *             `builtOn: 'special_message'`).
 *
 * ⚠ Measured on origin/main 2026-09-27, NOT bound here, and why:
 *   · names — `display_name` is DERIVED from the couple's first names in event
 *     settings (`app/dashboard/[eventId]/actions.ts`); Details does not own it,
 *     so "Change it everywhere (updates Details)" would be a false sentence.
 *   · date · venue — `event_date` / `venue_name` are the schedule's and the
 *     event settings' facts, and no scene offers them as editable text.
 *   · opening line · "Kindly reply" — print-only (`events.print_details`); no
 *     guest scene reads them. The per-print-format override is Phase 9's.
 * Adding one is one row in `DETAILS_FACT` plus the scene that shows it.
 *
 * Pure. No I/O. Its only runtime import is `lib/scene-templates.ts` (which
 * imports nothing at runtime), so `lib/hub-canvas.ts` can import the sanitizer
 * without a cycle.
 */

import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftPatch } from '@/lib/hub-draft';
import type { WidgetType } from '@/lib/invitation-widgets';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';

export const DETAILS_FACTS = ['message'] as const;
export type DetailsFact = (typeof DETAILS_FACTS)[number];

/**
 * The longest override — the SAME cap the Details writer holds its column to
 * (`HUB_DRAFT_TEXT_MAX`, `updateSpecialMessage`'s 600). Restated rather than
 * imported to keep this module free of a runtime cycle; `details-bound.test.ts`
 * asserts the two are equal.
 */
export const DETAILS_OVERRIDE_MAX = 600;

export const DETAILS_FACT: Record<
  DetailsFact,
  {
    /** The Details source column (`events`), in `HUB_DRAFT_EVENT_COLUMNS`. */
    column: 'special_message';
    /** The couple's word for it — the Details page's own label. */
    label: string;
    /** The scene's words box's label — the Content tab's shipped "Your message". */
    boxLabel: string;
  }
> = {
  message: { column: 'special_message', label: 'Special message', boxLabel: 'Your message' },
};

export function isDetailsFact(v: unknown): v is DetailsFact {
  return typeof v === 'string' && (DETAILS_FACTS as readonly string[]).includes(v);
}

/** A scene's own versions of Details facts. Absent key = bound to Details. */
export type HubDetailsOverrides = Partial<Record<DetailsFact, string>>;

/**
 * Read `canvas.details` out of stored config. Drops rather than repairs, like
 * every canvas reader: an unknown fact, a non-string, a blank, or a value over
 * the cap is not an override anybody made.
 */
export function sanitizeDetailsOverrides(raw: unknown): HubDetailsOverrides | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: HubDetailsOverrides = {};
  for (const fact of DETAILS_FACTS) {
    const v = src[fact];
    if (typeof v !== 'string') continue;
    const t = v.replace(/\r\n?/g, '\n').trim();
    if (t.length === 0 || t.length > DETAILS_OVERRIDE_MAX) continue;
    out[fact] = t;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * WHAT A BOUND SCENE SHOWS — the ONE rule, read by the guest render and the
 * Maker's field alike: this scene's own override where the couple set one,
 * otherwise the Details value. `overridden` drives the "Edited here" chip.
 */
export function sceneBoundText(
  fact: DetailsFact,
  canvas: Pick<HubSectionCanvas, 'details'> | null | undefined,
  detailsValue: string | null | undefined,
): { text: string | null; overridden: boolean } {
  const own = canvas?.details?.[fact];
  if (typeof own === 'string' && own.length > 0) return { text: own, overridden: true };
  const d = typeof detailsValue === 'string' ? detailsValue.trim() : '';
  return { text: d.length > 0 ? d : null, overridden: false };
}

/**
 * The same rule, read straight from a stored `config_json` — for the guest
 * dispatchers, which must not reach for the canvas contract themselves (the
 * frame owns it, `every-dispatcher-frames-the-canvas.test.ts`). Reads the
 * canvas where `sanitizeHubCanvas` does: `config.canvas`, else the config.
 */
export function sceneBoundTextOf(
  fact: DetailsFact,
  configJson: unknown,
  detailsValue: string | null | undefined,
): { text: string | null; overridden: boolean } {
  const src = configJson && typeof configJson === 'object' && !Array.isArray(configJson) ? (configJson as Record<string, unknown>) : null;
  const canvas =
    src && src.canvas && typeof src.canvas === 'object' && !Array.isArray(src.canvas)
      ? (src.canvas as Record<string, unknown>)
      : src;
  const details = sanitizeDetailsOverrides(canvas?.details);
  return sceneBoundText(fact, details ? { details } : null, detailsValue);
}

/**
 * WHICH DETAILS FACT A SCENE SHOWS, or null. The Special message scene shows
 * the message; a template scene built on the special message (11 · Letter)
 * shows it too. Nothing else is bound in v1 (see the file note).
 */
export function detailsFactOfScene(
  widgetType: string,
  canvas: Pick<HubSectionCanvas, 'template'> | null | undefined,
): DetailsFact | null {
  if (widgetType === 'special_message') return 'message';
  if (canvas?.template && SCENE_TEMPLATES[canvas.template]?.builtOn === 'special_message') return 'message';
  return null;
}

/** The canvas with this scene's own version of `fact` set. */
export function withDetailsOverride(canvas: HubSectionCanvas, fact: DetailsFact, text: string): HubSectionCanvas {
  const clean = sanitizeDetailsOverrides({ ...(canvas.details ?? {}), [fact]: text });
  const next: HubSectionCanvas = { ...canvas };
  if (clean) next.details = clean;
  else delete next.details;
  return next;
}

/** The canvas with this scene bound to Details again for `fact` ("↺ Use Details"). */
export function withoutDetailsOverride(canvas: HubSectionCanvas, fact: DetailsFact): HubSectionCanvas {
  const rest: HubDetailsOverrides = { ...(canvas.details ?? {}) };
  delete rest[fact];
  const next: HubSectionCanvas = { ...canvas };
  if (Object.keys(rest).length > 0) next.details = rest;
  else delete next.details;
  return next;
}

export type DetailsEditChoice = 'everywhere' | 'here' | 'use-details';

/**
 * THE DRAFT PATCH FOR ONE ANSWER — every path goes into the DRAFT
 * (`hubDraftAction` intent=save → `mergeHubDraft`); nothing here is live.
 *
 *   everywhere  → the Details column in the draft; and, if THIS scene had its
 *                 own version, that override comes off so the scene shows the
 *                 value just written (the couple said "everywhere").
 *   here        → this scene's override only; Details is untouched, so every
 *                 other scene keeps showing Details.
 *   use-details → this scene's override comes off; it shows Details again.
 *
 * The canvas is sent WHOLE (a draft canvas replaces whole), built from the
 * draft-over-live canvas the Maker holds, so the scene's look rides along.
 * An "everywhere" on a scene with no override sends no canvas at all — a
 * no-op canvas in the draft would read as an unapplied scene change.
 */
export function detailsEditPatch(input: {
  choice: DetailsEditChoice;
  fact: DetailsFact;
  text: string;
  widgetType: WidgetType;
  canvas: HubSectionCanvas;
}): HubDraftPatch {
  const { choice, fact, widgetType, canvas } = input;
  const text = input.text.replace(/\r\n?/g, '\n').trim().slice(0, DETAILS_OVERRIDE_MAX);
  const hadOwn = Boolean(canvas.details?.[fact]);
  if (choice === 'here') {
    return { widgets: { [widgetType]: { canvas: withDetailsOverride(canvas, fact, text) } } };
  }
  if (choice === 'use-details') {
    return { widgets: { [widgetType]: { canvas: withoutDetailsOverride(canvas, fact) } } };
  }
  const patch: HubDraftPatch = { events: { [DETAILS_FACT[fact].column]: text.length > 0 ? text : null } };
  if (hadOwn) patch.widgets = { [widgetType]: { canvas: withoutDetailsOverride(canvas, fact) } };
  return patch;
}
