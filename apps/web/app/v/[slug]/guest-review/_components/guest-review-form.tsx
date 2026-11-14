'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { StarRatingInput } from '@/app/_components/star-rating-input';
import { SubmitButton } from '@/app/_components/submit-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { GUEST_REVIEW_LINE_MAX, type GuestShownAs } from '@/lib/guest-reviews';
import { actionButtonClass } from '@/components/action-button';

/**
 * ⭐ THE GUEST FORM — prototype § 7 "Guest review · new screen", one screen, ONE supplier (owner, 6 Nov: "a request
 * shows only that supplier"). Overall · one line (140) · an optional shot of their own · Shown as · Send. No
 * communication / price / schedule questions — a guest never dealt with those. The card shows by NAME only: a review
 * never shows a price (owner, 6 Nov).
 *
 * 💾 Send saves IN PLACE (owner rule "a save never resets the screen"): the action's answer swaps this card for the
 * thank-you (prototype § 10) on the same screen — no redirect, no reload.
 */
export type GuestReviewCard = { serviceId: string; title: string };
export type GuestReviewShot = { id: string; url: string };
export type GuestReviewSendState =
  | { status: 'idle' }
  | { status: 'sent'; firstName: string; giftLine: string | null }
  | { status: 'refused'; message: string };

export function GuestReviewForm({
  action,
  slug,
  eventId,
  shopName,
  cards,
  shots,
  names,
  checkedInLabel,
  backHref,
}: {
  action: (prev: GuestReviewSendState, form: FormData) => Promise<GuestReviewSendState>;
  slug: string;
  eventId: string;
  shopName: string;
  /** This supplier's cards booked on this event — never another supplier's. */
  cards: GuestReviewCard[];
  /** The guest's own Papic shots from this event. [] → the photo row is not shown. */
  shots: GuestReviewShot[];
  /** "Gabriel D." and "G. D." — the two ways the guest may be shown. */
  names: Record<GuestShownAs, string>;
  /** "Checked in at the door · Dec 12" — the proof line, platform-stamped. */
  checkedInLabel: string;
  /** Back to the guest's own Event Hub. */
  backHref: string;
}) {
  const [state, send] = useActionState(action, { status: 'idle' } as GuestReviewSendState);
  const [card, setCard] = useState<string>(cards[0]?.serviceId ?? '');
  const [shot, setShot] = useState<string>('');
  const [shownAs, setShownAs] = useState<GuestShownAs>('name');

  if (state.status === 'sent') {
    return <GuestReviewThanks firstName={state.firstName} giftLine={state.giftLine} shopName={shopName} backHref={backHref} />;
  }

  const current = cards.find((c) => c.serviceId === card) ?? null;
  return (
    <form action={send} className="sn-glass-bare rounded-xl p-4" data-guest-review="form">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="service_id" value={card} />
      <input type="hidden" name="capture_id" value={shot} />
      <input type="hidden" name="shown_as" value={shownAs} />

      {current ? (
        <div className="mt-1.5 rounded-xl bg-ink/[0.03] p-2.5" data-guest-review-card>
          {cards.length > 1 ? (
            <PickMenu
              label="Which card"
              value={card}
              options={cards.map((c) => ({ key: c.serviceId, label: c.title }))}
              onPick={setCard}
              dataAttr="data-guest-review-card-pick"
            />
          ) : (
            <p className="font-medium">{current.title}</p>
          )}
          <p className="mt-1 text-xs text-ink/70">The card they delivered at this event.</p>
        </div>
      ) : null}

      <div className="mt-3 border-b border-ink/10 py-1" data-guest-review-overall>
        <StarRatingInput name="rating_overall" label="Overall" required />
      </div>

      <label htmlFor="guest_review_line" className="mb-2 mt-3.5 block text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
        What stood out? (optional)
      </label>
      <textarea
        // field-ok: a GUEST-facing page (the guest Event Hub's template, not the dashboard Form row) — prototype § 7's one-line field, drawn as approved
        id="guest_review_line"
        name="line"
        rows={2}
        maxLength={GUEST_REVIEW_LINE_MAX}
        placeholder="One thing you noticed on the day…"
        className="input-field min-h-[60px] py-2"
      />
      <p className="mt-1.5 text-xs text-ink/70">Up to {GUEST_REVIEW_LINE_MAX} characters.</p>

      {shots.length > 0 ? (
        <>
          <p className="mb-2 mt-[18px] block text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
            A photo from the day (optional)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="A photo from the day" data-guest-review-shots>
            {shots.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={shot === s.id}
                aria-label="Use this shot"
                onClick={() => setShot(s.id)}
                className={`block h-14 w-14 overflow-hidden rounded-lg bg-ink/5 ${shot === s.id ? 'outline outline-2 outline-offset-2 outline-mulberry' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived presigned R2 thumb */}
                <img src={s.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={shot === ''}
              onClick={() => setShot('')}
              className={`grid h-14 w-14 place-items-center rounded-lg bg-ink/5 text-[11px] text-ink/55 ${shot === '' ? 'outline outline-2 outline-offset-2 outline-mulberry' : ''}`}
            >
              None
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink/70">Your own Papic shots from this event.</p>
        </>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-ink/10 py-3">
        <div className="min-w-0 flex-1 text-[15px]">
          Shown as
          <small className="block text-xs text-ink/65">On the card and their page, with ✓ Guest at the event</small>
        </div>
        <PickMenu
          label="Shown as"
          value={shownAs}
          options={[
            { key: 'name', label: names.name },
            { key: 'initials', label: names.initials },
          ]}
          onPick={(k) => setShownAs(k === 'initials' ? 'initials' : 'name')}
          dataAttr="data-guest-review-shown-as"
          className="shrink-0"
        />
      </div>

      {state.status === 'refused' ? (
        <p role="alert" className="mt-2 text-[13px] text-danger-700" data-guest-review="refused">
          {state.message}
        </p>
      ) : null}

      <div className="mt-[18px] flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink/70">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2} />
          {checkedInLabel}
        </span>
        <SubmitButton className="button-primary" pendingLabel="Sending…">
          Send
        </SubmitButton>
      </div>
    </form>
  );
}

/** 💌 The thank-you (prototype § 10) — on the same screen, in place of the form. The gift block shows only when the
 *  supplier set one (`guestReviewGiftFor`); today none can, so the thank-you stands alone. */
export function GuestReviewThanks({
  firstName,
  giftLine,
  shopName,
  backHref,
}: {
  firstName: string;
  giftLine: string | null;
  shopName: string;
  backHref: string;
}) {
  return (
    <div className="sn-glass-bare rounded-xl p-4" data-guest-review="sent">
      <p className="mb-1 text-[18px] font-semibold">Thank you, {firstName}</p>
      <p className="text-[13px] text-ink/70">Your line is on {shopName}&rsquo;s card. They&rsquo;ll see it today.</p>
      {giftLine ? (
        <div className="mt-2.5 border-t border-dashed border-ink/15 pt-3.5" data-guest-review-gift>
          <p className="text-[15px] font-semibold">From {shopName}</p>
          <p className="mt-0.5 text-[13px] text-ink/70">{giftLine}</p>
        </div>
      ) : null}
      <div className="mt-3.5 flex flex-col gap-2.5">
        <Link href={backHref} className={actionButtonClass('neutral', { extra: 'w-full !h-11' })}>
          Back to the event
        </Link>
      </div>
    </div>
  );
}
