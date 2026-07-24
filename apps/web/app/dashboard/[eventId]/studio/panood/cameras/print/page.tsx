import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderUrlQrSvg } from '@/lib/qr';
import { requirePanoodControlRoomMember } from '@/lib/panood-control-room-access';
import {
  fetchPanoodCameras,
  panoodCameraClaimUrl,
  panoodCameraCapForTier,
  provisionPanoodCamerasAdmin,
  resolvePanoodTier,
} from '@/lib/panood-camera-seats';

// Live Studio · printable camera-operator QR pack.
//
// The couple/control-room opens this to print (or save-as-PDF) one scannable
// card per camera seat — parity with the Papic photo-crew print pack
// (studio/papic/crew/print). Fulfils the "Print the QR sheet" button on the
// cameras page, which previously pointed at a route that was never built (404).
//
// Only UNCLAIMED cameras are printed: a claimed camera's `claim_qr_token` is a
// live seat-hijack credential, so the cameras page hides its QR on screen and we
// keep it off the print sheet for the same reason — you hand a card to the
// person who is ABOUT to hold that camera. Same authorization boundary as the
// cameras page (control-room member); the token never crosses to the client —
// only the built claim URL + rendered QR do.

export const metadata = { title: 'Print camera-operator QR cards' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

export default async function PanoodCamerasPrintPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // Same authorization boundary as the cameras page (control-room member).
  const isMember = await requirePanoodControlRoomMember(eventId, user.id);
  if (!isMember) redirect(`/dashboard/${eventId}`);

  // Provision before reading so a first visit shows the seats immediately (idempotent top-up).
  const admin = createAdminClient();
  const tier = await resolvePanoodTier(supabase, eventId);
  const cap = panoodCameraCapForTier(tier);
  await provisionPanoodCamerasAdmin(admin, eventId, cap).catch(() => 0);
  const cameras = await fetchPanoodCameras(admin, eventId).catch(() => []);

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const appUrl = `${proto}://${host}`;

  // Unclaimed seats only — a claimed camera's QR is a live credential (see header).
  const openCameras = cameras.filter((c) => !(Boolean(c.claimer_user_id) && !c.revoked_at));

  const cards = await Promise.all(
    openCameras.map(async (c) => {
      const claimUrl = panoodCameraClaimUrl(appUrl, c.claim_qr_token);
      return {
        id: c.id,
        label: c.label?.trim() || `Camera ${c.camera_index}`,
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
          (Windows) to print or save as PDF. Hand each card to a camera operator — they scan it to
          connect their phone to your control room.
        </p>
      </div>

      {cards.length === 0 ? (
        <main className="screen-only" style={{ padding: 24 }}>
          <p className="text-sm text-ink/70">
            Every camera is already connected — nothing to print. Reissue a camera on the cameras
            page if you need a fresh link to hand out.
          </p>
        </main>
      ) : (
        <main className="print-sheet">
          {cards.map((c) => (
            <article key={c.id} className="print-card">
              <p className="print-eyebrow">Live Studio · camera</p>
              <div className="print-qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <p className="print-name">{c.label}</p>
              <p className="print-role">
                Scan to connect this camera to {eventName}&rsquo;s live broadcast — no app, no
                account.
              </p>
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
