import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import {
  REPLY_TIME_MIN_SAMPLE,
  FAST_REPLY_THRESHOLD_MIN,
  formatReplyMinutes,
  type ReplyTimeVerdict,
} from '@/lib/vendor-reply-time';

/**
 * "WHAT COUPLES SEE ABOUT YOUR REPLIES" — Performance · Snapshot · all tiers.
 *
 * ── WHY THIS CARD EXISTS ────────────────────────────────────────────────────
 * `lib/vendor-reply-time.ts` decides one of the few claims Setnayan makes about
 * a shop on a page couples actually browse — "Usually responds in 2h" — and it
 * refuses to make it five different ways. The shop it is about could see none
 * of that: not the number, not whether it is showing, not what would make it
 * show. A number with no consequence attached is a number nobody acts on.
 *
 * ⛔ NO INVENTED STATISTIC. An earlier draft of this card carried "shops that
 * answer inside a day get booked twice as often". Production holds zero
 * marketplace bookings, so that sentence would have been a number we made up,
 * printed as advice, on the one screen whose whole subject is honest numbers.
 * The consequence stated here is the one we can prove: it is on the card, and
 * a couple comparing shops can see it.
 *
 * ── EVERY THRESHOLD IS DERIVED ──────────────────────────────────────────────
 * The floor and the four-hour line are IMPORTED from the module that enforces
 * them, and the duration is printed by that module's own formatter. Re-typing
 * "3" or "4 hours" here is how the explanation starts describing a rule the
 * product no longer has.
 *
 * Server component — no client JS, no clock (the verdict is computed upstream
 * with an injected `now`).
 */

type Copy = { value: string; title: string; body: string };

function copyFor(verdict: ReplyTimeVerdict): Copy {
  if (verdict.shown) {
    return {
      value: formatReplyMinutes(verdict.medianMinutes),
      title: `Couples see “${verdict.label}” on your shop.`,
      body:
        `Taken from your ${verdict.sample} answered conversations. It comes off on its own if your ` +
        `typical reply goes past ${formatReplyMinutes(FAST_REPLY_THRESHOLD_MIN)}, or if you go a week ` +
        `without signing in — it is a claim about now, so it has to stay true.`,
    };
  }
  switch (verdict.reason) {
    case 'not_enough_replies': {
      const left = REPLY_TIME_MIN_SAMPLE - verdict.sample;
      return {
        value: `${verdict.sample} of ${REPLY_TIME_MIN_SAMPLE}`,
        title: 'Couples see nothing yet about how fast you reply.',
        body:
          `We only say “usually” after ${REPLY_TIME_MIN_SAMPLE} answered conversations — one quick ` +
          `answer is not a habit. Answer ${left} more and your reply time starts showing on your shop. ` +
          'Answering couples is free.',
      };
    }
    case 'no_median':
      return {
        value: '—',
        title: 'Couples see nothing yet about how fast you reply.',
        body:
          `You have not answered anybody yet. Reply to ${REPLY_TIME_MIN_SAMPLE} conversations and your ` +
          'reply time starts showing on your shop. Answering couples is free.',
      };
    case 'too_slow':
      return {
        value: formatReplyMinutes(verdict.medianMinutes),
        title: 'Your reply time is hidden because it is slow.',
        body:
          `You typically reply in ${formatReplyMinutes(verdict.medianMinutes)}. We only show it when it ` +
          `is under ${formatReplyMinutes(FAST_REPLY_THRESHOLD_MIN)} — under that it is a reason to pick ` +
          'you, over it, it is not. Get under the line and it appears on your shop by itself.',
      };
    case 'away':
      return {
        value: '—',
        title: 'Your reply time is hidden because you have been away.',
        body:
          'It comes off after a week without signing in, because it is a promise about how fast you ' +
          'answer today. Signing in and answering brings it back.',
      };
  }
}

export function ReplyClaimCard({ verdict }: { verdict: ReplyTimeVerdict }) {
  const copy = copyFor(verdict);
  return (
    <div className="sn-tile p-5">
      <div className="mb-2 flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
        <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="font-mono text-[11px] uppercase tracking-[0.15em]">
          What couples see about your replies
        </span>
      </div>
      <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {copy.value}
      </p>
      <p className="mt-1.5 text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
        {copy.title}
      </p>
      <p className="mt-1 max-w-[68ch] text-sm" style={{ color: 'var(--m-slate-2)' }}>
        {copy.body}
      </p>
      {verdict.shown ? null : (
        <Link
          href="/vendor-dashboard/customers"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline"
          style={{ color: 'var(--m-ink)' }}
        >
          Go to your customers
          <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      )}
    </div>
  );
}
