import type { EventWords } from '../_lib/event-words';
import { GuestToHostCta } from '@/app/_components/guest-to-host-cta';
import { SubmitButton } from '@/app/_components/submit-button';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
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
  faceMode,
  flash = null,
  replyLocked = false,
  profileDetails = null,
  words,
}: {
  words: EventWords;
  guest: GuestRow;
  eventId: string;
  eventPublicId: string;
  /** Effective face-tag mode — passed to the selfie so mode_b skips the embedder. */
  faceMode: PapicFaceMode;
  /** Did the last attempt land? Rendered at the TOP of the form, because an
   *  error at the bottom is below the fold on a phone and the whole point is
   *  that the guest must not walk away thinking they replied. */
  flash?: { tone: 'ok' | 'error'; text: string } | null;
  /**
   * The guest list is final, so the GOING-OR-NOT answer is frozen (owner
   * 2026-08-20). Everything else on this card stays open.
   *
   * 🔑 THIS FORM IS NOT A HEADCOUNT — it is five things, and only one of them
   * is the count: the answer · the selfie that makes their photos findable ·
   * their meal · their dietary notes · a note to the host. The list finalizes
   * about two weeks out, which is exactly when "nut allergy" and "vegetarian"
   * matter MOST. Closing the whole card to freeze the count would take the
   * allergy box away from a caterer's last fortnight.
   *
   * The database already drew this line and drew it correctly: its post-lock
   * guard blocks only count-affecting writes and lets meal, photo and seating
   * through by design. This prop makes the screen agree with it.
   *
   * When true no `rsvp_status` control is rendered AT ALL — the answer cannot
   * be posted, rather than being posted and refused.
   */
  replyLocked?: boolean;
  /**
   * This person's OWN saved answers (owner 2026-08-21). Used ONLY as a default
   * where they have not answered for THIS event — so somebody invited to their
   * fourth wedding is not typing "nut allergy" for the fourth time.
   *
   * 🔒 NEVER AN OVERRIDE. `guest.*` wins whenever it holds anything: the answer
   * they gave HERE is the one the caterer cooks from, and a stale profile must
   * not quietly replace it.
   */
  profileDetails?: {
    mealPreference: string | null;
    dietaryRestrictions: string | null;
    email: string | null;
    phone: string | null;
    displayName: string | null;
  } | null;
}) {
  const action = submitRsvp.bind(null, eventId, guest.guest_id);

  // The three boxes, declared ONCE so the folded and unfolded arms can never
  // drift apart. Both arms render them, so both POST them.
  const contactFields = (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="contact_email"
          label="Email"
          type="email"
          autoComplete="email"
          defaultValue={guest.email ?? profileDetails?.email ?? ''}
          placeholder="you@email.com"
        />
        <Field
          id="contact_mobile"
          label="Mobile"
          autoComplete="tel"
          defaultValue={guest.mobile ?? profileDetails?.phone ?? ''}
          placeholder="+63 …"
        />
      </div>
      <Field
        id="contact_display_name"
        label="What should we call you? (optional)"
        defaultValue={guest.display_name ?? profileDetails?.displayName ?? ''}
        placeholder={guest.first_name}
      />
    </>
  );

  /**
   * "ALL DETAILS ARE FILLED" — owner, 2026-08-21.
   *
   * Both ways of reaching them must be present: an email with no number, or a
   * number with no email, is still something the host has to chase, so this
   * asks for BOTH and falls back to the full form when either is missing.
   * ⚠ Meal and dietary are NOT required. "No preference" and "no allergies" are
   * real answers, and a guest with neither would otherwise be shown five boxes
   * forever for facts that have nothing to add.
   */
  const knownEmail = (guest.email ?? profileDetails?.email ?? '').trim();
  const knownMobile = (guest.mobile ?? profileDetails?.phone ?? '').trim();
  const detailsAlreadyKnown = knownEmail !== '' && knownMobile !== '';
  const knownName = (guest.display_name ?? profileDetails?.displayName ?? '').trim();
  const knownSummary = [knownName || `${guest.first_name} ${guest.last_name}`.trim(), knownEmail, knownMobile]
    .filter(Boolean)
    .join(' · ');

  return (
    <form action={action} className="rsvp-form pahina-deckle space-y-6 sm:p-8">
      {flash ? (
        <p
          role={flash.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border px-3 py-2 text-sm ${
            flash.tone === 'error'
              ? 'border-terracotta/40 bg-terracotta/10 text-terracotta-700'
              : 'border-success-700/30 bg-success-50 text-success-800'
          }`}
        >
          {flash.text}
        </p>
      ) : null}
      {/* The selfie step reveals once the guest picks "attending" — pure
          CSS :has(), the same pattern as the has-[:checked] ring on the radios
          below, so this stays a server component with no client state.
          Omitted when the answer is locked: there is no radio to watch, so the
          rule is dead weight AND its selector text is the only `rsvp_status`
          left in the markup, which reads to any scan like a live control. */}
      {replyLocked ? null : (
        <style>{`.rsvp-form .selfie-reveal{display:none}.rsvp-form:has(input[name="rsvp_status"][value="attending"]:checked) .selfie-reveal{display:block}`}</style>
      )}

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
      {replyLocked ? (
        <LockedAnswer status={guest.rsvp_status} />
      ) : (
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
      )}

      {/* ⚠ THE SELFIE IS REVEALED BY `:has(rsvp_status=attending:checked)`. With
          the answer locked there IS no radio, so that selector can never match
          and the selfie step would vanish for exactly the guests who are
          coming — in the fortnight before the day, when getting their photos to
          find them is the whole point. Locked + attending renders it outright. */}
      {replyLocked ? (
        guest.rsvp_status === 'attending' ? (
          <div>
            <SelfieCapture faceMode={faceMode} />
          </div>
        ) : null
      ) : (
        <div className="selfie-reveal">
          <SelfieCapture faceMode={faceMode} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="meal_preference"
          label="Meal preference"
          defaultValue={guest.meal_preference ?? profileDetails?.mealPreference ?? 'no_preference'}
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
          defaultValue={guest.dietary_restrictions ?? profileDetails?.dietaryRestrictions ?? ''}
          placeholder="halal · nut allergy · …"
        />
      </div>

      {/* ── HOW THEY REACH YOU ──────────────────────────────────────────────
          🔴 THESE THREE BOXES DID NOT EXIST. The host's own guest page carries
          Email, Mobile and Display name, and NOTHING anywhere in the product
          let the guest supply any of them — so a host without a number had to
          leave the app and go and ask for it, for every guest.
          Owner, 2026-08-21, pointing at that page: "these are all the
          information we want to fill up."

          🔒 First and last name stay HOST-ONLY, deliberately. The link that
          reaches this card is printed on a poster, and a stranger who can
          rename a seat-holder is the exact harm `seedBindAllowed` was hardened
          against on 2026-08-01. What to CALL you is a label; who you ARE is not
          a label, and only the host sets it.

          ⚠ NOT FROZEN when the guest list closes. Only the ANSWER freezes
          (owner, 2026-08-20) — a phone number corrected the week of the event
          is worth more then than at any other time.

          📦 AND IT FOLDS WHEN WE ALREADY KNOW. Owner, 2026-08-21: "if they have
          an account, and all details are filled, all they need is to accept the
          invitation." A signed-in guest whose profile already carries their
          contact details is shown their answer and a ONE-LINE SUMMARY of what
          we hold — not five boxes asking what the app can already read.

          ⚠ AND THE SUMMARY NAMES WHAT IS BEHIND IT, or this repeats #4683 — the
          guest's own message sat in a drawer whose label advertised something
          else, and the host never saw it. Everything folded away is listed on
          the line, and the inputs still POST: <details> hides, it does not
          disable. */}
      {detailsAlreadyKnown ? (
        <details className="rounded-lg border border-ink/10 bg-ink/[0.02]">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-ink/80 hover:text-ink">
            <span className="min-w-0">
              <span className="block font-medium text-ink">Your details are filled in</span>
              <span className="mt-0.5 block truncate text-xs text-ink/70">{knownSummary}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-mulberry">Change</span>
          </summary>
          <div className="space-y-4 px-4 pb-4">{contactFields}</div>
        </details>
      ) : (
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink">
            How {words.theOrganizer} can reach you
          </span>
          {contactFields}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="guest_note" className="block text-sm font-medium text-ink">
          A note to {words.theOrganizer} (optional)
        </label>
        {/* ⚠ `guest_note`, NOT `notes`. Until 2026-08-06 this box was bound to
            `guests.notes` — the COUPLE'S PRIVATE note about this guest — so it
            displayed to them whatever the couple had written ("seat away from
            Tita"), and submitting the RSVP overwrote it. Never bind a
            guest-facing field to `notes`. */}
        {/* The label one line above already uses the event's own words; this
            placeholder was hardcoded to a sample couple, so EVERY event — a
            birthday, a graduation, a debut — asked its guests to write to
            "Maria & Juan". Even the seeded sample is Maria & JOSE, so the demo
            was wrong by a name. */}
        <textarea
          id="guest_note"
          name="guest_note"
          rows={3}
          defaultValue={guest.guest_note ?? ''}
          className="input-field min-h-[88px] resize-y py-2"
          placeholder={`Anything you'd like ${words.theOrganizer} to know.`}
        />
      </div>

      <SubmitButton
        className="button-primary w-full sm:w-auto"
        pendingLabel={replyLocked ? 'Saving details…' : 'Saving RSVP…'}
      >
        {replyLocked ? 'Save details' : 'Save RSVP'}
      </SubmitButton>
    </form>
  );
}

/**
 * The frozen answer, where the three choices were. Shows what they said (or
 * that they never said), and why it can no longer move — a control that
 * silently stops working teaches nothing.
 */
function LockedAnswer({ status }: { status: GuestRow['rsvp_status'] }) {
  const said =
    status === 'attending'
      ? 'You said you are coming.'
      : status === 'declined'
        ? 'You said you cannot make it.'
        : status === 'maybe'
          ? 'You were undecided.'
          : 'No reply was received from you.';
  return (
    <div className="border-l-2 border-ink/25 bg-paper-deep px-5 py-4">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/50">
        Replies are closed
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        {said} The guest list is final, so this part can no longer change — but
        everything below is still yours to update.
      </p>
    </div>
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
  type = 'text',
  autoComplete,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  /** `email` puts the @ keyboard on a phone; the contact boxes are the only
   *  fields on this card that are not free text. */
  type?: 'text' | 'email' | 'tel';
  /** Lets the phone's own autofill offer what it already knows — the same
   *  "stop asking what you can read" the account prefill does one layer up. */
  autoComplete?: 'email' | 'tel' | 'name';
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
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
