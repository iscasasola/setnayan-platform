'use client';

import { useState, useTransition } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { REVIEW_LINE_MAX, REVIEW_STAR_OPTIONS, reviewAskWords } from '@/lib/supplier-scan';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';

/**
 * ⭐ "HOW WAS THE PHOTO BOOTH?" — the guest's OPTIONAL review after a supplier's scanner marked their item received
 * (DECISION_LOG 2026-09-25 "…AN OPTIONAL REVIEW CAN POP UP ON THEIR EVENT HUB" — *"optional to respond"*). A quiet card
 * under "Your number": a rating dropdown (a set of choices is a dropdown — house rule), one optional line, Send — and
 * Not now, which is an answer too, so the card never asks twice. One per guest per service.
 *
 * Who is answering is the pass this phone holds (the server reads it), never anything this card sends. The supplier
 * never sees who wrote it; once Setnayan publishes it, the rating shows on the supplier's page under Guest ratings,
 * apart from couple reviews (owner 2026-11-05), never naming the guest.
 */
export function ScanReviewAsk({ eventId, coverageId, service, shop }: { eventId: string; coverageId: number; service: string; shop: string | null }) {
  const [stars, setStars] = useState<string | null>(null);
  const [line, setLine] = useState('');
  const [done, setDone] = useState<null | 'sent' | 'skipped'>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (skip: boolean) => {
    setError(null);
    start(async () => {
      try {
        const reply = await supplierScan({ op: 'guest_review', eventId, coverageId, stars: skip ? null : Number(stars), line: skip ? null : line });
        if (reply.op === 'guest_review' && reply.result.ok) setDone(skip ? 'skipped' : 'sent');
        else setError(reply.op === 'guest_review' && !reply.result.ok ? reply.result.error : 'Couldn’t send just now.');
      } catch {
        setError('No signal — nothing was sent. Try again when you’re back online.');
      }
    });
  };

  if (done === 'skipped') return null;
  if (done === 'sent') {
    return (
      <p role="status" className="text-center text-[13.5px] text-ink/65" data-scan-review="sent">
        Thank you — your rating was sent.
      </p>
    );
  }
  return (
    <section aria-label={reviewAskWords(service)} className="space-y-2 text-center" data-scan-review={coverageId}>
      <p className="text-[15px] font-medium text-ink">{reviewAskWords(service)}</p>
      {shop ? <p className="text-[12.5px] text-ink/55">{shop} won&rsquo;t see who wrote it.</p> : null}
      <div className="flex justify-center">
        <PickMenu label="Your rating" value={stars} options={REVIEW_STAR_OPTIONS} onPick={setStars} buttonText={stars ? undefined : 'Your rating'} dataAttr="data-scan-review-stars" />
      </div>
      {stars ? (
        // ✍ The one Field template (`TypedRow`): it posts nothing itself — what it holds rides along with Send, as typed.
        <FormRows width="wide">
          <TypedRow
            name="One line"
            value={line}
            empty="Optional"
            maxLength={REVIEW_LINE_MAX}
            onType={setLine}
            onKeep={(t) => setLine(t)}
            data="scan-review-line"
          />
        </FormRows>
      ) : null}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          disabled={pending || !stars}
          onClick={() => send(false)}
          className="sn-press min-h-11 rounded-full border border-ink/25 px-5 text-[15px] font-medium text-ink disabled:opacity-40"
        >
          Send
        </button>
        <button type="button" disabled={pending} onClick={() => send(true)} className="min-h-11 px-2 text-[14px] text-ink/60 underline underline-offset-4">
          Not now
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-[rgb(var(--color-warn))]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
