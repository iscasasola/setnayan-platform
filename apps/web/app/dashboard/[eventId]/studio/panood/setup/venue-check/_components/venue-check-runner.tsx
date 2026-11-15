'use client';

/**
 * Live Watch › venue connection check — the phone screen.
 *
 * idle → (start signs the test upload) → running (lib/venue-probe-run.ts) → finish re-judges, saves and
 * deletes the upload → result. Any way out of a run that does not reach `finish` (Stop, a refused upload,
 * leaving the page) calls `discard`, so the test upload is deleted then and there; a phone that dies
 * mid-run is the hourly sweep's (lib/venue-check-sweep.ts).
 *
 * The three screens are exported on their own (`VenueCheckReady` · `VenueCheckBusy` · `VenueCheckDone`)
 * so `/dev/venue-check-lab` draws the REAL ones on sample data; `VenueCheckRunner` is the only thing that
 * moves between them.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Gauge, Play, RotateCcw, Square, Wifi } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import {
  PLACE_NAME_MAX,
  PROBE_MAX_BYTES,
  PROBE_RUN_MS,
  STREAM_FULL_BPS,
  VERDICT_WORDS,
  checkedOnLine,
  formatMbps,
  formatMegabytes,
  verdictHeadline,
  verdictLine,
  type VenueJudgement,
  type VenueVerdict,
} from '@/lib/venue-check';
import { runVenueProbe, type ProbeRun } from '@/lib/venue-probe-run';
import { venueCheck } from '../actions';
import { TONE_DOT, VenueCheckStatus, type VenueCheckStatusProps } from './venue-check-status';

export type JudgedVenue = VenueJudgement & { verdict: VenueVerdict };

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; progress: number; liveBps: number | null }
  | { kind: 'saving' }
  | { kind: 'result'; judgement: JudgedVenue; delayMs: number | null; checkedAt: string; placeName: string | null }
  | { kind: 'error'; message: string };

/** The verdict's wash — a tint, no frame (frames are for things you can press). Tokens flip for dark mode. */
const VERDICT_WASH: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-success-50',
  warn: 'bg-warn-50',
  bad: 'bg-danger-50',
};

const ICON = { 'aria-hidden': true, className: 'h-4 w-4', strokeWidth: 2 } as const;

export function VenueCheckRunner({
  eventId,
  setupHref,
  last,
}: {
  eventId: string;
  setupHref: string;
  last: VenueCheckStatusProps;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [place, setPlace] = useState('');
  const [lastSeen, setLastSeen] = useState<VenueCheckStatusProps>(last);
  const run = useRef<{ probe: ProbeRun; checkId: string } | null>(null);

  // Leaving the page mid-run stops the upload and deletes what it sent.
  useEffect(() => {
    return () => {
      const r = run.current;
      if (!r) return;
      run.current = null;
      r.probe.cancel();
      void venueCheck({ op: 'discard', eventId, checkId: r.checkId }).catch(() => {});
    };
  }, [eventId]);

  async function start() {
    setPhase({ kind: 'starting' });
    let started: Awaited<ReturnType<typeof venueCheck<{ op: 'start'; eventId: string }>>>;
    try {
      started = await venueCheck({ op: 'start', eventId });
    } catch {
      setPhase({ kind: 'error', message: 'We couldn’t reach Setnayan from here. Check the connection, then try again.' });
      return;
    }
    if (!started.ok) {
      setPhase({ kind: 'error', message: started.error });
      return;
    }
    const { checkId } = started;
    setPhase({ kind: 'running', progress: 0, liveBps: null });
    const probe = runVenueProbe(
      { uploadUrl: started.uploadUrl, contentType: started.contentType },
      {
        onProgress: (p) => setPhase((cur) => (cur.kind === 'running' ? { ...cur, progress: p } : cur)),
        onSample: (_s, bps) => setPhase((cur) => (cur.kind === 'running' ? { ...cur, liveBps: bps } : cur)),
      },
    );
    run.current = { probe, checkId };
    const out = await probe.done;
    if (run.current?.checkId !== checkId) return; // left the page, or stopped: already discarded
    run.current = null;

    if (out.kind !== 'measured') {
      void venueCheck({ op: 'discard', eventId, checkId }).catch(() => {});
      setPhase(
        out.kind === 'cancelled'
          ? { kind: 'idle' }
          : { kind: 'error', message: 'Storage turned the test upload away, so this says nothing about the venue. Try again.' },
      );
      return;
    }

    setPhase({ kind: 'saving' });
    try {
      const saved = await venueCheck({
        op: 'finish',
        eventId,
        checkId,
        samples: out.samples,
        delayMs: out.delayMs,
        placeName: place,
      });
      if (!saved.ok || saved.judgement.verdict === null) {
        setPhase({ kind: 'error', message: saved.ok ? 'Nothing reached Setnayan from here. Try again.' : saved.error });
        return;
      }
      const judgement = saved.judgement as JudgedVenue;
      const placeName = place.trim() || null;
      setLastSeen({ state: 'found', finishedAt: saved.checkedAt, verdict: judgement.verdict, placeName });
      setPhase({ kind: 'result', judgement, delayMs: out.delayMs, checkedAt: saved.checkedAt, placeName });
    } catch {
      void venueCheck({ op: 'discard', eventId, checkId }).catch(() => {});
      setPhase({ kind: 'error', message: 'We measured the venue but couldn’t save the result. Check the connection, then try again.' });
    }
  }

  function stop() {
    const r = run.current;
    if (!r) return;
    run.current = null;
    r.probe.cancel();
    void venueCheck({ op: 'discard', eventId, checkId: r.checkId }).catch(() => {});
    setPhase({ kind: 'idle' });
  }

  if (phase.kind === 'starting' || phase.kind === 'running' || phase.kind === 'saving') {
    return (
      <VenueCheckBusy
        saving={phase.kind === 'saving'}
        progress={phase.kind === 'running' ? phase.progress : phase.kind === 'saving' ? 1 : 0}
        liveBps={phase.kind === 'running' ? phase.liveBps : null}
        onStop={phase.kind === 'running' ? stop : null}
      />
    );
  }
  if (phase.kind === 'result') {
    return (
      <VenueCheckDone
        judgement={phase.judgement}
        delayMs={phase.delayMs}
        checkedAt={phase.checkedAt}
        placeName={phase.placeName}
        setupHref={setupHref}
        onAgain={() => setPhase({ kind: 'idle' })}
      />
    );
  }
  return (
    <VenueCheckReady
      place={place}
      onPlace={setPlace}
      error={phase.kind === 'error' ? phase.message : null}
      onStart={() => void start()}
      last={lastSeen}
    />
  );
}

/** Before a run: what it does, what it costs, where you are, Start — and the last result. */
export function VenueCheckReady({
  place,
  onPlace,
  error,
  onStart,
  last,
}: {
  place: string;
  onPlace: (text: string) => void;
  error: string | null;
  onStart: () => void;
  last: VenueCheckStatusProps;
}) {
  return (
    <section className="border-t border-ink/10 space-y-5 py-5 sm:p-6">
      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
          <Wifi aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Check the venue connection
        </h2>
        <p className="text-sm text-ink/70">
          Do this at the venue, where the stream will go out from, on the Wi-Fi or mobile data you&rsquo;ll use on the
          day.
        </p>
      </div>
      <ul className="space-y-1.5 text-sm text-ink/75">
        <li>Takes about {Math.round(PROBE_RUN_MS / 1_000)} seconds</li>
        <li>Uses up to {formatMegabytes(PROBE_MAX_BYTES)} of data</li>
        <li>The stream needs {formatMbps(STREAM_FULL_BPS)} of steady upload</li>
      </ul>
      <FormRows width="wide">
        <TypedRow
          name="Where are you?"
          about={{ words: 'Optional. Saved with the result, so your coordinator knows which spot was checked.' }}
          value={place}
          empty="Add"
          placeholder="e.g. Main hall, by the stage"
          maxLength={PLACE_NAME_MAX}
          onType={onPlace}
          onKeep={(t) => {
            onPlace(t.trim());
            return { ok: true as const };
          }}
          data="venue-check-place"
        />
      </FormRows>
      {error ? (
        <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-900">
          {error}
        </p>
      ) : null}
      <ActionButton
        tone="brand"
        main
        icon={<Play {...ICON} />}
        label={error ? 'Try again' : 'Start the check'}
        onClick={onStart}
        data-testid="venue-check-start"
      />
      <div className="border-t border-ink/10 pt-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-ink/70">Last check</p>
        <VenueCheckStatus {...last} />
      </div>
    </section>
  );
}

/** During a run: a progress bar on the run's own clock, the speed right now, Stop. */
export function VenueCheckBusy({
  saving,
  progress,
  liveBps,
  onStop,
}: {
  saving: boolean;
  progress: number;
  liveBps: number | null;
  onStop: (() => void) | null;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <section aria-live="polite" className="border-t border-ink/10 space-y-5 py-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
          <Gauge aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          {saving ? 'Saving the result…' : 'Checking…'}
        </h2>
        <p className="text-sm text-ink/70">Keep this screen open and the phone where it is.</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Check progress"
        className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
      >
        <div className="h-full rounded-full bg-terracotta transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-ink/70">
        Upload right now: <span className="font-semibold text-ink">{liveBps !== null ? formatMbps(liveBps) : '—'}</span>
      </p>
      {onStop ? <ActionButton tone="neutral" icon={<Square {...ICON} />} label="Stop" onClick={onStop} /> : null}
    </section>
  );
}

/** After a run: the colour, one plain sentence, the four numbers, and the way back. */
export function VenueCheckDone({
  judgement,
  delayMs,
  checkedAt,
  placeName,
  setupHref,
  onAgain,
}: {
  judgement: JudgedVenue;
  delayMs: number | null;
  checkedAt: string;
  placeName: string | null;
  setupHref: string;
  onAgain: () => void;
}) {
  const tone = VERDICT_WORDS[judgement.verdict].tone;
  return (
    <section aria-live="polite" className="space-y-5">
      <div className={`space-y-3 rounded-2xl p-5 ${VERDICT_WASH[tone]}`}>
        <p className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
          <span aria-hidden className={`inline-block h-3 w-3 rounded-full ${TONE_DOT[tone]}`} />
          {verdictHeadline(judgement.verdict)}
        </p>
        <p className="text-base text-ink/85">{verdictLine(judgement)}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Fact label="Upload" value={formatMbps(judgement.averageBps)} />
        <Fact label="Slowest second" value={formatMbps(judgement.slowestBps)} />
        <Fact label="Delay" value={delayMs === null ? '—' : `${Math.round(delayMs)} ms`} />
        <Fact label="Stream needs" value={formatMbps(STREAM_FULL_BPS)} />
      </dl>
      <p className="text-sm text-ink/70">
        {checkedOnLine({ finishedAt: checkedAt, placeName, verdict: judgement.verdict })}. Saved to Live Watch setup.
      </p>
      <div className="flex flex-wrap gap-3">
        <ActionButton tone="brand" main icon={<ArrowLeft {...ICON} />} label="Back to setup" href={setupHref} />
        <ActionButton tone="neutral" icon={<RotateCcw {...ICON} />} label="Check again" onClick={onAgain} />
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink/5 p-3">
      <dt className="text-xs text-ink/70">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tracking-tight text-ink">{value}</dd>
    </div>
  );
}
