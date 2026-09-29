'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getHostUserId } from '@/lib/host-gate';
import { parsePrintDetails, serializePrintDetails } from '@/lib/print-pieces';
import { defaultInviteTemplate, sanitizeInviteTemplate } from '@/lib/guest-invite-message';
import { logQueryError } from '@/lib/supabase/error-detect';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * THE COUPLE REWORDS THE INVITE MESSAGE — ONCE, FOR EVERY GUEST.
 *
 * Owner 2026-09-29 (controller brief, item 3): one stored wording with
 * placeholders that fill themselves. Its home is `events.print_details` — the
 * Maker's Details › Words jsonb, "only what has no other home" — under the key
 * `invite_message`, so there is no new column, grant or view rebuild.
 *
 * ── THE SAME DOOR THE PRINT ROUTE USES ─────────────────────────────────────
 * `print_details` is granted SELECT only to `authenticated`; its writers go
 * through the ADMIN client after proving the caller is a host of THIS event
 * (`getHostUserId` — a couple, or an accepted non-viewer host). This is that
 * shape, not a second one.
 *
 * 🔑 READ, THEN WRITE — OR WRITE NOTHING. The jsonb also holds the printed
 * set's words, toggles and Menu. A blind write would wipe them, so the stored
 * value is read first and round-tripped through parse/serialize; if it cannot
 * be read, nothing is written and the couple is told.
 *
 * ⚖ OUR WORDING IS STORED AS NULL. Saving text identical to ours (or blank, or
 * "Use our wording") stores null, so a later improvement to our wording reaches
 * every couple who never changed theirs.
 *
 * ⚠ It counts rows: a zero-row UPDATE is success-shaped.
 */
export async function saveInviteMessage(
  eventId: string,
  text: string,
): Promise<{ ok: true; template: string | null } | { ok: false }> {
  if (!UUID.test(eventId)) return { ok: false };
  const hostId = await getHostUserId(eventId);
  if (!hostId) return { ok: false };

  const cleaned = sanitizeInviteTemplate(text);
  const isOurs =
    cleaned === null ||
    cleaned === defaultInviteTemplate({ solemn: false }) ||
    cleaned === defaultInviteTemplate({ solemn: true });
  const template = isOurs ? null : cleaned;

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from('events')
    .select('print_details')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readError || !current) {
    if (readError) logQueryError('saveInviteMessage.read', readError, { event_id: eventId }, 'graceful_degrade');
    return { ok: false };
  }
  const stored = parsePrintDetails((current as { print_details?: unknown }).print_details ?? null);

  const { data, error } = await admin
    .from('events')
    .update({ print_details: serializePrintDetails({ ...stored, inviteMessage: template }) })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !data || data.length === 0) {
    if (error) logQueryError('saveInviteMessage.write', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false };
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath(`/dashboard/${eventId}/guests/send`);
  revalidatePath(`/dashboard/${eventId}/invitation`);
  return { ok: true, template };
}
