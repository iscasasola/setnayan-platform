'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { postManpowerGig } from '@/app/vendor-dashboard/manpower/actions';
import { SubmitButton } from '@/app/_components/submit-button';

/**
 * V2 Phase F · Post-gig drawer (host-side).
 *
 * Inline drawer (not a portal modal) for simplicity — opens/closes via
 * local state. Form posts to the server action `postManpowerGig` which
 * INSERTs and redirects back to the host manpower page with ?posted=1.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] brand-voice copy ·
 * editorial register · no engineering jargon. The default cash amount
 * is ₱15,000 (matches Phase F lock) but the host can adjust per gig.
 */
export function PostGigDrawer({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="m-btn inline-flex items-center gap-2"
          style={{
            background: 'var(--m-orange)',
            color: 'white',
            padding: '10px 18px',
            borderRadius: 'var(--m-r-md)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Post a manpower gig
        </button>
      ) : (
        <div
          className="rounded-lg border border-slate-200 bg-white p-5"
          style={{ boxShadow: 'var(--m-shadow-md)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className="m-eyebrow uppercase text-slate-500"
                style={{ letterSpacing: '0.2em', fontSize: '11px' }}
              >
                Post a gig
              </p>
              <h3 className="m-display-tight mt-1 text-lg">
                Day-of crew · paid direct
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <form action={postManpowerGig} className="mt-4 space-y-4">
            <input type="hidden" name="event_id" value={eventId} />

            <label className="block">
              <span
                className="m-label-mono mb-1 block uppercase text-slate-500"
                style={{ letterSpacing: '0.2em', fontSize: '11px' }}
              >
                Gig label
              </span>
              <input
                type="text"
                name="gig_label"
                placeholder="8-person setup crew · 6 AM call"
                minLength={4}
                maxLength={200}
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              />
              <span className="mt-1 block text-xs text-slate-500">
                A short headline vendors will see on the gig board.
              </span>
            </label>

            <label className="block">
              <span
                className="m-label-mono mb-1 block uppercase text-slate-500"
                style={{ letterSpacing: '0.2em', fontSize: '11px' }}
              >
                Cash amount (₱)
              </span>
              <input
                type="number"
                name="cash_amount_php"
                defaultValue={15000}
                min={0}
                step={100}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              />
              <span className="mt-1 block text-xs text-slate-500">
                You pay this directly to the crew on the day. Setnayan never
                touches the money.
              </span>
            </label>

            <label className="block">
              <span
                className="m-label-mono mb-1 block uppercase text-slate-500"
                style={{ letterSpacing: '0.2em', fontSize: '11px' }}
              >
                Notes (optional)
              </span>
              <textarea
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder="Venue, call time, parking, what to bring..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <SubmitButton
                pendingLabel="Posting…"
                className="m-btn inline-flex items-center gap-1.5"
                style={{
                  background: 'var(--m-orange)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: 'var(--m-r-md)',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Post gig
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
