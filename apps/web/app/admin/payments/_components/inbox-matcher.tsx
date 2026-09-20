'use client';

import { useMemo, useState } from 'react';
import { ClipboardPaste, CornerDownRight, X } from 'lucide-react';
import { referencesAgree, scanPaymentProof } from '@/lib/payment-proof-scan';
import { formatPhp } from '@/lib/orders';
import { haystackCarriesAmount } from '@/lib/payment-amount-forms';

/**
 * InboxMatcher — paste-and-match reconciliation helper (Wave 7 · 2-step program).
 *
 * The manual reconciliation chore (iteration 0034) is: a GCash / BDO push
 * notification lands in the Setnayan inbox, and the admin has to eyeball the
 * pending-payment queue to find which order it belongs to. That's the 5-difficulty
 * step. This collapses it: paste the notification text and the matcher finds the
 * pending payment it belongs to.
 *
 * THREE tiers, strongest first (the top one added 2026-07-31):
 *   1. WALLET — the reference the couple submitted at checkout agrees with one
 *      in the text the admin just copied out of their own bank/GCash app. Two
 *      independent sources; this is the strongest signal obtainable without a
 *      bank feed, and none exists on a personal account.
 *   2. REFERENCE — Setnayan's own order code appears in the transfer note.
 *      Still valid for MANUAL transfers, but a scanned-QR payment carries no
 *      note we can see and the code cannot ride inside the QR (GCash rejects
 *      the EMVCo tag 62 template), so this fires far less than when written.
 *   3. AMOUNT — weakest. Two couples paying the same SKU the same day are
 *      indistinguishable here.
 *
 * It takes NO action — it only finds the row and offers a jump link. The admin
 * still approves manually through the existing approve guard, and nothing here
 * is evidence: a self-reported reference agreeing with the bank app is strong
 * corroboration, not proof of receipt. (The persisted `payment_inbox_messages`
 * table + the server-side SQL `match_inbox_to_order` matcher remain unbuilt.)
 */

export type MatcherPayment = {
  payment_id: string;
  /** order.reference_code — the exact-match token ('SN' + 8 uppercase hex). */
  reference_code: string | null;
  /** payments.reference_number — the WALLET reference the couple submitted. */
  reference_number: string | null;
  amount_php: number;
  /** Human label for the row — couple email, else order public id. */
  label: string;
  orderPublicId: string | null;
};

type Match = {
  payment: MatcherPayment;
  /** 'wallet' = the couple's reference agrees with the admin's bank app. */
  tier: 'wallet' | 'reference' | 'amount';
};

/**
 * ⛔ A PRIVATE PESO FORMATTER USED TO LIVE HERE — a THIRD rendering of one
 * amount. With `minimumFractionDigits: 0, maximumFractionDigits: 2` it printed
 * ₱837.5 for the same charge the fee page printed as ₱838 and the `/pay` QR
 * carried as 837.50: three screens, three spellings, one number. The desk
 * matches these figures against a bank message by eye, so the spelling IS the
 * work. Now it is the shared `formatPhp` — see `lib/orders.ts`.
 */

function matchPayments(text: string, payments: MatcherPayment[]): Match[] {
  const trimmed = text.trim();
  if (trimmed.length < 4) return [];

  const lower = trimmed.toLowerCase();
  // Comma-stripped copy so "3,999" in the notification matches a bare "3999"
  // amount (and vice-versa).
  const noCommas = lower.replace(/,/g, '');

  // Every reference-shaped token in the pasted notification, tagged by kind.
  const foundRefs = scanPaymentProof(trimmed).references;

  const wallet: Match[] = [];
  const reference: Match[] = [];
  const amount: Match[] = [];

  for (const p of payments) {
    // (1) STRONGEST — the couple's wallet reference agrees with one the admin
    // just copied out of their bank app. Two independent sources.
    const submitted = p.reference_number?.trim();
    if (submitted && foundRefs.some((r) => referencesAgree(submitted, r.value))) {
      wallet.push({ payment: p, tier: 'wallet' });
      continue;
    }
    // (2) Setnayan's own order code appearing in the transfer note. Still
    // works for MANUAL transfers, where the payer can type a note — but a
    // scanned QR payment carries no note we can see, and the code cannot ride
    // inside the QR (GCash rejects the EMVCo tag 62 template), so this tier
    // now fires far less often than when it was written.
    const code = p.reference_code?.trim().toLowerCase();
    if (code && code.length >= 4 && lower.includes(code)) {
      reference.push({ payment: p, tier: 'reference' });
      continue;
    }
    // (3) Amount fallback: bare OR centavo form against the comma-stripped
    // haystack. Weakest — two couples paying the same SKU on the same day are
    // indistinguishable here.
    //
    // 🔴 THIS COMPARED A ROUNDED NUMBER, AND ROUNDING A KEY INVENTS MATCHES.
    // It was `String(Math.round(p.amount_php))`, so the pending ₱837.50 booking
    // fee looked for the literal "838" — a figure that exists nowhere: not in
    // `payments.amount_php`, not in the order, not in any bank message about
    // THIS transfer. What it does find is a bank message about somebody else's
    // ₱838 payment, which the desk is then offered as a match, on money.
    // 🔑 A display that rounds is a lie the reader can see. A COMPARISON that
    // rounds is a lie that picks the wrong row and looks like a hit.
    //
    // The forms now come off the exact string, so each is a TRUNCATION of the
    // real digits rather than an invented neighbour: 3999.00 → "3999" (still
    // matching a note that writes "3,999" with no decimals, which is the whole
    // reason that form exists) and 837.50 → "837.50", which is already exact.
    // The rounded variant is deleted, not left unused.
    //
    // 🔑 THE RULE LIVES IN A PURE SIBLING SO A GUARD CAN RUN IT. This file is
    // `'use client'`; a test that could only grep it would pass while the rule
    // did nothing. See `lib/payment-amount-forms.ts`.
    if (haystackCarriesAmount(noCommas, p.amount_php)) {
      amount.push({ payment: p, tier: 'amount' });
    }
  }

  // Strongest first.
  return [...wallet, ...reference, ...amount];
}

export function InboxMatcher({ payments }: { payments: MatcherPayment[] }) {
  const [text, setText] = useState('');
  const matches = useMemo(() => matchPayments(text, payments), [text, payments]);

  const hasInput = text.trim().length >= 4;
  // Wallet and reference hits are both DECISIVE-strength; amount-only is not.
  const strongHits = matches.filter((m) => m.tier !== 'amount').length;

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
        placeholder="Paste from your GCash / BDO app — e.g. Received from Other Bank + PHP 2,999.43 · Reference number GXCHPHM2XXXB000000006991560"
        rows={2}
        className="input-field mt-3 min-h-[60px] py-2 text-sm"
        aria-label="Paste a bank or GCash notification"
      />

      {hasInput ? (
        matches.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-ink/70">
              {strongHits > 0
                ? `${strongHits} reference match${strongHits > 1 ? 'es' : ''}`
                : 'No reference match — possible amount-only match, verify it yourself'}
              {matches.length > strongHits
                ? ` · ${matches.length - strongHits} amount-only`
                : ''}
            </p>
            <ul className="space-y-1.5">
              {matches.map((m) => (
                <li key={m.payment.payment_id}>
                  <a
                    href={`#payment-${m.payment.payment_id}`}
                    className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2 text-sm hover:bg-cream ${
                      m.tier !== 'amount'
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
                        m.tier !== 'amount'
                          ? 'bg-success-100 text-success-800'
                          : 'bg-warn-100 text-warn-900'
                      }`}
                    >
                      {m.tier === 'wallet'
                        ? 'Their ref matches'
                        : m.tier === 'reference'
                          ? 'Order code match'
                          : 'Amount only'}
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
