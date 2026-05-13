import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  fetchGuestById,
  guestDisplayName,
  GROUP_CATEGORY_LABELS,
  INVITED_TO_BLOCKS,
  INVITED_TO_LABELS,
  MEAL_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type InvitedToBlock,
  type MealPreference,
  type RsvpStatus,
} from '@/lib/guests';
import { softDeleteGuest, updateGuest } from './actions';

export const metadata = { title: 'Guest detail' };

const ROLE_OPTIONS: GuestRole[] = [
  'guest',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];
const SIDE_OPTIONS: GuestSide[] = ['bride', 'groom', 'both'];
const GROUP_OPTIONS: GuestGroupCategory[] = [
  'family',
  'friends',
  'work',
  'school',
  'officiant',
  'other',
];
const MEAL_OPTIONS: MealPreference[] = [
  'no_preference',
  'beef',
  'chicken',
  'fish',
  'vegetarian',
  'vegan',
  'kids',
];
const RSVP_OPTIONS: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please enter both first and last name.',
  missing_side: 'Choose which side this guest is on.',
  missing_group: 'Choose a group category for this guest.',
  invalid_role: 'Invalid role selection.',
  invalid_rsvp: 'Invalid RSVP status.',
  invalid_meal: 'Invalid meal preference.',
};

type Props = {
  params: Promise<{ eventId: string; guestId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function GuestDetailPage({ params, searchParams }: Props) {
  const { eventId, guestId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const guest = await fetchGuestById(supabase, eventId, guestId);
  if (!guest) notFound();

  const rawError = search.error ? decodeURIComponent(search.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const saved = search.saved === '1';

  const updateAction = updateGuest.bind(null, eventId, guestId);
  const deleteAction = softDeleteGuest.bind(null, eventId, guestId);

  const invitedSet = new Set(guest.invited_to_blocks);
  const tagsValue = guest.custom_tags.join(', ');

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <Link
          href={`/dashboard/${eventId}/guests`}
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to guest list
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {guestDisplayName(guest)}
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">
          {guest.public_id}
        </p>
      </header>

      {saved ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Saved.
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <form action={updateAction} className="space-y-5">
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium uppercase tracking-[0.15em] text-ink/55">
            Identity
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="first_name" label="First name *" required defaultValue={guest.first_name} />
            <Field id="last_name" label="Last name *" required defaultValue={guest.last_name} />
          </div>
          <Field id="display_name" label="Display name (optional)" defaultValue={guest.display_name ?? ''} placeholder="e.g. Tito Boy &amp; Tita Cora" />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium uppercase tracking-[0.15em] text-ink/55">
            Categorization
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              id="side"
              label="Side *"
              required
              defaultValue={guest.side}
              options={SIDE_OPTIONS.map((v) => ({ value: v, label: SIDE_LABELS[v] }))}
            />
            <Select
              id="group_category"
              label="Group *"
              required
              defaultValue={guest.group_category}
              options={GROUP_OPTIONS.map((v) => ({ value: v, label: GROUP_CATEGORY_LABELS[v] }))}
            />
          </div>
          <Select
            id="role"
            label="Role in wedding"
            defaultValue={guest.role}
            options={ROLE_OPTIONS.map((v) => ({ value: v, label: ROLE_LABELS[v] }))}
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium uppercase tracking-[0.15em] text-ink/55">
            RSVP &amp; events
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              id="rsvp_status"
              label="RSVP status"
              defaultValue={guest.rsvp_status}
              options={RSVP_OPTIONS.map((v) => ({ value: v, label: RSVP_LABELS[v] }))}
            />
            <Select
              id="meal_preference"
              label="Meal preference"
              defaultValue={guest.meal_preference ?? 'no_preference'}
              options={MEAL_OPTIONS.map((v) => ({ value: v, label: MEAL_LABELS[v] }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">Invited to</label>
            <div className="flex flex-wrap gap-2">
              {INVITED_TO_BLOCKS.map((block) => (
                <label
                  key={block}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-sm has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700"
                >
                  <input
                    type="checkbox"
                    name={`invited_${block}`}
                    defaultChecked={invitedSet.has(block)}
                    className="sr-only"
                  />
                  {INVITED_TO_LABELS[block]}
                </label>
              ))}
            </div>
          </div>
          <Field
            id="dietary_restrictions"
            label="Dietary restrictions"
            defaultValue={guest.dietary_restrictions ?? ''}
            placeholder="halal · nut allergy · ..."
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium uppercase tracking-[0.15em] text-ink/55">
            Contact
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="email" label="Email" type="email" defaultValue={guest.email ?? ''} />
            <Field id="mobile" label="Mobile" defaultValue={guest.mobile ?? ''} placeholder="+63 …" />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium uppercase tracking-[0.15em] text-ink/55">
            Tags &amp; notes
          </legend>
          <Field
            id="custom_tags"
            label="Custom tags (comma-separated)"
            defaultValue={tagsValue}
            placeholder="vip, college-friends, ninang"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="notes">
              Notes (private)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={guest.notes ?? ''}
              className="input-field min-h-[88px] resize-y py-2"
            />
          </div>
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="photo_consent"
              defaultChecked={guest.photo_consent}
              className="h-5 w-5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
            />
            <span>
              <span className="font-medium">Photo consent</span>{' '}
              <span className="text-ink/60">— guest agrees to be tagged (RA 10173).</span>
            </span>
          </label>
        </fieldset>

        <div className="flex flex-col-reverse gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:justify-between">
          <DeleteForm action={deleteAction} guestName={guestDisplayName(guest)} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/dashboard/${eventId}/guests`} className="button-secondary">
              Cancel
            </Link>
            <button type="submit" className="button-primary">
              Save changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function DeleteForm({
  action,
  guestName,
}: {
  action: (formData: FormData) => Promise<void>;
  guestName: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline"
        aria-label={`Remove ${guestName}`}
      >
        Remove guest
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  required = false,
  type = 'text',
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <input
        className="input-field"
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </div>
  );
}

function Select({
  id,
  label,
  options,
  required = false,
  defaultValue,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        required={required}
        className="input-field appearance-none bg-cream pr-8"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
