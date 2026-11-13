'use client';

import { useState, useTransition } from 'react';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { NOTICE_ACTION } from '@/app/_components/notices/notices';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { REVIEW_LINE_MAX, REVIEW_STAR_OPTIONS, reviewAskWords } from '@/lib/supplier-scan';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';

/**
 * ⭐ "HOW WAS THE PHOTO BOOTH?" — the guest's OPTIONAL review after a supplier's scanner marked their item received
 * (DECISION_LOG 2026-09-25 "…AN OPTIONAL REVIEW CAN POP UP ON THEIR EVENT HUB" — *"optional to respond"*). A quiet card
 * under "Your number": a rating dropdown (a set of choices is a dropdown — house rule), one optional line, "Shown as",
 * Send — and Not now, so the card never asks about that shop twice. One per guest per shop per event.
 *
 * ONE STORE (owner ruling 2026-11-06): this card is a second door into the same guest review the supplier's QR opens —
 * written by the one writer, shown at once in the shop page's "From guests" group as the guest chose ("Gabriel D." or
 * "G. D."), and Setnayan can hide it. Who is answering is the pass this phone holds (the server reads it), never
 * anything this card sends.
 */
export function ScanReviewAsk({
  eventId,
  vendorProfileId,
  service,
  shop,
  names,
}: {
  eventId: string;
  vendorProfileId: string;
  service: string;
  shop: string | null;
  names: { name: string; initials: string };
}) {
  const [stars, setStars] = useState<string | null>(null);
  const [shownAs, setShownAs] = useState<'name' | 'initials'>('name');
  const [line, setLine] = useState('');
  const [done, setDone] = useState<null | 'sent' | 'skipped'>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (skip: boolean) => {
    setError(null);
    start(async () => {
      try {
        const reply = await supplierScan({
          op: 'guest_review',
          eventId,
          vendorProfileId,
          stars: skip ? null : Number(stars),
          line: skip ? null : line,
          shownAs,
        });
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
        Thank you — your review is on {shop ? `${shop}’s page` : 'their page'}.
      </p>
    );
  }
  // 🔔 Inventory #34 — a To-do ask in the one notice system (owner approved 14 Nov 2026), drawn where it stands under the
  // guest's number: the ask is the line, the rating and Send are its actions, "Not now" its close — kept by the one
  // notice memory AND sent as the shipped skip, so the supplier's request is answered either way.
  return (
    <section aria-label={reviewAskWords(service)} className="space-y-2 text-left" data-scan-review={vendorProfileId}>
      <InlineNotice
        kind="todo"
        noticeKey={`booth-review:${eventId}:${vendorProfileId}`}
        title={reviewAskWords(service)}
        detail={shop ? `Your review shows on ${shop}’s page.` : undefined}
        onClose={() => send(true)}
        actions={
          <>
            <PickMenu label="Your rating" value={stars} options={REVIEW_STAR_OPTIONS} onPick={setStars} buttonText={stars ? undefined : 'Your rating'} dataAttr="data-scan-review-stars" />
            <button type="button" disabled={pending || !stars} onClick={() => send(false)} className={`${NOTICE_ACTION} disabled:opacity-40`}>
              Send
            </button>
          </>
        }
      />
      {stars ? (
        // ✍ The one Field template (`TypedRow`): it posts nothing itself — what it holds rides along with Send, as typed.
        <>
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
          {/* How the name shows on the shop's page — the same two choices as the guest-review page. */}
          <div className="flex items-center justify-center gap-2 text-[13.5px] text-ink/65">
            <span>Shown as</span>
            <PickMenu
              label="Shown as"
              value={shownAs}
              options={[
                { key: 'name', label: names.name },
                { key: 'initials', label: names.initials },
              ]}
              onPick={(k) => setShownAs(k === 'initials' ? 'initials' : 'name')}
              dataAttr="data-scan-review-shown-as"
            />
          </div>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-[rgb(var(--color-warn))]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
