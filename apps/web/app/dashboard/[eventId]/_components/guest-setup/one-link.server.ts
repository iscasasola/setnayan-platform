import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { renderStyledUrlQrSvg } from '@/lib/qr';
import { QR_LOOK_COLUMNS, qrLookFromRow } from '@/lib/qr-look.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';

/**
 * 🔗 THE ONE LINK + ONE QR for Guests › Setup's "Your one link" row (shown only
 * for Open · Anyone with the link — HOME_AND_GUESTS_CHECK G27). The same rules
 * as the invite page's panel (`share-link-panel.tsx`), read the same way:
 *
 *   · the URL exists only once the link can actually be OPENED
 *     (`sharedJoinLinkState` — a private event's QR would answer "Link not
 *     found"), and `notice` names the real reason when it cannot;
 *   · the branded `/{slug}/invite` address when the event has a slug, else the
 *     opaque token URL;
 *   · the QR wears the event's look (`qrLookFromRow` — the Setnayan mark free,
 *     the couple's own on Event Hub Pro).
 *
 * Read with the caller's session for the token and event (RLS), the look
 * through the admin client AFTER the caller's couple check (`invite-panel.tsx`).
 */
export type OneLink = { url: string | null; qrSvg: string | null; notice: string | null };

export async function readOneLink(supabase: SupabaseClient, eventId: string): Promise<OneLink> {
  const admin = createAdminClient();
  const [tokenRes, eventRes, lookRes, ownsPro] = await Promise.all([
    supabase.from('event_join_tokens').select('token, revoked_at, expires_at').eq('event_id', eventId).maybeSingle(),
    supabase
      .from('events')
      .select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at')
      .eq('event_id', eventId)
      .maybeSingle(),
    admin.from('events').select(QR_LOOK_COLUMNS).eq('event_id', eventId).maybeSingle(),
    eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId).catch(() => false),
  ]);
  if (tokenRes.error) logQueryError('GuestSetup.oneLink (event_join_tokens)', tokenRes.error, { event_id: eventId }, 'graceful_degrade');
  if (eventRes.error) logQueryError('GuestSetup.oneLink (events)', eventRes.error, { event_id: eventId }, 'graceful_degrade');
  if (eventRes.error || tokenRes.error) {
    return { url: null, qrSvg: null, notice: 'We couldn’t read your link just now. Nothing was changed.' };
  }
  const token = tokenRes.data as { token?: string | null; revoked_at?: string | null; expires_at?: string | null } | null;
  const state = sharedJoinLinkState({
    event: (eventRes.data ?? {}) as Parameters<typeof sharedJoinLinkState>[0]['event'],
    tokenValid: !!token?.token && !token.revoked_at && (!token.expires_at || new Date(token.expires_at) > new Date()),
  });
  if (!state.usable) {
    return { url: null, qrSvg: null, notice: state.notice ?? 'Your link isn’t ready yet. Try again in a moment.' };
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const slug = (eventRes.data?.slug as string | null) ?? null;
  const ownerSlug = slug ? await resolveEventOwnerSlug(admin, eventId) : null;
  const url = slug
    ? `${appUrl}${publicEventPath(slug, ownerSlug)}/invite`
    : token?.token
      ? `${appUrl}/join/${eventId}?token=${token.token}`
      : null;
  if (!url) return { url: null, qrSvg: null, notice: 'Your link isn’t ready yet. Try again in a moment.' };
  const qrSvg = await renderStyledUrlQrSvg(url, qrLookFromRow(lookRes.data, ownsPro), 240);
  return { url, qrSvg, notice: null };
}
