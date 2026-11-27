'use client';

/**
 * A segment's fields — the drawing's opened row and its "Add a segment" sheet (owner-approved redraw v3, 21 Nov 2026 ·
 * `supplier_tools_redraw_v3_fable.html` § 08): "Segment name", "How long it takes", "Where in the day" as the house
 * form rows (a name on the left, its answer in a pill on the right — `TypedRow` / `ChosenRow`), the blurb in its box.
 * The SAME fields post under the SAME names (`label` · `duration_minutes` · `block_type` · `blurb`) to the SAME actions
 * (`addActivity` / `updateActivity`); the durations are the shipped list (5–90 min) plus any odd saved value.
 */
import { useState, type ReactNode } from 'react';
import { ChosenRow, TypedRow } from '@/app/_components/form-row';
import { StayForm } from '@/app/_components/stay-form';
import { SCHEDULE_BLOCK_LABEL, SCHEDULE_BLOCK_TYPES } from '@/lib/schedule';
import type { VendorActivity } from '@/lib/vendor-activities';
import { addActivity, updateActivity } from '../actions';

export const SEGMENT_DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90] as const;

export function SegmentForm({ activity, submit }: { activity?: VendorActivity; submit: ReactNode }) {
  const [label, setLabel] = useState(activity?.label ?? '');
  const [minutes, setMinutes] = useState(String(activity?.duration_minutes ?? 15));
  const [block, setBlock] = useState(activity?.block_type ?? 'program');
  const [blurb, setBlurb] = useState(activity?.blurb ?? '');
  const durations = [...new Set<number>([...SEGMENT_DURATIONS, ...(activity ? [activity.duration_minutes] : [])])].sort((a, b) => a - b);
  const fields = (
    <>
      <TypedRow
        name="Segment name"
        value={label}
        required
        maxLength={80}
        fieldName="label"
        onType={setLabel}
        onKeep={(t) => setLabel(t)}
        data="segment-name"
      />
      <input type="hidden" name="duration_minutes" value={minutes} />
      <ChosenRow
        name="How long it takes"
        value={minutes}
        options={durations.map((d) => ({ key: String(d), label: `${d} min` }))}
        onPick={setMinutes}
        data="segment-minutes"
      />
      <input type="hidden" name="block_type" value={block} />
      <ChosenRow
        name="Where in the day"
        value={block}
        options={SCHEDULE_BLOCK_TYPES.map((t) => ({ key: t, label: SCHEDULE_BLOCK_LABEL[t] }))}
        onPick={setBlock}
        data="segment-block"
      />
      <TypedRow
        name="What it is"
        value={blurb}
        empty={activity ? 'What happens, in your words.' : 'What happens, in your words — the couple reads this while choosing.'}
        long
        boxed
        maxLength={400}
        fieldName="blurb"
        onType={setBlurb}
        onKeep={(t) => setBlurb(t)}
        data="segment-blurb"
      />
    </>
  );
  return activity ? (
    <StayForm door="supActivities.updateActivity" action={updateActivity} className="flex flex-col gap-2">
      <input type="hidden" name="activity_id" value={activity.activity_id} />
      {fields}
      {submit}
    </StayForm>
  ) : (
    <StayForm door="supActivities.addActivity" action={addActivity} className="flex flex-col gap-2">
      {fields}
      {submit}
    </StayForm>
  );
}
