'use client';

// One-tap "request proposal changes" suggestion (negotiation Phase 3). Under the
// sender's own message, when the reader flags a discount/inclusion (proposal/
// money intent), offer to open the bundle builder — prefilled with the detected
// line — to send a multi-item amendment. Supersedes the P2 single-item chip for
// creating new proposal changes; existing change-order cards still resolve.

import { useState } from 'react';
import { detectNegotiation } from '@/lib/chat-negotiation-detect';
import { createAmendmentFromChat } from './negotiation-actions';
import { AmendmentBuilder, type AmendmentBuilderRow } from './amendment-builder';

function numFromExcerpt(excerpt: string | undefined): string {
  if (!excerpt) return '';
  const m = excerpt.replace(/,/g, '').match(/\d+/);
  return m ? m[0] : '';
}

export function AmendmentSuggestChip({
  threadId,
  returnPath,
  body,
}: {
  threadId: string;
  returnPath: string;
  body: string;
}) {
  const signals = detectNegotiation(body).signals;
  const discount = signals.find((s) => s.type === 'discount');
  const inclusion = signals.find((s) => s.type === 'inclusion');
  const [open, setOpen] = useState(false);

  if (!discount && !inclusion) return null;

  const initial: AmendmentBuilderRow[] = [];
  if (discount) initial.push({ kind: 'discount', label: 'Discount', amount: numFromExcerpt(discount.excerpt) });
  if (inclusion) initial.push({ kind: 'addon', label: inclusion.excerpt ?? 'Add-on', amount: '' });
  if (initial.length === 0) initial.push({ kind: 'discount', label: '', amount: '' });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-mulberry/30 bg-mulberry/[0.06] px-3 py-1 text-xs font-medium text-mulberry hover:bg-mulberry/10"
      >
        🧾 Request proposal changes
      </button>
    );
  }

  return (
    <div className="w-full max-w-[80%]">
      <AmendmentBuilder
        action={createAmendmentFromChat}
        threadId={threadId}
        returnPath={returnPath}
        submitLabel="Send request"
        initial={initial}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
