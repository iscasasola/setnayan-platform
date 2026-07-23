'use client';

/**
 * Guest Columns — the submit/edit form (client half of guest-column-card).
 *
 * States (owner rules, studies doc § 1):
 *   · compose            — no column yet (or withdrawn): title + body + the
 *                          RA 10173 consent tick. No tick, no send.
 *   · pending            — submitted, awaiting the couple; Edit + Withdraw.
 *   · declined (rejected)— returned by the couple with an optional note;
 *                          edit + resubmit through the same form.
 *   · approved           — published; Withdraw only (edit-until-approved —
 *                          an approved column is out of the guest's hands).
 *   · closed             — the editorial lifecycle phase closed submissions
 *                          (server-enforced in the RPC; this mirrors it).
 *
 * POSTs to /api/guest-columns (cookie-validated → Tier-1 moderation → the
 * service-role guest_submit_column RPC). Withdraw DELETEs the same route.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PenLine, Trash2 } from 'lucide-react';
import {
  GUEST_COLUMN_BODY_MAX,
  GUEST_COLUMN_TITLE_MAX,
  type OwnGuestColumn,
} from '@/lib/guest-columns';

const FRIENDLY_ERRORS: Record<string, string> = {
  keep_it_sweet: 'Let’s keep it sweet — please rephrase and try again.',
  consent_required: 'Please tick the consent box so we can publish your words.',
  submissions_closed: 'Column submissions have closed for this event.',
  edit_limit: 'You’ve reached the edit limit for your column.',
  already_published: 'Your column is already published — withdraw it first to make changes.',
  messaging_disabled: 'Messaging is turned off for your invitation.',
  too_fast: 'One moment — you’re going a little fast. Try again shortly.',
  bad_title: 'Please give your column a short title (up to 60 characters).',
  bad_message: 'Please write something (up to 280 characters).',
};

export function GuestColumnForm({
  own,
  closed,
}: {
  own: OwnGuestColumn | null;
  closed: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(own?.title ?? '');
  const [body, setBody] = useState(own?.body ?? '');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showForm = !closed && (editing || own === null || own.status === 'rejected');

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/guest-columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, consent }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(FRIENDLY_ERRORS[data?.error ?? ''] ?? 'Something hiccuped — please try again.');
          return;
        }
        setEditing(false);
        setConsent(false);
        router.refresh();
      } catch {
        setError('Something hiccuped — please try again.');
      }
    });
  };

  const withdraw = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/guest-columns', { method: 'DELETE' });
        if (!res.ok) {
          setError('Something hiccuped — please try again.');
          return;
        }
        setEditing(false);
        setTitle('');
        setBody('');
        router.refresh();
      } catch {
        setError('Something hiccuped — please try again.');
      }
    });
  };

  if (closed && own === null) {
    return (
      <p className="rounded-lg border border-ink/10 bg-white/50 p-3 text-center text-sm text-ink/60">
        Column submissions have closed for this event.
      </p>
    );
  }

  return (
    <div className="text-left">
      {/* Status line for an existing column */}
      {own !== null && !showForm ? (
        <div className="rounded-xl border border-ink/10 bg-white/50 p-4">
          {own.status === 'approved' ? (
            <p className="text-sm font-medium text-ink">
              Your column is published in the paper. 🗞
            </p>
          ) : own.status === 'pending' ? (
            <p className="text-sm text-ink/70">
              Your column is with the couple for review.
            </p>
          ) : null}
          <p className="mt-2 font-display text-base font-medium italic text-ink">{own.title}</p>
          <p className="mt-1 text-sm text-ink/70">{own.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!closed && own.status === 'pending' ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-60"
              >
                <PenLine aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Edit
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={withdraw}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-xs text-ink/60 hover:bg-ink/5 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Withdraw
            </button>
          </div>
        </div>
      ) : null}

      {/* Declined note — the couple returned it */}
      {own?.status === 'rejected' && !closed ? (
        <div className="mb-3 rounded-lg border border-warn-200 bg-warn-50 p-3 text-sm text-warn-900">
          The couple returned your column{own.declineNote ? ':' : '.'}{' '}
          {own.declineNote ? <span className="italic">&ldquo;{own.declineNote}&rdquo;</span> : null}{' '}
          You can edit it and send it again.
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="gcol-title" className="block text-xs font-medium text-ink/70">
              Title
              <span className="ml-1.5 font-mono text-xs text-ink/40">
                {title.length}/{GUEST_COLUMN_TITLE_MAX}
              </span>
            </label>
            <input
              id="gcol-title"
              type="text"
              value={title}
              maxLength={GUEST_COLUMN_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A headline for your column"
              className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="gcol-body" className="block text-xs font-medium text-ink/70">
              Your column
              <span className="ml-1.5 font-mono text-xs text-ink/40">
                {body.length}/{GUEST_COLUMN_BODY_MAX}
              </span>
            </label>
            <textarea
              id="gcol-body"
              value={body}
              maxLength={GUEST_COLUMN_BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Your words for the couple’s paper…"
              className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
            />
          </div>
          {/* RA 10173 consent — required on every submit (the Kwento shape). */}
          <label className="flex items-start gap-2 text-xs text-ink/60">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-terracotta"
            />
            <span>
              I agree that my name and these words may be shown on this event&rsquo;s
              pages once the couple approves them (Data Privacy Act of 2012). You can
              withdraw your column at any time.
            </span>
          </label>
          {error ? <p className="text-xs text-terracotta">{error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || !consent || title.trim().length === 0 || body.trim().length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3.5 py-2 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <PenLine aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {own !== null && own.status !== 'rejected' ? 'Save changes' : own?.status === 'rejected' ? 'Send again' : 'Submit for review'}
            </button>
            {editing ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setTitle(own?.title ?? '');
                  setBody(own?.body ?? '');
                }}
                className="rounded-md px-2.5 py-2 text-xs text-ink/50 hover:text-ink/80"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {closed && own !== null ? (
        <p className="mt-3 text-xs text-ink/50">
          Column submissions have closed for this event
          {own.status === 'pending' ? ' — your column can still be approved by the couple.' : '.'}
        </p>
      ) : null}
    </div>
  );
}
