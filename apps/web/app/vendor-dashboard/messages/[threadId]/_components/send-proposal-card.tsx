'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { sendProposalFromChat } from '../proposal-actions';

type Option = { id: string; name: string };

/**
 * In-chat "Send a proposal" — the vendor-only composer affordance that creates
 * + sends a full structured proposal into the thread (see proposal-actions.ts).
 * Collapsed to a single button so it never crowds the conversation; expands to
 * the template/package/price form. If the vendor has no templates yet, we point
 * them to build one rather than show a dead form.
 */
export function SendProposalCard({
  threadId,
  templates,
  packages,
}: {
  threadId: string;
  templates: Option[];
  packages: Option[];
}) {
  const [open, setOpen] = useState(false);

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-mulberry/25 bg-mulberry/[0.04] p-3 text-sm text-ink/70">
        Want to send a priced proposal here?{' '}
        <Link href="/vendor-dashboard/proposals" className="font-medium text-mulberry underline hover:text-mulberry-600">
          Create a proposal template
        </Link>{' '}
        first — then it&rsquo;s one tap from any chat.
      </div>
    );
  }

  const field =
    'h-10 w-full rounded-lg border border-ink/15 bg-cream px-3 text-sm text-ink focus:border-mulberry focus:outline-none';

  return (
    <div className="rounded-xl border border-mulberry/25 bg-mulberry/[0.04] p-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-mulberry/30 bg-cream px-4 text-sm font-medium text-mulberry hover:border-mulberry/60"
        >
          <span aria-hidden>📄</span> Send a proposal
        </button>
      ) : (
        <form action={sendProposalFromChat} className="space-y-2.5">
          <p className="text-sm font-semibold text-ink">Send a proposal</p>
          <input type="hidden" name="thread_id" value={threadId} />

          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Template</span>
            <select name="template_id" required defaultValue="" className={field}>
              <option value="" disabled>
                Choose a template…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {packages.length > 0 ? (
            <label className="block space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Package (optional)
              </span>
              <select name="package_id" defaultValue="" className={field}>
                <option value="">No package — set a price below</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Price ₱</span>
              <input
                name="total_php"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="e.g. 45000"
                className={field}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Valid until (optional)
              </span>
              <input name="valid_until" type="date" className={field} />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Title (optional)</span>
            <input name="title" type="text" maxLength={160} placeholder="Auto-titled if blank" className={field} />
          </label>

          <p className="text-xs text-ink/55">
            The proposal appears in this chat. The couple reviews + accepts it — accepting just adds it to
            their plan, never a payment.
          </p>

          <div className="flex gap-2 pt-0.5">
            <SubmitButton
              pendingLabel="Sending…"
              className="inline-flex h-10 items-center rounded-lg bg-mulberry px-4 text-sm font-semibold text-cream hover:bg-mulberry-600"
            >
              Send proposal
            </SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center rounded-lg border border-ink/15 px-4 text-sm text-ink/70 hover:border-ink/40"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
