import 'server-only';

import { findGuestSeatForUser } from '@/lib/guest-membership-session';
import { readGuestSession } from '@/lib/guest-session';
import { guestCopyViewer } from '@/lib/offline-copies';
import { createClient } from '@/lib/supabase/server';

/**
 * 📶 R18 — WHOSE SAVED COPY A ROOM OF THE EVENT HUB IS (seat and table, E-Gifts, the guest list): the hub's ONE rule
 * (`guestCopyViewer`, `lib/offline-copies.ts`), asked with the same facts the hub page reads — the pass this browser
 * holds for THIS event (`readGuestSession`, already checked against the guest's CURRENT QR token, so a rotated QR or a
 * removed guest is nobody), and the signed-in account's own seat. The pass wins, as it does on the hub
 * (`resolveGuestViewer`). Null = nobody's copy: no seal, no mark, nothing saved. A read that fails is nobody's too.
 */
export async function roomCopyViewer(eventId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const [pass, auth] = await Promise.all([readGuestSession({ eventId }), supabase.auth.getUser()]);
    const passGuestId = pass && pass.event_id === eventId ? pass.guest_id : null;
    const accountId = auth.data.user?.id ?? null;
    if (!accountId) {
      return guestCopyViewer({ refused: false, accountId: null, seatHolderId: null, passGuestId, drawnGuestId: passGuestId });
    }
    const seat = await findGuestSeatForUser(eventId, accountId);
    const drawnGuestId = passGuestId ?? seat?.guestId ?? null;
    return guestCopyViewer({
      refused: false,
      accountId,
      seatHolderId: seat && seat.guestId === drawnGuestId ? accountId : null,
      passGuestId,
      drawnGuestId,
    });
  } catch {
    return null;
  }
}
