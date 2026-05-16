'use client';

import { useState } from 'react';
import { Film } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { submitPatiktokRender } from '../actions';

// Iteration 0017 Phase 2 — Patiktok render-form (real server action).
//
// Previously this component mocked the render queue client-side and generated
// a fake job ID. Phase 2 swaps the mock for a real <form action={…}> POST that
// inserts a row into `patiktok_render_jobs` via the `submitPatiktokRender`
// server action. The action redirects back to the gallery with ?queued=<job>
// so the success state lives in URL state, not transient component state.
//
// Real ffmpeg/Remotion render orchestration still ships in the worker (see
// `app/api/internal/patiktok/process-job/route.ts` seam) — this form's job
// is only to enqueue the work. Music selection moves into the gallery flow
// in Phase 5; for now `performer_count` defaults to 1.

type Props = {
  eventId: string;
  templateSlug: string;
  templateName: string;
  defaultDurationSec: number;
};

export function RenderForm({
  eventId,
  templateSlug,
  templateName: _templateName,
  defaultDurationSec,
}: Props) {
  const [duration, setDuration] = useState<number>(defaultDurationSec);

  return (
    <form action={submitPatiktokRender} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="template_slug" value={templateSlug} />
      <input type="hidden" name="duration_sec" value={duration} />

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

      <SubmitButton
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-600 disabled:opacity-70"
        pendingLabel="Queuing…"
      >
        <Film aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Render reel
      </SubmitButton>
      <p className="text-[11px] text-ink/55">
        Renders queue server-side. The ffmpeg / Remotion vertical-reel worker
        finishes each job and emails a download link — typically within an hour
        of your booth wrapping.
      </p>
    </form>
  );
}
