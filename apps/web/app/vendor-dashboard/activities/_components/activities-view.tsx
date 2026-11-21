import type { ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, CircleOff, Clock, Plus, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_SUBLINE, TemplateEmpty } from '@/app/_components/template-rows';
import { Fold } from '@/app/_components/fold';
import { StayForm } from '@/app/_components/stay-form';
import { SCHEDULE_BLOCK_LABEL } from '@/lib/schedule';
import type { VendorActivity } from '@/lib/vendor-activities';
import { ToolPage, ToolPin, ToolSection } from '../../_components/tool-page';
import { ToolAddSheet } from '../../_components/tool-add-sheet';
import { reorderActivity, toggleActivityOffered } from '../actions';
import { SegmentForm } from './segment-form';

/**
 * Your segments — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 08). Look
 * only: name, duration list (5–90 min, plus any odd saved value), where in the day, blurb, Save, Move earlier / later,
 * Stop offering, the Not offering fold with Offer again, and the questions block (`questions`, the ONE shared
 * component) are the shipped page's. "Add a segment" is the thumb row's ＋ now. On a computer: segments | questions.
 * Presentational — the page and `/dev/supplier-tools-lab` mount it; the page measures the read and hands `unread`.
 */

export function ActivitiesView({
  offered,
  retired,
  minutes,
  measured,
  unread,
  questions,
  sp,
}: {
  offered: VendorActivity[];
  retired: VendorActivity[];
  minutes: number;
  /** The segments read ran — else `unread` is said in the list's place, never "Nothing here yet". */
  measured: boolean;
  unread: ReactNode;
  questions: ReactNode;
  sp: { error?: string };
}) {
  return (
    <ToolPage name="activities">
      {/* The redraw (v3, 21 Nov 2026): the pinned row names the page and carries the night's length. */}
      <ToolPin
        route="/vendor-dashboard/activities"
        title="Your segments"
        right={
          offered.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="h-4 w-4" strokeWidth={1.9} />
              {minutes} min
            </span>
          ) : null
        }
      />

      {sp.error ? (
        <p role="alert" className="py-2 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
          {sp.error}
        </p>
      ) : null}

      <div className="tab:grid tab:grid-cols-2 tab:items-start tab:gap-6">
        <div>
          {/* The list */}
          <ToolSection
            label="Your menu"
            count={measured ? offered.length : undefined}
            tip="Write your programme once — the roll call, the games — and every couple after picks from it. It stays yours."
            right={offered.length > 0 ? `${minutes} min end to end` : undefined}
            data="activities"
          >
            {!measured ? (
              unread
            ) : offered.length === 0 ? (
              <TemplateEmpty data="activities">
                Nothing here yet. Add the segments you actually run — a couple can only pick from
                what you have written down.
              </TemplateEmpty>
            ) : (
              <ul className="sn-frame px-4 py-1">
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
          </ToolSection>

          {retired.length > 0 ? (
            <div className="sn-frame mt-3 px-4 py-1">
              <Fold title={`Not offering · ${retired.length}`} data="activities-retired">
                <p className={`pb-1 ${TEMPLATE_SUBLINE}`}>
                  Kept, not deleted — couples who already picked these still see them on their day.
                </p>
                <ul className="pb-2">
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
              </Fold>
            </div>
          ) : null}
        </div>

        <div>
          {questions}
        </div>
      </div>

      {/* Add — the thumb row's ＋ rises the shipped form (it sat open at the top of the page). */}
      <ToolAddSheet name="activities" label="Add a segment" title="Add a segment">
          <SegmentForm submit={<ActionButton type="submit" tone="brand" main icon={<Plus aria-hidden />} label="Add segment" />} />
      </ToolAddSheet>
    </ToolPage>
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
    <li>
      <Fold
        title={activity.label}
        line={`${activity.duration_minutes} min · ${SCHEDULE_BLOCK_LABEL[activity.block_type as keyof typeof SCHEDULE_BLOCK_LABEL] ?? activity.block_type}`}
        data="activity"
      >
      <div className="pb-4 pt-1">
      <SegmentForm activity={activity} submit={<div><ActionButton type="submit" tone="brand" icon={<Check aria-hidden />} label="Save" /></div>} />

      <div className="mt-2 flex items-center gap-2">
        <MoveButton activityId={activity.activity_id} direction="up" disabled={isFirst} />
        <MoveButton activityId={activity.activity_id} direction="down" disabled={isLast} />
        <StayForm door="supActivities.toggleActivityOffered" action={toggleActivityOffered} className="ml-auto">
          <input type="hidden" name="activity_id" value={activity.activity_id} />
          <input type="hidden" name="is_offered" value="false" />
          <ActionButton type="submit" tone="neutral" quiet icon={<CircleOff aria-hidden />} label="Stop offering" />
        </StayForm>
      </div>
      </div>
      </Fold>
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
