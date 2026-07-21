import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Camera, Printer, CheckCircle2 } from 'lucide-react';
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
  PANOOD_FREE_CAMERA_COUNT,
} from '@/lib/panood-camera-seats';
import { CopyLink } from '../_components/copy-link';
import { ReissueCameraButton } from './reissue-button';

export const metadata = { title: 'Camera operators · Setnayan' };
export const dynamic = 'force-dynamic';

// Live Studio — CAMERA OPERATORS.
//
// The surface that makes the free rig-verification tier actually reachable. Until this page
// existed, `panoodCameraClaimUrl()` had ZERO production callers: cameras could be provisioned but
// there was no way to hand one to a person, so "connect everything and test it first" was
// impossible at any price.
//
// One row per camera seat. Unclaimed seats show a copyable link + a QR the operator scans on
// their phone; claimed seats show who holds it and a reissue control that recycles the seat.
//
// SERVER COMPONENT ON PURPOSE: `claim_qr_token` is a per-camera seat-hijack credential and must
// never cross a 'use client' boundary or land in an RSC payload. Only the fully-built claim URL
// and a rendered QR string cross over — the token itself stays here.

type Props = { params: Promise<{ eventId: string }> };

export default async function PanoodCamerasPage({ params }: Props) {
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

  // Same authorization boundary as the control room — operators are handed links from here, so
  // this page is exactly as sensitive as the console.
  const isMember = await requirePanoodControlRoomMember(eventId, user.id);
  if (!isMember) redirect(`/dashboard/${eventId}`);

  const tier = await resolvePanoodTier(supabase, eventId);
  const cap = panoodCameraCapForTier(tier);

  // Provision before reading, so a first visit on the free tier shows seats immediately rather
  // than an empty page that self-heals on reload. Idempotent top-up; never destructive.
  const admin = createAdminClient();
  await provisionPanoodCamerasAdmin(admin, eventId, cap).catch(() => 0);
  const cameras = await fetchPanoodCameras(admin, eventId).catch(() => []);

  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const appUrl = `${proto}://${host}`;

  const rows = await Promise.all(
    cameras.map(async (c) => {
      const claimed = Boolean(c.claimer_user_id) && !c.revoked_at;
      const claimUrl = panoodCameraClaimUrl(appUrl, c.claim_qr_token);
      return {
        id: c.id,
        index: c.camera_index,
        label: c.label?.trim() || `Camera ${c.camera_index}`,
        claimed,
        claimUrl,
        // Only render a QR for a seat someone can still take. A claimed seat's QR is a live
        // credential with no reason to be on screen.
        qrSvg: claimed ? null : await renderUrlQrSvg(claimUrl, 128),
      };
    }),
  );

  const claimedCount = rows.filter((r) => r.claimed).length;

  return (
    <section className="space-y-6 pb-12">
      <Link
        href={`/dashboard/${eventId}/studio/panood/broadcast`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to the control room
      </Link>

      <header className="sn-reveal space-y-2">
        <p className="sn-eye">Live Studio</p>
        <h1 className="sn-h1 flex items-center gap-3">
          <Camera aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Camera operators
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          Send one link per camera to whoever is holding that phone. They open it, tap once, and
          their camera appears in your control room — no app to install, no account to make.
          {tier === 'free' && (
            <>
              {' '}
              You have <strong>{PANOOD_FREE_CAMERA_COUNT} cameras free</strong> to test with. Every
              feed carries the Setnayan mark until you unlock Live Studio.
            </>
          )}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink/55">
          {claimedCount} of {rows.length} connected
        </p>
        <Link
          href={`/dashboard/${eventId}/studio/panood/cameras/print`}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <Printer aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Print the QR sheet
        </Link>
      </div>

      {/* Displays — deliberately an HONEST note, not a fake door. Live Studio venue screens are
          NOT wired: `provisionPanoodScreensAdmin` has no callers, so no screen is ever created,
          and `panoodScreenPairUrl` builds `/wall?code=…` while the route is `/wall/[eventId]`
          (a 404) AND that route gates on the LIVE_WALL SKU — a different product. Showing a
          pairing UI here would be a door onto nothing. */}
      <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4">
        <h2 className="text-sm font-semibold">Venue displays</h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink/60">
          Routing a feed to a screen at the venue isn’t connected yet — the control room can
          choose what each screen shows, but there’s no way to pair a screen to it. For now, put a
          laptop on the screen and use the OBS program window from the control room.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="sn-tile p-6 text-sm text-ink/65">
          No camera seats yet. Open the control room once and they’ll be created for you.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="sn-tile space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{r.label}</h2>
                {r.claimed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-success-700">
                    <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                    Connected
                  </span>
                ) : (
                  <span className="rounded-full bg-ink/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/55">
                    Open
                  </span>
                )}
              </div>

              {r.claimed ? (
                <>
                  <p className="text-xs leading-relaxed text-ink/60">
                    Someone has this camera and it’s bound to their phone. Reissuing mints a new
                    link and disconnects them — the old link stops working immediately.
                  </p>
                  <ReissueCameraButton eventId={eventId} cameraId={r.id} label={r.label} />
                </>
              ) : (
                <>
                  <div
                    aria-hidden
                    className="mx-auto w-32 [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: r.qrSvg ?? '' }}
                  />
                  <CopyLink
                    label="Camera link"
                    url={r.claimUrl}
                    hint="Send this to the person holding this camera."
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
