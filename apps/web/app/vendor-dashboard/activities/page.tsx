import { redirect } from 'next/navigation';
import { Check, ChevronDown, ChevronUp, CircleOff, Clock, Plus, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_SUBLINE, TemplateEmpty, TemplateFail, TemplateSection } from '@/app/_components/template-rows';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { SCHEDULE_BLOCK_LABEL, SCHEDULE_BLOCK_TYPES } from '@/lib/schedule';
import { offeredCatalogue, totalMinutes, type VendorActivity } from '@/lib/vendor-activities';
import { logQueryError } from '@/lib/supabase/error-detect';
import { QuestionsSection } from './questions-section';
import { startersForShopServices } from '@/lib/supplier-question-starters.server';
import {
  addActivity,
  reorderActivity,
  toggleActivityOffered,
  updateActivity,
} from './actions';
import { StayForm } from '@/app/_components/stay-form';

export const metadata = { title: 'Your segments · Supplier' };

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
    <section className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6">
      {/* Rule 1 — the pinned row names the page; the heading stays for a screen reader only. */}
      <h1 className="sr-only">What you do on the night</h1>

      {sp.error ? (
        <p role="alert" className="py-2 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
          {sp.error}
        </p>
      ) : null}

      {/* Add */}
      <TemplateSection
        label="Add a segment"
        first
        tip="Write your programme once — the roll call, the games — and every couple after picks from it. It stays yours."
      >
        <StayForm door="supActivities.addActivity" action={addActivity} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <label className="block">
              <span className="sr-only">Segment name</span>
              <input
                name="label"
                required
                maxLength={80}
                placeholder="e.g. Principal sponsors roll call"
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className="sr-only">How long it takes</span>
              <select name="duration_minutes" defaultValue={15} className={FIELD}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Where in the day</span>
              <select name="block_type" defaultValue="program" className={FIELD}>
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
              className={FIELD}
            />
          </label>
          <ActionButton type="submit" tone="brand" main icon={<Plus aria-hidden />} label="Add segment" />
        </StayForm>
      </TemplateSection>

      {/* The list */}
      <TemplateSection
        label={`Your menu · ${offered.length} ${offered.length === 1 ? 'segment' : 'segments'}`}
        right={
          offered.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="h-4 w-4" strokeWidth={1.9} />
              {minutes} min end to end
            </span>
          ) : null
        }
      >
        {!measured ? (
          <TemplateFail data="activities">
            <strong>We couldn&rsquo;t load your segments.</strong> Your list has not been emptied
            and couples can still pick from it — reload before writing it out again.
          </TemplateFail>
        ) : offered.length === 0 ? (
          <TemplateEmpty data="activities">
            Nothing here yet. Add the segments you actually run — a couple can only pick from
            what you have written down.
          </TemplateEmpty>
        ) : (
          <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
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
      </TemplateSection>

      {retired.length > 0 ? (
        <details className="mt-[18px]">
          <summary className="flex min-h-11 cursor-pointer items-center text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
            Not offering · {retired.length}
          </summary>
          <p className={TEMPLATE_SUBLINE}>
            Kept, not deleted — couples who already picked these still see them on their day.
          </p>
          <ul className="mt-1 [&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
            {retired.map((a) => (
              <li key={a.activity_id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <span className="text-[15px] text-ink">{a.label}</span>
                <StayForm door="supActivities.toggleActivityOffered" action={toggleActivityOffered}>
                  <input type="hidden" name="activity_id" value={a.activity_id} />
                  <input type="hidden" name="is_offered" value="true" />
                  <ActionButton type="submit" tone="neutral" icon={<RotateCcw aria-hidden />} label="Offer again" />
                </StayForm>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* DAY-7 · what only the couple can tell them — the supplier's reusable questions. ❓ Every supplier since
          2026-11-04 (owner "Yes, every supplier"): the shop's own doorway lands on `#questions`, and the starting
          suggestions follow the shop's trade through the live taxonomy. */}
      <QuestionsSection
        supabase={supabase}
        vendorProfileId={profile.vendor_profile_id}
        starters={await startersForShopServices(profile.services)}
      />
    </section>
  );
}

/** A typed field — the template's 12-corner field, 44 high, on the page's own paper. */
const FIELD =
  'w-full min-h-11 rounded-xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-[15px] text-ink placeholder:text-[color:var(--m-slate-2)]'; // no-card-ok: a typed field's own outline (inputs / selects / textareas), not a box around content

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
    <li className="py-3">
      <StayForm door="supActivities.updateActivity" action={updateActivity} className="space-y-2">
        <input type="hidden" name="activity_id" value={activity.activity_id} />
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            name="label"
            defaultValue={activity.label}
            maxLength={80}
            aria-label="Segment name"
            className={`${FIELD} font-medium`}
          />
          <select
            name="duration_minutes"
            defaultValue={activity.duration_minutes}
            aria-label="How long it takes"
            className={FIELD}
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
            className={FIELD}
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
          className={FIELD}
        />
        <ActionButton type="submit" tone="brand" icon={<Check aria-hidden />} label="Save" />
      </StayForm>

      <div className="mt-2 flex items-center gap-2">
        <MoveButton activityId={activity.activity_id} direction="up" disabled={isFirst} />
        <MoveButton activityId={activity.activity_id} direction="down" disabled={isLast} />
        <StayForm door="supActivities.toggleActivityOffered" action={toggleActivityOffered} className="ml-auto">
          <input type="hidden" name="activity_id" value={activity.activity_id} />
          <input type="hidden" name="is_offered" value="false" />
          <ActionButton type="submit" tone="neutral" quiet icon={<CircleOff aria-hidden />} label="Stop offering" />
        </StayForm>
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
    <StayForm door="supActivities.reorderActivity" action={reorderActivity}>
      <input type="hidden" name="activity_id" value={activityId} />
      <input type="hidden" name="direction" value={direction} />
      <ActionButton
        type="submit"
        tone="neutral"
        iconOnly
        disabled={disabled}
        icon={<Icon aria-hidden strokeWidth={1.9} />}
        label={direction === 'up' ? 'Move earlier' : 'Move later'}
      />
    </StayForm>
  );
}
