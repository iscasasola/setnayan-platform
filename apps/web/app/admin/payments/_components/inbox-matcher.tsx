'use client';

import { useMemo, useState } from 'react';
import { ClipboardPaste, CornerDownRight, X } from 'lucide-react';

/**
 * InboxMatcher — paste-and-match reconciliation helper (Wave 7 · 2-step program).
 *
 * The manual reconciliation chore (iteration 0034) is: a GCash / BDO push
 * notification lands in the Setnayan inbox, and the admin has to eyeball the
 * pending-payment queue to find which order it belongs to. That's the 5-difficulty
 * step. This collapses it: paste the notification text, and the matcher scans the
 * already-loaded pending payments for the one whose **reference code** appears in
 * the text (the exact-match signal couples are told to put in the transfer note),
 * falling back to an **amount-only** hint when no code is present.
 *
 * It takes NO action — it only finds the row and offers a jump link. The admin
 * still approves manually through the existing ConfirmForm guard. (The persisted
 * `payment_inbox_messages` table + the 4-tier SQL `match_inbox_to_order` matcher
 * are a later server-side layer; this is the zero-migration client slice.)
 */

export type MatcherPayment = {
  payment_id: string;
  /** order.reference_code — the exact-match token (8-char Crockford). */
  reference_code: string | null;
  amount_php: number;
  /** Human label for the row — couple email, else order public id. */
  label: string;
  orderPublicId: string | null;
};

type Match = {
  payment: MatcherPayment;
  tier: 'reference' | 'amount';
};

function formatPhp(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function matchPayments(text: string, payments: MatcherPayment[]): Match[] {
  const trimmed = text.trim();
  if (trimmed.length < 4) return [];

  const lower = trimmed.toLowerCase();
  // Comma-stripped copy so "3,999" in the notification matches a bare "3999"
  // amount (and vice-versa).
  const noCommas = lower.replace(/,/g, '');

  const reference: Match[] = [];
  const amount: Match[] = [];

  for (const p of payments) {
    const code = p.reference_code?.trim().toLowerCase();
    if (code && code.length >= 4 && lower.includes(code)) {
      reference.push({ payment: p, tier: 'reference' });
      continue; // a reference hit is decisive; don't also amount-match it
    }
    // Amount fallback: match the whole-peso form OR the centavo form against
    // the comma-stripped haystack.
    const whole = String(Math.round(p.amount_php));
    const fixed = p.amount_php.toFixed(2);
    if (whole.length >= 3 && (noCommas.includes(whole) || noCommas.includes(fixed))) {
      amount.push({ payment: p, tier: 'amount' });
    }
  }

  // Reference hits first (strongest), then amount-only hits.
  return [...reference, ...amount];
}

export function InboxMatcher({ payments }: { payments: MatcherPayment[] }) {
  const [text, setText] = useState('');
  const matches = useMemo(() => matchPayments(text, payments), [text, payments]);

  const hasInput = text.trim().length >= 4;
  const referenceHits = matches.filter((m) => m.tier === 'reference').length;

  return (
    <section className="mb-5 rounded-xl border border-mulberry/20 bg-mulberry/[0.03] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <ClipboardPaste aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
            Match a bank / GCash notification
          </h2>
          <p className="text-xs text-ink/60">
            Paste the SMS or app alert below — we&rsquo;ll find the pending payment whose reference
            code (or amount) it mentions, so you don&rsquo;t have to scan the list.
          </p>
        </div>
        {text ? (
          <button
            type="button"
            onClick={() => setText('')}
            aria-label="Clear pasted text"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink/55 hover:bg-ink/5"
          >
            <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Clear
          </button>
        ) : null}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. You have received PHP 3,999.00 from MARIA S. Ref: 7Q3KZ9PA. — GCash"
        rows={2}
        className="input-field mt-3 min-h-[60px] py-2 text-sm"
        aria-label="Paste a bank or GCash notification"
      />

      {hasInput ? (
        matches.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-ink/70">
              {referenceHits > 0
                ? `${referenceHits} reference match${referenceHits > 1 ? 'es' : ''}`
                : 'No reference match — possible amount-only match, verify the code'}
              {matches.length > referenceHits
                ? ` · ${matches.length - referenceHits} amount-only`
                : ''}
            </p>
            <ul className="space-y-1.5">
              {matches.map((m) => (
                <li key={m.payment.payment_id}>
                  <a
                    href={`#payment-${m.payment.payment_id}`}
                    className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2 text-sm hover:bg-cream ${
                      m.tier === 'reference'
                        ? 'border-success-300/70 bg-success-50'
                        : 'border-warn-300/70 bg-warn-50'
                    }`}
                  >
                    <CornerDownRight
                      aria-hidden
                      className="h-3.5 w-3.5 text-ink/45"
                      strokeWidth={1.75}
                    />
                    <span className="font-medium text-ink">{m.payment.label}</span>
                    {m.payment.reference_code ? (
                      <span className="font-mono text-xs text-terracotta-700">
                        ref {m.payment.reference_code}
                      </span>
                    ) : null}
                    <span className="font-mono text-xs text-ink/70">
                      {formatPhp(m.payment.amount_php)}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                        m.tier === 'reference'
                          ? 'bg-success-100 text-success-800'
                          : 'bg-warn-100 text-warn-900'
                      }`}
                    >
                      {m.tier === 'reference' ? 'Reference match' : 'Amount only'}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink/50">
              Tap a match to jump to its row, confirm the transfer in your inbox, then approve there.
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-ink/20 bg-cream px-3 py-2 text-xs text-ink/55">
            No pending payment mentions that reference code or amount. Check the &ldquo;All
            payments&rdquo; tab, or it may be a transfer with no matching order yet.
          </p>
        )
      ) : null}
    </section>
  );
}
