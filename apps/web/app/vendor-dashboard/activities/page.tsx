import { redirect } from 'next/navigation';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { SCHEDULE_BLOCK_LABEL, SCHEDULE_BLOCK_TYPES } from '@/lib/schedule';
import { offeredCatalogue, totalMinutes, type VendorActivity } from '@/lib/vendor-activities';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  addActivity,
  reorderActivity,
  toggleActivityOffered,
  updateActivity,
} from './actions';

export const metadata = { title: 'Your segments · Vendor' };

/**
 * THE EMCEE'S SEGMENTS — where a host/MC writes down what he does, once.
 *
 * Sibling of `/vendor-dashboard/repertoire` (a band's songs), and deliberately
 * the same kind of screen: a vendor-owned reusable list, plain form posts, no
 * client state machine. What differs is the payload — a segment carries a
 * LENGTH, because that is what lets a picked one become a block on the
 * couple's timeline.
 *
 * WHY THIS IS WORTH THE VENDOR'S TIME (the copy says it, and it is true): the
 * list is written once and reused for every customer after. It is the emcee's
 * craft, and per the owner's 2026-07-27 split it travels with him while a
 * couple's answers never do.
 *
 * RETIRE, NEVER DELETE. Past couples' picks reference these rows; deleting one
 * would cascade their pick away and rewrite a day they can still look back on.
 * So the only removal on this screen is a soft "stop offering".
 */

const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90] as const;

export default async function VendorActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/activities');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard/verify');

  const { data, error: activitiesError } = await supabase
    .from('vendor_activities')
    .select(
      'activity_id, vendor_profile_id, label, blurb, duration_minutes, block_type, is_offered, display_order',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('display_order', { ascending: true });

  // ⚠ THE PROGRAMME THEY WROTE ONCE AND REUSE AT EVERY WEDDING. Refused, `?? []`
  // ⚠ empties it, and this page's whole promise — "you keep the list, it stays
  // ⚠ yours from wedding to wedding" — reads as broken.
  if (activitiesError) {
    logQueryError(
      'VendorActivitiesPage.activities',
      activitiesError,
      { vendorProfileId: profile.vendor_profile_id },
      'graceful_degrade',
    );
  }
  const measured = !activitiesError && data !== null;
  const all = (data ?? []) as VendorActivity[];
  const offered = offeredCatalogue(all);
  const retired = all.filter((a) => !a.is_offered);
  const minutes = totalMinutes(offered);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
          What you do on the night
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink/70">
          Write your programme down once — the roll call, the games, the bits that always
          land — and every couple after this picks from it. They see the list; you keep the
          list. It stays yours from wedding to wedding.
        </p>
      </header>

      {sp.error ? (
        <p role="alert" className="border border-terracotta-700/40 bg-terracotta-700/5 px-4 py-3 text-sm text-terracotta-700">
          {sp.error}
        </p>
      ) : null}

      {/* Add */}
      <form action={addActivity} className="space-y-3 border border-ink/10 bg-paper-deep p-4">
        <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
          Add a segment
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className="sr-only">Segment name</span>
            <input
              name="label"
              required
              maxLength={80}
              placeholder="e.g. Principal sponsors roll call"
              className="w-full border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40"
            />
          </label>
          <label className="block">
            <span className="sr-only">How long it takes</span>
            <select
              name="duration_minutes"
              defaultValue={15}
              className="w-full border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Where in the day</span>
            <select
              name="block_type"
              defaultValue="program"
              className="w-full border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
            >
              {SCHEDULE_BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SCHEDULE_BLOCK_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="sr-only">What it is</span>
          <textarea
            name="blurb"
            rows={2}
            maxLength={400}
            placeholder="What happens, in your words — the couple reads this while choosing."
            className="w-full border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40"
          />
        </label>
        <button
          type="submit"
          className="bg-ink px-4 py-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paper transition-opacity hover:opacity-90"
        >
          Add segment
        </button>
      </form>

      {/* The list */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
            Your menu · {offered.length} {offered.length === 1 ? 'segment' : 'segments'}
          </h2>
          {offered.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink/55">
              <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
              {minutes} min end to end
            </span>
          ) : null}
        </div>

        {!measured ? (
          <p
            role="alert"
            className="border-t-[3px] border-mulberry/70 bg-mulberry/5 px-4 py-3 text-sm leading-relaxed text-ink/70"
          >
            <strong className="text-ink">We couldn&rsquo;t load your segments.</strong>{' '}
            Your list has not been emptied and couples can still pick from it —
            it just is not showing here. Reload before writing it out again.
          </p>
        ) : offered.length === 0 ? (
          <p className="border border-dashed border-ink/15 px-4 py-8 text-center text-sm leading-relaxed text-ink/65">
            Nothing here yet. Add the segments you actually run — a couple can only pick
            from what you have written down.
          </p>
        ) : (
          <ul className="space-y-2">
            {offered.map((a, i) => (
              <ActivityRow
                key={a.activity_id}
                activity={a}
                isFirst={i === 0}
                isLast={i === offered.length - 1}
              />
            ))}
          </ul>
        )}
      </div>

      {retired.length > 0 ? (
        <details className="border border-ink/10 bg-paper-deep p-4">
          <summary className="cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/60">
            Not offering · {retired.length}
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-ink/60">
            Kept, not deleted — couples who already picked these still see them on their day.
          </p>
          <ul className="mt-3 space-y-2">
            {retired.map((a) => (
              <li key={a.activity_id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink/70">{a.label}</span>
                <form action={toggleActivityOffered}>
                  <input type="hidden" name="activity_id" value={a.activity_id} />
                  <input type="hidden" name="is_offered" value="true" />
                  <button
                    type="submit"
                    className="border border-ink/15 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-ink/70 transition-colors hover:border-gild"
                  >
                    Offer again
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** One segment: editable in place, movable, retirable. */
function ActivityRow({
  activity,
  isFirst,
  isLast,
}: {
  activity: VendorActivity;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <li className="border border-ink/10 bg-white p-3">
      <form action={updateActivity} className="space-y-2">
        <input type="hidden" name="activity_id" value={activity.activity_id} />
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            name="label"
            defaultValue={activity.label}
            maxLength={80}
            aria-label="Segment name"
            className="w-full border border-ink/15 px-2.5 py-1.5 text-sm font-medium text-ink"
          />
          <select
            name="duration_minutes"
            defaultValue={activity.duration_minutes}
            aria-label="How long it takes"
            className="border border-ink/15 px-2.5 py-1.5 text-sm text-ink"
          >
            {[...new Set([...DURATIONS, activity.duration_minutes])]
              .sort((a, b) => a - b)
              .map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
          </select>
          <select
            name="block_type"
            defaultValue={activity.block_type}
            aria-label="Where in the day"
            className="border border-ink/15 px-2.5 py-1.5 text-sm text-ink"
          >
            {SCHEDULE_BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {SCHEDULE_BLOCK_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="blurb"
          defaultValue={activity.blurb ?? ''}
          rows={2}
          maxLength={400}
          aria-label="What it is"
          placeholder="What happens, in your words."
          className="w-full border border-ink/15 px-2.5 py-1.5 text-sm text-ink placeholder:text-ink/40"
        />
        <button
          type="submit"
          className="border border-ink/15 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-ink/75 transition-colors hover:border-gild"
        >
          Save
        </button>
      </form>

      <div className="mt-2 flex items-center gap-2 border-t border-ink/10 pt-2">
        <MoveButton activityId={activity.activity_id} direction="up" disabled={isFirst} />
        <MoveButton activityId={activity.activity_id} direction="down" disabled={isLast} />
        <form action={toggleActivityOffered} className="ml-auto">
          <input type="hidden" name="activity_id" value={activity.activity_id} />
          <input type="hidden" name="is_offered" value="false" />
          <button
            type="submit"
            className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-ink/55 underline-offset-4 hover:text-terracotta-700 hover:underline"
          >
            Stop offering
          </button>
        </form>
      </div>
    </li>
  );
}

function MoveButton({
  activityId,
  direction,
  disabled,
}: {
  activityId: string;
  direction: 'up' | 'down';
  disabled: boolean;
}) {
  const Icon = direction === 'up' ? ChevronUp : ChevronDown;
  return (
    <form action={reorderActivity}>
      <input type="hidden" name="activity_id" value={activityId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === 'up' ? 'Move earlier' : 'Move later'}
        className="inline-flex h-7 w-7 items-center justify-center border border-ink/15 text-ink/60 transition-colors hover:border-gild disabled:opacity-30"
      >
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
      </button>
    </form>
  );
}
