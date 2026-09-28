import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { QR_LOOK_COLUMNS, qrLookFromRow, resolveEventQrLook } from '@/lib/qr-look.server';
import { getHostUserId } from '@/lib/host-gate';
import { readHubDraftForHostPreview } from '@/lib/hub-draft-store';
import { overlayHubDraftEvent } from '@/lib/hub-draft';
import { renderEventLandingQrPng } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * GET /api/website/qr/[slug] — serves the master event QR as a PNG in the
 * event's LOOK. Drives the Event Hub address on the Maker's Details page,
 * the code every printed piece carries, the Panood program/control screens,
 * and is safe to share directly as an `<img>` source.
 *
 * The encoded URL is `setnayan.com/{slug}` (no token suffix) — same code that
 * drives host social shares + vendor scan-at-venue Tier 1/Tier 2 per the
 * 0002 unified QR lifecycle lock (CLAUDE.md 2026-05-22 row 11).
 *
 * THE LOOK (owner 2026-09-27, lib/qr-look.ts): a free event's code carries the
 * SETNAYAN mark in the centre; an Event Hub Pro event's carries the couple's
 * own logo, in their chosen shape, pattern and palette ink. Resolved by
 * `resolveEventQrLook` — the one place that reads Pro for a QR.
 *
 * Public read: the slug is already addressable on the marketing surface, so
 * no auth is required to fetch the QR for that slug. We hit the events table
 * with the admin client for the monogram + look columns; the privacy footprint
 * is limited to fields that already render on the public landing page itself.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  if (!slug || typeof slug !== 'string' || slug.length < 1 || slug.length > 64) {
    return new NextResponse('Invalid slug.', { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from('events')
    // The CANONICAL monogram list + the look's own two columns (role_palette,
    // style_preferences) — never a hand-typed near-copy.
    .select(`event_id, slug, ${QR_LOOK_COLUMNS}`)
    .eq('slug', slug)
    .maybeSingle();

  if (!event) {
    return new NextResponse('Event Hub not found.', { status: 404 });
  }

  /* 💾 THE HOST'S DRAFT PREVIEW (`?draft=1`, owner 2026-09-29 "yes to all 3").
     The Maker's Details page draws the QR look the couple is TRYING — their
     drafted shape · pattern · colour, worn as Pro would wear it — for a VERIFIED
     host only (`getHostUserId`), never cached, never for a guest. Without the
     param, or for anyone else, this is the live code exactly as before. */
  const draftAsked = new URL(req.url).searchParams.get('draft') === '1';
  let look = null as Awaited<ReturnType<typeof resolveEventQrLook>> | null;
  let preview = false;
  if (draftAsked && (await getHostUserId(event.event_id).catch(() => null))) {
    const draft = await readHubDraftForHostPreview(supabase, event.event_id);
    if (draft && 'style_preferences' in draft.events) {
      look = qrLookFromRow(overlayHubDraftEvent(event as Record<string, unknown>, draft) as typeof event, true);
      preview = true;
    }
  }
  if (!look) look = await resolveEventQrLook(supabase, event.event_id, event);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  // Canonical URL form — nested /u/ under the cutover flag, bare root otherwise
  // (resolve self-noops OFF; no query pre-cutover).
  const ownerSlug = await resolveEventOwnerSlug(supabase, event.event_id);

  // Render at 1024px so the printed PNG stays crisp at A4 / postcard sizes.
  //
  // 🔑 A BADGE THAT DID NOT DRAW MUST NOT LOOK LIKE ONE THAT DID. The styled
  // render falls back to the plain code on any failure — right, because the
  // guest's scannable code is the thing that must never break — but the first
  // cut of this route passed no error handler, so production served the bare
  // PNG with 200 and nothing anywhere said so. The header below carries that
  // fact onto the wire, where it can be measured without log access.
  let markError: unknown = null;
  const png = await renderEventLandingQrPng({
    appUrl,
    slug,
    ownerSlug,
    look,
    onMonogramError: (err) => {
      markError = err;
      logQueryError('EventLandingQrPng.look', err, { eventId: event.event_id }, 'graceful_degrade');
    },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // 'composited' = the look (its centre mark included) is in these pixels.
      // 'fallback' = it is not, and why is in the logs. See the note above.
      'X-Setnayan-Monogram': markError ? 'fallback' : 'composited',
      // Same slug + same look → same PNG, but the look is now a CHOICE the
      // couple can change from the Maker and expects to see at once, so the
      // shared cache is short (5 min) where it used to be a day. The Maker's
      // own preview adds a version query so it never waits even that long.
      // A host's draft preview is theirs alone — never stored by a shared cache.
      'Cache-Control': preview ? 'private, no-store' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
