'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isWidgetType } from '@/lib/invitation-widgets';

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

/**
 * Host membership gate — mirrors the canonical helper repeated in every
 * /website sub-editor's actions.ts. Accepts:
 *   1. event_moderators rows with accepted_at IS NOT NULL AND removed_at IS NULL
 *   2. event_members rows with member_type = 'couple' (V1 backwards-compat)
 *
 * Throws on unauthenticated or unauthorized callers. The thrown error
 * surfaces as a 500 to the caller — Next.js form actions don't have a
 * clean way to surface 403 specifically without client-side state.
 */
async function requireHostMembership(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Source 1 — event_moderators (canonical going forward · iteration 0048).
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();

  if (moderator) return user.id;

  // Source 2 — event_members couple row (V1 backwards-compat).
  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (legacy && (legacy as { member_type: string }).member_type === 'couple') {
    return user.id;
  }

  throw new Error('Forbidden — only current hosts can edit widget visibility.');
}

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

  revalidatePath(`/dashboard/${eventId}/website/widgets`);
  revalidatePath(`/dashboard/${eventId}/website`);
  if (event?.slug) {
    revalidatePath(`/${event.slug}`);
  }
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

  await requireHostMembership(eventId);

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
    redirect(`/dashboard/${eventId}/website/widgets?error=always_on`);
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
  redirect(`/dashboard/${eventId}/website/widgets?saved=1`);
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

  await requireHostMembership(eventId);

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

  const movingIndex = rows.findIndex((r) => r.widget_id === widgetId);
  if (movingIndex === -1) {
    // Widget either doesn't exist on this event OR is_always_on (we
    // filter to is_always_on=false above). Either way silent no-op.
    redirect(`/dashboard/${eventId}/website/widgets`);
  }

  const movingRow = rows[movingIndex]!;
  const neighborIndex = direction === 'up' ? movingIndex - 1 : movingIndex + 1;

  // Already at the boundary — nothing to swap with. Silent no-op so
  // a host mashing the Up arrow on the topmost widget doesn't see an
  // error toast.
  if (neighborIndex < 0 || neighborIndex >= rows.length) {
    redirect(`/dashboard/${eventId}/website/widgets`);
  }

  const neighborRow = rows[neighborIndex]!;

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
  redirect(`/dashboard/${eventId}/website/widgets?saved=1`);
}
