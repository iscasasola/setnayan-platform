import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchPapicSeats, papicSeatJoinUrl } from '@/lib/papic-seats';
import { renderUrlQrSvg } from '@/lib/qr';

// Papic · printable photo-crew QR pack.
//
// The couple opens this to print (or save-as-PDF) one scannable card per crew
// seat — parity with the guest place-card / table-sign packs. A friend scans the
// card → /papic/claim/[token] → /papic/seat/[token] capture. Fulfils the studio
// page's "printable QR codes per seat" promise (previously the crew QR was
// on-screen only). Gated to the couple; force-dynamic for live seat state.

export const metadata = { title: 'Print photo-crew QR cards' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

function seatLabel(seatIndex: number): string {
  if (seatIndex >= 200) return `Camera ${seatIndex - 199}`; // per-camera (base 200)
  return `Seat ${seatIndex}`;
}

export default async function PapicCrewPrintPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Couple-only (the crew page enforces the same).
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}`);
  }

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const seats = await fetchPapicSeats(supabase, eventId);

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const appUrl = `${proto}://${host}`;

  const cards = await Promise.all(
    seats.map(async (s) => {
      // Hybrid join link (native app opens directly when installed, otherwise
      // forwards to the existing /papic/claim flow). Legacy /papic/claim links
      // still work, so any card printed before this stays valid.
      const claimUrl = papicSeatJoinUrl(appUrl, s.claim_qr_token);
      return {
        seatId: s.seat_id,
        label: seatLabel(s.seat_index as number),
        claimUrl,
        svg: await renderUrlQrSvg(claimUrl, 200),
      };
    }),
  );

  const eventName = (event.display_name as string | null) ?? 'the wedding';

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <div className="print-toolbar screen-only">
        <p className="text-sm text-ink/70">
          Press <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">⌘P</kbd>{' '}
          (Mac) or{' '}
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">Ctrl+P</kbd>{' '}
          (Windows) to print or save as PDF. Hand each card to a friend — they scan
          it to turn their phone into a candid camera.
        </p>
      </div>

      {cards.length === 0 ? (
        <main className="screen-only" style={{ padding: 24 }}>
          <p className="text-sm text-ink/70">
            No photo-crew seats yet. Set them up on the crew page first, then come
            back to print.
          </p>
        </main>
      ) : (
        <main className="print-sheet">
          {cards.map((c) => (
            <article key={c.seatId} className="print-card">
              <p className="print-eyebrow">Papic · photo crew</p>
              <div className="print-qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <p className="print-name">{c.label}</p>
              <p className="print-role">Scan to start shooting — every photo lands in {eventName}&rsquo;s gallery.</p>
              <p className="print-footer">{c.claimUrl}</p>
            </article>
          ))}
        </main>
      )}
    </>
  );
}

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }

  .print-toolbar { padding: 12px 16px; background: #FAF7F2; border: 1px solid rgba(26, 26, 26, 0.12); border-radius: 8px; margin: 16px; }

  .print-sheet {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8mm;
    padding: 6mm;
    max-width: 210mm;
    margin: 0 auto;
    background: #ffffff;
    border: 1px dashed rgba(26, 26, 26, 0.15);
  }
  .print-card {
    border: 1px dashed rgba(26, 26, 26, 0.25);
    border-radius: 4mm;
    padding: 6mm;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
    color: #1A1A1A;
    background: #ffffff;
  }
  .print-eyebrow {
    font-size: 7pt; color: #C4674F; margin: 0 0 3mm 0;
    font-family: ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.2em; text-transform: uppercase;
  }
  .print-qr { display: inline-block; width: 48mm; height: 48mm; }
  .print-qr svg { width: 100% !important; height: 100% !important; }
  .print-name { font-size: 13pt; font-weight: 600; margin: 3mm 0 0 0; }
  .print-role { font-size: 9pt; color: rgba(26, 26, 26, 0.65); margin: 1.5mm auto 0; max-width: 72mm; }
  .print-footer {
    font-size: 6.5pt; color: rgba(26, 26, 26, 0.4); margin: 2.5mm 0 0 0; word-break: break-all;
    font-family: ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.02em;
  }

  @media print {
    body { background: #ffffff !important; }
    .screen-only { display: none !important; }
    .print-sheet { padding: 0; border: none; max-width: none; }
    header, nav { display: none !important; }
    main { padding: 0 !important; }
  }
`;
