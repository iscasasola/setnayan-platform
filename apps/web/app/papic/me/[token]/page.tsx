import Link from 'next/link';
import { ArrowRight, Camera, CircleAlert, Clock, Download, Images, Sparkles } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveGuestCamera } from '@/lib/papic-limited';
import { getGuestLiveGallery } from '@/lib/guest-live-gallery';
import { papicPoolGalleryEnabled } from '@/lib/papic-pool-flag';
import { GuestStoryMaker } from './_components/guest-story-maker';

// Papic · MY camera (guest personal-QR → Limited roll camera).
//
// Limited = the guest list (owner-locked 2026-06-26): every non-declined guest
// becomes a Limited camera whose credential is their EXISTING personal QR
// (guests.qr_token). This route is the bridge that turns that QR into a camera:
//   1. resolve the guest by qr_token (the capability — same as the ?invite= flow),
//   2. resolve THEIR active roll seat under the event's Limited snapshot,
//   3. if the snapshot is active (paid) → hand off to the existing capture
//      surface at /papic/seat/[claim_qr_token] (NO duplicated camera UI — the
//      seat's own claim token keys the same claim → capture pipeline a crew seat
//      uses); if it's still pending → "payment under review", no capture.
//
// We also surface the guest's personal gallery ("photos of you so far") right
// here so the one QR opens BOTH their camera and their photos, per the owner's
// intent. The gallery read is the same per-guest, clean-screened photo_tags
// pipeline the day-of landing page uses (lib/guest-live-gallery).
//
// Public, qr_token-gated; admin reads scoped by the resolved guest_id. Nothing
// here runs on an always-rendered page. force-dynamic — per-request resolution.

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ token: string }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 shadow-sm">
        {children}
      </div>
    </main>
  );
}

/** Doorway to the Shared Pool Gallery ("Everyone's photos") — renders ONLY
 *  when the env flag is on AND the couple opened the pool for this event
 *  (events.pool_gallery_open, DEFAULT FALSE). When either is off there is no
 *  door at all (owner rule: guests see NOTHING, no dead door). The link goes
 *  through the token→session bridge so the pool page is session-scoped and no
 *  guest token appears in the pool URL. */
async function PoolDoorway({ eventId, token }: { eventId: string; token: string }) {
  if (!papicPoolGalleryEnabled()) return null;
  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('events')
    .select('pool_gallery_open')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev?.pool_gallery_open) return null;
  return (
    <a
      href={`/papic/me/${encodeURIComponent(token)}/session?next=pool`}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/80 transition hover:bg-ink/10"
    >
      <Images aria-hidden className="h-4 w-4" strokeWidth={2} />
      Browse everyone&rsquo;s photos
    </a>
  );
}

/** "Photos of you so far" — the guest's tagged, clean-screened captures. Reuses
 *  the day-of landing gallery read so the QR opens camera + gallery together. */
async function GuestGallery({
  eventId,
  guestId,
  token,
}: {
  eventId: string;
  guestId: string;
  token: string;
}) {
  const gallery = await getGuestLiveGallery(eventId, guestId);
  if (!gallery || gallery.photos.length === 0) return null;
  return (
    <section aria-label="Photos of you" className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          <Images aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Photos of you
        </p>
        <p className="text-sm text-ink/60">{gallery.total.toLocaleString()}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {gallery.photos.map((p) => (
          <a
            key={p.id}
            // Thumbnail is the light derivative (`p.url`); the LINK opens the
            // FULL-RES original with EXIF/GPS stripped on the fly (owner 2026-07-16),
            // never the raw geo-bearing original (RA 10173).
            href={`/papic/me/${token}/photo?id=${encodeURIComponent(p.id)}&src=${
              p.sourceTable === 'papic_photos' ? 'seat' : 'guest'
            }`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open full size to save"
            className="block aspect-square overflow-hidden rounded-lg bg-ink/5"
          >
            {/* Presigned URL — raw <img> (the optimizer would cache the expiry). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
      {/* Download all — the full set of tagged captures as a ZIP (not just the
          preview grid above), streamed from the token-scoped download route. */}
      <a
        href={`/papic/me/${token}/download`}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/80 transition hover:bg-ink/10"
      >
        <Download aria-hidden className="h-4 w-4" strokeWidth={2} />
        Download my photos
      </a>
      {/* Kwento Decorator — go through the token→session bridge (route handler)
          so a guest who only has the raw token link still gets a session before
          the session-scoped /papic/decorate. Plain <a> = full nav that sets the
          cookie; it's a route handler (not a page), so no-html-link-for-pages
          doesn't apply. */}
      <a
        href={`/papic/me/${token}/session`}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/80 transition hover:bg-ink/10"
      >
        <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2} />
        Decorate a photo
      </a>
      {/* FREE Guest Stories — one-tap 30s reel from these tagged photos. */}
      <GuestStoryMaker token={token} />
    </section>
  );
}

export default async function PapicMyCameraPage({ params }: Props) {
  const { token } = await params;
  const cleanToken = token?.trim();

  const admin = createAdminClient();

  // Resolve the guest by their personal QR token (the capability — mirrors the
  // /[slug]?invite= redeem read). Deleted guests don't resolve. The event slug
  // (for the "back to your invitation" link) is a second cheap read so we avoid
  // a PostgREST embed (keeps this off the typed-relationship path).
  let guest:
    | { guest_id: string; event_id: string; first_name: string | null; slug: string | null }
    | null = null;
  if (cleanToken) {
    const { data } = await admin
      .from('guests')
      .select('guest_id, event_id, first_name')
      .eq('qr_token', cleanToken)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) {
      const { data: ev } = await admin
        .from('events')
        .select('slug')
        .eq('event_id', data.event_id as string)
        .maybeSingle();
      guest = {
        guest_id: data.guest_id as string,
        event_id: data.event_id as string,
        first_name: (data.first_name as string | null) ?? null,
        slug: (ev?.slug as string | null) ?? null,
      };
    }
  }

  // Bad / reissued / deleted token → friendly dead-end (never leak why).
  if (!guest) {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CircleAlert aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          This link isn&rsquo;t active
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          This personal QR doesn&rsquo;t open a camera right now — it may have been
          replaced with a new one. Ask your host for your current QR or link and
          try again.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/10"
        >
          Back to Setnayan
        </Link>
      </Shell>
    );
  }

  const backToInvite = guest.slug
    ? `/${guest.slug}?invite=${encodeURIComponent(cleanToken!)}`
    : null;
  const backLink = backToInvite ? (
    <Link
      href={backToInvite}
      className="mt-5 inline-flex items-center justify-center rounded-md bg-ink/5 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/10"
    >
      Back to your invitation
    </Link>
  ) : null;

  // Resolve THIS guest's Limited roll camera. sync:true self-heals a late "yes"
  // RSVP whose camera hasn't been materialized yet (provision-on-scan).
  const camera = await resolveGuestCamera(admin, guest.event_id, guest.guest_id, {
    sync: true,
  });

  // No camera for this guest — Limited isn't activated, or they declined / are
  // beyond the cost cap. Still show their gallery if they have tagged photos.
  if (camera.status === 'none') {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Camera aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          Your Papic camera isn&rsquo;t ready yet
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          The couple hasn&rsquo;t turned on Papic for the guest list yet — or your
          spot is still being set up. Check back closer to the day.
        </p>
        <GuestGallery eventId={guest.event_id} guestId={guest.guest_id} token={cleanToken!} />
        <PoolDoorway eventId={guest.event_id} token={cleanToken!} />
        {backLink}
      </Shell>
    );
  }

  // Camera exists but the Limited order is awaiting reconciliation → no capture.
  if (camera.status === 'pending') {
    return (
      <Shell>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Clock aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          Payment under review
        </h1>
        <p className="mt-3 text-sm text-ink/65">
          Your camera is reserved! The Setnayan team is confirming the couple&rsquo;s
          payment — this usually clears within a day. Come back and your camera
          will be ready to shoot.
        </p>
        <GuestGallery eventId={guest.event_id} guestId={guest.guest_id} token={cleanToken!} />
        <PoolDoorway eventId={guest.event_id} token={cleanToken!} />
        {backLink}
      </Shell>
    );
  }

  // Ready (paid + active). Hand off to the existing capture surface via the
  // seat's claim token, and surface the guest's gallery alongside it.
  const greetName = (guest.first_name ?? '').trim();
  return (
    <Shell>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Camera aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
        {greetName ? `${greetName}, your camera’s ready` : 'Your camera’s ready'}
      </h1>
      <p className="mt-3 text-sm text-ink/65">
        Tap below and your phone turns into a candid camera for the wedding. Every
        photo you shoot lands straight in the couple&rsquo;s gallery — no app to
        install.
      </p>
      <Link
        href={`/papic/seat/${encodeURIComponent(camera.claimToken)}`}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream transition hover:bg-mulberry-600"
      >
        <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
        Open my camera
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
      </Link>
      <GuestGallery eventId={guest.event_id} guestId={guest.guest_id} token={cleanToken!} />
      <PoolDoorway eventId={guest.event_id} token={cleanToken!} />
      {backLink}
    </Shell>
  );
}
