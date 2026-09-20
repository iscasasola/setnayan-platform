'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isLiveStudioSetupHost } from '@/lib/panood-control-room-access';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { liveStudioControlPath } from '@/lib/live-studio-control';
import { resolveBroadcastWindow } from '@/lib/live-studio-window-server';
import { generateScreenPairingCode } from '@/lib/panood-screens';
import {
  DEFAULT_LIVE_SCREEN_MODE,
  LIVE_SCREEN_CODE_TTL_MS,
  canAddScreen,
  canUseVenueScreens,
  isLiveScreenMode,
  nextScreenIndex,
  normalizeScreenName,
} from '@/lib/live-screens';

/**
 * VENUE SCREENS (DAY-12) — the controller's writes to `panood_screens`.
 *
 * Owner rulings 2026-09-20: screens live in this controller; a screen shows
 * live background, mirror or off, never the photo wall (lib/live-screens.ts).
 *
 * GATE 1 · HOST: the SAME predicate the controller page and its other actions
 * use (`isLiveStudioSetupHost` — couple, coordinator or moderator). The
 * table's RLS covers couple + coordinator only, so a moderator would be
 * refused by a session-client write; the writes therefore run on the
 * service-role client AFTER the host gate, and every one of them is scoped by
 * `event_id` so a screen id from another event matches nothing. This is the
 * camera-seat shape the page already uses.
 *
 * GATE 2 · ENTITLEMENT (owner ruling 2026-09-20, lib/live-screens.ts): venue
 * screens come WITH the paid Live Studio unlock — no second charge, no second
 * flag. Resolved the SAME way the controller page resolves broadcasting
 * (`resolveBroadcastWindow` → `eventSkuActive(LIVE_STUDIO_SKU)`, on the ADMIN
 * client, for the same reason page.tsx uses it there: `orders` RLS is
 * purchaser-scoped, and a coordinator/moderator running this controller for a
 * couple who paid is not the purchaser). Every action below runs GATE 2 —
 * except `removeLiveScreen`, which stays allowed for cleanup even on a locked
 * event (`gate(formData, { allowLocked: true })`).
 *
 * EVERY WRITE COUNTS ITS ROWS. An update that matches nothing returns no error
 * (a zero-row UPDATE is success-shaped), so each one selects `id` back and a
 * missing row is reported to the operator instead of a green banner.
 */

// `?sheet=screens`, not `#screens`: redirect() from a server action drops the hash,
// which left the sheet shut and the new screen's code hidden (prod, 2026-09-20).
const SCREENS = (eventId: string, qs: string) => `${liveStudioControlPath(eventId)}?${qs}&sheet=screens`;

async function gate(formData: FormData, opts: { allowLocked?: boolean } = {}): Promise<string> {
  const raw = formData.get('event_id');
  if (typeof raw !== 'string' || raw.length === 0) redirect('/dashboard');
  const eventId = raw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!(await isLiveStudioSetupHost(eventId, user.id))) redirect('/dashboard');

  // GATE 2 · ENTITLEMENT. Skipped only for removeLiveScreen (cleanup).
  if (!opts.allowLocked) {
    const admin = createAdminClient();
    const broadcastWindow = await resolveBroadcastWindow(admin, eventId);
    if (!canUseVenueScreens({ liveStudioActive: broadcastWindow.multiCam })) {
      redirect(SCREENS(eventId, 'screen_error=locked'));
    }
  }
  return eventId;
}

function screenIdFrom(formData: FormData): number | null {
  const n = Number(formData.get('screen_id'));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function freshCode(nowMs: number) {
  return {
    pairing_code: generateScreenPairingCode(),
    pairing_expires_at: new Date(nowMs + LIVE_SCREEN_CODE_TTL_MS).toISOString(),
  };
}

/** Add a screen. It starts on the live background with a fresh pairing code. */
export async function addLiveScreen(formData: FormData): Promise<void> {
  const eventId = await gate(formData);
  const admin = createAdminClient();

  const { data: rows, error: readError } = await admin
    .from('panood_screens')
    .select('screen_index, revoked_at')
    .eq('event_id', eventId);
  if (readError) {
    console.error('[supabase-error] panood/control/screens-actions.ts · addLiveScreen read', readError);
    redirect(SCREENS(eventId, 'screen_error=save'));
  }
  const all = (rows ?? []) as Array<{ screen_index: number; revoked_at: string | null }>;
  if (!canAddScreen(all.filter((r) => !r.revoked_at).length)) {
    redirect(SCREENS(eventId, 'screen_error=cap'));
  }

  const now = Date.now();
  const screenIndex = nextScreenIndex(all.map((r) => r.screen_index));
  const { data: inserted, error } = await admin
    .from('panood_screens')
    .insert({
      event_id: eventId,
      screen_index: screenIndex,
      name: normalizeScreenName(formData.get('name')),
      ...freshCode(now),
      // Written explicitly: the column DEFAULT is the legacy 'photos'.
      current_source: DEFAULT_LIVE_SCREEN_MODE,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();
  if (error || !inserted) {
    if (error) console.error('[supabase-error] panood/control/screens-actions.ts · addLiveScreen insert', error);
    redirect(SCREENS(eventId, 'screen_error=save'));
  }

  revalidatePath(liveStudioControlPath(eventId));
  redirect(SCREENS(eventId, 'screen_added=1'));
}

/** Choose what one screen shows. Only the three Live Studio modes are accepted. */
export async function setLiveScreenMode(formData: FormData): Promise<void> {
  const eventId = await gate(formData);
  const screenId = screenIdFrom(formData);
  const mode = formData.get('mode');
  if (screenId === null || !isLiveScreenMode(mode)) redirect(SCREENS(eventId, 'screen_error=save'));

  const { data, error } = await createAdminClient()
    .from('panood_screens')
    .update({ current_source: mode, updated_at: new Date().toISOString() })
    .eq('id', screenId)
    .eq('event_id', eventId)
    .is('revoked_at', null)
    .select('id');
  if (error || !data || data.length === 0) {
    if (error) console.error('[supabase-error] panood/control/screens-actions.ts · setLiveScreenMode', error);
    redirect(SCREENS(eventId, 'screen_error=missing'));
  }

  revalidatePath(liveStudioControlPath(eventId));
  redirect(SCREENS(eventId, 'screen_mode=1'));
}

/** Put every screen on the same mode at once. */
export async function setAllLiveScreensMode(formData: FormData): Promise<void> {
  const eventId = await gate(formData);
  const mode = formData.get('mode');
  if (!isLiveScreenMode(mode)) redirect(SCREENS(eventId, 'screen_error=save'));

  const { data, error } = await createAdminClient()
    .from('panood_screens')
    .update({ current_source: mode, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .is('revoked_at', null)
    .select('id');
  if (error || !data || data.length === 0) {
    if (error) console.error('[supabase-error] panood/control/screens-actions.ts · setAllLiveScreensMode', error);
    redirect(SCREENS(eventId, 'screen_error=missing'));
  }

  revalidatePath(liveStudioControlPath(eventId));
  redirect(SCREENS(eventId, 'screen_mode=1'));
}

/** Rename a screen. An empty name falls back to "Screen N". */
export async function renameLiveScreen(formData: FormData): Promise<void> {
  const eventId = await gate(formData);
  const screenId = screenIdFrom(formData);
  if (screenId === null) redirect(SCREENS(eventId, 'screen_error=save'));

  const { data, error } = await createAdminClient()
    .from('panood_screens')
    .update({ name: normalizeScreenName(formData.get('name')), updated_at: new Date().toISOString() })
    .eq('id', screenId)
    .eq('event_id', eventId)
    .is('revoked_at', null)
    .select('id');
  if (error || !data || data.length === 0) {
    if (error) console.error('[supabase-error] panood/control/screens-actions.ts · renameLiveScreen', error);
    redirect(SCREENS(eventId, 'screen_error=missing'));
  }

  revalidatePath(liveStudioControlPath(eventId));
  redirect(SCREENS(eventId, 'screen_renamed=1'));
}

/**
 * Issue a new pairing code. This UNPAIRS the screen: `paired_at` is cleared,
 * so whatever device held it fails its next check-in (lib/live-screen-session).
 * Used when a TV is swapped, or a code expired before anyone typed it.
 */
export async function reissueLiveScreenCode(formData: FormData): Promise<void> {
  const eventId = await gate(formData);
  const screenId = screenIdFrom(formData);
  if (screenId === null) redirect(SCREENS(eventId, 'screen_error=save'));

  const { data, error } = await createAdminClient()
    .from('panood_screens')
    .update({
      ...freshCode(Date.now()),
      paired_at: null,
      last_seen_at: null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', screenId)
    .eq('event_id', eventId)
    .is('revoked_at', null)
    .select('id');
  if (error || !data || data.length === 0) {
    if (error) console.error('[supabase-error] panood/control/screens-actions.ts · reissueLiveScreenCode', error);
    redirect(SCREENS(eventId, 'screen_error=missing'));
  }

  revalidatePath(liveStudioControlPath(eventId));
  redirect(SCREENS(eventId, 'screen_code=1'));
}

/**
 * Remove a screen. The row is kept (its index stays taken, so a later screen
 * never inherits an old device's number) and stamped revoked; the device's
 * token is refused from its next check-in.
 */
export async function removeLiveScreen(formData: FormData): Promise<void> {
  // Cleanup stays allowed even on a locked event — GATE 2's one exception.
  const eventId = await gate(formData, { allowLocked: true });
  const screenId = screenIdFrom(formData);
  if (screenId === null) redirect(SCREENS(eventId, 'screen_error=save'));

  const { data, error } = await createAdminClient()
    .from('panood_screens')
    .update({
      revoked_at: new Date().toISOString(),
      pairing_code: null,
      pairing_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', screenId)
    .eq('event_id', eventId)
    .is('revoked_at', null)
    .select('id');
  if (error || !data || data.length === 0) {
    if (error) console.error('[supabase-error] panood/control/screens-actions.ts · removeLiveScreen', error);
    redirect(SCREENS(eventId, 'screen_error=missing'));
  }

  revalidatePath(liveStudioControlPath(eventId));
  redirect(SCREENS(eventId, 'screen_removed=1'));
}
