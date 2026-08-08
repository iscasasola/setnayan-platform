import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, CloudUpload, Radio, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPhotoDeliveryOAuthConfig } from '@/lib/photo-delivery-drive';
import {
  PhotoDeliveryPanel,
  type PhotoDeliveryStatus,
} from './_components/photo-delivery-panel';
import {
  setPhotoDeliverySyncModeAuto,
  setPhotoDeliverySyncModeManual,
} from './actions';

export const metadata = { title: 'Photo Delivery · Setnayan' };

type SyncMode = 'manual_release' | 'auto_sync';

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    sync_mode_set?: string;
    sync_mode_error?: string;
    release_started?: string;
    already_complete?: string;
    release_error?: string;
    disconnected?: string;
  }>;
};

/**
 * Iteration 0009 — Photo Delivery (V1.5+ scaffold).
 *
 * Server component shell:
 *  - auth-gates the route (couples only — RLS handles the rest if the eventId
 *    doesn't belong to them, the layout one level up already enforces couple
 *    membership so we just defer to it).
 *  - reads the event's display name so the panel can render "Maria & Juan ·
 *    Lead photographer · 1,247 photos" without an extra fetch.
 *
 * The interactive Connect → Connected → Downloaded state machine lives in the
 * client component below. The real Drive OAuth + Drive API + compression-cron
 * pipeline is STUBBED — see `// TODO(0009):` markers in the panel.
 */
export default async function PhotoDeliveryPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    // SEC-2b: public.events_host, not public.events — this select names a column
    // (budget / birth data / Drive folder) that is SELECT-denied to `authenticated`
    // on the base table by 20271008731642. The view is the couple/moderator-scoped
    // read path; same columns, same row shape, guests get zero rows.
    .from('events_host')
    .select(
      'display_name, event_date, photo_delivery_sync_mode, photo_delivery_status, photo_delivery_folder_id, photo_delivery_folder_name, photo_delivery_account_email, photo_delivery_progress_pct, photo_delivery_failed_count, photo_delivery_completed_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  // Connection health for the reconnect banner. Photo Delivery + Papic share
  // ONE per-event grant (provider='drive'); 'needs_reauth' is set by the lazy
  // token refreshers when Google rejects the stored refresh_token. RLS scopes
  // this read to the couple (same pattern the Papic add-on page uses).
  const { data: driveGrant } = await supabase
    .from('oauth_grants')
    .select('connection_health')
    .eq('event_id', eventId)
    .eq('provider', 'drive')
    .is('revoked_at', null)
    .maybeSingle();
  const needsReauth = driveGrant?.connection_health === 'needs_reauth';

  const syncMode: SyncMode =
    (event?.photo_delivery_sync_mode as SyncMode | null) ?? 'manual_release';
  const syncModeJustSet =
    search.sync_mode_set === 'manual_release' || search.sync_mode_set === 'auto_sync'
      ? (search.sync_mode_set as SyncMode)
      : null;
  const syncModeError = search.sync_mode_error ?? null;

  const deliveryStatus =
    (event?.photo_delivery_status as PhotoDeliveryStatus | null) ?? 'idle';

  // Read the latest job rollup via the admin client (RLS on photo_delivery_jobs
  // restricts to service role). The status route uses the same pattern.
  const adminForJobs = createAdminClient();
  const { data: latestJob } = await adminForJobs
    .from('photo_delivery_jobs')
    .select('total_files, uploaded_files, total_bytes, uploaded_bytes')
    .eq('event_id', eventId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const releaseStartedFlash = search.release_started === '1';
  const alreadyCompleteFlash = search.already_complete === '1';
  const releaseErrorMsg = search.release_error ?? null;
  const disconnectedFlash = search.disconnected === '1';
  // getPhotoDeliveryOAuthConfig is now async (DB-first) — resolve before render.
  const photoDeliveryOauthReady = (await getPhotoDeliveryOAuthConfig()).ready;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="sn-reveal space-y-3">
        <p className="sn-eye inline-flex items-center gap-1.5">
          <CloudUpload aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Photo Delivery · Web V1
        </p>
        <h1 className="sn-h1">
          Send your finalized photos to Google Drive
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Once your photographers and videographers finish their post-event edits,
          Setnayan pushes the full-resolution archive straight to a Drive folder you
          control — no hard drives changing hands, no &ldquo;wait for the photographer
          to upload&rdquo; back-and-forth.
        </p>
      </header>

      {/* How long we hold things — visible at the top of the page so couples see
          it before they ever click Connect.
          ⚠ This comment used to say "the standing 30-day compression rule". There
          is no such rule and there never was; it is what kept the false box below
          it alive through several edits. */}
      <aside
        role="note"
        aria-label="How long full-resolution originals are kept"
        className="rounded-2xl border border-warn-300/60 bg-warn-50/70 p-4 text-sm text-warn-950 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-warn-200/80 text-warn-900">
            <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="space-y-1.5">
            {/* ⚠ REWRITTEN 2026-08-07. THIS BOX MADE THREE FALSE CLAIMS AT ONCE,
                on the screen where a couple decides their photos are safe:

                1. A "30-day window" that starts when photos land in Drive. NO
                   SUCH RULE EXISTS anywhere in the product. The real clock runs
                   6 months from the event's FIRST capture, floored at 3 months
                   after the event, and it is about OUR copy, not a download.
                2. "Setnayan compresses the Drive originals". We never touch the
                   couple's own Drive folder — we only ADD to it. The sweep
                   removes our own R2 original and actually DEFERS when the Drive
                   copy is unconfirmed.
                3. "your Setnayan-side 5-year backup stays intact" — there is no
                   5-year backup. That exact phrase is in the banned list in
                   retention-copy-is-true.test.ts and the guard could not see it,
                   because JSX wrapped it as "5-year\nbackup" and the pattern
                   needed one space. The guard is now whitespace-normalised.

                And the one reassuring fact — the gallery is kept, free, for 5 years — was
                never said, so the box could only ever cause panic. */}
            <p className="font-semibold tracking-tight">
              Your photos stay — full resolution has a window
            </p>
            <p className="text-warn-900/85">
              Every photo stays in your Setnayan gallery, free, for 5 years. About{' '}
              <span className="font-mono font-semibold">6 months</span> after
              your first photo is taken — and never sooner than 3 months after
              your event — we swap the full-resolution original for a compressed
              copy, and we keep that copy indefinitely. Anything already in your
              Drive folder is yours: we only add to it, and never compress or
              remove what&rsquo;s there.
            </p>
          </div>
        </div>
      </aside>

      <SyncModeSection
        eventId={eventId}
        currentMode={syncMode}
        justSet={syncModeJustSet}
        errorMessage={syncModeError}
      />

      <PhotoDeliveryPanel
        eventId={eventId}
        eventName={event?.display_name ?? null}
        eventDate={event?.event_date ?? null}
        syncMode={syncMode}
        status={deliveryStatus}
        folderName={event?.photo_delivery_folder_name ?? null}
        folderId={event?.photo_delivery_folder_id ?? null}
        accountEmail={event?.photo_delivery_account_email ?? null}
        progressPct={event?.photo_delivery_progress_pct ?? 0}
        failedCount={event?.photo_delivery_failed_count ?? 0}
        completedAt={event?.photo_delivery_completed_at ?? null}
        releaseError={releaseErrorMsg}
        releaseStartedFlash={releaseStartedFlash}
        alreadyComplete={alreadyCompleteFlash}
        disconnectedFlash={disconnectedFlash}
        oauthReady={photoDeliveryOauthReady}
        needsReauth={needsReauth}
        loginEmail={user.email ?? null}
        job={
          latestJob
            ? {
                total_files: latestJob.total_files as number,
                uploaded_files: latestJob.uploaded_files as number,
                total_bytes: Number(latestJob.total_bytes),
                uploaded_bytes: Number(latestJob.uploaded_bytes),
              }
            : null
        }
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sync-mode picker (iteration 0009, added 2026-05-20)                       */
/* -------------------------------------------------------------------------- */
/**
 * Per-event sync-mode picker for the 0009 Photo Delivery pipeline.
 *
 * `manual_release` (default) — couple clicks "Release to Drive" via the
 *   panel below after the 7-day review window. Background job pushes
 *   the archive in one batch.
 * `auto_sync` (opt-in) — photos stream to Drive in real-time as they
 *   land in R2 (Papic captures + photographer uploads alike).
 *
 * The choice persists to events.photo_delivery_sync_mode and the upload
 * job branches on it. The picker works whether or not Drive is connected
 * — couples can pre-pick the mode while waiting on Google's verified-app
 * review (#19g).
 */
function SyncModeSection({
  eventId,
  currentMode,
  justSet,
  errorMessage,
}: {
  eventId: string;
  currentMode: SyncMode;
  justSet: SyncMode | null;
  errorMessage: string | null;
}) {
  return (
    <section
      aria-label="Photo delivery sync mode"
      className="sn-tile space-y-4 p-5 sm:p-6"
    >
      <header className="space-y-1.5">
        <p className="sn-eye">
          Sync mode
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          How should photos reach your Drive?
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Change this any time before the event. The upload pipeline reads
          this setting when photos start landing in your archive.
        </p>
      </header>

      {justSet ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-md bg-success-100/80 px-3 py-1.5 text-xs font-medium text-success-950"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Saved — {justSet === 'manual_release' ? 'Review then release' : 'Sync live during the event'}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700"
        >
          Could not save sync mode: {errorMessage}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SyncModeCard
          mode="manual_release"
          eventId={eventId}
          selected={currentMode === 'manual_release'}
          action={setPhotoDeliverySyncModeManual}
          Icon={ShieldCheck}
          title="Review then release"
          tagline="Default · you stay in control"
          bullets={[
            'Photos sit safely in Setnayan during the event.',
            '7-day review window — hide anything you don’t want.',
            'Click "Release to Drive" once and the full archive uploads in one pass.',
          ]}
        />
        <SyncModeCard
          mode="auto_sync"
          eventId={eventId}
          selected={currentMode === 'auto_sync'}
          action={setPhotoDeliverySyncModeAuto}
          Icon={Radio}
          title="Sync live during the event"
          tagline="Real-time · see your archive fill up live"
          bullets={[
            'Every photo streams to your Drive as it lands in R2.',
            'No release gate — photos arrive in Drive while the event is happening.',
            'Hide-in-Setnayan after sync stays in Drive (delete there manually).',
          ]}
        />
      </div>
    </section>
  );
}

function SyncModeCard({
  mode,
  eventId,
  selected,
  action,
  Icon,
  title,
  tagline,
  bullets,
}: {
  mode: SyncMode;
  eventId: string;
  selected: boolean;
  action: (formData: FormData) => Promise<void>;
  Icon: typeof ShieldCheck;
  title: string;
  tagline: string;
  bullets: string[];
}) {
  return (
    <form action={action} className="contents">
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        aria-pressed={selected}
        aria-label={`Set sync mode to ${title}`}
        data-mode={mode}
        className={
          selected
            ? 'flex h-full flex-col gap-3 rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 text-left transition'
            : 'flex h-full flex-col gap-3 rounded-xl border border-ink/15 bg-cream p-4 text-left transition hover:border-ink/30 hover:bg-ink/[0.03]'
        }
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={
              selected
                ? 'inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-terracotta text-cream'
                : 'inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-ink/5 text-ink/70'
            }
          >
            <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
          {selected ? (
            <span
              aria-hidden
              className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-cream"
            >
              <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
              Selected
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            {tagline}
          </p>
        </div>
        <ul className="space-y-1 text-xs text-ink/70">
          {bullets.map((b) => (
            <li key={b} className="leading-relaxed">
              <span aria-hidden className="mr-1.5 text-ink/35">·</span>
              {b}
            </li>
          ))}
        </ul>
      </button>
    </form>
  );
}
