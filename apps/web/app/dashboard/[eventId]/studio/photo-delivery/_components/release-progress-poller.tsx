'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// 0009 Photo Delivery — release progress poller.
//
// Mounted by the server panel when the event is in a mid-flight upload
// state (status ∈ {'releasing', 'uploading'}). Polls GET /api/photo-delivery/
// status every 2.5s and re-renders the progress bar + file/byte counters.
// When the status transitions to a final state ('complete' or 'failed'),
// reloads the page once so the server-rendered success/failure UI takes
// over (avoids needing two UI surfaces for "almost done" vs "done").

type StatusResponse = {
  event: {
    photo_delivery_status: string;
    photo_delivery_progress_pct: number;
  };
  job: {
    job_id: string;
    status: string;
    total_files: number;
    uploaded_files: number;
    failed_files: number;
    total_bytes: number;
    uploaded_bytes: number;
    current_file: string | null;
  } | null;
};

const POLL_INTERVAL_MS = 2500;
const FINAL_STATES = new Set(['complete', 'failed']);

type Props = {
  eventId: string;
  initialPct: number;
  initialUploadedFiles: number;
  initialTotalFiles: number;
  initialUploadedBytes: number;
  initialTotalBytes: number;
};

export function ReleaseProgressPoller({
  eventId,
  initialPct,
  initialUploadedFiles,
  initialTotalFiles,
  initialUploadedBytes,
  initialTotalBytes,
}: Props) {
  const [pct, setPct] = useState(initialPct);
  const [uploadedFiles, setUploadedFiles] = useState(initialUploadedFiles);
  const [totalFiles, setTotalFiles] = useState(initialTotalFiles);
  const [uploadedBytes, setUploadedBytes] = useState(initialUploadedBytes);
  const [totalBytes, setTotalBytes] = useState(initialTotalBytes);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const reloadedRef = useRef(false);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/photo-delivery/status?event_id=${encodeURIComponent(eventId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        setPct(data.event.photo_delivery_progress_pct);
        if (data.job) {
          setUploadedFiles(data.job.uploaded_files);
          setTotalFiles(data.job.total_files);
          setUploadedBytes(data.job.uploaded_bytes);
          setTotalBytes(data.job.total_bytes);
          setCurrentFile(data.job.current_file);
        }
        if (
          FINAL_STATES.has(data.event.photo_delivery_status) &&
          !reloadedRef.current
        ) {
          reloadedRef.current = true;
          window.location.reload();
        }
      } catch {
        // Network blip — quietly skip this tick. Next one will retry.
      }
    };

    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [eventId]);

  const clampedPct = Math.min(100, Math.max(0, pct));

  return (
    <div className="space-y-3 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-5">
      <div className="flex items-center gap-2">
        <Loader2
          aria-hidden
          className="h-4 w-4 animate-spin text-amber-900"
          strokeWidth={2.25}
        />
        <p className="text-sm font-semibold text-amber-950">
          Uploading to your Drive — {clampedPct}% complete
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-amber-200/60"
      >
        <div
          className="h-full bg-amber-700 transition-[width] duration-700"
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      {totalFiles > 0 ? (
        <p className="font-mono text-xs text-amber-900/85">
          {uploadedFiles.toLocaleString('en-US')} /{' '}
          {totalFiles.toLocaleString('en-US')} files ·{' '}
          {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
        </p>
      ) : null}

      {currentFile ? (
        <p className="truncate text-xs text-amber-900/65">
          Currently uploading:{' '}
          <span className="font-mono">{currentFile}</span>
        </p>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}
