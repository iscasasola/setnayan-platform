import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, guestDisplayName, ROLE_LABELS } from '@/lib/guests';
import { renderInvitationQrSvg } from '@/lib/qr';

export const metadata = { title: 'Print sheet' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export default async function PrintSheetPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, event_date, slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const slug = event.slug ?? eventId;
  const guests = await fetchGuestsByEvent(supabase, eventId);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const qrCards = await Promise.all(
    guests.map(async (g) => ({
      guest: g,
      svg: await renderInvitationQrSvg({ appUrl, slug, qrToken: g.qr_token }),
    })),
  );

  return (
    <html lang="en">
      <head>
        <style>{PRINT_STYLES}</style>
      </head>
      <body className="print-body">
        <div className="screen-only print-toolbar">
          <p>
            <strong>Print sheet — A4.</strong> Press <code>⌘P</code> (Mac) or{' '}
            <code>Ctrl+P</code> (Windows) to print. Set scale to 100% and margins to
            None for best results.
          </p>
        </div>

        <main className="sheet">
          {qrCards.map(({ guest, svg }) => (
            <article key={guest.guest_id} className="card">
              <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="card-meta">
                <p className="name">{guestDisplayName(guest)}</p>
                <p className="role">{ROLE_LABELS[guest.role]}</p>
                <p className="footer">{event.display_name}</p>
              </div>
            </article>
          ))}
        </main>
      </body>
    </html>
  );
}

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }
  html, body { background: #ffffff; color: #1A1A1A; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  body.print-body { padding: 0; margin: 0; }
  .screen-only { padding: 16px; background: #FAF7F2; border-bottom: 1px solid #1A1A1A20; font-size: 13px; }
  @media print {
    .screen-only { display: none !important; }
    body { padding: 0; margin: 0; }
  }
  .sheet {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6mm;
    padding: 6mm;
    max-width: 210mm;
    margin: 0 auto;
  }
  .card {
    border: 1px dashed #1A1A1A40;
    border-radius: 4mm;
    padding: 4mm;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .card .qr { display: inline-block; width: 38mm; height: 38mm; }
  .card .qr svg { width: 100% !important; height: 100% !important; }
  .card .card-meta { margin-top: 2mm; }
  .card .name { font-size: 11pt; font-weight: 600; margin: 0; }
  .card .role { font-size: 8pt; color: #1A1A1A80; margin: 1mm 0 0 0; }
  .card .footer { font-size: 7pt; color: #1A1A1A60; margin: 2mm 0 0 0; font-family: ui-monospace, SF Mono, monospace; letter-spacing: 0.05em; text-transform: uppercase; }
`;
