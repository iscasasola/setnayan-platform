import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderUrlQrSvg } from '@/lib/qr';
import { isLiveStudioSetupHost } from '@/lib/panood-control-room-access';
import { liveStudioControlPath } from '@/lib/live-studio-control';
import { buildCameraCards } from '@/lib/live-studio-camera-cards';
import {
  fetchChannelCameras,
  type ChannelCameraView,
} from '@/lib/live-studio-channel-cameras';

// Live Studio · printable camera-operator join cards.
//
// ── WHAT WAS WRONG WITH THIS SHEET ──────────────────────────────────────────
// It printed one card per camera SEAT, titled `Camera 3` from the seat's own
// index, under the retired per-seat model. The controller that a host actually
// operates mints one join code **per CHANNEL** and names it the way the host named
// it — `CH 3 · Main stage`. So the cards and the screen described the same QR in
// two different vocabularies, and the operator holding "Camera 3" had nothing on
// the control room to match it to.
//
// Worse, it printed seats that are bound to NO channel at all. Those QRs work —
// a phone claims the seat — and then the camera appears on no channel and can
// never go on air. A card that leads nowhere, handed out at a venue, on a day that
// cannot be re-run.
//
// This now reads through `fetchChannelCameras`, the SAME reader the controller
// uses, so a card can only exist for a channel the controller would also show a QR
// for. The two surfaces cannot drift into disagreeing about what is joinable,
// because there is one reader and one caption composer (`formatChannel`) behind
// both.
//
// ── WHAT IS DELIBERATELY NOT PRINTED ────────────────────────────────────────
// `fetchChannelCameras` returns `claimUrl: null` for a seat that is CLAIMED (the
// link is a live credential that would let a second phone take the camera) or
// REVOKED (the token is already dead — a QR that silently cannot work). Both
// decisions are made in that one place, and this sheet does not re-derive them;
// it prints exactly the channels that have a usable link.
//
// Channels with no join code yet are NOT silently dropped — they are listed on
// screen, above the sheet, because an absence a host cannot see is how you arrive
// at a venue one camera short.

export const metadata = { title: 'Print camera join cards' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

type ZoneRow = {
  id: number;
  zone_index: number;
  label: string;
  venue_label: string | null;
  camera_operator_id: number | null;
};

export default async function PanoodCamerasPrintPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('event_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the event record. Degrades rather than claiming.
  if (eventError) {
    logQueryError('PanoodPrintPage.event', eventError, { eventId }, 'graceful_degrade');
  }
  if (!event) notFound();

  // ⚠ THE SAME GATE AS THE CONTROLLER, and this is a deliberate change from the
  // narrower requirePanoodControlRoomMember this page used to call.
  //
  // The controller admits a COORDINATOR (isLiveStudioSetupHost) and already shows
  // them every one of these join QRs on screen, one `<details>` per channel. A
  // coordinator who can read every code in the control room but is redirected away
  // from printing those same codes is an inconsistency, not a protection — and now
  // that the controller links here, it would be a doorway that bounces the very
  // person sent through it. This grants no data the same person cannot already see.
  if (!(await isLiveStudioSetupHost(eventId, user.id))) redirect(`/dashboard/${eventId}`);

  // Channels, in the host's own order — the same read the controller does, under
  // the host's own RLS.
  const { data: zoneRows, error: zoneRowsError } = await supabase
    .from('live_studio_roam_zones')
    .select('id, zone_index, label, venue_label, camera_operator_id')
    .eq('event_id', eventId)
    .order('zone_index', { ascending: true });
  // ⚠ the roam zones the couple defined. Refused, the printout comes out with none —
  // ⚠ and this page exists to be PRINTED and carried to a venue.
  if (zoneRowsError) {
    logQueryError('PanoodPrintPage.zoneRows', zoneRowsError, { eventId }, 'graceful_degrade');
  }
  const zones = (zoneRows ?? []) as ZoneRow[];

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const appUrl = `${proto}://${host}`;

  // Service-role, because the seat rows carry claim tokens and their RLS is
  // control-room-only — the host check above is the authorization boundary, the
  // same posture the controller documents for this identical read. Fail-soft: an
  // un-bootstrapped database yields an empty map and the honest "nothing to print
  // yet" note below, rather than a crash.
  const admin = createAdminClient();
  const cameras = await fetchChannelCameras(admin, eventId, zones, appUrl).catch(
    () => new Map<number, ChannelCameraView>(),
  );

  // ONE function decides what is printable and what is merely waiting — the same
  // one the controller calls to size its "Print" doorway, so the door can never
  // promise cards this page would not produce.
  const sheet = buildCameraCards(
    zones.map((z) => {
      const cam = cameras.get(z.id) ?? null;
      return {
        zoneId: z.id,
        zoneIndex: z.zone_index,
        label: z.label,
        venueLabel: z.venue_label,
        claimUrl: cam?.claimUrl ?? null,
        hasSeat: Boolean(cam),
        claimed: cam?.claimed ?? false,
        revoked: cam?.revoked ?? false,
      };
    }),
  );

  const cards = await Promise.all(
    sheet.cards.map(async (c) => ({ ...c, svg: await renderUrlQrSvg(c.claimUrl, 200) })),
  );
  const waiting = sheet.waiting;

  const eventName = (event.display_name as string | null) ?? 'the celebration';

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <div className="print-toolbar screen-only">
        <p className="text-sm text-ink/70">
          Press <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">⌘P</kbd>{' '}
          (Mac) or{' '}
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">Ctrl+P</kbd>{' '}
          (Windows) to print or save as PDF. Hand each card to the person shooting that
          channel — they scan it, tap once, and their phone becomes that channel in your
          control room.
        </p>
        <Link
          href={liveStudioControlPath(eventId)}
          className="mt-2 inline-block text-xs font-medium text-terracotta underline underline-offset-2"
        >
          Back to the control room
        </Link>
      </div>

      {waiting.length > 0 ? (
        <div className="print-note screen-only">
          <p className="text-sm font-semibold text-ink/80">
            {waiting.length === 1 ? 'One channel has' : `${waiting.length} channels have`} no card
            to print:
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-ink/65">
            {waiting.map((w) => (
              <li key={w.zoneId}>
                <strong>{w.title}</strong> — {w.why}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <main className="screen-only" style={{ padding: 24 }}>
          <p className="text-sm text-ink/70">
            There are no join cards to print yet. Open the control room and make a join QR for
            each channel you want someone to shoot.
          </p>
        </main>
      ) : (
        <main className="print-sheet">
          {cards.map((c) => (
            <article key={c.zoneId} className="print-card">
              <p className="print-eyebrow">Live Studio · CH {c.channel}</p>
              <div className="print-qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <p className="print-name">{c.title}</p>
              {c.venue ? <p className="print-venue">{c.venue}</p> : null}
              <p className="print-role">
                Scan to shoot this channel at {eventName} — no app, no account. Your phone
                becomes CH {c.channel} in the control room.
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
  .print-note { padding: 12px 16px; background: #FFF8F0; border: 1px solid rgba(196, 103, 79, 0.35); border-radius: 8px; margin: 0 16px 16px; }

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
  .print-venue { font-size: 9.5pt; color: rgba(26, 26, 26, 0.55); margin: 1mm 0 0 0; }
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
