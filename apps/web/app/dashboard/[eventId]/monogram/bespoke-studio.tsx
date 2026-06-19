'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Flag, Sparkles, Undo2, Wand2 } from 'lucide-react';
import {
  BESPOKE_STYLES,
  type BespokeStyleKey,
} from '@/lib/bespoke-monogram-shared';
import {
  generateBespokeAction,
  applyBespokeAction,
  clearBespokeAction,
  reportBespokeAction,
} from './bespoke-actions';

/**
 * BespokeStudio — the "Setnayan AI" bespoke monogram studio inside the
 * Monogram Maker (Phase 2 of the 2026-06-11 monogram overhaul; revives
 * iteration 0037 on a native-vector pipeline).
 *
 * Brief (style direction + optional motif) → one round of 4 candidate marks
 * → refine with feedback (new round) → apply one as the event monogram
 * (events.monogram_custom_svg → the landing hero renders it; QR + chrome
 * stay typographic for small-size legibility).
 *
 * Candidates arrive as data URIs (sanitized server-side, inert <img>
 * rendering). Generation runs ~10–30s — the submit button carries a living
 * pending state. Round cap + remaining count shown honestly.
 *
 * BRANDING: "Setnayan AI" only — the underlying vendor is never named.
 */

export type BespokeCandidateView = {
  generationId: string;
  dataUri: string;
};

function GenerateButton({ disabled, refining }: { disabled: boolean; refining: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Wand2 aria-hidden className="h-4 w-4" strokeWidth={2} />
      {pending
        ? 'Setnayan AI is sketching…'
        : refining
          ? 'Generate a new round'
          : 'Generate 4 designs'}
    </button>
  );
}

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-mulberry px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-mulberry-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Applying…' : 'Use this monogram'}
    </button>
  );
}

// Report-an-AI-result path (Google Play GenAI policy — in-app flagging of
// offensive AI output). Reasons are the user_reports enum subset that applies
// to a generated mark; labels mirror the /admin/user-reports queue.
const REPORT_REASONS = [
  { value: 'nudity_sexual', label: 'Nudity / sexual' },
  { value: 'violence', label: 'Violence' },
  { value: 'hate_harassment', label: 'Hate / harassment' },
  { value: 'other', label: 'Other' },
] as const;

function ReportSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-md bg-ink/80 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send report'}
    </button>
  );
}

/** Tiny per-mark report affordance: link → inline reason picker → server action. */
function ReportMark({
  eventId,
  generationId,
  open,
  onToggle,
}: {
  eventId: string;
  generationId: string;
  open: boolean;
  onToggle: (generationId: string | null) => void;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onToggle(generationId)}
        className="inline-flex items-center justify-center gap-1 text-[11px] font-medium text-ink/40 transition-colors hover:text-ink/70"
      >
        <Flag aria-hidden className="h-3 w-3" strokeWidth={2} />
        Report this result
      </button>
    );
  }
  return (
    <form action={reportBespokeAction} className="space-y-1.5">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="generation_id" value={generationId} />
      <label htmlFor={`report-reason-${generationId}`} className="sr-only">
        Why are you reporting this design?
      </label>
      <select
        id={`report-reason-${generationId}`}
        name="reason"
        defaultValue="other"
        className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs text-ink focus:border-mulberry focus:outline-none focus:ring-1 focus:ring-mulberry"
      >
        {REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <input
        name="details"
        maxLength={500}
        placeholder="Anything else? (optional)"
        className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs text-ink focus:border-mulberry focus:outline-none focus:ring-1 focus:ring-mulberry"
      />
      <ReportSubmitButton />
      <button
        type="button"
        onClick={() => onToggle(null)}
        className="inline-flex w-full items-center justify-center text-[11px] font-medium text-ink/45 transition-colors hover:text-ink/70"
      >
        Cancel
      </button>
    </form>
  );
}

export function BespokeStudio({
  eventId,
  defaultInitials,
  roundsUsed,
  maxRounds,
  candidates,
  activeGenerationId,
  hasCustom,
  enabled,
  notice,
}: {
  eventId: string;
  defaultInitials: string;
  roundsUsed: number;
  maxRounds: number;
  candidates: BespokeCandidateView[];
  activeGenerationId: string | null;
  hasCustom: boolean;
  enabled: boolean;
  /** Pre-resolved status line from the page (?bespoke / ?bespoke_error). */
  notice: { tone: 'ok' | 'error'; text: string } | null;
}) {
  const [styleKey, setStyleKey] = useState<BespokeStyleKey>('crest');
  // Which mark's report form is open (one at a time keeps the tiles calm).
  const [reportingId, setReportingId] = useState<string | null>(null);
  const roundsLeft = Math.max(0, maxRounds - roundsUsed);
  const capped = roundsLeft === 0;
  const refining = roundsUsed > 0;

  return (
    <section
      id="bespoke-studio"
      className="scroll-mt-6 rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8"
    >
      <header className="space-y-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Setnayan AI · Bespoke studio
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          A monogram no one else has
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Tell Setnayan AI your direction and it designs interlocked, wreathed,
          crested, or geometric marks around your initials — yours to refine
          until it feels right.
        </p>
      </header>

      {notice ? (
        <p
          className={`mt-4 rounded-lg px-4 py-2.5 text-sm font-medium ${
            notice.tone === 'ok'
              ? 'bg-success-50 text-success-800'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {hasCustom ? (
        <div className="mt-4 space-y-2 rounded-xl border border-success-300/60 bg-success-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-success-800">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
              Your bespoke monogram is live on your wedding website.
            </p>
            <form action={clearBespokeAction}>
              <input type="hidden" name="event_id" value={eventId} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
              >
                <Undo2 aria-hidden className="h-3 w-3" strokeWidth={2} />
                Switch back to lettering
              </button>
            </form>
          </div>
          <p className="text-xs text-success-800/80">
            Your QR codes and dashboard keep your lettered monogram so your
            initials stay crisp at small sizes.
          </p>
        </div>
      ) : null}

      {!enabled ? (
        <p className="mt-4 rounded-lg bg-ink/5 px-4 py-3 text-sm text-ink/60">
          The bespoke studio isn&rsquo;t available on this deployment yet —
          your curated lockups above work as always.
        </p>
      ) : (
        <>
          {/* ── Brief ── */}
          <form action={generateBespokeAction} className="mt-5 space-y-4">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="initials" value={defaultInitials} />
            <input type="hidden" name="style_key" value={styleKey} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BESPOKE_STYLES.map((s) => {
                const selected = s.key === styleKey;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStyleKey(s.key)}
                    aria-pressed={selected}
                    className={`relative flex flex-col items-start gap-1 rounded-xl border bg-white p-3 text-left transition-colors ${
                      selected
                        ? 'border-mulberry ring-2 ring-mulberry/15'
                        : 'border-ink/10 hover:border-ink/25'
                    }`}
                  >
                    {selected ? (
                      <Check
                        aria-hidden
                        className="absolute right-2 top-2 h-3.5 w-3.5 text-mulberry"
                        strokeWidth={2.5}
                      />
                    ) : null}
                    <span className="text-sm font-semibold text-ink">{s.label}</span>
                    <span className="text-xs leading-snug text-ink/55">{s.hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="bespoke-motif" className="block text-sm font-semibold text-ink">
                  A touch of your story{' '}
                  <span className="font-normal text-ink/45">(optional)</span>
                </label>
                <input
                  id="bespoke-motif"
                  name="motif"
                  maxLength={120}
                  placeholder="sampaguita, mountains, our beagle…"
                  className="w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-mulberry focus:outline-none focus:ring-1 focus:ring-mulberry"
                />
              </div>
              {refining ? (
                <div className="space-y-1.5">
                  <label htmlFor="bespoke-feedback" className="block text-sm font-semibold text-ink">
                    What should change?{' '}
                    <span className="font-normal text-ink/45">(optional)</span>
                  </label>
                  <input
                    id="bespoke-feedback"
                    name="feedback"
                    maxLength={200}
                    placeholder="thinner lines, more negative space…"
                    className="w-full rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-mulberry focus:outline-none focus:ring-1 focus:ring-mulberry"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <GenerateButton disabled={capped} refining={refining} />
              <p className="text-xs text-ink/55">
                {capped
                  ? 'You’ve used all your design rounds for this event.'
                  : `${roundsLeft} of ${maxRounds} design rounds left · each round sketches 4 marks (~30s).`}
              </p>
            </div>
          </form>

          {/* ── Candidates ── */}
          {candidates.length > 0 ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-semibold text-ink">Latest designs</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {candidates.map((c) => {
                  const isActive = c.generationId === activeGenerationId;
                  return (
                    <div
                      key={c.generationId}
                      className={`flex flex-col gap-2 rounded-xl border bg-white p-3 ${
                        isActive ? 'border-mulberry ring-2 ring-mulberry/15' : 'border-ink/10'
                      }`}
                    >
                      <span className="relative mx-auto flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-cream">
                        {/* eslint-disable-next-line @next/next/no-img-element -- inert
                            data-URI of the server-sanitized mark */}
                        <img
                          src={c.dataUri}
                          alt="Bespoke monogram design by Setnayan AI"
                          style={{ width: '88%', height: '88%', objectFit: 'contain' }}
                        />
                        {isActive ? (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-mulberry p-1">
                            <Check aria-hidden className="h-3 w-3 text-cream" strokeWidth={3} />
                          </span>
                        ) : null}
                      </span>
                      {isActive ? (
                        <p className="text-center text-xs font-medium text-mulberry">
                          On your website now
                        </p>
                      ) : (
                        <form action={applyBespokeAction}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="generation_id" value={c.generationId} />
                          <ApplyButton />
                        </form>
                      )}
                      <ReportMark
                        eventId={eventId}
                        generationId={c.generationId}
                        open={reportingId === c.generationId}
                        onToggle={setReportingId}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-ink/55">
                Not quite right? Adjust the direction or add what should change,
                then generate a new round.
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
