import { GuestToHostCta } from '@/app/_components/guest-to-host-cta';
import { SubmitButton } from '@/app/_components/submit-button';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { submitRsvp } from '../actions';
import type { GuestRow } from '../_lib/types';
import { SelfieCapture } from './selfie-capture';

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
    <form
      action={action}
      className="rsvp-form space-y-5 rounded-2xl border border-terracotta/30 bg-gradient-to-b from-terracotta/5 to-cream p-6 sm:p-8"
    >
      {/* The selfie step reveals once the guest picks "I'll be there" — pure
          CSS :has(), the same pattern as the has-[:checked] ring on the radios
          below, so this stays a server component with no client state. */}
      <style>{`.rsvp-form .selfie-reveal{display:none}.rsvp-form:has(input[name="rsvp_status"][value="attending"]:checked) .selfie-reveal{display:block}`}</style>
      <header className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          RSVP
        </p>
        <RsvpPill status={guest.rsvp_status} />
      </header>

      {/* Seat reservation: confirming attendance holds the guest's place (the
          couple seats them later). Show the reassurance whenever they're
          attending — this is the "your place is reserved" confirmation. */}
      {guest.rsvp_status === 'attending' ? (
        <>
          <p className="flex items-center justify-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-center text-sm font-medium text-success-800">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-600" />
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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(
          [
            { key: 'attending', label: "I'll be there", tone: 'bg-success-600 text-white border-success-600 hover:bg-success-700' },
            { key: 'maybe', label: 'Maybe', tone: 'bg-cream text-ink border-ink/20 hover:border-ink/40' },
            { key: 'declined', label: "Can't make it", tone: 'bg-cream text-ink border-ink/20 hover:border-ink/40' },
          ] as const
        ).map((option) => (
          <label
            key={option.key}
            className={`flex h-16 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-[:checked]:ring-2 has-[:checked]:ring-offset-2 has-[:checked]:ring-offset-cream ${
              guest.rsvp_status === option.key
                ? 'border-terracotta bg-terracotta text-cream ring-2 ring-terracotta'
                : option.tone
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
  const tone: Record<GuestRow['rsvp_status'], string> = {
    attending: 'bg-success-100 text-success-800',
    pending: 'bg-warn-100 text-warn-800',
    declined: 'bg-danger-100 text-danger-800',
    maybe: 'bg-ink/10 text-ink/70',
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
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone[status]}`}>
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
