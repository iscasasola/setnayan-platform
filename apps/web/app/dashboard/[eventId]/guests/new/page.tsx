import Link from 'next/link';
import {
  fetchSingletonRoleHolders,
  GROUP_CATEGORY_LABELS,
  MEAL_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  type GuestGroupCategory,
  type GuestRole,
  type GuestSide,
  type MealPreference,
  type RsvpStatus,
} from '@/lib/guests';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { InvitedToChips } from '../_components/invited-to-chips';
import { createGuest } from './actions';

export const metadata = { title: 'Add guest' };

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please enter both first and last name.',
  missing_side: 'Choose which side this guest is on.',
  missing_group: 'Choose a group category for this guest.',
  invalid_role: 'Invalid role selection.',
  invalid_rsvp: 'Invalid RSVP status.',
  invalid_meal: 'Invalid meal preference.',
};

const SIDE_OPTIONS: GuestSide[] = ['bride', 'groom', 'both'];
const GROUP_OPTIONS: GuestGroupCategory[] = ['family', 'friends', 'work', 'school', 'officiant', 'other'];
const RSVP_OPTIONS: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];
const MEAL_OPTIONS: MealPreference[] = ['no_preference', 'beef', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids'];
const ROLE_OPTIONS: GuestRole[] = [
  'guest',
  'bride',
  'groom',
  // VIP family — owner directive 2026-05-23 PM (PR #424 lock).
  'bride_parents',
  'groom_parents',
  'bride_immediate_family',
  'groom_immediate_family',
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

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function NewGuestPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const rawError = search.error ? decodeURIComponent(search.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;

  // Hide bride/groom from the dropdown when already assigned in the event;
  // the DB partial unique indexes (migration 20260531010000) make a second
  // pick fail anyway, so don't offer the option in the first place.
  const supabase = await createClient();
  const singletonHolders = await fetchSingletonRoleHolders(supabase, eventId);
  const availableRoles = ROLE_OPTIONS.filter((r) => !(r in singletonHolders));

  const action = createGuest.bind(null, eventId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <Link
          href={`/dashboard/${eventId}/guests`}
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to guest list
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Add a guest</h1>
        <p className="text-sm text-ink/60">
          First and last name + side + group are required. Everything else is optional.
        </p>
      </header>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <form action={action} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="first_name" label="First name *" required placeholder="Maria" />
          <Field id="last_name" label="Last name *" required placeholder="de la Cruz" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="side"
            label="Side *"
            required
            options={SIDE_OPTIONS.map((v) => ({ value: v, label: SIDE_LABELS[v] }))}
          />
          <Select
            id="group_category"
            label="Group *"
            required
            options={GROUP_OPTIONS.map((v) => ({
              value: v,
              label: GROUP_CATEGORY_LABELS[v],
            }))}
          />
        </div>

        <Select
          id="role"
          label="Role in wedding"
          defaultValue="guest"
          options={availableRoles.map((v) => ({ value: v, label: ROLE_LABELS[v] }))}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="email" label="Email" type="email" placeholder="maria@example.com" />
          <Field id="mobile" label="Mobile" placeholder="+63 …" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="rsvp_status"
            label="RSVP status"
            defaultValue="pending"
            options={RSVP_OPTIONS.map((v) => ({ value: v, label: RSVP_LABELS[v] }))}
          />
          <Select
            id="meal_preference"
            label="Meal preference"
            defaultValue="no_preference"
            options={MEAL_OPTIONS.map((v) => ({ value: v, label: MEAL_LABELS[v] }))}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink">Invited to</label>
          {/*
            Smart defaults by role · locked 2026-05-23 PM. Inner-circle
            roles (couple, parents, immediate family, primary wedding
            party, principal sponsors) populate all 5 blocks; the rest
            populate ceremony + reception + cocktails. Snaps when the
            host changes the Role dropdown above — the client island
            listens to the role <select id="role"> on this page.
          */}
          <InvitedToChips roleSelectId="role" initialRole="guest" />
          <p className="text-xs text-ink/50">
            Picks smart defaults from the Role above. Toggle any block the guest
            isn&rsquo;t invited to.
          </p>
        </div>

        <PlusOneToggle />

        <Field
          id="custom_tags"
          label="Custom tags (comma-separated)"
          placeholder="vip, college-friends, ninang"
        />

        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="photo_consent"
              defaultChecked
              className="h-5 w-5 rounded border-ink/30 text-terracotta focus:ring-terracotta"
            />
            <span>
              <span className="font-medium">Photo consent</span>{' '}
              <span className="text-ink/60">
                — guest agrees to be tagged in the event gallery (per RA 10173).
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-medium text-ink">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Private to you — dietary notes, mobility needs, anything else."
            className="input-field min-h-[88px] resize-y py-2"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Saving…">
            Save guest
          </SubmitButton>
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="button-secondary w-full sm:w-auto"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function PlusOneToggle() {
  return (
    <details className="rounded-lg border border-ink/15 bg-cream open:border-terracotta/40">
      <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink">
        <span className="select-none">+ Add a plus-one for this guest</span>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
          optional
        </span>
      </summary>
      <div className="space-y-4 border-t border-ink/10 p-4">
        <input type="hidden" name="plus_one_allowed" value="on" />
        <p className="text-xs text-ink/60">
          A second guest row will be created for the +1, with its own QR. Leave names blank for TBA.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="plus_one_first_name" label="Plus-one first name" placeholder="(or leave blank for TBA)" />
          <Field id="plus_one_last_name" label="Plus-one last name" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink">Plus-one access mode</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-lg border border-ink/15 bg-cream p-3 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5">
              <input type="radio" name="plus_one_mode" value="full" defaultChecked className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-ink">Full</span>
                <span className="block text-xs text-ink/60">
                  Full guest experience — own invitation site, can join Setnayan account, can use Papic / Patiktok / reels.
                </span>
              </span>
            </label>
            <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-lg border border-ink/15 bg-cream p-3 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/5">
              <input type="radio" name="plus_one_mode" value="limited" className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-ink">Limited</span>
                <span className="block text-xs text-ink/60">
                  Tagging + RSVP only. No Shutter / Selfie Camera / Challenges. Their tagged photos route to the inviter&rsquo;s gallery.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </details>
  );
}

function Field({
  id,
  label,
  required = false,
  type = 'text',
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
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
        {!required && !defaultValue ? <option value="">—</option> : null}
        {required && !defaultValue ? <option value="">Choose…</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
