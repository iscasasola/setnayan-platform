'use client';

import { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CloudUpload,
  Download,
  HardDrive,
  Loader2,
  Plane,
  ShieldAlert,
  Video,
  type LucideIcon,
} from 'lucide-react';

/**
 * Iteration 0009 — Photo Delivery panel (V1.5+ scaffold).
 *
 * This is the interactive surface. It models the three product states:
 *   1. Not connected   → Hero + Connect Google Drive CTA (stubbed).
 *   2. Connected       → List of vendor delivery folders + per-folder
 *                        "Download all" CTAs.
 *   3. Downloaded      → Folder shows a countdown badge ("Originals compress
 *                        in 28 days") and the 30-day rule is repeated near
 *                        the action zone.
 *
 * State management is intentionally local — no DB row, no server action.
 * This is a scaffold-level launch; the persistent state shape ships with the
 * real Drive OAuth integration in V1.5+ proper.
 *
 * Stubs:
 *  - // TODO(0009): Real Google Drive OAuth (PKCE, drive.file scope).
 *  - // TODO(0009): Real Drive API list/download (folders + files).
 *  - // TODO(0009): Background worker that runs the 30-day compression cron.
 *  - // TODO(0009): R2 storage tier transitions (originals → web-quality).
 */

type DeliveryFolder = {
  key: string;
  vendorLabel: string;
  vendorType: 'photographer' | 'drone' | 'video';
  Icon: LucideIcon;
  photoCount: number;
  clipCount: number;
  totalBytes: number;
  receivedAt: string; // ISO date — fixed so the mock list doesn't change on re-render.
};

const COMPRESSION_WINDOW_DAYS = 30;

// Deterministic mock list — same content on every load. The label format
// matches the spec's "Lead photographer · 1,247 photos" pattern.
const MOCK_FOLDERS: ReadonlyArray<DeliveryFolder> = [
  {
    key: 'lead-photographer',
    vendorLabel: 'Lead photographer',
    vendorType: 'photographer',
    Icon: Camera,
    photoCount: 1247,
    clipCount: 0,
    totalBytes: 4_200_000_000, // 4.2 GB
    receivedAt: '2026-10-25T08:14:00.000Z',
  },
  {
    key: 'second-shooter',
    vendorLabel: 'Second shooter',
    vendorType: 'photographer',
    Icon: Camera,
    photoCount: 612,
    clipCount: 0,
    totalBytes: 1_950_000_000, // 1.95 GB
    receivedAt: '2026-10-25T11:42:00.000Z',
  },
  {
    key: 'drone-team',
    vendorLabel: 'Drone team',
    vendorType: 'drone',
    Icon: Plane,
    photoCount: 198,
    clipCount: 14,
    totalBytes: 2_800_000_000, // 2.8 GB
    receivedAt: '2026-10-26T09:05:00.000Z',
  },
  {
    key: 'cinema-team',
    vendorLabel: 'Cinema team',
    vendorType: 'video',
    Icon: Video,
    photoCount: 0,
    clipCount: 312,
    totalBytes: 18_400_000_000, // 18.4 GB
    receivedAt: '2026-10-26T15:30:00.000Z',
  },
];

type PanelState = 'idle' | 'connecting' | 'connected';

type Props = {
  eventId: string;
  eventName: string | null;
  eventDate: string | null;
};

export function PhotoDeliveryPanel({ eventId, eventName, eventDate }: Props) {
  // Connection lifecycle: idle → connecting (2s spinner) → connected.
  const [state, setState] = useState<PanelState>('idle');

  // Per-folder downloaded-at timestamps. A non-null value means "the couple
  // has clicked Download all on this folder" → the 30-day compression
  // countdown is now ticking.
  const [downloadedAt, setDownloadedAt] = useState<Record<string, number | null>>(
    () => Object.fromEntries(MOCK_FOLDERS.map((f) => [f.key, null])),
  );

  function handleConnect() {
    // TODO(0009): Replace with real Google OAuth (drive.file scope, PKCE).
    // Today this just simulates the round-trip so the UI flow is honest.
    setState('connecting');
    window.setTimeout(() => setState('connected'), 2000);
  }

  function handleDisconnect() {
    // TODO(0009): Call the real Drive revoke endpoint when the live OAuth lands.
    setState('idle');
    setDownloadedAt(Object.fromEntries(MOCK_FOLDERS.map((f) => [f.key, null])));
  }

  function handleDownload(folderKey: string) {
    // TODO(0009): Trigger real Drive download + start the compression cron timer.
    // For scaffold-level: stamp "downloaded now" so the countdown badge
    // appears and the compression rule explainer is surfaced.
    setDownloadedAt((prev) => ({ ...prev, [folderKey]: Date.now() }));
  }

  // For scaffold display only — the real folder name is built server-side
  // when the OAuth callback creates the Drive folder.
  const folderName = useMemo(() => {
    const couple = eventName?.trim();
    const date = eventDate ? eventDate.slice(0, 10) : null;
    if (couple && date) return `Setnayan · ${couple} · ${date}`;
    if (couple) return `Setnayan · ${couple}`;
    return 'Setnayan · Your wedding';
  }, [eventName, eventDate]);

  if (state === 'idle' || state === 'connecting') {
    return (
      <ConnectState
        connecting={state === 'connecting'}
        onConnect={handleConnect}
        folderName={folderName}
      />
    );
  }

  return (
    <ConnectedState
      folders={MOCK_FOLDERS}
      downloadedAt={downloadedAt}
      folderName={folderName}
      onDownload={handleDownload}
      onDisconnect={handleDisconnect}
      eventId={eventId}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  State 1: not connected (or connecting)                                    */
/* -------------------------------------------------------------------------- */

function ConnectState({
  connecting,
  onConnect,
  folderName,
}: {
  connecting: boolean;
  onConnect: () => void;
  folderName: string;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Step 1 of 3 — Connect
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Link your Google Drive
            </h2>
            <p className="max-w-prose text-sm text-ink/65">
              Setnayan creates one folder in your Drive — named{' '}
              <span className="font-mono text-ink">{folderName}</span> — and
              pushes every photographer and videographer&rsquo;s finished
              deliverables there. We use the{' '}
              <span className="font-mono">drive.file</span> scope, which means
              Setnayan can only see and write the files it creates inside that
              folder. Nothing else in your Drive is touched.
            </p>
          </div>

          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
            aria-busy={connecting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-5 py-3 text-sm font-medium text-cream transition hover:bg-terracotta-600 disabled:cursor-wait disabled:opacity-80 sm:w-auto"
          >
            {connecting ? (
              <>
                <Loader2
                  aria-hidden
                  className="h-4 w-4 animate-spin"
                  strokeWidth={2.25}
                />
                Drive connection in progress…
              </>
            ) : (
              <>
                <CloudUpload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Connect Google Drive
              </>
            )}
          </button>
        </div>
      </section>

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
            title: 'Download or share',
            body: 'You own the archive in your Drive. Setnayan keeps a 5-year backup independently.',
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
/*  State 2 + 3: connected (per-folder download + compression countdown)      */
/* -------------------------------------------------------------------------- */

function ConnectedState({
  folders,
  downloadedAt,
  folderName,
  onDownload,
  onDisconnect,
  eventId,
}: {
  folders: ReadonlyArray<DeliveryFolder>;
  downloadedAt: Record<string, number | null>;
  folderName: string;
  onDownload: (folderKey: string) => void;
  onDisconnect: () => void;
  eventId: string;
}) {
  const anyDownloaded = Object.values(downloadedAt).some((t) => t !== null);

  return (
    <div className="space-y-6">
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
              <p className="text-xs text-emerald-900/80">
                Account: <span className="font-mono">c•••@gmail.com</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/70 bg-cream/60 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-cream"
          >
            Disconnect
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Vendor deliveries
            </h2>
            <p className="text-sm text-ink/65">
              Each finalized handoff your vendors push to Setnayan shows up here.
            </p>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
            {folders.length} folders
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {folders.map((folder) => (
            <li key={folder.key}>
              <FolderCard
                folder={folder}
                downloadedAt={downloadedAt[folder.key] ?? null}
                onDownload={() => onDownload(folder.key)}
              />
            </li>
          ))}
        </ul>
      </section>

      {anyDownloaded ? (
        <section
          aria-label="Compression reminder"
          className="rounded-2xl border border-amber-300/60 bg-amber-50/60 p-4 text-sm text-amber-950 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-200/80 text-amber-900">
              <ShieldAlert aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="space-y-1.5">
              <p className="font-semibold tracking-tight">
                You&rsquo;ve downloaded — compression in 30 days
              </p>
              <p className="text-amber-900/85">
                The folders you downloaded above will keep their full-resolution
                originals on Drive for 30 days, then Setnayan compresses them to
                web-quality JPEGs so your Drive doesn&rsquo;t balloon. Setnayan&rsquo;s
                own 5-year backup stays untouched — you can request a re-delivery
                at full resolution any time within that window from this page.
              </p>
              <p className="text-xs text-amber-900/70">
                Event: <span className="font-mono">{eventId.slice(0, 8)}</span>
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FolderCard({
  folder,
  downloadedAt,
  onDownload,
}: {
  folder: DeliveryFolder;
  downloadedAt: number | null;
  onDownload: () => void;
}) {
  const { Icon } = folder;
  const totalLabel = formatFolderTotal(folder);
  const sizeLabel = formatBytes(folder.totalBytes);
  const receivedLabel = formatReceivedAt(folder.receivedAt);
  const daysRemaining =
    downloadedAt !== null ? daysUntilCompression(downloadedAt) : null;

  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-ink/10 bg-cream p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-ink">
              {folder.vendorLabel}
            </h3>
            <p className="text-xs text-ink/55">{totalLabel}</p>
          </div>
        </div>

        {downloadedAt !== null && daysRemaining !== null ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-900"
            title="30-day post-download compression rule"
          >
            <ShieldAlert
              aria-hidden
              className="h-3 w-3"
              strokeWidth={1.75}
            />
            Originals compress in {daysRemaining}{' '}
            {daysRemaining === 1 ? 'day' : 'days'}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-ink/[0.03] p-3 text-xs">
        <div>
          <dt className="font-mono uppercase tracking-[0.15em] text-ink/50">
            Size
          </dt>
          <dd className="mt-0.5 font-mono text-sm text-ink">{sizeLabel}</dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-[0.15em] text-ink/50">
            Received
          </dt>
          <dd className="mt-0.5 text-sm text-ink/80">{receivedLabel}</dd>
        </div>
      </dl>

      {downloadedAt === null ? (
        <button
          type="button"
          onClick={onDownload}
          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md border border-terracotta/60 bg-cream px-4 py-2 text-sm font-medium text-terracotta-700 transition hover:bg-terracotta/10"
        >
          <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Download all
        </button>
      ) : (
        <div className="mt-auto space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Downloaded {formatRelative(downloadedAt)}
          </p>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-xs font-medium text-ink/75 transition hover:bg-ink/5"
          >
            <HardDrive aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Re-download originals
          </button>
        </div>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatFolderTotal(folder: DeliveryFolder): string {
  const parts: string[] = [];
  if (folder.photoCount > 0)
    parts.push(`${folder.photoCount.toLocaleString('en-US')} photos`);
  if (folder.clipCount > 0)
    parts.push(`${folder.clipCount.toLocaleString('en-US')} clips`);
  return parts.join(' · ');
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  }
  if (bytes >= 1_000_000) {
    return `${Math.round(bytes / 1_000_000)} MB`;
  }
  return `${Math.round(bytes / 1_000)} KB`;
}

function formatReceivedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntilCompression(downloadedAtMs: number): number {
  const elapsedMs = Date.now() - downloadedAtMs;
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  return Math.max(0, COMPRESSION_WINDOW_DAYS - elapsedDays);
}

function formatRelative(downloadedAtMs: number): string {
  const elapsedMs = Date.now() - downloadedAtMs;
  const minutes = Math.floor(elapsedMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
