import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  CloudUpload,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unlink2,
} from 'lucide-react';
import {
  disconnectPhotoDelivery,
  releasePhotoDelivery,
} from '../actions';
import { ReleaseProgressPoller } from './release-progress-poller';
import { DriveConnectCard, DriveReconnectBanner } from './drive-connect-card';

// 0009 Photo Delivery panel — wired to real OAuth + release flow.
//
// Server component. Renders one of three top-level states based on
// events.photo_delivery_status:
//
//   idle (no Drive grant or post-disconnect)
//     → Connect Drive CTA + 3-step explainer
//
//   connected | releasing | uploading | paused | complete | failed
//     → ConnectedState — connected info card + Disconnect button + state-
//       specific content (release button / progress poller / success /
//       error).
//
// Replaces the 517-line mock client-state panel that shipped pre-2026-05-20.
// The OAuth lib + lib/photo-delivery-release.ts + the API routes (start,
// callback, release, disconnect, status) were already engineering-ready;
// this rewrite hooks them up. See CLAUDE.md decision log row 446 for the
// 0009 sync-mode + relationship clarifications that preceded this work.

export type PhotoDeliveryStatus =
  | 'idle'
  | 'connected'
  | 'releasing'
  | 'uploading'
  | 'paused'
  | 'complete'
  | 'failed';

type JobRollup = {
  total_files: number;
  uploaded_files: number;
  total_bytes: number;
  uploaded_bytes: number;
};

type Props = {
  eventId: string;
  eventName: string | null;
  eventDate: string | null;
  syncMode: 'manual_release' | 'auto_sync';
  status: PhotoDeliveryStatus;
  folderName: string | null;
  folderId: string | null;
  accountEmail: string | null;
  progressPct: number;
  failedCount: number;
  completedAt: string | null;
  releaseError: string | null;
  releaseStartedFlash: boolean;
  alreadyComplete: boolean;
  disconnectedFlash: boolean;
  job: JobRollup | null;
  // 2026-05-20 graceful-fallback: when the Google Drive OAuth env isn't
  // set (the #19g verified-app review hasn't cleared yet), the Connect
  // Drive button degrades to a "coming soon" placeholder instead of
  // letting the couple click through to a JSON error page from the
  // /api/oauth/photo-delivery/start route.
  oauthReady: boolean;
  // True when Google rejected the stored refresh_token (oauth_grants
  // .connection_health === 'needs_reauth'). Surfaces the calm reconnect banner
  // on the connected panel instead of a stale "Connected" while uploads stall.
  needsReauth: boolean;
};

export function PhotoDeliveryPanel({
  eventId,
  eventName,
  eventDate,
  syncMode,
  status,
  folderName,
  folderId,
  accountEmail,
  progressPct,
  failedCount,
  completedAt,
  releaseError,
  releaseStartedFlash,
  alreadyComplete,
  disconnectedFlash,
  job,
  oauthReady,
  needsReauth,
}: Props) {
  const folderNamePreview = buildFolderNamePreview(eventName, eventDate);

  if (status === 'idle') {
    return (
      <IdleState
        eventId={eventId}
        disconnectedFlash={disconnectedFlash}
        oauthReady={oauthReady}
      />
    );
  }

  return (
    <ConnectedState
      eventId={eventId}
      syncMode={syncMode}
      status={status}
      folderName={folderName ?? folderNamePreview}
      folderId={folderId}
      accountEmail={accountEmail}
      progressPct={progressPct}
      failedCount={failedCount}
      completedAt={completedAt}
      releaseError={releaseError}
      releaseStartedFlash={releaseStartedFlash}
      alreadyComplete={alreadyComplete}
      job={job}
      needsReauth={needsReauth}
    />
  );
}

function buildFolderNamePreview(
  eventName: string | null,
  eventDate: string | null,
): string {
  const couple = eventName?.trim();
  const date = eventDate ? eventDate.slice(0, 10) : null;
  if (couple && date) return `Setnayan · ${couple} · ${date}`;
  if (couple) return `Setnayan · ${couple}`;
  return 'Setnayan · Your wedding';
}

/* -------------------------------------------------------------------------- */
/*  Idle state — Drive not yet connected (or just disconnected)               */
/* -------------------------------------------------------------------------- */

function IdleState({
  eventId,
  disconnectedFlash,
  oauthReady,
}: {
  eventId: string;
  disconnectedFlash: boolean;
  oauthReady: boolean;
}) {
  return (
    <div className="space-y-6">
      {disconnectedFlash ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100/80 px-3 py-1.5 text-xs font-medium text-emerald-950"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Drive disconnected. The files Setnayan wrote to your Drive are still yours.
        </p>
      ) : null}

      <DriveConnectCard
        connectHref={`/api/oauth/photo-delivery/start?event_id=${encodeURIComponent(eventId)}`}
        oauthReady={oauthReady}
        headline="Keep your own copy in Google Drive"
        body={
          <>
            Your photos already live here in Setnayan — nothing to set up,
            they&rsquo;re always yours to view. Connect your Google Drive and
            we&rsquo;ll <em>also</em> drop every finished photo and clip into one
            folder you own, yours to keep forever, long after the wedding.
          </>
        }
        deferHref={`/dashboard/${eventId}/add-ons`}
        deferLabel="Not now — keep my photos in Setnayan"
      />

      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          {
            n: 1,
            title: 'Connect Drive',
            body: 'One-tap OAuth. Setnayan can only touch the folder it creates — nothing else in your account.',
          },
          {
            n: 2,
            title: 'Vendors deliver',
            body: 'Each photographer, drone team, and videographer drops their finals into your folder as they finish.',
          },
          {
            n: 3,
            title: 'Own the archive',
            body: 'Photos arrive in your Drive. Setnayan keeps a 5-year backup independently in case you need a re-delivery.',
          },
        ].map((step) => (
          <li
            key={step.n}
            className="space-y-1.5 rounded-xl border border-ink/10 bg-cream p-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Step {step.n}
            </p>
            <p className="text-sm font-semibold text-ink">{step.title}</p>
            <p className="text-xs text-ink/65">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Connected state — Drive linked; state-specific content inside             */
/* -------------------------------------------------------------------------- */

function ConnectedState({
  eventId,
  syncMode,
  status,
  folderName,
  folderId,
  accountEmail,
  progressPct,
  failedCount,
  completedAt,
  releaseError,
  releaseStartedFlash,
  alreadyComplete,
  job,
  needsReauth,
}: {
  eventId: string;
  syncMode: 'manual_release' | 'auto_sync';
  status: Exclude<PhotoDeliveryStatus, 'idle'>;
  folderName: string;
  folderId: string | null;
  accountEmail: string | null;
  progressPct: number;
  failedCount: number;
  completedAt: string | null;
  releaseError: string | null;
  releaseStartedFlash: boolean;
  alreadyComplete: boolean;
  job: JobRollup | null;
  needsReauth: boolean;
}) {
  const isUploading = status === 'releasing' || status === 'uploading';
  const isComplete = status === 'complete';
  const isFailed = status === 'failed';
  const isConnectedIdle = status === 'connected' || status === 'paused';

  const driveFolderUrl = folderId
    ? `https://drive.google.com/drive/folders/${folderId}`
    : null;

  return (
    <div className="space-y-5">
      {needsReauth ? (
        <DriveReconnectBanner
          reconnectHref={`/api/oauth/photo-delivery/start?event_id=${encodeURIComponent(eventId)}`}
        />
      ) : null}

      {releaseError ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700"
        >
          Could not start release: {releaseError}
        </p>
      ) : null}
      {releaseStartedFlash && !releaseError ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100/80 px-3 py-1.5 text-xs font-medium text-emerald-950"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {alreadyComplete
            ? 'Already up to date — no new photos to release.'
            : 'Release started — uploads begin in the background.'}
        </p>
      ) : null}

      <section
        aria-label="Connected Drive folder"
        className="rounded-2xl border border-emerald-300/60 bg-emerald-50/70 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-emerald-200/80 text-emerald-900">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-950">
                Drive connected
              </p>
              <p className="text-xs text-emerald-900/80">
                Folder:{' '}
                <span className="font-mono text-emerald-950">{folderName}</span>
              </p>
              {accountEmail ? (
                <p className="text-xs text-emerald-900/80">
                  Account: <span className="font-mono">{accountEmail}</span>
                </p>
              ) : null}
            </div>
          </div>

          <form action={disconnectPhotoDelivery}>
            <input type="hidden" name="event_id" value={eventId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/70 bg-cream/60 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-cream"
            >
              <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Disconnect
            </button>
          </form>
        </div>
      </section>

      <ModeBanner syncMode={syncMode} isUploading={isUploading} />

      {isUploading ? (
        <ReleaseProgressPoller
          eventId={eventId}
          initialPct={progressPct}
          initialUploadedFiles={job?.uploaded_files ?? 0}
          initialTotalFiles={job?.total_files ?? 0}
          initialUploadedBytes={job?.uploaded_bytes ?? 0}
          initialTotalBytes={job?.total_bytes ?? 0}
        />
      ) : null}

      {isConnectedIdle && syncMode === 'manual_release' ? (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
          <header className="space-y-1">
            <h3 className="text-base font-semibold text-ink">
              Ready when you are
            </h3>
            <p className="max-w-prose text-sm text-ink/65">
              Setnayan is holding your photos. When you&rsquo;ve finished
              reviewing, release the full archive to your Drive in one pass.
            </p>
          </header>
          <form action={releasePhotoDelivery}>
            <input type="hidden" name="event_id" value={eventId} />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition hover:bg-mulberry-600"
            >
              <CloudUpload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Release to Drive
            </button>
          </form>
        </section>
      ) : null}

      {isConnectedIdle && syncMode === 'auto_sync' ? (
        <section
          aria-label="Auto-sync active"
          className="rounded-2xl border border-ink/10 bg-cream p-5"
        >
          <p className="max-w-prose text-sm text-ink/65">
            Photos will land in your Drive as they arrive in Setnayan. No
            release step needed. Check this page during the event to see the
            upload count tick up.
          </p>
        </section>
      ) : null}

      {isComplete ? (
        <section className="space-y-3 rounded-2xl border border-emerald-300/60 bg-emerald-50/70 p-5">
          <header className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-900/70">
              Delivery complete{completedAt ? ` · ${formatCompletedAt(completedAt)}` : ''}
            </p>
            <h3 className="text-base font-semibold text-emerald-950">
              All photos are in your Drive
            </h3>
            <p className="text-sm text-emerald-900/85">
              {job
                ? `${job.uploaded_files.toLocaleString('en-US')} files · ${formatBytes(job.uploaded_bytes)} delivered.`
                : 'Your folder is ready.'}{' '}
              Setnayan keeps a 5-year backup in case you need a re-delivery.
            </p>
          </header>
          <div className="flex flex-wrap gap-2">
            {driveFolderUrl ? (
              <Link
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-emerald-800"
              >
                <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Open in Drive
              </Link>
            ) : null}
            <form action={releasePhotoDelivery}>
              <input type="hidden" name="event_id" value={eventId} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/70 bg-cream/60 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-cream"
              >
                <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Re-deliver new photos
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {isFailed ? (
        <section className="space-y-3 rounded-2xl border border-terracotta/40 bg-terracotta/5 p-5">
          <header className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert
                aria-hidden
                className="h-4 w-4 text-terracotta-700"
                strokeWidth={1.75}
              />
              <h3 className="text-base font-semibold text-terracotta-700">
                Upload failed
              </h3>
            </div>
            <p className="text-sm text-ink/75">
              {failedCount > 0
                ? `${failedCount} file${failedCount === 1 ? '' : 's'} couldn't make it after several retries. `
                : ''}
              Setnayan still has your photos safely in R2 — retry whenever you&rsquo;re ready.
            </p>
          </header>
          <form action={releasePhotoDelivery}>
            <input type="hidden" name="event_id" value={eventId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-mulberry-600"
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Retry upload
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function ModeBanner({
  syncMode,
  isUploading,
}: {
  syncMode: 'manual_release' | 'auto_sync';
  isUploading: boolean;
}) {
  if (isUploading) return null;
  if (syncMode === 'auto_sync') {
    return (
      <p
        role="status"
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/75"
      >
        <Radio aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
        Live sync active · photos stream to your Drive as they land in R2
      </p>
    );
  }
  return (
    <p
      role="status"
      className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/75"
    >
      <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
      Review mode · release when you&rsquo;re ready (change above)
    </p>
  );
}

function formatCompletedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}
