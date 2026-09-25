'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { nextTransition } from '@/lib/hub-scenes';
import { hasContent, isWidgetType, type WidgetType } from '@/lib/invitation-widgets';
import { siteMediaServeRef, siteMediaServeRefs } from '@/lib/site-media-ref';
import {
  customSectionHasContent,
  customSectionIntent,
  customSectionWriteAllowed,
  isCustomSectionType,
  nextFreeCustomSlot,
  readCustomSectionInput,
} from '@/lib/custom-sections';
import {
  HUB_DIRECTIONS,
  HUB_FOCAL_POINTS,
  HUB_IN,
  HUB_MOTION_PRESETS,
  HUB_OUT,
  hubInMoves,
  hubOutMoves,
  HUB_SEQUENCES,
  HUB_ZOOMS,
  hubArrangement,
  hubBackgroundColor,
  hubMediaRef,
  HUB_TIMELINE,
  sanitizeHubCanvas,
  type HubDirection,
  type HubIn,
  type HubMotionPreset,
  type HubOut,
  type HubSequence,
  type HubTimeline,
} from '@/lib/hub-canvas';

const isHubMotionPreset = (v: unknown): v is HubMotionPreset =>
  typeof v === 'string' && (HUB_MOTION_PRESETS as readonly string[]).includes(v);
const isHubTimeline = (v: unknown): v is HubTimeline =>
  typeof v === 'string' && (HUB_TIMELINE as readonly string[]).includes(v);
const isHubSequence = (v: unknown): v is HubSequence =>
  typeof v === 'string' && (HUB_SEQUENCES as readonly string[]).includes(v);
const isHubIn = (v: unknown): v is HubIn =>
  typeof v === 'string' && (HUB_IN as readonly string[]).includes(v);
const isHubOut = (v: unknown): v is HubOut =>
  typeof v === 'string' && (HUB_OUT as readonly string[]).includes(v);
const isHubDirection = (v: unknown): v is HubDirection =>
  typeof v === 'string' && (HUB_DIRECTIONS as readonly string[]).includes(v);
import { requireHostMembershipOrThrow } from '@/lib/host-gate';
import { HUB_CANVAS_MOTION_KEYS, canvasHasMotion, sectionBackgroundChange } from '@/lib/hub-look-pro';
import { requireLookPro } from '@/lib/hub-look-gate';
import type { HubDraftPatch, HubDraftWidget } from '@/lib/hub-draft';
import {
  draftedDisplayOrders,
  draftedWidgetConfig,
  isHubDraftWrite,
  saveHubDraftPatch,
} from '@/lib/hub-draft-store';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';
import { resolveReturnTo } from '@/lib/editor-return';
import {
  SECTION_CONTENT_EVENT_COLUMNS,
  computeSectionContentMap,
  type SectionContentEvent,
} from '@/lib/website-section-content';

/**
 * Invitation Widgets Editor — server actions (V1 · 2026-05-22 PM).
 *
 * Three actions cover the editor surface:
 *   - toggleWidgetVisibility — flips is_visible (always-on rows blocked)
 *   - moveWidgetUp           — swaps display_order with the previous row
 *   - moveWidgetDown         — swaps display_order with the next row
 *
 * Each action mirrors the host-membership gate pattern locked in
 * apps/web/app/dashboard/[eventId]/website/privacy/actions.ts (PR #381):
 * accept any user who is an accepted event_moderator OR a legacy
 * event_members 'couple' row. Anyone else hits the throw.
 *
 * Drag-and-drop is intentionally NOT shipped in V1 — Up/Down arrow
 * buttons are mobile-friendly, keyboard-accessible, and require zero
 * new dependencies (dnd-kit, react-beautiful-dnd). V1.1 can layer
 * drag-and-drop on top of the same actions without server changes.
 */

// Host gate: the canonical lib/host-gate.ts helper (throw variant — this
// editor surfaces a 500 on unauthorized rather than redirecting). The message
// preserves the pre-dedup wording. See lib/host-gate.ts for the redirect-vs-
// throw split the council surfaced (§1.4).
const WIDGET_FORBIDDEN = 'Forbidden — only current hosts can edit widget visibility.';

/**
 * Revalidate the editor, the website hub, and the public landing page.
 * The public landing page is ISR-cached at revalidate=60; explicit
 * revalidation here means the host's edit lands within a beat instead
 * of waiting up to a minute for the cache to expire.
 */
async function revalidateForWidgetChange(eventId: string): Promise<void> {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();

  revalidateWebsiteEditor(eventId, 'widgets');
  revalidateGuestSite(event?.slug);
}

/**
 * Toggle is_visible on a widget. Blocks the toggle when is_always_on is
 * TRUE — the editor UI disables those checkboxes too, but the server
 * action enforces the rule independently so a hand-crafted form submit
 * can't sneak past.
 *
 * Form fields:
 *   - event_id    — the event the widget belongs to (also used by the
 *                   host-membership gate). Hidden input.
 *   - widget_id   — the row PK. Hidden input.
 *   - widget_type — canonical type (for double-check + always-on gate).
 *                   Hidden input.
 *   - next_visible — '1' to show, '0' to hide (mirrors the checkbox state).
 */
export async function toggleWidgetVisibility(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const widgetIdRaw = formData.get('widget_id');
  const widgetTypeRaw = formData.get('widget_type');
  const nextVisibleRaw = formData.get('next_visible');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  if (typeof widgetIdRaw !== 'string' || widgetIdRaw.length === 0) {
    throw new Error('Missing widget id.');
  }
  if (!isWidgetType(widgetTypeRaw)) {
    throw new Error('Invalid widget type.');
  }
  if (nextVisibleRaw !== '0' && nextVisibleRaw !== '1') {
    throw new Error('Invalid visibility value.');
  }
  const eventId = eventIdRaw as string;
  const widgetId = widgetIdRaw as string;
  const nextVisible = nextVisibleRaw === '1';

  await requireHostMembershipOrThrow(eventId, WIDGET_FORBIDDEN);

  const supabase = await createClient();

  // Defensive — re-read the current row to confirm is_always_on. The
  // editor UI disables the checkbox for always-on widgets but a
  // hand-crafted POST could bypass; this read + gate makes the rule
  // server-enforced. The .eq('event_id') ensures a host can't flip a
  // widget on someone else's event by guessing widget IDs (RLS would
  // catch this too but defense in depth is cheap).
  const { data: row, error: readErr } = await supabase
    .from('invitation_widgets')
    .select('widget_id, widget_type, is_always_on, is_visible')
    .eq('widget_id', widgetId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (readErr) {
    throw new Error(`Failed to load widget: ${readErr.message}`);
  }
  if (!row) {
    throw new Error('Widget not found on this event.');
  }
  if (row.is_always_on && !nextVisible) {
    // Blocked — always-on widgets cannot be hidden. Silently no-op
    // rather than throw, matching the editor UI's disabled-checkbox UX.
    redirect(
      resolveReturnTo(
        formData,
        `/dashboard/${eventId}/website/widgets?error=always_on`,
        '?error=always_on',
      ),
    );
  }

  const { error: updateErr } = await supabase
    .from('invitation_widgets')
    .update({ is_visible: nextVisible })
    .eq('widget_id', widgetId)
    .eq('event_id', eventId);

  if (updateErr) {
    throw new Error(`Failed to update widget visibility: ${updateErr.message}`);
  }

  await revalidateForWidgetChange(eventId);
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?saved=1`, '?saved=1'),
  );
}

// The three legal open-browse section modes (matches the CHECK constraint on
// invitation_widgets.mode from migration 20270919912384).
const SECTION_MODES = ['auto', 'shown', 'hidden'] as const;
type SectionMode = (typeof SECTION_MODES)[number];

function isSectionMode(value: unknown): value is SectionMode {
  return typeof value === 'string' && (SECTION_MODES as readonly string[]).includes(value);
}

/**
 * Set a widget's OPEN-BROWSE three-state section mode (Auto / Shown / Hidden)
 * — the couple's `mode` writer (OPEN-BROWSE PR9 · council verdict §1.4). This
 * is ADDITIVE to `toggleWidgetVisibility`: `mode` and `is_visible` coexist, and
 * PR7's reader (`openBrowseSectionVisible`) treats `is_visible=false` OR
 * `mode='hidden'` as hidden while `mode='shown'` force-shows a hideable row.
 *
 *   - `auto`   — the site decides (falls back to the legacy `is_visible` gate).
 *   - `shown`  — force-show. REFUSED when the widget's source has no content:
 *                force-on must never manufacture a blank guest-facing section
 *                (redirects with ?error=empty_source instead of writing).
 *   - `hidden` — force-hide.
 *
 * Always-on rows (Home / QR / Greeting / RSVP) are NEVER holdable (§1.4) — a
 * mode write against one silently no-ops.
 *
 * Form fields:
 *   - event_id  — the event the widget belongs to (also the gate subject).
 *   - widget_id — the row PK.
 *   - next_mode — one of auto | shown | hidden.
 */
export async function setSectionMode(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const widgetIdRaw = formData.get('widget_id');
  const nextModeRaw = formData.get('next_mode');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  if (typeof widgetIdRaw !== 'string' || widgetIdRaw.length === 0) {
    throw new Error('Missing widget id.');
  }
  if (!isSectionMode(nextModeRaw)) {
    throw new Error('Invalid mode.');
  }
  const eventId = eventIdRaw as string;
  const widgetId = widgetIdRaw as string;
  const nextMode = nextModeRaw;

  await requireHostMembershipOrThrow(
    eventId,
    'Forbidden — only current hosts can edit section visibility.',
  );

  const supabase = await createClient();

  // Re-read the target row to confirm is_always_on + widget_type. The .eq on
  // both widget_id AND event_id keeps a host from touching another event's row
  // by guessing IDs (RLS backstops this; defense in depth is cheap).
  const { data: row, error: readErr } = await supabase
    .from('invitation_widgets')
    .select('widget_id, widget_type, is_always_on')
    .eq('widget_id', widgetId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (readErr) {
    throw new Error(`Failed to load widget: ${readErr.message}`);
  }
  if (!row) {
    throw new Error('Widget not found on this event.');
  }
  if (row.is_always_on) {
    // Always-on sections are never holdable (council §1.4 "Home and Me are
    // never holdable"). Silent no-op rather than throw — the editor UI never
    // renders this control for always-on rows, but a hand-crafted POST could.
    redirect(resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets`));
  }

  const widgetType = row.widget_type as WidgetType;

  // "Shown disabled while empty" — force-on must never manufacture a blank
  // guest-facing section. Compute content presence with the SAME signals the
  // guest site uses (lib/website-section-content mirrors site-body's
  // openBrowseContent map). Types with no clear signal fail OPEN via hasContent.
  if (nextMode === 'shown') {
    const { data: eventRow, error: eventErr } = await supabase
      .from('events')
      .select(SECTION_CONTENT_EVENT_COLUMNS)
      .eq('event_id', eventId)
      .maybeSingle();
    if (eventErr) {
      throw new Error(`Failed to load event: ${eventErr.message}`);
    }
    const contentMap = await computeSectionContentMap(
      supabase,
      eventId,
      (eventRow ?? {
        event_date: null,
        venue_name: null,
        venue_address: null,
        love_story: null,
        special_message: null,
        what_to_bring: null,
        our_photos: null,
      }) as SectionContentEvent,
    );
    if (!hasContent(widgetType, contentMap)) {
      redirect(
      resolveReturnTo(
        formData,
        `/dashboard/${eventId}/website/widgets?error=empty_source`,
        '?error=empty_source',
      ),
    );
    }
  }

  if (isHubDraftWrite(formData)) {
    await saveWidgetToDraft(formData, eventId, widgetType, { mode: nextMode });
  }
  const { error: updateErr } = await supabase
    .from('invitation_widgets')
    .update({ mode: nextMode })
    .eq('widget_id', widgetId)
    .eq('event_id', eventId);

  if (updateErr) {
    redirect(
      resolveReturnTo(
        formData,
        `/dashboard/${eventId}/website/widgets?error=mode_write`,
        '?error=mode_write',
      ),
    );
  }

  await revalidateForWidgetChange(eventId);
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?saved=1`, '?saved=1'),
  );
}

/**
 * Move a widget up in display_order. Swaps its display_order with the
 * widget directly above it. Blocked when:
 *   - The widget is is_always_on (always-on widgets render in fixed
 *     positions; reorder is meaningless for them).
 *   - The widget is already first in the hideable group (nothing above
 *     to swap with — silent no-op).
 *
 * Mirror of moveWidgetDown below; both share the same swap pattern.
 */
export async function moveWidgetUp(formData: FormData): Promise<void> {
  await moveWidget(formData, 'up');
}

export async function moveWidgetDown(formData: FormData): Promise<void> {
  await moveWidget(formData, 'down');
}

/**
 * Shared swap logic — picks the neighbor row by display_order ordering
 * and swaps the two rows' values. Two parallel UPDATEs are fine here
 * (the UNIQUE constraint is on (event_id, widget_type), NOT on
 * (event_id, display_order), so transient duplicates during the swap
 * are tolerated).
 */
async function moveWidget(formData: FormData, direction: 'up' | 'down'): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const widgetIdRaw = formData.get('widget_id');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  if (typeof widgetIdRaw !== 'string' || widgetIdRaw.length === 0) {
    throw new Error('Missing widget id.');
  }
  const eventId = eventIdRaw as string;
  const widgetId = widgetIdRaw as string;

  await requireHostMembershipOrThrow(eventId, WIDGET_FORBIDDEN);

  const supabase = await createClient();

  // Load the moving row + its neighbor in one round trip. We fetch all
  // hideable rows for the event (max 8 today) and pick the neighbor
  // in-memory — cheaper than a clever SQL query for V1's row counts.
  const { data: allRows, error: readErr } = await supabase
    .from('invitation_widgets')
    .select('widget_id, widget_type, display_order, is_always_on')
    .eq('event_id', eventId)
    .eq('is_always_on', false)
    .order('display_order', { ascending: true });

  if (readErr) {
    throw new Error(`Failed to load widgets: ${readErr.message}`);
  }
  const rows = (allRows ?? []) as Array<{
    widget_id: string;
    widget_type: string;
    display_order: number;
    is_always_on: boolean;
  }>;

  // 💾 In the DRAFT the order is the drafted one — swap neighbours as the couple
  // sees them in their preview, not as guests see them.
  const drafting = isHubDraftWrite(formData);
  if (drafting) {
    const drafted = await draftedDisplayOrders(eventId);
    for (const r of rows) {
      const o = drafted[r.widget_type];
      if (o !== undefined) r.display_order = o;
    }
    rows.sort((a, b) => a.display_order - b.display_order);
  }

  const movingIndex = rows.findIndex((r) => r.widget_id === widgetId);
  if (movingIndex === -1) {
    // Widget either doesn't exist on this event OR is_always_on (we
    // filter to is_always_on=false above). Either way silent no-op.
    redirect(resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets`));
  }

  const movingRow = rows[movingIndex]!;
  const neighborIndex = direction === 'up' ? movingIndex - 1 : movingIndex + 1;

  // Already at the boundary — nothing to swap with. Silent no-op so
  // a host mashing the Up arrow on the topmost widget doesn't see an
  // error toast.
  if (neighborIndex < 0 || neighborIndex >= rows.length) {
    redirect(resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets`));
  }

  const neighborRow = rows[neighborIndex]!;

  if (drafting) {
    await saveHubDraftPatch(eventId, {
      widgets: {
        [movingRow.widget_type]: { display_order: neighborRow.display_order },
        [neighborRow.widget_type]: { display_order: movingRow.display_order },
      } as HubDraftPatch['widgets'],
    });
    finishDraftSave(formData, eventId);
  }

  // Two parallel UPDATEs. No transaction needed — even if the second
  // update fails, we have not introduced data corruption: both rows
  // remain valid invitation_widgets rows; only the ordering is
  // temporarily duplicated. The next read will surface the duplicate
  // and the user can manually re-order. Acceptable for V1.
  const [{ error: updErr1 }, { error: updErr2 }] = await Promise.all([
    supabase
      .from('invitation_widgets')
      .update({ display_order: neighborRow.display_order })
      .eq('widget_id', movingRow.widget_id)
      .eq('event_id', eventId),
    supabase
      .from('invitation_widgets')
      .update({ display_order: movingRow.display_order })
      .eq('widget_id', neighborRow.widget_id)
      .eq('event_id', eventId),
  ]);

  if (updErr1 || updErr2) {
    const msg = updErr1?.message || updErr2?.message || 'Unknown swap error';
    throw new Error(`Failed to reorder widgets: ${msg}`);
  }

  await revalidateForWidgetChange(eventId);
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?saved=1`, '?saved=1'),
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   THE CANVAS — how one section MOVES (owner 2026-09-23: "rails on")
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Set one section's motion preset, and optionally its timeline override.
 *
 * ── WHY IT MERGES INSTEAD OF WRITING ────────────────────────────────────────
 * 🔑 `config_json` IS A SHARED BAG. It is typed `unknown` in
 * `lib/invitation-widgets.ts` and any widget may keep its own settings there.
 * Writing `{ canvas: … }` over the top would delete whatever else a couple had
 * saved — silently, and only visible on their guest page. So the current row is
 * re-read and the canvas is merged into it under its own `canvas` key, leaving
 * every sibling key exactly as it was.
 *
 * ⚠ AND IT RE-READS RATHER THAN TRUSTING THE FORM. The rendered panel is a
 * snapshot; a couple with two tabs open would otherwise post a `config_json`
 * from before their other change. Only the fields this form owns are touched.
 *
 * ── "AUTO" IS AN ABSENCE ───────────────────────────────────────────────────
 * `timeline=auto` DELETES the key rather than storing the word. An absent
 * override means "whatever the preset says", so a later change to what
 * "Editorial" means reaches a couple who never overrode it. Storing 'auto'
 * would freeze today's preset body into their saved page.
 *
 * Form fields:
 *   - event_id · widget_id — the row, and the gate subject
 *   - preset               — still | calm | editorial | cinematic
 *   - timeline             — auto | time | scrub   (optional; auto removes it)
 *   - transition           — scroll | scrub | auto  (optional; the transition INTO THE NEXT
 *                            scene; scroll removes it; scrub/auto need Event Hub Pro)
 *   - auto_speed           — slow | normal | fast  (optional; kept only beside auto)
 */
export async function setWidgetMotion(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const widgetIdRaw = formData.get('widget_id');
  const presetRaw = formData.get('preset');
  const timelineRaw = formData.get('timeline');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  if (typeof widgetIdRaw !== 'string' || widgetIdRaw.length === 0) {
    throw new Error('Missing widget id.');
  }
  const eventId = eventIdRaw as string;
  const widgetId = widgetIdRaw as string;

  await requireHostMembershipOrThrow(eventId, WIDGET_FORBIDDEN);

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from('invitation_widgets')
    .select('widget_id, widget_type, config_json')
    .eq('widget_id', widgetId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (readErr) throw new Error(`Failed to load section: ${readErr.message}`);
  if (!row) throw new Error('Section not found on this event.');

  const drafting = isHubDraftWrite(formData);
  const existing = await canvasBase(drafting, eventId, row);
  const canvas: Record<string, unknown> = { ...sanitizeHubCanvas(existing) };

  /* ⛔ HOW A SECTION MOVES IS HOW THE PAGE LOOKS — PRO (owner 2026-09-24).
     `reset=1` is the one motion write a free couple may always make: it takes
     every motion choice OFF the section, back to the page we wrote. Anything
     else is a choice, and a choice needs Pro.
     💾 A DRAFT save is not gated here — trying is free; `hubDraftAction` apply
     is the gate (owner 2026-09-25, "Try then pay"). */
  if (formData.get('reset') === '1') {
    if (!drafting) await requireLookPro(eventId, canvasHasMotion(canvas) ? 'remove' : 'none');
    for (const k of HUB_CANVAS_MOTION_KEYS) delete canvas[k];
    if (drafting) await saveCanvasToDraft(formData, eventId, row.widget_type, canvas);
    const { error: resetErr } = await supabase
      .from('invitation_widgets')
      .update({ config_json: { ...existing, canvas } })
      .eq('widget_id', widgetId)
      .eq('event_id', eventId);
    if (resetErr) throw new Error(`Failed to reset how this section moves: ${resetErr.message}`);
    await revalidateForWidgetChange(eventId);
    redirect(
      resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?saved=1`, '?saved=1'),
    );
  }
  if (!drafting) await requireLookPro(eventId, 'change');

  if (isHubMotionPreset(presetRaw)) canvas.preset = presetRaw;
  if (timelineRaw === 'auto') delete canvas.timeline;
  else if (isHubTimeline(timelineRaw)) canvas.timeline = timelineRaw;

  /* Do the section's parts arrive together, or in turn? Same Auto rule as the
     timing above: the word 'auto' DELETES the key, so a couple who never chose
     follows the preset and moves with it if the preset ever changes. */
  const sequenceRaw = formData.get('sequence');
  if (sequenceRaw === 'auto') delete canvas.sequence;
  else if (isHubSequence(sequenceRaw)) canvas.sequence = sequenceRaw;

  /* ── HOW IT COMES IN, HOW IT GOES OUT, AND WHICH WAY ──────────────────────
     Owner, 2026-09-23: "different stories fade in while entering from different
     areas and move and fade out or just move out".

     ⛔ A DIRECTION IS DROPPED WHEN THE EFFECT DOES NOT TRAVEL. `sanitizeHubCanvas`
     enforces the same rule on the way out, so the two ends cannot disagree —
     but doing it here as well means a stored config never carries a "from the
     left" beside a plain fade, which would be a saved setting with no effect. */
  const inRaw = formData.get('in');
  if (inRaw === 'auto') { delete canvas.in; delete canvas.inFrom; }
  else if (isHubIn(inRaw)) {
    canvas.in = inRaw;
    if (!hubInMoves(inRaw)) delete canvas.inFrom;
  }
  const inFromRaw = formData.get('in_from');
  if (isHubDirection(inFromRaw) && hubInMoves((canvas.in as HubIn | undefined) ?? 'none')) {
    canvas.inFrom = inFromRaw;
  }

  const outRaw = formData.get('out');
  if (outRaw === 'auto') { delete canvas.out; delete canvas.outTo; }
  else if (isHubOut(outRaw)) {
    canvas.out = outRaw;
    if (!hubOutMoves(outRaw)) delete canvas.outTo;
  }
  const outToRaw = formData.get('out_to');
  if (isHubDirection(outToRaw) && hubOutMoves((canvas.out as HubOut | undefined) ?? 'none')) {
    canvas.outTo = outToRaw;
  }

  /* ── SCROLL · SCRUB · AUTO-SCROLL (owner 2026-09-24) ──────────────────────
     The transition from this scene INTO THE NEXT. `nextTransition` owns the rules —
     Scroll is an absence, a speed only lives beside Auto, nothing is repaired —
     and says whether the write needs Pro.
     ⛔ SCRUB AND AUTO-SCROLL ARE EVENT HUB PRO. The editor locks the chips;
     this is the real gate, because a server action is a public POST. Going
     BACK to Scroll is never gated: a free couple may always take a look off.
     Admin client for the SKU read, as `website/colors/actions.ts` does — orders
     RLS is purchaser-scoped, so a co-host would otherwise read "not Pro". */
  const transitionRaw = formData.get('transition');
  const autoSpeedRaw = formData.get('auto_speed');
  if (transitionRaw !== null || autoSpeedRaw !== null) {
    const step = nextTransition(canvas, transitionRaw, autoSpeedRaw);
    if (!drafting && step.needsPro && !(await eventCoupleWebsiteProActive(createAdminClient(), eventId))) {
      redirect(`/dashboard/${eventId}/studio/website-pro`);
    }
    delete canvas.transition;
    delete canvas.autoSpeed;
    if (step.transition) canvas.transition = step.transition;
    if (step.autoSpeed) canvas.autoSpeed = step.autoSpeed;
  }

  if (drafting) await saveCanvasToDraft(formData, eventId, row.widget_type, canvas);
  const next = { ...existing, canvas };

  const { error: updateErr } = await supabase
    .from('invitation_widgets')
    .update({ config_json: next })
    .eq('widget_id', widgetId)
    .eq('event_id', eventId);

  if (updateErr) throw new Error(`Failed to save how this section moves: ${updateErr.message}`);

  await revalidateForWidgetChange(eventId);
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?saved=1`, '?saved=1'),
  );
}

/**
 * Set — or clear — one section's background photo.
 *
 * 🔒 THE REF IS HELD TO THE PUBLIC BUCKET TWICE. Once here, before it is
 * stored, and again by `sanitizeHubCanvas` on the way out. `config_json` is
 * couple-writable and `displayUrlForStoredAsset` signs whatever it is handed
 * within the public bucket, so a hand-crafted POST naming
 * `setnayan-thread-files` (payment proofs) or `setnayan-vendor-verification`
 * (government IDs) must be refused at the door. `siteMediaServeRef` is the one
 * allow-list, shared with the database CHECK on website media.
 *
 * 🔑 AND IT MUST BE A PHOTO THIS EVENT ALREADY HAS. Holding the bucket is not
 * enough on its own: the public bucket holds every event's website media, so a
 * ref from somebody else's wedding would pass that test. The submitted value is
 * checked against this event's own hero and gallery before it is written.
 *
 * `media=''` clears it — a couple must be able to take a background back off.
 *
 * Form fields: event_id · widget_id · media (an `r2://` ref, or empty to clear)
 */
export async function setWidgetBackground(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const widgetIdRaw = formData.get('widget_id');
  const mediaRaw = formData.get('media');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  if (typeof widgetIdRaw !== 'string' || widgetIdRaw.length === 0) {
    throw new Error('Missing section id.');
  }
  const eventId = eventIdRaw as string;
  const widgetId = widgetIdRaw as string;
  const wanted = typeof mediaRaw === 'string' ? mediaRaw.trim() : '';

  await requireHostMembershipOrThrow(eventId, WIDGET_FORBIDDEN);

  const supabase = await createClient();
  const [{ data: row, error: readErr }, { data: ev, error: evErr }] = await Promise.all([
    supabase
      .from('invitation_widgets')
      .select('widget_id, widget_type, config_json')
      .eq('widget_id', widgetId)
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('events')
      .select('landing_page_hero_image_url, our_photos, landing_page_hero_video_r2_key')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (readErr) throw new Error(`Failed to load section: ${readErr.message}`);
  if (!row) throw new Error('Section not found on this event.');
  if (evErr) throw new Error(`Failed to load your photos: ${evErr.message}`);

  /* The photos this couple may choose from — their own hero and their own
     gallery, each held to the public bucket. Nothing else is selectable, so a
     ref cannot be borrowed from another event by hand-crafting a POST. */
  const ownRefs = new Set(
    [
      siteMediaServeRef(ev?.landing_page_hero_image_url),
      ...siteMediaServeRefs(ev?.our_photos),
      /* 🎬 THE SNIPPET SOURCE — the couple's own hero video, and only that.
         A snippet rides the SAME `media` field and therefore the same
         allow-list as a photo; adding it here is what makes it THEIRS as well
         as public-bucket. One field, one fence, one ownership set. */
      siteMediaServeRef(ev?.landing_page_hero_video_r2_key),
    ].filter((r): r is string => Boolean(r)),
  );

  const drafting = isHubDraftWrite(formData);
  const existing = await canvasBase(drafting, eventId, row);
  const canvas: Record<string, unknown> = { ...sanitizeHubCanvas(existing) };

  /* WHICH KIND the couple asked for. Absent = photo, the same rule
     `resolveHubBackground` states for every row written before kinds existed. */
  const kindRaw = formData.get('kind');
  const kind = typeof kindRaw === 'string' ? kindRaw.trim() : '';

  /* ⛔ MEDIA BEHIND A SECTION IS PRO; A COLOUR IS NOT (owner 2026-09-24:
     "changing background color is free. making media a background is pro.").
     The REAL kind goes into the one classifier, so a colour write is never Pro
     in any direction (`sectionBackgroundChange` answers 'none' or, when it
     takes media down, 'remove'). Taking media off (`media=''`) is never gated;
     putting a photo or snippet up, or swapping it, is. Asked BEFORE any branch
     below writes, so no kind can reach the update ungated.
     💾 A DRAFT save skips it: trying is free, and `hubDraftAction` apply asks
     the same classifier before anything reaches the live row. The ownership
     check below still runs for a draft — a draft may only hold THEIR photo. */
  if (!drafting) await requireLookPro(
    eventId,
    sectionBackgroundChange({
      currentMedia: typeof canvas.media === 'string' ? canvas.media : null,
      kind: kind === 'color' ? 'color' : kind === 'snippet' ? 'snippet' : 'photo',
      nextMedia: kind === 'color' || wanted.length === 0 ? null : (hubMediaRef(wanted) ?? wanted),
    }),
  );

  if (kind === 'color') {
    /* 🔒 A COLOUR NEVER TOUCHES THE REF PATH. It has its own field and its own
       shape, so there is no way to hand this branch an `r2://` and have it
       stored — which would be a second doorway into `media` with no
       allow-list on it. An unusable value clears the background rather than
       being repaired into some other colour. */
    const color = hubBackgroundColor(formData.get('color'));
    delete canvas.media;
    if (color) {
      canvas.kind = 'color';
      canvas.color = color;
    } else {
      delete canvas.kind;
      delete canvas.color;
    }
  } else if (wanted.length === 0) {
    delete canvas.media;
    delete canvas.kind;
    delete canvas.color;
  } else {
    delete canvas.color;
    // The STRICTER reader, not `siteMediaServeRef` alone — that one passes a
    // bare string through as a legacy URL, and `"1"` is not a photo.
    const ref = hubMediaRef(wanted);
    if (!ref || !ownRefs.has(ref)) {
      redirect(
        resolveReturnTo(
          formData,
          `/dashboard/${eventId}/website/widgets?error=not_your_photo`,
          '?error=not_your_photo',
        ),
      );
    }
    canvas.media = ref;
    /* Only `snippet` is stored; a photo is the absence of a kind, so a row
       written here looks exactly like the millions written before kinds
       existed and reads the same way. */
    if (kind === 'snippet') canvas.kind = 'snippet';
    else delete canvas.kind;
  }

  if (drafting) await saveCanvasToDraft(formData, eventId, row.widget_type, canvas);
  const { error: updateErr } = await supabase
    .from('invitation_widgets')
    .update({ config_json: { ...existing, canvas } })
    .eq('widget_id', widgetId)
    .eq('event_id', eventId);

  if (updateErr) throw new Error(`Failed to save this section's background: ${updateErr.message}`);

  await revalidateForWidgetChange(eventId);
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?saved=1`, '?saved=1'),
  );
}

/**
 * Set how the section's background photo is CROPPED — the focal point and how
 * far in it sits.
 *
 * 🔑 ITS OWN ACTION, not a third field on `setWidgetBackground`. That action
 * reads an EMPTY `media` as "take the background off", so a crop form that did
 * not carry the photo would clear it on every tap — a control that quietly
 * undoes the thing it is adjusting.
 *
 * ⛔ AND IT REFUSES A SECTION WITH NO PHOTO. A focal point with nothing to crop
 * moves no pixels, and storing one would be a saved decision with no effect —
 * the defect this whole build exists to remove. The editor does not paint the
 * controls in that state either; this is the same rule, server-side.
 *
 * Form fields: event_id · widget_id · focal (1–9) · zoom (100 | 120 | 150)
 */
export async function setWidgetCrop(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const widgetIdRaw = formData.get('widget_id');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  if (typeof widgetIdRaw !== 'string' || widgetIdRaw.length === 0) {
    throw new Error('Missing section id.');
  }
  const eventId = eventIdRaw as string;
  const widgetId = widgetIdRaw as string;

  await requireHostMembershipOrThrow(eventId, WIDGET_FORBIDDEN);

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from('invitation_widgets')
    .select('widget_id, widget_type, config_json')
    .eq('widget_id', widgetId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (readErr) throw new Error(`Failed to load section: ${readErr.message}`);
  if (!row) throw new Error('Section not found on this event.');

  const drafting = isHubDraftWrite(formData);
  const existing = await canvasBase(drafting, eventId, row);
  const canvas: Record<string, unknown> = { ...sanitizeHubCanvas(existing) };

  if (!canvas.media) {
    redirect(
      resolveReturnTo(
        formData,
        `/dashboard/${eventId}/website/widgets?error=no_background`,
        '?error=no_background',
      ),
    );
  }

  /* ⛔ THE CROP AND ZOOM ARE HOW THE PAGE LOOKS — PRO (owner 2026-09-24). A free
     couple's existing crop stays as it is; moving it is a change. */
  if (!drafting) await requireLookPro(eventId, 'change');

  const focalRaw = Number(formData.get('focal'));
  const zoomRaw = Number(formData.get('zoom'));
  if ((HUB_FOCAL_POINTS as readonly number[]).includes(focalRaw)) canvas.focal = focalRaw;
  if ((HUB_ZOOMS as readonly number[]).includes(zoomRaw)) canvas.zoom = zoomRaw;

  if (drafting) await saveCanvasToDraft(formData, eventId, row.widget_type, canvas);

  const { error: updateErr } = await supabase
    .from('invitation_widgets')
    .update({ config_json: { ...existing, canvas } })
    .eq('widget_id', widgetId)
    .eq('event_id', eventId);

  if (updateErr) throw new Error(`Failed to save the crop: ${updateErr.message}`);

  await revalidateForWidgetChange(eventId);
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?saved=1`, '?saved=1'),
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   THE COUPLE'S OWN SECTIONS (owner 2026-09-23)
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Add a section — take the next free slot, at the bottom of the order.
 *
 * ⛔ THE SEVENTH IS REFUSED, and the refusal says so. Six is the shape, not a
 * rule: `CUSTOM_SECTION_TYPES` has six names and the database CHECK names the
 * same six, so a hand-crafted POST cannot make a seventh either.
 *
 * 🔑 IT INSERTS RATHER THAN SEEDS. Six empty rows on every event would be six
 * empty rows in every couple's editor forever, for a feature most will never
 * use — so a row exists only once somebody asks for one.
 */
export async function addCustomSection(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) redirect('/dashboard');
  const eventId = eventIdRaw as string;

  await requireHostMembershipOrThrow(eventId, WIDGET_FORBIDDEN);

  /* ⛔ PRO, CHECKED HERE AND NOT ONLY IN THE EDITOR. Adding a section is
     arranging the page, not fixing a word we wrote (owner 2026-09-22). The
     editor hides the button for a free couple; this refuses the hand-crafted
     POST. Admin client for the SKU read, as `website/colors/actions.ts` does:
     orders RLS is purchaser-scoped, and a co-host who did not place the order
     must still resolve the event's Pro. */
  await refuseCustomSectionWithoutPro(eventId, {
    intent: 'add',
    ownsPro: await eventCoupleWebsiteProActive(createAdminClient(), eventId),
    hadContent: false,
  });
  const supabase = await createClient();

  const { data: rows, error: readErr } = await supabase
    .from('invitation_widgets')
    .select('widget_type, display_order')
    .eq('event_id', eventId);
  if (readErr) throw new Error(`Failed to read your sections: ${readErr.message}`);

  // 🔑 A REFUSED READ MUST NOT LOOK LIKE AN EMPTY ONE. `rows` is null only on an
  // error we already threw on; an empty array genuinely means no sections.
  const used = (rows ?? []).map((r) => String(r.widget_type));
  const slot = nextFreeCustomSlot(used);
  if (!slot) {
    redirect(
      resolveReturnTo(
        formData,
        `/dashboard/${eventId}/website/widgets?error=no_free_section`,
        '?error=no_free_section',
      ),
    );
  }

  const bottom = (rows ?? []).reduce((max, r) => Math.max(max, Number(r.display_order) || 0), 0);
  const { error: insertErr } = await supabase.from('invitation_widgets').insert({
    event_id: eventId,
    widget_type: slot,
    display_order: bottom + 1,
    is_visible: true,
    is_always_on: false,
  });
  if (insertErr) throw new Error(`Failed to add a section: ${insertErr.message}`);

  await revalidateForWidgetChange(eventId);
  redirect(resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?saved=1`, '?saved=1'));
}

/** Redirect to the unlock page when the Pro line refuses this write. */
async function refuseCustomSectionWithoutPro(
  eventId: string,
  input: Parameters<typeof customSectionWriteAllowed>[0],
): Promise<void> {
  if (!customSectionWriteAllowed(input)) redirect(`/dashboard/${eventId}/studio/website-pro`);
}

/**
 * One of the couple's own sections — its words, its layout, or its removal.
 *
 * 🔑 ONE EXPORT, THREE INTENTS (`intent` = save · arrange · delete; absent =
 * save, which is what every form posted before this). Not three new exports:
 * the Vercel route ceiling is near, and every `'use server'` export is a route.
 *
 *   save    — the heading and the words. REFUSED over the limit, never cut
 *             (`readCustomSectionInput`); the inputs carry the same maxLength.
 *   arrange — one of the four chapter arrangements, a closed set; anything
 *             else is dropped (`hubArrangement` returns null → no write).
 *   delete  — the row goes, so its slot is free again for "Add". Never
 *             Pro-locked: taking your own words off your own page is not a
 *             purchase.
 *
 * ⛔ MERGES `config_json` for save and arrange, like every other writer here —
 * the canvas (photo, crop, motion) and the words share one bag, and a couple
 * who changed one must not lose the other.
 *
 * ⛔ THE PRO LINE (`customSectionWriteAllowed`): a free couple may still edit a
 * section that already HAS words — the editor's grandfather rule — but may not
 * start filling an empty one.
 */
export async function saveCustomSection(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const widgetIdRaw = formData.get('widget_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) redirect('/dashboard');
  if (typeof widgetIdRaw !== 'string' || widgetIdRaw.length === 0) {
    throw new Error('Missing section id.');
  }
  const eventId = eventIdRaw as string;
  const widgetId = widgetIdRaw as string;
  const intent = customSectionIntent(formData.get('intent'));
  if (!intent) throw new Error('Unknown change to your section.');

  await requireHostMembershipOrThrow(eventId, WIDGET_FORBIDDEN);
  const supabase = await createClient();

  const { data: row, error: readErr } = await supabase
    .from('invitation_widgets')
    .select('widget_id, widget_type, config_json')
    .eq('widget_id', widgetId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (readErr) throw new Error(`Failed to load the section: ${readErr.message}`);
  if (!row) throw new Error('Section not found on this event.');
  if (!isCustomSectionType(row.widget_type)) {
    // Words, layouts and removal belong only to a slot the couple added.
    // Deleting a SHIPPED section's row would take a product section off the
    // page with no way back; writing words onto one would put a paragraph
    // nothing renders inside its config.
    throw new Error('That section is not one you write yourself.');
  }

  const existing =
    row.config_json && typeof row.config_json === 'object' && !Array.isArray(row.config_json)
      ? (row.config_json as Record<string, unknown>)
      : {};

  await refuseCustomSectionWithoutPro(eventId, {
    intent,
    ownsPro:
      intent === 'delete' ? false : await eventCoupleWebsiteProActive(createAdminClient(), eventId),
    hadContent: customSectionHasContent(existing),
  });

  const back = (q: string) =>
    resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets${q}`, q);

  if (intent === 'delete') {
    /* 🔑 COUNT THE ROWS. A delete RLS refuses is not an error in PostgREST —
       it is zero rows and a 204 — so without `.select()` a refusal would redirect
       to "saved" with the section still on the page. */
    const { data: gone, error: delErr } = await supabase
      .from('invitation_widgets')
      .delete()
      .eq('widget_id', widgetId)
      .eq('event_id', eventId)
      .select('widget_id');
    if (delErr) throw new Error(`Failed to remove your section: ${delErr.message}`);
    if (!gone || gone.length !== 1) throw new Error('Your section could not be removed.');
    await revalidateForWidgetChange(eventId);
    redirect(back('?saved=1'));
  }

  let next: Record<string, unknown>;
  if (intent === 'arrange') {
    const arrangement = hubArrangement(formData.get('arrangement'));
    if (!arrangement) redirect(back('?error=bad_arrangement'));
    next = { ...existing, canvas: { ...sanitizeHubCanvas(existing), arrangement } };
  } else {
    const input = readCustomSectionInput(formData.get('title'), formData.get('body'));
    if (!input.ok) redirect(back('?error=too_long'));
    next = { ...existing, custom: input.value };
  }

  const { error: updateErr } = await supabase
    .from('invitation_widgets')
    .update({ config_json: next })
    .eq('widget_id', widgetId)
    .eq('event_id', eventId);
  if (updateErr) throw new Error(`Failed to save your section: ${updateErr.message}`);

  await revalidateForWidgetChange(eventId);
  redirect(back('?saved=1'));
}

/* ════════════════════════════════════════════════════════════════════════════
   💾 THE DRAFT DOOR (Event Hub Maker Phase 2, owner 2026-09-24/25)
   ════════════════════════════════════════════════════════════════════════════
   A form that carries `draft=1` (`HUB_DRAFT_FIELD`) is the Maker editing a
   DRAFT: every validation above still runs (the section must be this event's,
   a background must be the couple's own photo, "Shown" must have content), but
   the result goes into `event_site_drafts` instead of the live row, and the Pro
   gate moves to `hubDraftAction` apply — trying is free, applying is not.
   A form WITHOUT the field behaves byte-for-byte as before. */

/** The config a canvas writer builds on: the drafted canvas in draft mode. */
async function canvasBase(
  drafting: boolean,
  eventId: string,
  row: { config_json: unknown; widget_type: string },
): Promise<Record<string, unknown>> {
  const live =
    row.config_json && typeof row.config_json === 'object' && !Array.isArray(row.config_json)
      ? (row.config_json as Record<string, unknown>)
      : {};
  return drafting ? draftedWidgetConfig(eventId, row.widget_type, live) : live;
}

/** Back to where the couple was, marked as a draft save. Never returns. */
function finishDraftSave(formData: FormData, eventId: string): never {
  revalidateWebsiteEditor(eventId, 'widgets');
  redirect(resolveReturnTo(formData, `/dashboard/${eventId}/website/widgets?drafted=1`, '?drafted=1'));
}

async function saveWidgetToDraft(
  formData: FormData,
  eventId: string,
  widgetType: string,
  patch: HubDraftWidget,
): Promise<never> {
  await saveHubDraftPatch(eventId, { widgets: { [widgetType]: patch } as HubDraftPatch['widgets'] });
  finishDraftSave(formData, eventId);
}

async function saveCanvasToDraft(
  formData: FormData,
  eventId: string,
  widgetType: string,
  canvas: Record<string, unknown>,
): Promise<never> {
  return saveWidgetToDraft(formData, eventId, widgetType, { canvas: sanitizeHubCanvas({ canvas }) });
}
