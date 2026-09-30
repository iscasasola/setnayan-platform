import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { MEAL_LABELS, MEAL_PREFERENCES, type MealPreference } from '@/lib/guests';
import type { GuestAccountState } from '@/lib/guest-one-path';
import type { PlusOneAnswers, PlusOneRow } from '@/lib/plus-one-welcome';
import { SaveToAccount } from '../../_components/save-to-account';
import { PASS_CARD_WORDS } from '@/lib/pass-card';
import { composeFormalName, type FormalNameField } from '@/lib/formal-name';
import { FormalNameInputs } from '@/app/_components/formal-name-inputs';

/**
 * 👋 THE PLUS-ONE'S OWN DOOR — its body (the page, `../page.tsx`, reads the
 * rows and wraps this in the door shell). Prototype
 * `rsvp_plus_ones_2026-09-29.html`, frame F; owner 2026-09-29: *"plus guests
 * are only minimum questions … They also get their own QR Code. they can also
 * link it to their account."*
 *
 *   · YOUR DETAILS — what the bringer already filled, shown and marked "from
 *     Maria", never asked again ("Something wrong? Change it" opens the same
 *     boxes in place);
 *   · ONE MORE THING — only what is MISSING of the four (first name, last
 *     name, meal, dietary — meal and dietary only when the couple asks);
 *   · the Terms, then ONE "Save to my account" — the shipped `SaveToAccount`,
 *     the device's method, the answers saving with it (`through`);
 *   · "Not now — just show my pass" — their own QR, on this same door.
 *
 * No attendance, mobile, song, note or selfie — ever. Presentational: every
 * value arrives as a prop, so it renders the same in a test as on the page.
 */
export function PlusOneDoor({
  home,
  eventId,
  primaryFirst,
  theOrganizerPossessive,
  row,
  missing,
  filled,
  inside,
  account,
  personalLink,
  userAgent,
  termsCarried,
  passSvg,
  showPass,
  confirmAction,
  abandonAction,
}: {
  home: string;
  eventId: string;
  /** The bringer's first name — "from Maria". */
  primaryFirst: string;
  theOrganizerPossessive: string;
  row: PlusOneRow;
  missing: PlusOneAnswers;
  filled: PlusOneAnswers;
  /** Nothing REQUIRED is missing — the Event Hub will open for them. */
  inside: boolean;
  account: GuestAccountState;
  /** Their own invitation link — handed over where no provider can sign in. */
  personalLink: string | null;
  userAgent: string | null;
  termsCarried: boolean;
  passSvg: string | null;
  showPass: boolean;
  confirmAction: (formData: FormData) => Promise<void>;
  abandonAction: (formData: FormData) => Promise<void>;
}) {
  const wholeName = composeFormalName(row) ?? '';
  const meal = (row.meal_preference ?? '') as MealPreference | '';
  const missingCount = [missing.name, missing.meal, missing.dietary].filter(Boolean).length;
  const anyFilled = filled.name || filled.meal || filled.dietary;

  // The FIVE name parts every name box uses (owner 2026-09-30: *"The name will
  // be same: Prefix · First · Middle · Last · Suffix, to stay consistent"*) —
  // the shared boxes, never a first/last pair of this door's own.
  const nameBoxes = (defaults: Partial<Record<FormalNameField, string | null>>, required: boolean) => (
    <FormalNameInputs defaults={defaults} required={required} forSelf />
  );
  const mealBox = (defaultValue: string, required: boolean) => (
    <div className="space-y-1.5">
      <label htmlFor="meal_preference" className="block text-sm font-medium text-ink">
        Meal preference
      </label>
      <select
        id="meal_preference"
        name="meal_preference"
        required={required}
        defaultValue={defaultValue}
        className="input-field appearance-none bg-cream pr-8"
      >
        {required ? (
          <option value="" disabled>
            Choose one
          </option>
        ) : null}
        {MEAL_PREFERENCES.map((m) => (
          <option key={m} value={m}>
            {MEAL_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  );
  const dietaryBox = (defaultValue: string) => (
    <div className="space-y-1.5">
      <label htmlFor="dietary_restrictions" className="block text-sm font-medium text-ink">
        Dietary notes
      </label>
      <input
        id="dietary_restrictions"
        name="dietary_restrictions"
        type="text"
        maxLength={500}
        defaultValue={defaultValue}
        placeholder="halal · nut allergy · …"
        className="input-field"
      />
    </div>
  );

  const fields = (
    <div className="space-y-5" data-plus-one-welcome>
      {anyFilled ? (
        <section className="space-y-2" data-plus-one-filled>
          <p className="text-sm font-medium text-ink">Your details</p>
          <p className="text-xs text-ink/60">{primaryFirst} filled these in when they replied.</p>
          <dl className="divide-y divide-ink/10 border-y border-ink/10">
            {filled.name ? (
              <FromRow label="Name" value={wholeName} from={primaryFirst} />
            ) : null}
            {filled.meal ? (
              <FromRow
                label="Meal"
                value={MEAL_LABELS[meal as MealPreference] ?? String(row.meal_preference)}
                from={primaryFirst}
              />
            ) : null}
            {filled.dietary ? (
              <FromRow label="Dietary notes" value={String(row.dietary_restrictions)} from={primaryFirst} />
            ) : null}
          </dl>
          {/* The same boxes, in place — never a trip elsewhere to fix a typo. */}
          <details className="text-sm">
            <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-ink/70 underline underline-offset-4">
              Something wrong? Change it
            </summary>
            <div className="mt-2 space-y-4">
              {filled.name
                ? nameBoxes(
                    {
                      name_prefix: row.name_prefix ?? null,
                      first_name: row.first_name,
                      middle_name: row.middle_name ?? null,
                      last_name: row.last_name,
                      name_suffix: row.name_suffix ?? null,
                    },
                    false,
                  )
                : null}
              {filled.meal ? mealBox(meal, false) : null}
              {filled.dietary ? dietaryBox(String(row.dietary_restrictions ?? '')) : null}
            </div>
          </details>
        </section>
      ) : null}

      {missingCount > 0 ? (
        <section className="space-y-4" data-plus-one-missing>
          <p className="text-sm font-medium text-ink">{missingCount === 1 ? 'One more thing' : 'A few things'}</p>
          {missing.name ? nameBoxes({}, true) : null}
          {missing.meal ? mealBox('', true) : null}
          {missing.dietary ? dietaryBox('') : null}
          {missing.name ? (
            <p className="text-xs italic text-ink/50">
              This name will appear on your invitation, in {theOrganizerPossessive} guest list, and on
              photos you&rsquo;re tagged in.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  const notNow = (
    <p className="text-center text-sm text-ink/70">
      Not now —{' '}
      <button
        type="submit"
        name="then"
        value="pass"
        formNoValidate
        className="inline-flex min-h-[44px] items-center font-medium text-ink underline underline-offset-4"
      >
        just show my {PASS_CARD_WORDS.noun}
      </button>
    </p>
  );

  return (
    <>
      {passSvg ? (
        <section className="space-y-2 text-center" data-plus-one-pass aria-label={PASS_CARD_WORDS.yours}>
          <p className="text-sm font-medium text-ink">{PASS_CARD_WORDS.yours}</p>
          <div
            className="qr-slot mx-auto w-48 bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label={PASS_CARD_WORDS.yours}
            dangerouslySetInnerHTML={{ __html: passSvg }}
          />
          <p className="text-xs text-ink/60">Scans once at the door. It is also in Me, on the invitation.</p>
          {inside ? (
            <Link href={`/${home}`} className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink underline underline-offset-4">
              Open the invitation
            </Link>
          ) : null}
        </section>
      ) : null}

      {account.kind === 'offer' ? (
        <SaveToAccount
          state={account}
          eventId={eventId}
          slug={home}
          personalLink={personalLink}
          userAgent={userAgent}
          termsCarried={termsCarried}
          through={{ action: confirmAction, fields, after: showPass ? null : notNow }}
        />
      ) : (
        <>
          <form action={confirmAction} className="space-y-4">
            {fields}
            <SubmitButton name="then" value="done" className="button-primary h-14 w-full text-base" pendingLabel="Saving…">
              Save
            </SubmitButton>
            {showPass ? null : notNow}
          </form>
          <SaveToAccount
            state={account}
            eventId={eventId}
            slug={home}
            personalLink={personalLink}
            userAgent={userAgent}
            termsCarried={termsCarried}
          />
        </>
      )}

      {missing.name ? (
        <form action={abandonAction} className="text-center">
          <button type="submit" className="text-sm text-ink/60 underline-offset-4 hover:underline">
            This isn&rsquo;t me — I scanned the wrong code
          </button>
        </form>
      ) : null}
    </>
  );
}

/** One prefilled answer — shown, marked where it came from, never re-asked. */
function FromRow({ label, value, from }: { label: string; value: string; from: string }) {
  return (
    <div className="flex items-baseline gap-3 py-2" data-from-bringer>
      <dt className="w-24 shrink-0 text-xs text-ink/60">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-medium text-ink">{value}</dd>
      <span className="shrink-0 text-xs text-ink/55">from {from}</span>
    </div>
  );
}
