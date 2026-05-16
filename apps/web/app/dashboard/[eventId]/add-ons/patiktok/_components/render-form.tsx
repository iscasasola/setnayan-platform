'use client';

import { useState, type FormEvent } from 'react';
import { Film, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Client-side render-queue mock for iteration 0017's scaffold.
 *
 * Behaviour:
 *   1. User picks a duration between 1–30s (spec range).
 *   2. User clicks "Render reel" → form simulates a 600ms queue-submit pause
 *      and surfaces a "Render queued" state with a mock job ID.
 *   3. Job ID format: `pt_<base36 ts>_<random>` — clearly a mock, no DB write.
 *
 * TODO(0017): replace this with a real server action that
 *   - inserts a row into `patiktok_render_jobs` (table NOT created in this
 *     scaffold — pure mock so far),
 *   - enqueues an ffmpeg/Remotion job for the vertical-reel render,
 *   - uploads the rendered MP4 to R2,
 *   - returns the signed-URL once the render finishes.
 */

type Props = {
  templateSlug: string;
  templateName: string;
  defaultDurationSec: number;
};

type Status = 'idle' | 'queuing' | 'queued';

export function RenderForm({
  templateSlug,
  templateName,
  defaultDurationSec,
}: Props) {
  const [duration, setDuration] = useState<number>(defaultDurationSec);
  const [status, setStatus] = useState<Status>('idle');
  const [jobId, setJobId] = useState<string>('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status !== 'idle') return;
    setStatus('queuing');
    // TODO(0017): swap this stub for the real render-queue insert.
    await new Promise((r) => setTimeout(r, 600));
    const id = `pt_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    setJobId(id);
    setStatus('queued');
  }

  function reset() {
    setStatus('idle');
    setJobId('');
  }

  if (status === 'queued') {
    return (
      <div
        role="status"
        className="space-y-3 rounded-2xl border border-emerald-300/70 bg-emerald-50 p-4 text-sm text-emerald-900"
      >
        <p className="inline-flex items-center gap-1.5 font-semibold">
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Render queued
        </p>
        <p>
          Your {templateName} reel ({duration}s) is in the queue. We&rsquo;ll
          email a download link when the MP4 finishes encoding — typically
          inside an hour after your booth wraps.
        </p>
        <p className="font-mono text-[11px]">
          Job ID: <span className="text-emerald-700">{jobId}</span>
        </p>
        <p className="text-xs text-emerald-900/70">
          Scaffold preview only — no MP4 is actually rendered in this build.
          The real ffmpeg/Remotion pipeline is stubbed.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-emerald-900/10 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-900/20"
        >
          Queue another render
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="template_slug" value={templateSlug} />
      <div className="space-y-2">
        <label
          htmlFor="duration"
          className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink"
        >
          <span>Mimic duration</span>
          <span className="font-mono text-xs text-ink/60">{duration}s</span>
        </label>
        <input
          id="duration"
          name="duration"
          type="range"
          min={1}
          max={30}
          step={1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full accent-terracotta"
        />
        <p className="text-xs text-ink/55">
          Spec range: 1–30 seconds per clip. Default tracks the template&rsquo;s
          choreographed beat length.
        </p>
      </div>

      <button
        type="submit"
        disabled={status !== 'idle'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600 disabled:opacity-70"
      >
        {status === 'queuing' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Film aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        {status === 'queuing' ? 'Queuing…' : 'Render reel'}
      </button>
    </form>
  );
}
