/**
 * Coordinator P2 — filtered run-of-show chrome for the couple/coordinator
 * schedule page. Server components only (plain forms → server actions); every
 * piece here renders ONLY when NEXT_PUBLIC_SCHEDULE_ROS_P2_ENABLED === 'true',
 * so flag-off is byte-identical to today's page.
 *
 *   • RosLensBar      — audience switcher: master / guest preview / per-vendor
 *                       slices. Views are FILTERS over the master (lib/
 *                       schedule-ros.ts), never copies — the lens just narrows
 *                       what renders.
 *   • RosLensPreview  — read-only rendering of a filtered view. Preview, not a
 *                       second editor: edits happen on the master.
 *   • BulkRetimePanel — "day is running late" cascade: shift the anchor block
 *                       and everything after it (optionally bounded) by ±N
 *                       minutes in one action.
 *   • TemplatePicker  — wedding run-of-show skeletons, loadable into an EMPTY
 *                       schedule only (load never overwrites existing rows).
 *   • ResponsibleChip / ResponsiblePartyEditor — per-row responsible party
 *                       (vendor / crew / family) + vendor tagging that drives
 *                       the per-vendor slice.
 *
 * Reminders/call-times stay EMAIL-ONLY per the no-SMS lock and are P3's
 * build — nothing here sends anything.
 */

import Link from 'next/link';
import { Clock, Filter, LayoutTemplate, UserCheck } from 'lucide-react';
import {
  formatBlockTime,
  formatBlockTimeRange,
  type ScheduleBlockRow,
} from '@/lib/schedule';
import {
  countVendorTaggedBlocks,
  filterBlocksForAudience,
  type RosMetaMap,
} from '@/lib/schedule-ros';
import { SCHEDULE_TEMPLATES, type ScheduleTemplate } from '@/lib/schedule-templates';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  bulkRetimeScheduleBlocks,
  loadScheduleTemplate,
  setBlockResponsibleParty,
} from '../actions';

export type EventVendorOption = {
  vendor_id: string;
  vendor_name: string;
};

/** Parse the `?ros=` search param into a lens. Unknown values → master. */
export function parseRosLens(
  raw: string | undefined,
  vendors: readonly EventVendorOption[],
): { kind: 'all' } | { kind: 'guest' } | { kind: 'vendor'; vendor: EventVendorOption } {
  if (raw === 'guest') return { kind: 'guest' };
  if (raw?.startsWith('vendor:')) {
    const id = raw.slice('vendor:'.length);
    const vendor = vendors.find((v) => v.vendor_id === id);
    if (vendor) return { kind: 'vendor', vendor };
  }
  return { kind: 'all' };
}

export function RosLensBar({
  eventId,
  lens,
  blocks,
  vendors,
  meta,
}: {
  eventId: string;
  lens: ReturnType<typeof parseRosLens>;
  blocks: readonly ScheduleBlockRow[];
  vendors: readonly EventVendorOption[];
  meta: RosMetaMap;
}) {
  const base = `/dashboard/${eventId}/schedule?view=event-day`;
  // Only vendors with ≥1 tagged row earn a lens chip — an empty slice is noise.
  const taggedVendors = vendors.filter(
    (v) => countVendorTaggedBlocks(blocks, v.vendor_id, meta) > 0,
  );
  return (
    <div className="sn-row flex flex-wrap items-center gap-2 px-4 py-3">
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        <Filter aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        View as
      </span>
      <LensChip href={base} active={lens.kind === 'all'} label="Master" />
      <LensChip href={`${base}&ros=guest`} active={lens.kind === 'guest'} label="Guests" />
      {taggedVendors.map((v) => (
        <LensChip
          key={v.vendor_id}
          href={`${base}&ros=vendor:${v.vendor_id}`}
          active={lens.kind === 'vendor' && lens.vendor.vendor_id === v.vendor_id}
          label={v.vendor_name}
        />
      ))}
      <span className="basis-full text-xs text-ink/50">
        Every view is a live filter over this one master timeline — edit the
        master and each slice updates itself.
      </span>
    </div>
  );
}

function LensChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? 'bg-ink text-cream'
          : 'border border-ink/15 bg-white text-ink/60 hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );
}

/** Read-only render of one filtered audience view. */
export function RosLensPreview({
  lens,
  blocks,
  meta,
}: {
  lens: Exclude<ReturnType<typeof parseRosLens>, { kind: 'all' }>;
  blocks: readonly ScheduleBlockRow[];
  meta: RosMetaMap;
}) {
  const view = filterBlocksForAudience(
    blocks,
    lens.kind === 'guest'
      ? { kind: 'guest' }
      : { kind: 'vendor', eventVendorId: lens.vendor.vendor_id },
    meta,
  );
  const title =
    lens.kind === 'guest'
      ? 'What guests see'
      : `What ${lens.vendor.vendor_name} is responsible for`;
  return (
    <section className="sn-row space-y-3 p-4">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">{title}</p>
        <p className="text-xs text-ink/55">
          Read-only preview · {view.length} row{view.length === 1 ? '' : 's'}.
          {lens.kind === 'guest'
            ? ' Guests see public blocks on their invitation site.'
            : ' Tag or untag rows on the master to reshape this slice.'}
        </p>
      </header>
      {view.length === 0 ? (
        <p className="rounded-md bg-ink/[0.03] p-3 text-sm text-ink/60">
          {lens.kind === 'guest'
            ? 'No public blocks yet — flip a block to “Show to guests” on the master.'
            : 'Nothing tagged to this vendor yet — assign them a row on the master.'}
        </p>
      ) : (
        <ol className="divide-y divide-ink/10">
          {view.map((b) => (
            <li key={b.block_id} className={`py-2 ${b.parent_block_id ? 'pl-6' : ''}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="w-40 shrink-0 font-mono text-xs tabular-nums text-ink/60">
                  {b.end_at
                    ? formatBlockTimeRange(b.start_at, b.end_at)
                    : formatBlockTime(b.start_at)}
                </span>
                <span className="text-sm font-medium text-ink">{b.label}</span>
                {meta.get(b.block_id)?.responsible_party ? (
                  <span className="text-xs text-ink/55">
                    · {meta.get(b.block_id)!.responsible_party}
                  </span>
                ) : null}
              </div>
              {b.location ? <p className="mt-0.5 text-xs text-ink/50">{b.location}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** "Running late" cascade — one form, one server action, whole-span shift. */
export function BulkRetimePanel({
  eventId,
  blocks,
}: {
  eventId: string;
  blocks: readonly ScheduleBlockRow[];
}) {
  const topLevel = blocks.filter((b) => b.parent_block_id === null);
  if (topLevel.length === 0) return null;
  return (
    <details className="sn-row">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <Clock aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Shift the timeline (bulk retime)
      </summary>
      <form
        action={bulkRetimeScheduleBlocks}
        className="grid gap-4 border-t border-ink/10 p-4 sm:grid-cols-3"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">From block</span>
          <select name="from_block_id" required className="input-field">
            {topLevel.map((b) => (
              <option key={b.block_id} value={b.block_id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Through (optional)</span>
          <select name="to_block_id" defaultValue="" className="input-field">
            <option value="">End of day</option>
            {topLevel.map((b) => (
              <option key={b.block_id} value={b.block_id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Shift by (minutes)</span>
          <input
            name="delta_minutes"
            type="number"
            required
            step={5}
            min={-720}
            max={720}
            defaultValue={30}
            className="input-field"
          />
        </label>
        <p className="text-xs text-ink/55 sm:col-span-2">
          Moves the chosen block and everything after it (parts travel with
          their parent) by the same amount — positive pushes later, negative
          pulls earlier. Durations are kept.
        </p>
        <div className="sm:justify-self-end">
          <SubmitButton className="button-primary" pendingLabel="Shifting…">
            Shift blocks
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

/** Starter skeletons for an EMPTY schedule. Load never overwrites rows. */
export function TemplatePicker({
  eventId,
  templates = SCHEDULE_TEMPLATES,
}: {
  eventId: string;
  templates?: readonly ScheduleTemplate[];
}) {
  if (templates.length === 0) return null;
  return (
    <section className="sn-row space-y-3 p-4">
      <header className="space-y-1">
        <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          <LayoutTemplate aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Start from a template
        </p>
        <p className="max-w-prose text-xs text-ink/55">
          Load a run-of-show skeleton, then reshape every block. Templates only
          load into an empty schedule — they never overwrite what you&rsquo;ve built.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-3">
        {templates.map((t) => (
          <li key={t.id} className="flex flex-col rounded-xl border border-ink/10 bg-white p-3">
            <p className="text-sm font-semibold text-ink">{t.label}</p>
            <p className="mt-1 flex-1 text-xs text-ink/60">{t.description}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              {t.rows.length} blocks
            </p>
            <form action={loadScheduleTemplate} className="mt-2">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="template_id" value={t.id} />
              <SubmitButton
                className="w-full rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-cream hover:bg-ink/85"
                pendingLabel="Loading…"
              >
                Use this template
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Per-row responsible party display + editor (inside the master BlockCard). */
export function ResponsiblePartyEditor({
  eventId,
  block,
  meta,
  vendors,
}: {
  eventId: string;
  block: ScheduleBlockRow;
  meta: RosMetaMap;
  vendors: readonly EventVendorOption[];
}) {
  const rowMeta = meta.get(block.block_id);
  const party = rowMeta?.responsible_party ?? null;
  const taggedIds = new Set(rowMeta?.responsible_vendor_ids ?? []);
  const taggedNames = vendors
    .filter((v) => taggedIds.has(v.vendor_id))
    .map((v) => v.vendor_name);
  const summaryText =
    [party, ...taggedNames].filter(Boolean).join(' · ') || 'Assign responsible party';
  return (
    <details className="text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-ink/55 hover:text-ink">
        <UserCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {summaryText}
      </summary>
      <form
        action={setBlockResponsibleParty}
        className="mt-2 grid max-w-md gap-2 rounded-lg border border-ink/10 bg-ink/[0.02] p-3"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="block_id" value={block.block_id} />
        <label className="space-y-1">
          <span className="block font-medium text-ink">Responsible party</span>
          <input
            name="responsible_party"
            defaultValue={party ?? ''}
            maxLength={120}
            placeholder="e.g. HMUA team · Ninong Roberto · Coordinator"
            className="input-field"
          />
        </label>
        {vendors.length > 0 ? (
          <label className="space-y-1">
            <span className="block font-medium text-ink">Tag booked vendors</span>
            <select
              name="responsible_vendor_ids"
              multiple
              size={Math.min(vendors.length, 4)}
              defaultValue={[...taggedIds]}
              className="input-field h-auto"
            >
              {vendors.map((v) => (
                <option key={v.vendor_id} value={v.vendor_id}>
                  {v.vendor_name}
                </option>
              ))}
            </select>
            <span className="block text-[11px] text-ink/50">
              Tagged vendors get this row in their filtered run-of-show slice.
            </span>
          </label>
        ) : null}
        <div>
          <SubmitButton
            className="rounded-md bg-ink px-3 py-1 text-xs font-semibold text-cream hover:bg-ink/85"
            pendingLabel="Saving…"
          >
            Save
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}
