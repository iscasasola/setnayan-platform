import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, guestDisplayName, ROLE_LABELS } from '@/lib/guests';
import { renderBrandedInvitationQrSvg, resolveBrandedQrColors } from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { getPrimaryColor, sanitizeRolePalette } from '@/lib/mood-board';

export const metadata = { title: 'Branded QR print sheet · Setnayan' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/add-ons/custom-qr-guest/print — A4 print sheet of the
 * BRANDED per-guest QR cards (palette-tinted modules + monogram center).
 *
 * Mirrors the default invitation/print sheet but is GATED on the event owning
 * a paid CUSTOM_QR_GUEST order (not cancelled/refunded/lapsed) — a couple who
 * hasn't bought the upgrade is redirected back to the add-on detail page where
 * the buy CTA lives. The default (un-branded) print sheet stays available on
 * the Invitation tab regardless.
 */
export default async function BrandedQrPrintSheet({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, event_date, slug, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, role_palette',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // Ownership gate — same query shape as the detail page. Graceful-degrade on
  // a missing orders table by treating it as not-owned (→ redirect to buy).
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', eventId)
    .eq('service_key', 'CUSTOM_QR_GUEST')
    .not('status', 'in', '("cancelled","refunded","lapsed")');
  if (ordersError && ordersError.code !== '42P01' && ordersError.code !== '42703') {
    throw new Error(`Failed to load Custom QR order state: ${ordersError.message}`);
  }
  const owns = (orders ?? []).length > 0;
  if (!owns) {
    redirect(`/dashboard/${eventId}/add-ons/custom-qr-guest`);
  }

  const slug = event.slug ?? eventId;
  const guests = await fetchGuestsByEvent(supabase, eventId);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const monogram = resolveMonogram(event);
  const palette = sanitizeRolePalette(event.role_palette ?? {});
  const brandColor =
    getPrimaryColor(palette, 'reception') ??
    getPrimaryColor(palette, 'bride') ??
    getPrimaryColor(palette, 'ceremony') ??
    event.monogram_color ??
    null;
  const qrColors = resolveBrandedQrColors(brandColor);

  const qrCards = await Promise.all(
    guests.map(async (g) => ({
      guest: g,
      svg: await renderBrandedInvitationQrSvg({
        appUrl,
        slug,
        qrToken: g.qr_token,
        monogram,
        colors: qrColors,
      }),
    })),
  );

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <div className="print-toolbar screen-only">
        <p className="text-sm text-ink/70">
          Press{' '}
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">⌘P</kbd>{' '}
          (Mac) or{' '}
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">Ctrl+P</kbd>{' '}
          (Windows) to print. Set scale to 100% and margins to None for best results.
        </p>
        <Link
          href={`/dashboard/${eventId}/add-ons/custom-qr-guest`}
          className="text-sm font-medium text-terracotta underline-offset-4 hover:underline"
        >
          Back to Custom QR
        </Link>
      </div>

      {qrCards.length === 0 ? (
        <p className="screen-only" style={{ padding: '24px', color: 'rgba(26,26,26,0.6)' }}>
          Add guests to your event and their branded QR cards appear here.
        </p>
      ) : (
        <main className="print-sheet">
          {qrCards.map(({ guest, svg }) => (
            <article key={guest.guest_id} className="print-card">
              <div className="print-qr" dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="print-meta">
                <p className="print-name">{guestDisplayName(guest)}</p>
                <p className="print-role">{ROLE_LABELS[guest.role]}</p>
                <p className="print-footer">{event.display_name}</p>
              </div>
            </article>
          ))}
        </main>
      )}
    </>
  );
}

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }

  .print-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; background: #FAF7F2; border: 1px solid rgba(26, 26, 26, 0.12); border-radius: 8px; margin-bottom: 16px; }

  .print-sheet {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6mm;
    padding: 6mm;
    max-width: 210mm;
    margin: 0 auto;
    background: #ffffff;
    border: 1px dashed rgba(26, 26, 26, 0.15);
  }
  .print-card {
    border: 1px solid rgba(26, 26, 26, 0.18);
    border-radius: 4mm;
    padding: 4mm;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
    color: #1A1A1A;
    background: #FAF7F2;
  }
  .print-qr { display: inline-block; width: 38mm; height: 38mm; }
  .print-qr svg { width: 100% !important; height: 100% !important; }
  .print-meta { margin-top: 2mm; }
  .print-name { font-size: 12pt; font-style: italic; font-family: ui-serif, Georgia, serif; font-weight: 600; margin: 0; }
  .print-role { font-size: 8pt; color: rgba(26, 26, 26, 0.6); margin: 1mm 0 0 0; text-transform: uppercase; letter-spacing: 0.12em; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .print-footer {
    font-size: 7pt; color: rgba(26, 26, 26, 0.4); margin: 2mm 0 0 0;
  }

  @media print {
    body { background: #ffffff !important; }
    .screen-only { display: none !important; }
    .print-sheet { padding: 0; border: none; max-width: none; }
    header, nav { display: none !important; }
    main { padding: 0 !important; }
  }
`;
