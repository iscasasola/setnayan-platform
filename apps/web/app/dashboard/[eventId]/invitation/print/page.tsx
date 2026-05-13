import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, guestDisplayName, ROLE_LABELS } from '@/lib/guests';
import { renderInvitationQrSvg } from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';

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
    .select('event_id, display_name, event_date, slug, monogram_text, monogram_color')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const slug = event.slug ?? eventId;
  const guests = await fetchGuestsByEvent(supabase, eventId);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const monogram = resolveMonogram(event);

  const qrCards = await Promise.all(
    guests.map(async (g) => ({
      guest: g,
      svg: await renderInvitationQrSvg({ appUrl, slug, qrToken: g.qr_token, monogram }),
    })),
  );

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <div className="print-toolbar screen-only">
        <p className="text-sm text-ink/70">
          Press <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">⌘P</kbd>{' '}
          (Mac) or{' '}
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">Ctrl+P</kbd>{' '}
          (Windows) to print. Set scale to 100% and margins to None for best results.
        </p>
      </div>

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
    </>
  );
}

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }

  .print-toolbar { padding: 12px 16px; background: #FAF7F2; border: 1px solid rgba(26, 26, 26, 0.12); border-radius: 8px; margin-bottom: 16px; }

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
    border: 1px dashed rgba(26, 26, 26, 0.25);
    border-radius: 4mm;
    padding: 4mm;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
    color: #1A1A1A;
    background: #ffffff;
  }
  .print-qr { display: inline-block; width: 38mm; height: 38mm; }
  .print-qr svg { width: 100% !important; height: 100% !important; }
  .print-meta { margin-top: 2mm; }
  .print-name { font-size: 11pt; font-weight: 600; margin: 0; }
  .print-role { font-size: 8pt; color: rgba(26, 26, 26, 0.6); margin: 1mm 0 0 0; }
  .print-footer {
    font-size: 7pt; color: rgba(26, 26, 26, 0.4); margin: 2mm 0 0 0;
    font-family: ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.05em; text-transform: uppercase;
  }

  @media print {
    body { background: #ffffff !important; }
    .screen-only { display: none !important; }
    .print-sheet { padding: 0; border: none; max-width: none; }
    /* Hide dashboard chrome on print so the sheet is the only thing on the page. */
    header, nav { display: none !important; }
    main { padding: 0 !important; }
  }
`;
