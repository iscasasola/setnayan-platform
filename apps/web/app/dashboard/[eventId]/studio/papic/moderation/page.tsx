import Link from 'next/link';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { ArrowLeft, ShieldCheck, ShieldAlert, EyeOff, Eye, Flag, UserX, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { reScreenStuckCaptures } from '@/lib/nsfw-screen';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { eventPapicGuestActive } from '@/lib/papic-guest';
import { KwentoQueue } from './_components/kwento-queue';
import {
  reportCapture,
  setCaptureHidden,
  blockUploader,
  unblockUploader,
  approveScreenedCapture,
} from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Photo moderation · Papic · Setnayan' };
export const dynamic = 'force-dynamic';

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'nudity_sexual', label: 'Nudity / sexual content' },
  { value: 'violence', label: 'Violence' },
  { value: 'hate_harassment', label: 'Hate / harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'not_my_event', label: 'Not from this wedding' },
  { value: 'other', label: 'Something else' },
];

/**
 * /dashboard/[eventId]/studio/papic/moderation — couple-side UGC moderation
 * for the Papic guest gallery (Apple guideline 1.2 / Google Play UGC). Lists
 * every guest capture with three host actions:
 *   · Hide      — drops the photo out of the gallery (papic_guest_captures.hidden_at)
 *   · Report    — files a user_reports row routed to Setnayan admins too
 *   · Block     — event-scoped block of the uploading guest's camera
 * Plus a blocked-guests panel to lift a block. Reports are no longer a dead end
 * — they reach the /admin/user-reports queue.
 */
export default async function PapicModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}`);
  }

  // Cron-free self-heal: re-screen any capture stuck in 'unscreened' (a
  // capture-time screen that dropped fail-open) so it stops being permanently
  // invisible on the guest allowlist surfaces. Bounded + never throws.
  after(() => reScreenStuckCaptures(eventId));

  const admin = createAdminClient();

  const owns = await eventPapicGuestActive(admin, eventId);

  // Captures (newest first), the blocked-guest list, any open reports, and the
  // NSFW-screened (auto-filtered) captures from BOTH capture tables — one
  // parallel batch.
  const [
    { data: captures },
    { data: blocks },
    { data: reports },
    { data: screenedGuest },
    { data: screenedSeat },
  ] = await Promise.all([
    admin
      .from('papic_guest_captures')
      .select('capture_id, guest_id, r2_object_key, captured_at, hidden_at')
      .eq('event_id', eventId)
      .order('captured_at', { ascending: false })
      .limit(200),
    admin
      .from('event_blocked_users')
      .select('blocked_guest_id, reason, created_at')
      .eq('event_id', eventId),
    admin
      .from('user_reports')
      .select('target_id, status')
      .eq('event_id', eventId)
      .eq('target_type', 'photo'),
    admin
      .from('papic_guest_captures')
      .select('capture_id, guest_id, r2_object_key, captured_at')
      .eq('event_id', eventId)
      .eq('moderation_state', 'nsfw_blocked')
      .order('captured_at', { ascending: false })
      .limit(100),
    admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, captured_at, photo_type, poster_r2_key')
      .eq('event_id', eventId)
      .eq('moderation_state', 'nsfw_blocked')
      .order('captured_at', { ascending: false })
      .limit(100),
  ]);

  const captureRows = captures ?? [];
  const blockRows = blocks ?? [];
  const reportRows = reports ?? [];
  // Auto-filtered captures (NSFW screen) from both tables, normalized into one
  // list. Null data (pre-migration env without moderation_state) just hides
  // the section.
  const screenedRows = [
    ...(screenedGuest ?? []).map((r) => ({
      table: 'papic_guest_captures' as const,
      id: r.capture_id as string,
      guestId: (r.guest_id as string | null) ?? null,
      r2Ref: (r.r2_object_key as string | null) ?? null,
      capturedAt: (r.captured_at as string | null) ?? null,
      isClip: false,
    })),
    ...(screenedSeat ?? []).map((r) => ({
      table: 'papic_photos' as const,
      id: r.photo_id as string,
      guestId: null as string | null,
      // A flagged CLIP was screened via its poster frame — thumbnail that
      // (an <img> can't render the video file).
      r2Ref:
        ((r.photo_type as string | null) === 'clip'
          ? (r.poster_r2_key as string | null)
          : (r.r2_object_key as string | null)) ?? null,
      capturedAt: (r.captured_at as string | null) ?? null,
      isClip: (r.photo_type as string | null) === 'clip',
    })),
  ].sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''));

  // Resolve guest names + presigned thumbnails for the visible page.
  const guestIds = Array.from(
    new Set([
      ...captureRows.map((c) => c.guest_id as string),
      ...blockRows.map((b) => b.blocked_guest_id as string),
      ...screenedRows.flatMap((s) => (s.guestId ? [s.guestId] : [])),
    ]),
  );
  const { data: guestData } = guestIds.length
    ? await admin
        .from('guests')
        .select('guest_id, first_name, display_name')
        .in('guest_id', guestIds)
    : { data: [] };
  const guestName = new Map<string, string>();
  for (const g of guestData ?? []) {
    const name =
      ((g.first_name as string | null) ?? '').trim() ||
      ((g.display_name as string | null) ?? '').trim() ||
      'Guest';
    guestName.set(g.guest_id as string, name);
  }

  const blockedSet = new Set(blockRows.map((b) => b.blocked_guest_id as string));
  const reportedSet = new Set(reportRows.map((r) => r.target_id as string));

  const thumbs = await Promise.all(
    captureRows.map(async (c) => {
      const ref = c.r2_object_key as string | null;
      const url = ref ? await displayUrlForStoredAsset(ref) : null;
      return [c.capture_id as string, url] as const;
    }),
  );
  const thumbUrl = new Map<string, string | null>();
  for (const [id, url] of thumbs) thumbUrl.set(id, url);

  const screenedThumbs = await Promise.all(
    screenedRows.map(async (s) => {
      const url = s.r2Ref ? await displayUrlForStoredAsset(s.r2Ref) : null;
      return [s.id, url] as const;
    }),
  );
  const screenedThumbUrl = new Map<string, string | null>();
  for (const [id, url] of screenedThumbs) screenedThumbUrl.set(id, url);

  const notice =
    (search.reported && 'Report sent to the Setnayan team.') ||
    (search.hidden && 'Photo hidden from your gallery.') ||
    (search.unhidden && 'Photo restored to your gallery.') ||
    (search.blocked && 'That guest can no longer add photos to this wedding.') ||
    (search.unblocked && 'Block lifted — that guest can add photos again.') ||
    (search.approved && 'Photo approved — it will show in your gallery again.') ||
    null;
  const errorMsg = search.error ? 'Something went wrong — please try again.' : null;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <Link
          href={`/dashboard/${eventId}/studio/papic`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-terracotta hover:text-terracotta-700"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to Papic
        </Link>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Photo moderation</h1>
        </div>
        <p className="max-w-2xl text-sm text-ink/65">
          Every guest photo lands here. Hide anything you don&rsquo;t want in
          your gallery, report it to the Setnayan team for review, or block a
          guest&rsquo;s camera for this wedding. Blocking is limited to this
          event only.
        </p>
      </header>

      {notice && (
        <p className="inline-flex items-center gap-2 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-800">
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          {notice}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          {errorMsg}
        </p>
      )}

      {!owns ? (
        <p className="rounded-md border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/65">
          Guest cameras aren&rsquo;t active for this wedding yet. Once you add
          the Premium Guest Camera Pack, guest photos will appear here.
        </p>
      ) : captureRows.length === 0 ? (
        <p className="rounded-md border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/65">
          No guest photos yet. As guests start shooting, every photo shows up
          here for you to review.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {captureRows.map((c) => {
            const captureId = c.capture_id as string;
            const guestId = c.guest_id as string;
            const hidden = Boolean(c.hidden_at);
            const isBlocked = blockedSet.has(guestId);
            const isReported = reportedSet.has(captureId);
            const url = thumbUrl.get(captureId) ?? null;
            const name = guestName.get(guestId) ?? 'Guest';
            return (
              <li
                key={captureId}
                className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-surface p-3 shadow-sm"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-ink/[0.04]">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`Photo from ${name}`}
                      className={`h-full w-full object-cover ${hidden ? 'opacity-40 grayscale' : ''}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-ink/40">
                      Preview unavailable
                    </div>
                  )}
                  {hidden && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-medium text-cream">
                      <EyeOff aria-hidden className="h-3 w-3" strokeWidth={2} /> Hidden
                    </span>
                  )}
                  {isReported && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-warn-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
                      <Flag aria-hidden className="h-3 w-3" strokeWidth={2} /> Reported
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-ink/60">
                  <span className="font-medium text-ink/80">{name}</span>
                  {isBlocked && (
                    <span className="inline-flex items-center gap-1 text-terracotta">
                      <UserX aria-hidden className="h-3 w-3" strokeWidth={2} /> Blocked
                    </span>
                  )}
                </div>

                {/* Hide / unhide */}
                <form action={setCaptureHidden.bind(null, eventId)}>
                  <input type="hidden" name="capture_id" value={captureId} />
                  <input type="hidden" name="hide" value={hidden ? '0' : '1'} />
                  <SubmitButton
                    pendingLabel="Updating…"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/[0.04]"
                  >
                    {hidden ? (
                      <>
                        <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Unhide
                      </>
                    ) : (
                      <>
                        <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Hide from gallery
                      </>
                    )}
                  </SubmitButton>
                </form>

                {/* Report */}
                <form action={reportCapture.bind(null, eventId)} className="space-y-1.5">
                  <input type="hidden" name="capture_id" value={captureId} />
                  <div className="flex items-center gap-1.5">
                    <select
                      name="reason"
                      required
                      defaultValue="nudity_sexual"
                      className="min-w-0 flex-1 rounded-md border border-ink/15 bg-surface px-2 py-1.5 text-xs text-ink/80"
                    >
                      {REASON_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <SubmitButton
                      pendingLabel="Reporting…"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-warn-300 bg-warn-50 px-3 py-1.5 text-xs font-medium text-warn-900 hover:bg-warn-100"
                    >
                      <Flag aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Report
                    </SubmitButton>
                  </div>
                </form>

                {/* Block / unblock uploader (event-scoped) */}
                {isBlocked ? (
                  <form action={unblockUploader.bind(null, eventId)}>
                    <input type="hidden" name="guest_id" value={guestId} />
                    <SubmitButton
                      pendingLabel="Unblocking…"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/[0.04]"
                    >
                      Unblock {name}&rsquo;s camera
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={blockUploader.bind(null, eventId)}>
                    <input type="hidden" name="guest_id" value={guestId} />
                    <SubmitButton
                      pendingLabel="Blocking…"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-1.5 text-xs font-medium text-terracotta-700 hover:bg-terracotta/10"
                    >
                      <UserX aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Block {name}&rsquo;s camera
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {blockRows.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink/80">
            <UserX className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Blocked guests for this wedding
          </h2>
          <ul className="space-y-2">
            {blockRows.map((b) => {
              const gid = b.blocked_guest_id as string;
              return (
                <li
                  key={gid}
                  className="flex items-center justify-between rounded-md border border-ink/10 bg-surface px-3 py-2 text-sm"
                >
                  <span className="text-ink/80">{guestName.get(gid) ?? 'Guest'}</span>
                  <form action={unblockUploader.bind(null, eventId)}>
                    <input type="hidden" name="guest_id" value={gid} />
                    <SubmitButton
                      pendingLabel="Unblocking…"
                      className="rounded-md border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-ink/[0.04]"
                    >
                      Unblock
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {screenedRows.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-warn-200 bg-warn-50/50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink/80">
            <ShieldAlert className="h-4 w-4 text-warn-600" strokeWidth={1.75} />
            Filtered by the content screen
          </h2>
          <p className="max-w-2xl text-xs text-ink/60">
            Setnayan automatically screens every photo and clip for explicit
            content — the screen is always on and can&rsquo;t be turned off.
            Anything it filters is hidden from guests and your public pages,
            but you can review it here. Approving restores a single item.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {screenedRows.map((s) => {
              const url = screenedThumbUrl.get(s.id) ?? null;
              const name = s.guestId
                ? guestName.get(s.guestId) ?? 'Guest'
                : 'Papic crew';
              return (
                <li
                  key={`${s.table}:${s.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-surface p-2"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-ink/[0.04]">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`Filtered photo from ${name}`}
                        className="h-full w-full object-cover blur-md"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-ink/40">
                        Preview unavailable
                      </div>
                    )}
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-warn-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
                      <ShieldAlert aria-hidden className="h-3 w-3" strokeWidth={2} />{' '}
                      {s.isClip ? 'Filtered clip' : 'Filtered'}
                    </span>
                  </div>
                  <span className="truncate text-xs font-medium text-ink/70">{name}</span>
                  <form action={approveScreenedCapture.bind(null, eventId)}>
                    <input type="hidden" name="table" value={s.table} />
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton
                      pendingLabel="Approving…"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-success-300 bg-success-50 px-2.5 py-1.5 text-xs font-medium text-success-800 hover:bg-success-100"
                    >
                      <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Approve — show this photo
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <KwentoQueue eventId={eventId} />

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · iteration 0012 Papic · UGC moderation (Apple 1.2 / Google Play UGC)
      </p>
    </section>
  );
}
