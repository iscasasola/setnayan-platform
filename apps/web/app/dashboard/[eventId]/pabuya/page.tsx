import { Gift } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchEgiftMethods, isPabuyaPublicRouteEnabled } from '@/lib/egift';
import { PabuyaManager } from './_components/pabuya-manager';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';
import { PabuyaMessageEditor } from './_components/pabuya-message-editor';

export const metadata = { title: 'Pabuya · E-Gifts' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/pabuya — the couple manages their own e-gift ("digital
 * money dance") destinations.
 *
 * The couple connects THEIR OWN GCash / Maya / bank / PayPal handles + QR
 * images; guests scan/send DIRECTLY to those accounts. Setnayan only hosts the
 * display — it never holds or touches the money (the trust note makes this
 * explicit on both this surface and the public guest page).
 *
 * Access is already gated to couples / accepted moderators by the event layout
 * (dashboard/[eventId]/layout.tsx → notFound for anyone else); every write here
 * is additionally RLS-scoped (event_egift_methods_host_all).
 */
export default async function PabuyaDashboardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  // Event chrome (name + publish state). The layout already resolved the
  // membership gate; this read is RLS-safe for the couple.
  const { data: eventRow, error: eventRowError } = await supabase
    .from('events')
    .select('display_name, slug, landing_page_visibility, pabuya_message')
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventRowError) {
    logQueryError(
      'PabuyaPage.event',
      eventRowError,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  const event = (eventRow ?? null) as {
    display_name: string | null;
    slug: string | null;
    landing_page_visibility: string | null;
    pabuya_message: string | null;
  } | null;

  /**
   * Did we actually READ the event, or are we about to render around a hole?
   *
   * ── WHY THIS BOOLEAN EXISTS (2026-09-16) ──────────────────────────────────
   * This read is `graceful_degrade`, so a refusal leaves `event` null and the
   * page renders anyway — and the manager then did
   * `const isPrivate = (visibility ?? 'private') === 'private'`, turning "I
   * could not read this" into the sentence "Your event page is private —
   * launch it to make this live for guests." Measured against production on
   * 2026-09-16: the owner's own event is `public`, and it was being told the
   * opposite.
   *
   * 🔑 FAIL-CLOSED IS RIGHT FOR A GATE AND WRONG FOR A SENTENCE. The same
   * `?? 'private'` literal appears on the public guest pages, where defaulting
   * to private on a failed read HIDES the page and is correct. Here the value
   * does not gate anything — it only tells the couple what their setting is,
   * and a guess presented as a reading is a false statement. Three of the four
   * sites in the tree are safe for exactly this reason (two are gates; the
   * website editor redirects before it can render). This one was neither.
   *
   * ⚠ NOT `!!eventRowError` ALONE. A refusal and a zero-row answer both leave
   * us with nothing to say; the layout already proved the event exists, so
   * either way the honest report is "not read", not "private".
   */
  const eventWasRead = event !== null;

  // The couple's full set (enabled + hidden). Each row carries a resolved
  // presigned QR URL for the preview + the edit thumbnail.
  const methods = await fetchEgiftMethods(supabase, eventId);

  // Seed <FileUpload> thumbnails for existing QR images: r2Ref → display URL.
  const qrDisplayUrls: Record<string, string> = {};
  for (const m of methods) {
    if (m.qr_r2_key && m.qrDisplayUrl) qrDisplayUrls[m.qr_r2_key] = m.qrDisplayUrl;
  }

  // The event's own words, so the LIVE PREVIEW below reads byte-identically to
  // what a guest gets on the public gift page. Parity is the preview's whole job.
  const words = await eventWordsForEvent(eventId);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageMasthead title="The digital money dance" />

      {/* The couple's own sentence, above their payment details — owner
          2026-09-15. Mounted ABOVE the manager because that is where it sits
          on the public page; a preview that reorders the page is not one. */}
      <PabuyaMessageEditor eventId={eventId} initialMessage={event?.pabuya_message ?? null} />

      <PabuyaManager
        eventId={eventId}
        coupleName={event?.display_name ?? null}
        organizerPossessive={words.theOrganizerPossessive}
        theOrganizer={words.theOrganizer}
        slug={event?.slug ?? null}
        visibility={event?.landing_page_visibility ?? null}
        eventWasRead={eventWasRead}
        publicRouteEnabled={isPabuyaPublicRouteEnabled()}
        initialMethods={methods.map((m) => ({
          egift_method_id: m.egift_method_id,
          method_kind: m.method_kind,
          label: m.label,
          account_name: m.account_name,
          handle: m.handle,
          qr_r2_key: m.qr_r2_key,
          note: m.note,
          is_enabled: m.is_enabled,
          qrDisplayUrl: m.qrDisplayUrl,
        }))}
        qrDisplayUrls={qrDisplayUrls}
      />
    </div>
  );
}
