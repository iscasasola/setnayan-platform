'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  previewGiftForTotal,
  giftQuoteCopy,
  type GiftQuoteBasis,
} from '@/lib/setnayan-gift';
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
  giftBasis = null,
}: {
  threadId: string;
  templates: Option[];
  packages: Option[];
  /**
   * The Setnayan gift's basis, or null when this quote carries no gift.
   *
   * 🔑 THIS CARD GETS IT TOO, AND THAT IS THE POINT. Every shortcut in the app
   * — the clients action bar, the chat info rail — deep-links to
   * `#send-proposal`, i.e. HERE; `#build-quote` (the fuller ProposalMaker) has
   * no inbound link anywhere in the repo. A gift line mounted only there would
   * be invisible to any supplier who followed a Quote button, which is all of
   * them. Same derived number, same two voices.
   */
  giftBasis?: GiftQuoteBasis | null;
}) {
  const [open, setOpen] = useState(false);
  // Controlled so the gift can be re-priced as they type. The field still posts
  // `total_php` exactly as before.
  const [totalPhp, setTotalPhp] = useState('');
  const gift = previewGiftForTotal(Math.round((Number(totalPhp) || 0) * 100), giftBasis);
  const giftCopy = giftQuoteCopy(gift, 'supplier');

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
    'h-10 w-full rounded-lg border border-ink/15 bg-white/70 px-3 text-sm text-ink focus:border-mulberry focus:outline-none';

  return (
    <div className="rounded-xl border border-mulberry/25 bg-mulberry/[0.04] p-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-mulberry/30 bg-white/70 px-4 text-sm font-medium text-mulberry hover:border-mulberry/60"
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
                value={totalPhp}
                onChange={(e) => setTotalPhp(e.target.value)}
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

          {/* THE SETNAYAN GIFT — what the couple gets AND what it costs the
              supplier, re-priced as they type (owner 2026-09-15: "show both").
              Renders only when this booking will really be billed for it. */}
          {giftCopy ? (
            <div
              data-testid="compose-setnayan-gift"
              className="rounded-lg border border-mulberry-600/25 bg-mulberry-600/5 px-3 py-2.5"
            >
              <p className="text-sm font-semibold text-mulberry-600">{giftCopy.headline}</p>
              <p className="mt-0.5 text-xs text-ink/60">{giftCopy.detail}</p>
            </div>
          ) : null}

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
