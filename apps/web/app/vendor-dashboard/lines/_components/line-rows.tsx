'use client';

/**
 * My lines — the rows (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 09). Look only —
 * the same three actions and fields:
 *   · each line is ONE row that opens in place (the shared `Fold`, one at a time): the line itself, where it matches and
 *     "used N×". Open: the edit box and Save (`updateLine`), the blanks it fills, "Tied to" + Update match
 *     (`attachLineToActivity`).
 *   · REMOVE IS A SWIPE LEFT WITH UNDO (controller 21 Nov): the row hides at once and the SAME `deleteLine` is written
 *     after the Undo window (`deleteWithUndo`, through its StayForm door — its answer is read, never a navigation).
 *   · 🔴 A FAILED SEGMENTS READ IS SAID (controller 21 Nov): the "Tied to" picker used to vanish in silence when the
 *     segments could not be read. Its place now says "Couldn't load your segments" with Try again.
 *     🔒 app/vendor-dashboard/a-failed-tool-read-is-never-clean.test.ts
 */
import { useState } from 'react';
import { Check, EyeOff, Link2, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Fold } from '@/app/_components/fold';
import { StayForm } from '@/app/_components/stay-form';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { saveInPlace } from '@/app/_actions/save-in-place';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { ChosenRow, TypedRow } from '@/app/_components/form-row';
import { ToolChip } from '../../_components/tool-page';
import { attachLineToActivity, updateLine } from '../actions';

export type LineRow = {
  line_id: string;
  activity_id: string | null;
  label_key: string | null;
  block_type: string | null;
  body: string;
  is_private_note: boolean;
  use_count: number;
  last_used_at: string | null;
};

export type LineActivity = { activity_id: string; label: string };

/** A line as the page shows it — its match, its blanks, read by the page. */
export type ShownLine = LineRow & { matched: string; slots: string[] };

export function LineRows({
  lines,
  activities,
  notes = false,
}: {
  lines: readonly ShownLine[];
  /** His segments — or null when they could not be read (said in the picker's place, never hidden). */
  activities: readonly LineActivity[] | null;
  /** Notes to yourself: never reused, Remove only. */
  notes?: boolean;
}) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const shown = lines.filter((l) => !hidden.has(l.line_id));

  const remove = (line: ShownLine) =>
    deleteWithUndo({
      label: notes ? 'Note removed' : 'Line removed',
      hide: () => setHidden((h) => new Set(h).add(line.line_id)),
      restore: () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(line.line_id);
          return next;
        }),
      commit: () => {
        const fd = new FormData();
        fd.set('line_id', line.line_id);
        return saveInPlace('supLines.deleteLine', fd);
      },
      failed: 'Couldn’t remove that line. It’s back — try again.',
    });

  return (
    <>
      <ul className="sn-frame px-4 py-1" data-lines={notes ? 'notes' : 'spoken'}>
        {shown.map((line) => (
          <SwipeToDelete
            key={line.line_id}
            as="li"
            label={notes ? 'Remove this note' : 'Remove this line'}
            word="Remove"
            onDelete={() => remove(line)}
            radiusClass=""
            surfaceClass="bg-[rgb(var(--sn-frame-bg))]"
          >
            {notes ? (
              <div className="flex min-h-14 items-start gap-3 py-2.5">
                <EyeOff aria-hidden className="mt-0.5 h-[18px] w-[18px] flex-none text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold leading-snug text-ink">{line.body}</b>
                  <span className="mt-1 inline-flex">
                    <ToolChip tone="quiet">Never reused</ToolChip>
                  </span>
                </span>
              </div>
            ) : (
              <Fold title={line.body} line={`${line.matched}${line.use_count > 0 ? ` · used ${line.use_count}×` : ''}`} wrap lineWrap data="line">
                <div className="flex flex-col gap-2.5 pb-4 pt-1">
                  <LineEdit line={line} />

                  {/* rung 2 → rung 1: make a by-name guess into an exact match. */}
                  {activities === null ? (
                    <div role="alert" className="flex flex-wrap items-center gap-2 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-warn))' }} data-template-fail="lines-segments">
                      <Link2 aria-hidden className="h-4 w-4" />
                      <span className="flex-1">Tied to · Couldn’t load your segments</span>
                      <ActionButton tone="neutral" icon={<RotateCcw aria-hidden />} label="Try again" href="/vendor-dashboard/lines" prefetch={false} />
                    </div>
                  ) : activities.length > 0 ? (
                    <LineTie line={line} activities={activities} />
                  ) : null}
                </div>
              </Fold>
            )}
          </SwipeToDelete>
        ))}
      </ul>
      <UndoToastHost />
    </>
  );
}

/** The line's edit box and Save — the same `updateLine`, the same `body` field (2,000 characters). */
function LineEdit({ line }: { line: ShownLine }) {
  const [body, setBody] = useState(line.body);
  return (
    <StayForm door="supLines.updateLine" action={updateLine} className="flex flex-col gap-2">
      <input type="hidden" name="line_id" value={line.line_id} />
      <TypedRow name="Your line" value={body} empty="Your line" long boxed required maxLength={2000} fieldName="body" onType={setBody} onKeep={(t) => setBody(t)} data="line-body" />
      <p className={TEMPLATE_SUBLINE}>
        {line.slots.length > 0
          ? `Blanks filled per wedding: ${line.slots.map((s) => `⟨${s}⟩`).join(' · ')}`
          : 'No blanks in this one — it reads the same at every wedding.'}
      </p>
      <div>
        <ActionButton type="submit" tone="brand" icon={<Check aria-hidden />} label="Save" />
      </div>
    </StayForm>
  );
}

/** "Tied to" — one of his segments, or none; the same `attachLineToActivity` and `activity_id` field. */
function LineTie({ line, activities }: { line: ShownLine; activities: readonly LineActivity[] }) {
  const [tie, setTie] = useState(line.activity_id ?? '');
  return (
    <StayForm door="supLines.attachLineToActivity" action={attachLineToActivity} className="flex flex-col gap-2">
      <input type="hidden" name="line_id" value={line.line_id} />
      <input type="hidden" name="activity_id" value={tie} />
      <ChosenRow
        name="Tied to"
        label="Attach to one of your segments"
        value={tie}
        options={[{ key: '', label: 'Not tied to a segment' }, ...activities.map((a) => ({ key: a.activity_id, label: a.label }))]}
        onPick={setTie}
        data="line-tie"
      />
      <div>
        <ActionButton type="submit" tone="neutral" icon={<Link2 aria-hidden />} label="Update match" />
      </div>
    </StayForm>
  );
}
