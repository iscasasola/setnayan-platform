'use client';

import { useState, useTransition } from 'react';
import { Flag, X, Check } from 'lucide-react';
import { fileReport } from '@/lib/reports';

/**
 * ReportPageButton — the reusable "Report this page" entry for PUBLIC pages.
 * Files a report of a given target_type/target_id into the single existing
 * moderation queue (public.user_reports → /admin/user-reports) via the shared
 * server action (lib/reports.ts). Shared by the invitation page /[slug]
 * (target_type='event') and, forward-compat, the public profile /u/[slug]
 * (target_type='user_profile').
 *
 * Deliberately DISCREET — a small ghost link that opens a compact reason picker
 * on tap. It's chrome, never part of the couple's sacred aesthetic. Works for a
 * signed-out visitor (the write path runs server-side; see lib/reports.ts).
 */

const REASONS: { value: string; label: string }[] = [
  { value: 'nudity_sexual', label: 'Nudity or sexual content' },
  { value: 'hate_harassment', label: 'Hate or harassment' },
  { value: 'violence', label: 'Violence' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'not_my_event', label: 'Impersonation / not who it claims' },
  { value: 'other', label: 'Something else' },
];

export function ReportPageButton({
  targetType,
  targetId,
  label = 'Report this page',
  className,
}: {
  targetType: 'event' | 'user_profile';
  targetId: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!reason) {
      setError('Pick a reason.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fileReport({ targetType, targetId, reason, details });
      if (res.ok) {
        setDone(true);
      } else {
        setError("That didn't go through. Please try again.");
      }
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink/45 underline-offset-2 hover:text-ink/70 hover:underline"
      >
        <Flag aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report this page"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/60 bg-cream p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Flag aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
                Report this page
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-full p-1 text-ink/50 hover:bg-ink/[0.06] hover:text-ink/80 disabled:opacity-50"
                aria-label="Close"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {done ? (
              <div className="space-y-2 py-2 text-sm text-ink/75">
                <p className="inline-flex items-center gap-1.5 font-medium text-success-700">
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Thank you — reported.
                </p>
                <p className="text-ink/60">
                  Our team reviews every report. You can close this now.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-2 w-full rounded-md bg-ink px-3 py-2 text-xs font-medium text-cream hover:bg-ink/90"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-ink/60">
                  Tell us what&rsquo;s wrong with this page. Reports are private
                  and go straight to the Setnayan team.
                </p>
                <fieldset className="space-y-1.5">
                  <legend className="sr-only">Reason</legend>
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-white/60 bg-white/60 px-3 py-2 text-sm text-ink/80 hover:bg-white/80 has-[:checked]:border-terracotta/40 has-[:checked]:bg-terracotta/5"
                    >
                      <input
                        type="radio"
                        name="report_reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-terracotta"
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Add any detail (optional)"
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-md border border-white/60 bg-white/70 px-3 py-2 text-sm text-ink/80 placeholder:text-ink/40 focus:border-terracotta/40 focus:outline-none"
                />
                {error && <p className="text-xs font-medium text-terracotta-700">{error}</p>}
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  className="w-full rounded-md bg-terracotta px-3 py-2 text-xs font-semibold text-cream hover:bg-terracotta-700 disabled:opacity-60"
                >
                  {pending ? 'Sending…' : 'Submit report'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
