import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { provisionUploadsCameraAdmin } from '@/lib/papic-cameras';
import { resolveStoredWindow } from '@/lib/papic-window';
import { startAddingPhotos } from '@/app/dashboard/[eventId]/studio/papic/actions';
import { hostCameraRefusal, type HostCameraDoor } from '@/lib/papic-host-door';

/**
 * 📷 Is the person opening the guest-camera page a HOST of the event they came from — and if so, their own camera.
 * (`lib/papic-host-door.ts` says why.)
 *
 * · The event is the Hub's slug in the link; the HOST check is the viewer's OWN membership read on their own session
 *   (`member_type = 'couple'`: the couple and every co-host) — never anything the link claims.
 * · The camera is minted here as the Memories render mints it (same couple-checked shape, the viewer's own id, the
 *   same capture window, idempotent) — a host who has never opened Memories still gets theirs.
 * · The claim is the Memories door's own (`startAddingPhotos`): one resolver decides whose camera is whose.
 * Never throws: anything unexpected is 'not_host' (the guest page as it was) or a refusal in words.
 */
export async function hostCameraDoor(slug: string): Promise<HostCameraDoor> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) return { kind: 'not_host' };

    const admin = createAdminClient();
    const { data: ev, error: evErr } = await admin
      .from('events')
      .select('event_id, event_date, papic_window_start, papic_window_end, papic_uploads_open')
      .eq('slug', slug)
      .maybeSingle();
    if (evErr) logQueryError('hostCameraDoor.event', evErr, { slug }, 'graceful_degrade');
    const row = ev as {
      event_id: string;
      event_date: string | null;
      papic_window_start: string | null;
      papic_window_end: string | null;
      papic_uploads_open: boolean | null;
    } | null;
    if (!row) return { kind: 'not_host' };

    const { data: membership } = await supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', row.event_id)
      .eq('user_id', user.id)
      .eq('member_type', 'couple')
      .maybeSingle();
    if (!membership) return { kind: 'not_host' };

    const refused = (reason: Parameters<typeof hostCameraRefusal>[0]): HostCameraDoor => ({
      kind: 'refused',
      eventId: row.event_id,
      ...hostCameraRefusal(reason),
    });
    // The host camera follows the "adding photos" switch (`lib/papic-uploads-open-rule.ts`) — said, never a dead shutter.
    if ((row.papic_uploads_open ?? true) === false) return refused('adding_off');

    const win = resolveStoredWindow({ windowStart: row.papic_window_start, windowEnd: row.papic_window_end, eventDate: row.event_date });
    await provisionUploadsCameraAdmin(admin, row.event_id, { validFrom: win.startIso, validUntil: win.endIso }, user.id);

    const claim = await startAddingPhotos(row.event_id);
    if (claim.ok) return { kind: 'camera', token: claim.token };
    if (claim.code === 'signed_out' || claim.code === 'not_host') return { kind: 'not_host' };
    return refused(claim.code === 'helper' ? 'claim_failed' : claim.code);
  } catch (e) {
    console.error('[papic] host camera door', e instanceof Error ? e.message : e);
    return { kind: 'not_host' };
  }
}
