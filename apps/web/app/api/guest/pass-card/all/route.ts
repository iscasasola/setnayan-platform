import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getHostUserId } from '@/lib/host-gate';
import { PASS_CARD_WORDS, PASS_CARD_ZIP_MAX, passCardsZipFileName, uniqueFileNames } from '@/lib/pass-card';
import { eligiblePassCardGuests, loadPassCardKit, passCardDesignFor, passCardFileNameFor, renderPassCardFor } from '@/lib/pass-card.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatCount } from '@/lib/format-number';

/**
 * GET /api/guest/pass-card/all?event=<uuid> — EVERY guest's pass card in one
 * .zip, for the couple — how they hand tickets out by phone.
 *
 * 🎟 FREE FOR EVERY EVENT (owner 2026-10-22, "yes", DECISION_LOG "THE DIGITAL
 * TICKET ZIP IS FREE"; his rule, verbatim: *"the goal of the free is to keep
 * everything minimum ready but no personalization."*). It was Event Hub Pro
 * from 2026-09-29 (*"can we also create a zip file to download all? (PRO
 * feature)"*); handing out tickets is readiness, so the route asks NO Pro
 * question. What stays personal is the LOOK: the cards are drawn from
 * `loadPassCardKit` → `loadPrintSet`, whose one door (`printLookForEvent`)
 * draws a free event PLAIN WHITE and a Pro event in its Hub look (#6744).
 *
 * 🔒 TWO GATES, BOTH HERE ON THE SERVER — a hidden button is never the lock:
 *   1. signed in, and a HOST of this event (`getHostUserId`: an accepted
 *      moderator who is not a view-only helper, or the legacy couple row);
 *   2. only guests who HAVE a card (`eligiblePassCardGuests` → the pure
 *      `passCardEligibility`): accepted, not "can't come", named — pending
 *      requests, declines and TBA seats are not in it.
 *
 * Each file is the SAME render and the SAME name as a guest's own save
 * (`renderPassCardFor`, `passCardFileNameFor`) — two guests with one name get
 * `-2`, never an overwrite.
 *
 * ⚡ STREAMED, the shipped way (`app/papic/me/[token]/download/route.ts`):
 * archiver in `store` mode (PNGs are already compressed), the zip leaves as it
 * is built, cards drawn a few at a time and appended in order.
 * 🚫 NEVER A SILENTLY SHORT ZIP. Past `PASS_CARD_ZIP_MAX` the route refuses up
 * front, in words. A card that cannot be drawn (after one retry) DESTROYS the
 * stream — the download fails loudly rather than ending as a zip that looks
 * whole and is missing a guest.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Cards drawn at once — bounded so 300 guests neither time out nor exhaust memory. */
const PARALLEL = 4;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get('event');
  if (!eventId || !UUID.test(eventId)) return new NextResponse('Which event?', { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(`Sign in to download your ${PASS_CARD_WORDS.plural}.`, { status: 401 });
  if (!(await getHostUserId(eventId))) {
    return new NextResponse('Only the hosts of this event can download its passes.', { status: 403 });
  }

  const admin = createAdminClient();
  const { guests, measured } = await eligiblePassCardGuests(admin, eventId);
  if (!measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
  if (guests.length === 0) {
    return new NextResponse(`No guest has a ${PASS_CARD_WORDS.noun} yet — a ${PASS_CARD_WORDS.noun} appears once a guest is on your list and coming.`, { status: 409 });
  }
  if (guests.length > PASS_CARD_ZIP_MAX) {
    return new NextResponse(
      `That is ${formatCount(guests.length)} passes — more than one download can carry (${formatCount(PASS_CARD_ZIP_MAX)}). Download them from each guest's card, or ask us to raise the limit.`,
      { status: 413 },
    );
  }

  const kit = await loadPassCardKit(admin, eventId);
  if (!kit?.set.event.slug) return new NextResponse('Event not found.', { status: 404 });
  // The couple's own look, unless this download asked for another.
  const design = passCardDesignFor(kit, url.searchParams.get('design'));
  const names = uniqueFileNames(guests.map((g) => passCardFileNameFor(kit, g)));

  const archive = archiver('zip', { store: true });
  archive.on('error', () => archive.abort());

  void (async () => {
    try {
      for (let i = 0; i < guests.length; i += PARALLEL) {
        const batch = guests.slice(i, i + PARALLEL);
        const pngs = await Promise.all(
          batch.map((g) => renderPassCardFor(kit, g, design).catch(() => renderPassCardFor(kit, g, design))),
        );
        pngs.forEach((png, j) => archive.append(Buffer.from(png), { name: names[i + j]! }));
      }
      await archive.finalize();
    } catch (err) {
      logQueryError('pass-card.zip', err, { event_id: eventId }, 'graceful_degrade');
      archive.destroy(err instanceof Error ? err : new Error('pass card failed'));
    }
  })();

  const body = Readable.toWeb(archive) as unknown as ReadableStream;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${passCardsZipFileName(kit.set.event.display_name, kit.set.event.event_date)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
