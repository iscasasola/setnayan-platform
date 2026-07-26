import { GuestToHostCta } from '@/app/_components/guest-to-host-cta';
import { SubmitButton } from '@/app/_components/submit-button';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { submitRsvp } from '../actions';
import type { GuestRow } from '../_lib/types';
import { SelfieCapture } from './selfie-capture';
// Shared with the keepsake ticket so the reply card and the keepsake always
// print the SAME Nº for a given guest.
import { stubNo } from './pahina-keepsake';

export function RsvpWidget({
  guest,
  eventId,
  eventPublicId,
  limited,
  faceMode,
}: {
  guest: GuestRow;
  eventId: string;
  eventPublicId: string;
  limited: boolean;
  /** Effective face-tag mode — passed to the selfie so mode_b skips the embedder. */
  faceMode: PapicFaceMode;
}) {
  const action = submitRsvp.bind(null, eventId, guest.guest_id);

  return (
    <form action={action} className="rsvp-form pahina-deckle space-y-6 sm:p-8">
      {/* The selfie step reveals once the guest picks "attending" — pure
          CSS :has(), the same pattern as the has-[:checked] ring on the radios
          below, so this stays a server component with no client state. */}
      <style>{`.rsvp-form .selfie-reveal{display:none}.rsvp-form:has(input[name="rsvp_status"][value="attending"]:checked) .selfie-reveal{display:block}`}</style>

      {/* THE REPLY CARD (design 2026-07-25 §7) — the only thing on the page that
          is a card in real life, so it is the only thing still shaped like one:
          heavier paper-deep stock, letterpress "RSVP", a gild ticket stub, and
          the perforation rule. Everything else on the site is a plate. */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <p className="pahina-eyebrow">
            <span aria-hidden>№ 07</span>
            <span>Reply</span>
          </p>
          <RsvpPill status={guest.rsvp_status} />
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="pahina-letterpress font-pahina text-[3.2rem] font-light leading-[0.9] tracking-tight text-ink">
            RSVP
          </p>
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">
            Nº {stubNo(guest.guest_id)}
          </p>
        </div>
        <hr className="pahina-perforation" />
      </header>

      {/* Seat reservation: confirming attendance holds the guest's place (the
          couple seats them later). Show the reassurance whenever they're
          attending — this is the "your place is reserved" confirmation. */}
      {guest.rsvp_status === 'attending' ? (
        <>
          <p className="flex items-center gap-2.5 border-l-2 border-gild bg-veil/60 px-4 py-3 text-sm text-ink/80">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-gild" />
            Your place is reserved — we can&rsquo;t wait to celebrate with you.
          </p>
          <GuestToHostCta
            surface="rsvp_confirmation"
            eventId={eventId}
            eventPublicId={eventPublicId}
            headline="Planning your own celebration?"
            sub="Start free on Setnayan — no card needed."
          />
        </>
      ) : null}

      {/* Three quiet outlined options; the chosen one takes the palette's DEEP
          accent fill. Labels are the spec's reply-card wording — the `key`
          values (and therefore the server action's contract) are unchanged. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(
          [
            { key: 'attending', label: 'Joyfully accepts' },
            { key: 'maybe', label: 'Undecided, for now' },
            { key: 'declined', label: 'Regretfully declines' },
          ] as const
        ).map((option) => (
          <label
            key={option.key}
            className={`flex h-16 cursor-pointer items-center justify-center border px-3 text-center font-pahina text-base font-light italic leading-tight transition-colors has-[:checked]:ring-1 has-[:checked]:ring-terracotta-700 has-[:checked]:ring-offset-2 has-[:checked]:ring-offset-paper-deep ${
              guest.rsvp_status === option.key
                ? 'border-terracotta-700 bg-terracotta-700 text-cream'
                : 'border-ink/20 bg-paper text-ink hover:border-ink/40'
            }`}
          >
            <input
              type="radio"
              name="rsvp_status"
              value={option.key}
              defaultChecked={guest.rsvp_status === option.key}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className="selfie-reveal">
        <SelfieCapture faceMode={faceMode} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="meal_preference"
          label="Meal preference"
          defaultValue={guest.meal_preference ?? 'no_preference'}
          options={[
            ['no_preference', 'No preference'],
            ['beef', 'Beef'],
            ['chicken', 'Chicken'],
            ['fish', 'Fish'],
            ['vegetarian', 'Vegetarian'],
            ['vegan', 'Vegan'],
            ['kids', 'Kids'],
          ]}
        />
        <Field
          id="dietary_restrictions"
          label="Dietary notes"
          defaultValue={guest.dietary_restrictions ?? ''}
          placeholder="halal · nut allergy · …"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="block text-sm font-medium text-ink">
          A note to the couple (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={guest.notes ?? ''}
          className="input-field min-h-[88px] resize-y py-2"
          placeholder="Anything you'd like Maria &amp; Juan to know."
        />
      </div>

      {limited ? null : (
        <p className="text-xs text-ink/50">
          You&rsquo;ll be able to add a song request and dance style
          {papicGamesEnabled() ? ', plus a Papic Challenge opt-in,' : ''} when you sign
          up for a free Setnayan account.
        </p>
      )}

      <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Saving RSVP…">
        Save RSVP
      </SubmitButton>
    </form>
  );
}

function RsvpPill({ status }: { status: GuestRow['rsvp_status'] }) {
  // Functional-color exile (§4): the app's green / amber / red status tones are
  // gone. The states now read as quiet mono stamps — the answered one is
  // gild-ruled, the rest are ink. Status labels themselves are unchanged.
  const tone: Record<GuestRow['rsvp_status'], string> = {
    attending: 'border-gild text-gild',
    pending: 'border-ink/20 text-ink/55',
    declined: 'border-ink/25 text-ink/60',
    maybe: 'border-ink/20 text-ink/60',
  };
  const label =
    status === 'attending'
      ? 'Going'
      : status === 'pending'
        ? 'Pending'
        : status === 'declined'
          ? 'Declined'
          : 'Maybe';
  return (
    <span
      className={`shrink-0 border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] ${tone[status]}`}
    >
      {label}
    </span>
  );
}

function Field({
  id,
  label,
  defaultValue,
  placeholder,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

function Select({
  id,
  label,
  options,
  defaultValue,
}: {
  id: string;
  label: string;
  options: [string, string][];
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="input-field appearance-none bg-cream pr-8"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
