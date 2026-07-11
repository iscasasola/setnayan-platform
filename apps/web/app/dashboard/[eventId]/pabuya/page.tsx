import { Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchEgiftMethods, isPabuyaPublicRouteEnabled } from '@/lib/egift';
import { PabuyaManager } from './_components/pabuya-manager';

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
  const { data: eventRow } = await supabase
    .from('events')
    .select('display_name, slug, landing_page_visibility')
    .eq('event_id', eventId)
    .maybeSingle();
  const event = (eventRow ?? null) as {
    display_name: string | null;
    slug: string | null;
    landing_page_visibility: string | null;
  } | null;

  // The couple's full set (enabled + hidden). Each row carries a resolved
  // presigned QR URL for the preview + the edit thumbnail.
  const methods = await fetchEgiftMethods(supabase, eventId);

  // Seed <FileUpload> thumbnails for existing QR images: r2Ref → display URL.
  const qrDisplayUrls: Record<string, string> = {};
  for (const m of methods) {
    if (m.qr_r2_key && m.qrDisplayUrl) qrDisplayUrls[m.qr_r2_key] = m.qrDisplayUrl;
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          <Gift aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Pabuya · E-Gifts
        </p>
        <h1 className="mt-1 font-display text-3xl italic text-ink/90 sm:text-4xl">
          The digital money dance
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
          Add the accounts guests can send a gift to — your own GCash, Maya,
          bank, or PayPal. On your event page, guests scan your QR or copy your
          handle and send straight to you.
        </p>
      </header>

      <PabuyaManager
        eventId={eventId}
        coupleName={event?.display_name ?? null}
        slug={event?.slug ?? null}
        visibility={event?.landing_page_visibility ?? null}
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
