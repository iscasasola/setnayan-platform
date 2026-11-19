import Link from 'next/link';
import { BadgeCheck, Check, ChevronRight, ImagePlus, Info, PenLine, Users } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { approveFirstCard } from '@/app/open-shop/actions';
import { formatCount } from '@/lib/format-number';
import {
  FIRST_CARD_CARRY_LINE,
  FIRST_CARD_FIELD,
  FIRST_CARD_RETRY,
  TODAY_WELCOME_LINE,
  TODAY_WELCOME_STEPS,
  WELCOME_CLAIMED_PATH,
  WELCOME_OPENED_PATH,
  claimedWelcomeLine,
  welcomeDoneRow,
  welcomeTitle,
  type FirstCardCarry,
  type firstCardStateFrom,
} from '@/lib/supplier-onboarding';

const ICON = { clients: Users, logo: ImagePlus, verify: BadgeCheck } as const;

/**
 * 🚪 TODAY'S WELCOME — THE LAST STOP OF EVERY SUPPLIER ONBOARDING DOOR (owner 2026-11-19, drawing `36jmQMWrANcgd2HxihAUw5`
 * PB6 / P6). Drawn when Today is opened with `?opened=1` (the self-serve and coordinator doors) or `?claimed=1` (a couple's
 * invite accepted — before 19 Nov nothing read it). "Welcome, <shop>" · "Your shop is open on Free." · the ticked row of
 * what the door made · three next steps in the owner's order: Add the clients you already have · Add your logo
 * (`/open-shop/logo` stays reachable from here) · Get verified to be found. No leads are promised.
 *
 * A first card the door could NOT make is said here, never hidden (`card`): `waiting` — the Email way, made now with
 * "Approve card"; `refused` — the maker's own sentence, then Approve again or the Card Maker. `draft` — made, but the
 * shipped switch said no (a photo missing, the live-cards cap): its own sentence, the Card Maker on THAT card, and "Put it
 * on my page" to ask again. The ticked row says "Your shop and first card" ONLY on `?card=live` — never on a bare welcome.
 * 🔒 lib/supplier-onboarding.test.ts
 */
export function TodayWelcome({
  kind,
  shopName,
  card = null,
  cardState = null,
  cardNote = null,
  claimed = null,
}: {
  kind: 'claimed' | 'opened';
  shopName: string | null;
  card?: FirstCardCarry | null;
  /** `?card=` — the ticked row names the card ONLY when it is `live` (`welcomeDoneRow`); a bare welcome names the shop. */
  cardState?: ReturnType<typeof firstCardStateFrom>;
  /** The claim door's carry with no card to redraw — the switch's sentence and the card's id (`claimCardFrom`). */
  cardNote?: { why: string | null; id: string | null } | null;
  /** P6 — the couple whose invite this was, and their event's word; null names nobody. */
  claimed?: { couple: string; eventWord: string } | null;
}) {
  const welcome = kind === 'claimed' ? WELCOME_CLAIMED_PATH : WELCOME_OPENED_PATH;
  return (
    <section className="sn-tile mb-4 grid gap-3 p-4 sm:p-5" aria-labelledby="today-welcome-title" data-today-welcome={kind}>
      <div className="grid gap-1">
        <h2 id="today-welcome-title" className="text-lg font-semibold text-ink">
          {welcomeTitle(kind, shopName)}
        </h2>
        <p className="text-sm text-ink/70">
          {kind === 'claimed' && claimed ? claimedWelcomeLine(claimed.couple, claimed.eventWord) : TODAY_WELCOME_LINE}
        </p>
      </div>
      {card ? (
        <form
          action={approveFirstCard}
          className="grid gap-2 border-y border-ink/10 py-3"
          data-today-welcome-card={card.state}
          role={card.state === 'refused' ? 'alert' : undefined}
        >
          <input type="hidden" name="welcome" value={welcome} />
          <input type="hidden" name={FIRST_CARD_FIELD.title} value={card.title} />
          <input type="hidden" name={FIRST_CARD_FIELD.price} value={String(card.price)} />
          <input type="hidden" name="first_card_category" value={card.category} />
          <p className={`flex items-start gap-1.5 text-sm ${card.state === 'refused' ? 'text-mulberry-deep' : 'text-ink'}`}>
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              {FIRST_CARD_CARRY_LINE[card.state]}
              {card.why ? ` ${card.why}` : null}
            </span>
          </p>
          <p className="text-[14.5px] font-medium text-ink">
            {card.title} <span className="font-normal text-ink/60">· from ₱{formatCount(card.price)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={card.id ? `/vendor-dashboard/services/${card.id}` : `/vendor-dashboard/services/new/${encodeURIComponent(card.category)}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink hover:bg-ink/5"
              data-today-welcome-card-edit=""
            >
              <PenLine aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Edit in the Card Maker
            </Link>
            <SubmitButton className="button-primary ml-auto inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm" pendingLabel={card.state === 'draft' ? 'Trying…' : 'Approving…'}>
              {card.state === 'draft' ? FIRST_CARD_RETRY : 'Approve card'}
            </SubmitButton>
          </div>
        </form>
      ) : cardState === 'draft' || cardState === 'refused' ? (
        // The claim door's first card, as its finish found it — made but not on the page (the switch's own sentence,
        // the Card Maker on THAT card), or not made at all. Said, never a ✓ (review 20 Nov).
        <p
          className={`flex items-start gap-1.5 border-y border-ink/10 py-3 text-sm ${cardState === 'refused' ? 'text-mulberry-deep' : 'text-ink'}`}
          data-today-welcome-card={cardState}
          role={cardState === 'refused' ? 'alert' : undefined}
        >
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>
            {FIRST_CARD_CARRY_LINE[cardState]}
            {cardNote?.why ? ` ${cardNote.why}` : null}{' '}
            <Link
              href={cardNote?.id ? `/vendor-dashboard/services/${cardNote.id}` : '/vendor-dashboard/services'}
              className="font-medium text-mulberry underline-offset-2 hover:underline"
            >
              {cardNote?.id ? 'Open it in the Card Maker' : 'Open your cards'}
            </Link>
          </span>
        </p>
      ) : null}
      <ul className="grid gap-1.5">
        <li className="flex min-h-12 items-center gap-3 px-2 py-2 text-[14.5px] font-medium text-ink" data-today-welcome-done="">
          <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-paper" style={{ background: 'rgb(var(--color-ok))' }}>
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <span className="flex-1">{welcomeDoneRow(cardState)}</span>
        </li>
        {TODAY_WELCOME_STEPS.map((s) => {
          const Icon = ICON[s.key];
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                className="flex min-h-12 items-center gap-3 rounded-xl px-2 py-2 text-[14.5px] font-medium text-ink hover:bg-ink/5"
                data-today-welcome-step={s.key}
              >
                <Icon aria-hidden className="h-5 w-5 shrink-0 text-mulberry" strokeWidth={1.75} />
                <span className="flex-1">{s.label}</span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
