import 'server-only';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import { deriveMonogram } from '@/lib/monogram';
import { readEventWatchUrls, resolveWatchLinks } from '@/lib/watch-live-links';
import { decideScreenPicture, shouldWriteCheckIn, type ScreenPicture } from '@/lib/live-screens';
import {
  LIVE_SCREEN_COOKIE_NAME,
  liveScreenTokenMatchesRow,
  verifyLiveScreenToken,
} from '@/lib/live-screen-session';

/**
 * What one venue screen should draw right now (DAY-12).
 *
 * Runs on every poll. The cookie is a CLAIM; the row decides
 * (`liveScreenTokenMatchesRow`), so Remove and New code take effect on the
 * screen's next poll, not when the cookie expires.
 *
 * ⚠ This reads `events` with the SERVICE-ROLE client, which ignores
 * visibility. What makes that safe is the gate above it: only a device holding
 * a token for a live, paired row of THIS event reaches the read, and only the
 * couple's own controller can mint the code that produces one. What it reads
 * is the name, the monogram and the YouTube watch link — the last of which the
 * couple already publishes on their event page.
 *
 * A REFUSED READ IS NOT "UNPAIRED". A database error returns `{ state: 'down' }`
 * so the screen keeps its last picture and says it is reconnecting, instead of
 * telling a room full of guests that the screen was disconnected.
 */

export type ScreenBrand = {
  displayName: string;
  initials: string;
  markDataUri: string | null;
  color: string | null;
  eventDate: string | null;
};

export type LoadedScreen =
  | { state: 'unpaired' }
  | { state: 'revoked' }
  | { state: 'down' }
  | { state: 'ready'; picture: ScreenPicture; brand: ScreenBrand; screenName: string | null };

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function loadLiveScreen(): Promise<LoadedScreen> {
  const jar = await cookies();
  const claim = await verifyLiveScreenToken(jar.get(LIVE_SCREEN_COOKIE_NAME)?.value);
  if (!claim) return { state: 'unpaired' };

  const admin = createAdminClient();
  const { data: rowRaw, error: rowError } = await admin
    .from('panood_screens')
    .select('id, event_id, name, paired_at, revoked_at, last_seen_at, current_source')
    .eq('id', claim.screen_id)
    .maybeSingle();
  if (rowError) {
    console.error('[supabase-error] app/live/_lib/load-screen.ts · screen read', rowError);
    return { state: 'down' };
  }
  const row = rowRaw as {
    id: number;
    event_id: string;
    name: string | null;
    paired_at: string | null;
    revoked_at: string | null;
    last_seen_at: string | null;
    current_source: string | null;
  } | null;
  if (!liveScreenTokenMatchesRow(claim, row)) return { state: 'revoked' };
  // Narrowed by the check above; restated for the type system.
  if (!row) return { state: 'revoked' };

  const now = Date.now();
  if (shouldWriteCheckIn(row.last_seen_at, now)) {
    const stamp = new Date(now).toISOString();
    const { error: seenError } = await admin
      .from('panood_screens')
      .update({ last_seen_at: stamp, status: 'online' })
      .eq('id', row.id)
      .is('revoked_at', null);
    // A missed check-in only makes the controller say "not responding" early;
    // it must never blank the TV. Logged, not thrown.
    if (seenError) console.error('[supabase-error] app/live/_lib/load-screen.ts · check-in', seenError);
  }

  const [{ data: eventRaw, error: eventError }, urls] = await Promise.all([
    admin
      .from('events')
      .select(`event_id, event_date, ${HERO_MONOGRAM_COLUMNS}`)
      .eq('event_id', row.event_id)
      .maybeSingle(),
    readEventWatchUrls(admin, row.event_id),
  ]);
  if (eventError || !eventRaw) {
    if (eventError) console.error('[supabase-error] app/live/_lib/load-screen.ts · event read', eventError);
    return { state: 'down' };
  }
  const event = eventRaw as Record<string, unknown> & {
    display_name?: string | null;
    event_date?: string | null;
    monogram_text?: string | null;
    monogram_color?: string | null;
    monogram_uploaded_svg?: string | null;
    monogram_custom_svg?: string | null;
  };

  const markSvg = resolveEventMonogramSvg(event);
  const links = resolveWatchLinks({ youtubeWatchUrl: urls.youtubeWatchUrl });
  const color = typeof event.monogram_color === 'string' && HEX.test(event.monogram_color) ? event.monogram_color : null;

  return {
    state: 'ready',
    screenName: row.name,
    picture: decideScreenPicture({ mode: row.current_source, embedUrl: links?.embedUrl ?? null }),
    brand: {
      displayName: event.display_name?.trim() || 'Our celebration',
      initials: event.monogram_text?.trim() || deriveMonogram(event.display_name),
      markDataUri: markSvg ? bespokeSvgToDataUri(markSvg) : null,
      color,
      eventDate: event.event_date ?? null,
    },
  };
}
