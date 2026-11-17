import { BadgeCheck, Check, Clock, Minus } from 'lucide-react';

import { formatCount } from '@/lib/format-number';
import {
  FREE_UNVERIFIED,
  RENEWAL_WAITING,
  RENEWED_PAGE,
  freeUnverifiedLines,
  nextRenewalLine,
  renewalWaitingBody,
  type RenewalPageFacts,
} from '@/lib/papers-renewal';

/**
 * 📄 THE SHOP'S STATE ON TOP OF THE ONE UPLOAD PLACE during a renewal — §3 and §6 of the approved design
 * (`prototypes/supplier_papers_renewal_2026-11-14_fable.html`): "Free · Unverified" with what carries on and what is
 * paused; "Waiting for Setnayan" when a person must look; "You're verified" with the next renewal day once a renewal
 * is approved. Which one is `renewalPageCard` (pure); this only draws it.
 */
export function RenewalStateCard({ card, facts }: { card: 'free_unverified' | 'waiting' | 'verified_again'; facts: RenewalPageFacts }) {
  if (card === 'verified_again') {
    return (
      <div
        className="flex items-start gap-3 rounded-2xl p-5"
        data-renewal-card="verified_again"
        style={{ background: 'color-mix(in srgb, var(--m-sage-deep) 8%, rgba(255,255,255,.72))' }}
      >
        <BadgeCheck aria-hidden className="h-6 w-6 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-sage-deep)' }} />
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--m-sage-deep)' }}>
            {RENEWED_PAGE.title}
          </p>
          <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
            {RENEWED_PAGE.sub}
          </p>
          <p className="text-xs" style={{ color: 'var(--m-ink)' }}>
            <strong>{RENEWED_PAGE.stamp}</strong> {facts.dueAt ? nextRenewalLine(facts.dueAt) : null}
          </p>
        </div>
      </div>
    );
  }
  if (card === 'waiting') {
    const n = facts.bookings;
    return (
      <div
        className="space-y-2 rounded-2xl p-5"
        data-renewal-card="waiting"
        style={{ background: 'var(--m-paper)' }}
      >
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          <Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} style={{ color: 'var(--m-orange-deep)' }} />
          {RENEWAL_WAITING.title}
        </p>
        <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
          {RENEWAL_WAITING.sub}
        </p>
        <p className="text-xs" style={{ color: 'var(--m-ink)' }}>
          {renewalWaitingBody(facts.handTyped ?? null)} You stay out of Find until then;{' '}
          {n === null ? 'your bookings carry on.' : `your ${formatCount(n)} ${n === 1 ? 'booking carries' : 'bookings carry'} on.`}
        </p>
      </div>
    );
  }
  return (
    <div
      className="space-y-3 rounded-2xl p-5"
      data-renewal-card="free_unverified"
      style={{ background: 'var(--m-orange-4)' }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          {FREE_UNVERIFIED.title}
        </p>
        <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
          {FREE_UNVERIFIED.sub}
        </p>
      </div>
      <ul className="space-y-1.5">
        {freeUnverifiedLines(facts.bookings).map((l) => (
          <li key={l.text} className="flex items-center gap-2 text-xs" style={{ color: 'var(--m-ink)' }}>
            <span
              aria-hidden
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={l.ok ? { background: 'var(--m-paper-2)', color: 'var(--m-sage-deep)' } : { background: 'var(--m-line-soft)', color: 'var(--m-slate)' }}
            >
              {l.ok ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <Minus className="h-3 w-3" strokeWidth={2.5} />}
            </span>
            {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
