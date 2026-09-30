import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { MEAL_LABELS, type MealPreference } from '@/lib/guests';
import { rsvpAsks, type RsvpAskConfig } from '@/lib/rsvp-ask';
import { REQUEST_ANSWERS, REQUEST_MAX_SEATS } from '@/lib/guest-requests';
import type { FormalName } from '@/lib/formal-name';
import { FormalNameInputs } from '@/app/_components/formal-name-inputs';

/**
 * ASK TO JOIN — the request form (guest pathway prototype frame 7b, owner
 * 2026-09-26/27). The person types their name — the five parts every name box
 * uses, Prefix · First · Middle · Last · Suffix (owner 2026-09-30) — (the guest
 * list is NEVER shown),
 * answers the RSVP (📵 no email — owner 2026-09-29). It produces a REQUEST, not an
 * admission: the join actions write no membership and no guest session, and the
 * couple Keeps, Links or Removes it in Guest List → Requests.
 *
 * Only the questions the couple still asks are drawn (`ask`, the same
 * `rsvp_ask_config` the RSVP enforces), and the server reads back only those
 * (`readRequestAnswers`). Field names match the RSVP's own
 * (`rsvp_status`, `meal_preference`, `dietary_restrictions`, `guest_note`,
 * `contact_mobile`).
 *
 * A server component — nothing here needs JavaScript to post.
 */
export function RequestForm({
  action,
  ask,
  organizer,
  defaultParts = {},
  accountEmail = null,
}: {
  action: (formData: FormData) => Promise<void>;
  ask: RsvpAskConfig;
  /** "the couple" / "the family" — the event's own word. */
  organizer: string;
  /** A signed-in asker's name, already split — they do not retype it. */
  defaultParts?: Partial<FormalName>;
  /** Signed in with a real address — it is the contact; no box is shown. */
  accountEmail?: string | null;
}) {
  const meals = Object.keys(MEAL_LABELS) as MealPreference[];
  return (
    <form action={action} className="space-y-6" data-join-request="">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink">Your name</legend>
        <FormalNameInputs defaults={defaultParts} required forSelf idPrefix="request-" />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink">Will you be there?</legend>
        {REQUEST_ANSWERS.map((a, i) => (
          <label
            key={a.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full bg-ink/[0.04] px-4 text-sm text-ink has-[:checked]:bg-ink has-[:checked]:text-cream"
          >
            <input type="radio" name="rsvp_status" value={a.value} required defaultChecked={i === 0} className="accent-current" />
            {a.label}
          </label>
        ))}
      </fieldset>

      {rsvpAsks(ask, 'plus_ones') ? (
        <div className="space-y-1.5">
          <label htmlFor="request-seats" className="block text-sm font-medium text-ink">
            How many of you?
          </label>
          <select id="request-seats" name="seats" defaultValue="1" className="input-field">
            {Array.from({ length: REQUEST_MAX_SEATS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'Just me' : `${n} — me and ${n - 1} more`}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {rsvpAsks(ask, 'meal') ? (
        <div className="space-y-1.5">
          <label htmlFor="request-meal" className="block text-sm font-medium text-ink">
            Meal preference
          </label>
          <select id="request-meal" name="meal_preference" defaultValue="no_preference" className="input-field">
            {meals.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {rsvpAsks(ask, 'dietary') ? (
        <div className="space-y-1.5">
          <label htmlFor="request-dietary" className="block text-sm font-medium text-ink">
            Dietary notes
          </label>
          <input id="request-dietary" name="dietary_restrictions" type="text" maxLength={500} placeholder="halal · nut allergy · …" className="input-field" />
        </div>
      ) : null}

      {rsvpAsks(ask, 'note') ? (
        <div className="space-y-1.5">
          <label htmlFor="request-note" className="block text-sm font-medium text-ink">
            A note to {organizer}
          </label>
          <textarea id="request-note" name="guest_note" rows={2} maxLength={1000} className="input-field" />
        </div>
      ) : null}

      {/* 📵 NO EMAIL BOX (owner 2026-09-29, "NO EMAIL TO GUESTS"): the requester
          gets their own key on Send — the pending Digital ticket and their link —
          so nothing needs an address to reach them. */}
      {rsvpAsks(ask, 'mobile') ? (
        <div className="space-y-1.5">
          <label htmlFor="request-mobile" className="block text-sm font-medium text-ink">
            Mobile
          </label>
          <input id="request-mobile" name="contact_mobile" type="tel" autoComplete="tel" inputMode="tel" placeholder="+63 …" className="input-field" />
        </div>
      ) : null}

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink/80">
        <input type="checkbox" name="terms" required className="mt-1 h-4 w-4 shrink-0" />
        <span>
          I agree to the{' '}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>{' '}
          and the{' '}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Notice
          </Link>
        </span>
      </label>

      <SubmitButton className="button-primary w-full" pendingLabel="Sending…">
        Send request
      </SubmitButton>
    </form>
  );
}
