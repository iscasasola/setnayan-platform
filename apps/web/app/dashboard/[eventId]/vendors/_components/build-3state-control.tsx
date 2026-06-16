'use client';

/**
 * Build3StateControl — the 3-State Build control (Phase 3d ·
 * Build_3State_Solver_2026-06-16.md). This is the Build tab.
 *
 * Each row carries a leftmost tri-state segmented control —
 *   🔒 Lock (Locked) · ⚡ Zap (Auto) · 👁️ EyeOff (Excluded) —
 * writing via `setCategoryBuildState`. Locked REQUIRES a concrete pick:
 *   • a taxonomy row → a small picker of that category's QUOTED inquiries
 *     (event_vendors with total_cost_php != null) → pinned_vendor_id.
 *   • a dimension row (Date/Budget/Location) → an inline value editor that
 *     reveals when Locked and persists onto the `events` columns via setAnchor.
 *
 * The bottom bar is [Reset] (→ all Excluded) + [Build] (resolve Auto rows).
 * Save-As lives on the Compare tab, not here.
 *
 * Calm, not loud — reuses the surrounding theme tokens (ink / cream / paper /
 * terracotta / mulberry) and Lucide icons already in the Build surface.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Zap,
  EyeOff,
  Loader2,
  ChevronDown,
  Check,
  RotateCcw,
  Hammer,
  Search,
  Plus,
  MapPin,
  Star,
} from 'lucide-react';
import type { BuildState } from '@/lib/build-3state';
import { DIM_DATE, DIM_BUDGET, DIM_LOCATION } from '@/lib/build-3state';
import {
  setCategoryBuildState,
  resetBuildStates,
  runBuild3State,
} from '../build-3state-actions';
import {
  findBuildFallbackSuggestions,
  type BuildFallbackSuggestion,
} from '../build-3state-fallback-actions';
import { attachMarketplaceVendorToCategory } from '../actions';
import { setAnchor } from '../build-anchors-actions';

/** The Build tab's three anchor values (Date / Budget / Location). */
export type AnchorData = {
  date: { iso: string | null; label: string | null; candidateCount: number };
  budget: { php: number | null };
  location: { region: string | null };
};

/** The "show 5 more" page step for the marketplace fallback list. */
const FALLBACK_EXPAND_STEP = 5;

/** One quoted vendor option for a taxonomy row's Locked picker. */
export type QuotedOption = { vendorId: string; name: string; pricePhp: number | null };

/** A taxonomy row: a plan group with ≥1 quoted inquiry. */
export type TaxonomyRow = {
  groupId: string;
  label: string;
  state: BuildState;
  pinnedVendorId: string | null;
  /** That category's quoted inquiries (total_cost_php != null). */
  options: QuotedOption[];
};

const peso = (php: number | null) =>
  php == null ? '—' : `₱${Math.round(php).toLocaleString('en-PH')}`;

const STATE_META: Record<BuildState, { label: string; icon: typeof Lock; hint: string }> = {
  locked: { label: 'Locked', icon: Lock, hint: 'Fixed to your pick.' },
  auto: { label: 'Auto', icon: Zap, hint: 'Build fills this for you.' },
  excluded: { label: 'Hidden', icon: EyeOff, hint: 'Left out of the build.' },
};
const STATE_ORDER: BuildState[] = ['locked', 'auto', 'excluded'];

export function Build3StateControl({
  eventId,
  anchors,
  dimensionStates,
  taxonomyRows,
}: {
  eventId: string;
  anchors: AnchorData;
  /** State of the three dimension rows (Date/Budget/Location), keyed by DIM_* . */
  dimensionStates: Record<string, BuildState>;
  taxonomyRows: TaxonomyRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [buildMsg, setBuildMsg] = useState<string | null>(null);
  const [unfilled, setUnfilled] = useState<{ groupId: string; label: string }[]>([]);

  function applyState(
    planGroupId: string,
    state: BuildState,
    pinnedVendorId?: string | null,
  ) {
    setBusyRow(planGroupId);
    startTransition(async () => {
      const res = await setCategoryBuildState({ eventId, planGroupId, state, pinnedVendorId });
      setBusyRow(null);
      if (res.ok) router.refresh();
      else setBuildMsg(res.error);
    });
  }

  function reset() {
    setBuildMsg(null);
    setUnfilled([]);
    startTransition(async () => {
      const res = await resetBuildStates({ eventId });
      if (res.ok) router.refresh();
      else setBuildMsg(res.error);
    });
  }

  function build() {
    setBuildMsg(null);
    setUnfilled([]);
    startTransition(async () => {
      const res = await runBuild3State({ eventId });
      if (!res.ok) {
        setBuildMsg(res.error);
        return;
      }
      setUnfilled(res.unfilled);
      setBuildMsg(
        res.filled > 0
          ? `Built ${res.filled} pick${res.filled === 1 ? '' : 's'} from your quotes.`
          : res.unfilled.length > 0
            ? null
            : 'Nothing to build — set a category to Auto or Lock first.',
      );
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="space-y-1">
        <h2 className="font-display text-xl italic text-ink/85">Build your plan</h2>
        <p className="text-sm text-ink/60">
          <span className="font-medium text-ink/75">Lock</span> what&rsquo;s decided ·{' '}
          <span className="font-medium text-ink/75">Auto</span> to fill for you ·{' '}
          <span className="font-medium text-ink/75">Hidden</span> to leave out. Then Build.
        </p>
      </div>

      {/* Dimension rows — Date / Budget / Location. The trio writes the
          Locked/Auto/Hidden state; when Locked, the row reveals an inline value
          editor that persists onto the existing `events` columns via setAnchor.
          One unified row per anchor (no separate legacy anchors module). */}
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
          Your anchors
        </div>
        <DimensionRow
          eventId={eventId}
          anchor="date"
          label="Wedding date"
          state={dimensionStates[DIM_DATE] ?? 'excluded'}
          busy={busyRow === DIM_DATE && pending}
          onState={(s) => applyState(DIM_DATE, s)}
          valueText={anchors.date.label}
          editorType="date"
          editorDefault={anchors.date.iso ?? ''}
          editorPlaceholder=""
        />
        <DimensionRow
          eventId={eventId}
          anchor="budget"
          label="Total budget"
          state={dimensionStates[DIM_BUDGET] ?? 'excluded'}
          busy={busyRow === DIM_BUDGET && pending}
          onState={(s) => applyState(DIM_BUDGET, s)}
          valueText={anchors.budget.php != null ? peso(anchors.budget.php) : null}
          editorType="number"
          editorDefault={anchors.budget.php != null ? String(anchors.budget.php) : ''}
          editorPlaceholder="360000"
        />
        <DimensionRow
          eventId={eventId}
          anchor="location"
          label="Location"
          state={dimensionStates[DIM_LOCATION] ?? 'excluded'}
          busy={busyRow === DIM_LOCATION && pending}
          onState={(s) => applyState(DIM_LOCATION, s)}
          valueText={anchors.location.region}
          editorType="text"
          editorDefault={anchors.location.region ?? ''}
          editorPlaceholder="e.g. Tagaytay"
        />
      </div>

      {/* Taxonomy rows — one per category with ≥1 quoted inquiry. */}
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
          Quoted categories
        </div>
        {taxonomyRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/15 bg-paper px-4 py-3 text-sm text-ink/55">
            No quoted services yet. Once a vendor sends a price, that category shows up here to
            build with.
          </p>
        ) : (
          taxonomyRows.map((row) => (
            <TaxonomyRowControl
              key={row.groupId}
              row={row}
              busy={busyRow === row.groupId && pending}
              onState={(s, pin) => applyState(row.groupId, s, pin)}
            />
          ))
        )}
      </div>

      {/* Bottom bar — Reset + Build (Save As is a follow-on flagged PR). */}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink/8 pt-3">
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3.5 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/[0.03] disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
          Reset
        </button>
        <button
          type="button"
          onClick={build}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Hammer className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
          Build
        </button>
        {buildMsg ? <span className="text-xs text-ink/60">{buildMsg}</span> : null}
      </div>

      {unfilled.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs text-ink/55">
            Couldn&rsquo;t fill {unfilled.map((u) => u.label).join(', ')} from your quotes within
            budget. Lock a pick, raise the budget, hide the category — or look wider:
          </p>
          {unfilled.map((u) => (
            <FallbackPanel key={u.groupId} eventId={eventId} group={u} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Marketplace fallback for ONE unfilled Auto category — the couple taps
 * "Find more options" to widen past their own quotes into the marketplace.
 * Suggestions are ordered by a HIDDEN compatibility % (never shown) and are
 * TAP-TO-ADD: nothing is auto-added or auto-charged. Behind BUILD_3STATE_ENABLED
 * like the rest of this surface (the action re-checks the flag server-side).
 */
function FallbackPanel({
  eventId,
  group,
}: {
  eventId: string;
  group: { groupId: string; label: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [opened, setOpened] = useState(false);
  const [suggestions, setSuggestions] = useState<BuildFallbackSuggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [hasCoords, setHasCoords] = useState(false);
  const [limit, setLimit] = useState(10);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load(nextLimit: number) {
    setErr(null);
    startTransition(async () => {
      const res = await findBuildFallbackSuggestions({
        eventId,
        groupId: group.groupId,
        limit: nextLimit,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOpened(true);
      setSuggestions(res.suggestions);
      setTotal(res.total);
      setHasCoords(res.hasReceptionCoords);
      setLimit(nextLimit);
    });
  }

  function add(vendorProfileId: string) {
    if (added.has(vendorProfileId) || addingId) return;
    setAddingId(vendorProfileId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('marketplace_vendor_id', vendorProfileId);
      // The group id doubles as the category — attachMarketplaceVendorToCategory
      // validates it (rejects a non-leaf) so we can never mis-categorize.
      fd.set('category', group.groupId);
      const res = await attachMarketplaceVendorToCategory(fd);
      setAddingId(null);
      if (res.status === 'ok' || res.status === 'already_attached') {
        setAdded((prev) => new Set(prev).add(vendorProfileId));
        router.refresh();
      } else {
        setErr('Could not add that vendor — try another.');
      }
    });
  }

  const canExpand = opened && suggestions.length < total;

  return (
    <div className="rounded-xl border border-ink/10 bg-paper px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink/75">{group.label}</span>
        {!opened ? (
          <button
            type="button"
            onClick={() => load(10)}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/[0.03] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Search className="h-3 w-3" strokeWidth={2} aria-hidden />
            )}
            Find more options
          </button>
        ) : null}
      </div>

      {opened && suggestions.length === 0 && !pending ? (
        <p className="mt-2 text-[11px] italic text-ink/50">
          No other vendors found for this category right now.
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mt-2.5 space-y-1 border-t border-ink/8 pt-2.5">
          {suggestions.map((s) => {
            const isAdded = s.alreadyAdded || added.has(s.vendorProfileId);
            return (
              <li key={s.vendorProfileId}>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/12 bg-cream px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{s.name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink/55">
                      {s.city ? <span className="truncate">{s.city}</span> : null}
                      {hasCoords && s.distanceKm != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                          {Math.round(s.distanceKm)} km
                        </span>
                      ) : null}
                      {s.rating != null && s.reviewCount ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                          {s.rating.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => add(s.vendorProfileId)}
                    disabled={isAdded || addingId === s.vendorProfileId}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                      isAdded
                        ? 'border-mulberry/40 bg-mulberry/10 text-mulberry'
                        : 'border-ink/15 text-ink/70 hover:bg-ink/[0.03]'
                    }`}
                  >
                    {addingId === s.vendorProfileId ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : isAdded ? (
                      <Check className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    ) : (
                      <Plus className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    )}
                    {isAdded ? 'Added' : 'Add'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canExpand ? (
        <button
          type="button"
          onClick={() => load(limit + FALLBACK_EXPAND_STEP)}
          disabled={pending}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink/60 hover:text-ink/80 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
          )}
          Show {FALLBACK_EXPAND_STEP} more
        </button>
      ) : null}

      {err ? <p className="mt-1.5 text-[11px] text-terracotta">{err}</p> : null}
    </div>
  );
}

/** The leftmost tri-state segmented control — shared by both row kinds. */
function StateTrio({
  state,
  busy,
  onSelect,
}: {
  state: BuildState;
  busy: boolean;
  onSelect: (s: BuildState) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1" role="group" aria-label="Build state">
      {STATE_ORDER.map((s) => {
        const { label, icon: Icon } = STATE_META[s];
        const on = state === s;
        const tone =
          s === 'locked'
            ? 'border-mulberry/50 bg-mulberry/10 text-mulberry'
            : s === 'auto'
              ? 'border-terracotta/50 bg-terracotta/10 text-terracotta'
              : 'border-ink/25 bg-ink/[0.04] text-ink/65';
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            disabled={busy}
            aria-pressed={on}
            title={`${label} — ${STATE_META[s].hint}`}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
              on ? tone : 'border-ink/15 text-ink/35 hover:text-ink/60'
            }`}
          >
            {busy && on ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

function DimensionRow({
  eventId,
  anchor,
  label,
  state,
  busy,
  onState,
  valueText,
  editorType,
  editorDefault,
  editorPlaceholder,
}: {
  eventId: string;
  anchor: 'date' | 'budget' | 'location';
  label: string;
  state: BuildState;
  busy: boolean;
  onState: (s: BuildState) => void;
  /** The current persisted value (already formatted), or null when unset. */
  valueText: string | null;
  editorType: 'date' | 'number' | 'text';
  editorDefault: string;
  editorPlaceholder: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Auto-open the editor when Locked with no value yet (§4: Locked must resolve).
  const [editing, setEditing] = useState(false);
  const locked = state === 'locked';
  const hasValue = valueText != null && valueText !== '';
  const needsValue = locked && !hasValue;
  const editorOpen = editing || needsValue;

  function save(value: string) {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('anchor', anchor);
    fd.set('value', value);
    startTransition(async () => {
      await setAnchor(fd);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        locked ? 'border-mulberry/30 bg-mulberry/[0.04]' : 'border-ink/10 bg-paper'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <StateTrio state={state} busy={busy} onSelect={onState} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/45">{label}</div>
          {locked && hasValue ? (
            <div className="truncate text-sm font-semibold text-ink">{valueText}</div>
          ) : (
            <div className="truncate text-xs italic text-ink/50">
              {locked
                ? 'Set the value below.'
                : state === 'auto'
                  ? 'Setnayan suggests this.'
                  : 'Not part of the build.'}
            </div>
          )}
        </div>
        {locked ? (
          <button
            type="button"
            onClick={() => setEditing((o) => !o)}
            disabled={pending}
            className="shrink-0 rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-ink/[0.03] disabled:opacity-50"
          >
            {editorOpen ? 'Close' : hasValue ? 'Edit' : 'Set'}
          </button>
        ) : null}
      </div>

      {locked && editorOpen ? (
        <div className="mt-2.5 border-t border-ink/8 pt-2.5">
          <InlineValueEditor
            type={editorType}
            defaultValue={editorDefault}
            placeholder={editorPlaceholder}
            pending={pending}
            onSave={save}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Inline value editor for a Locked dimension row (date / budget / location). */
function InlineValueEditor({
  type,
  defaultValue,
  placeholder,
  pending,
  onSave,
}: {
  type: 'date' | 'number' | 'text';
  defaultValue: string;
  placeholder: string;
  pending: boolean;
  onSave: (value: string) => void;
}) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="flex items-center gap-2">
      <input
        type={type}
        value={val}
        placeholder={placeholder}
        onChange={(e) => setVal(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-mulberry/50"
      />
      <button
        type="button"
        onClick={() => onSave(val)}
        disabled={pending || val.trim().length === 0}
        className="shrink-0 rounded-lg bg-mulberry px-3.5 py-2 text-sm font-semibold text-paper disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}

function TaxonomyRowControl({
  row,
  busy,
  onState,
}: {
  row: TaxonomyRow;
  busy: boolean;
  onState: (s: BuildState, pinnedVendorId?: string | null) => void;
}) {
  // Open the picker automatically when Locked has no concrete pick yet (§4: a
  // Locked row MUST resolve to a value).
  const [pickerOpen, setPickerOpen] = useState(false);
  const pinnedName =
    row.pinnedVendorId != null
      ? row.options.find((o) => o.vendorId === row.pinnedVendorId)?.name ?? null
      : null;
  const needsPick = row.state === 'locked' && !row.pinnedVendorId;

  function selectState(s: BuildState) {
    if (s === 'locked') {
      // Lock requires a pick. If there's exactly one quote, lock it directly;
      // otherwise open the picker and let the host choose.
      if (row.options.length === 1) {
        onState('locked', row.options[0]!.vendorId);
        return;
      }
      setPickerOpen(true);
      // Don't write 'locked' yet — wait for a concrete pick to keep state valid.
      return;
    }
    setPickerOpen(false);
    onState(s);
  }

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        row.state === 'locked'
          ? 'border-mulberry/30 bg-mulberry/[0.04]'
          : row.state === 'auto'
            ? 'border-terracotta/30 bg-terracotta/[0.04]'
            : 'border-ink/10 bg-paper'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <StateTrio state={row.state} busy={busy} onSelect={selectState} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{row.label}</div>
          <div className="truncate text-xs text-ink/55">
            {row.state === 'locked' && pinnedName ? (
              <span className="text-mulberry">{pinnedName}</span>
            ) : row.state === 'auto' ? (
              <span className="italic">
                {row.options.length} quote{row.options.length === 1 ? '' : 's'} — Build picks the
                cheapest that fits
              </span>
            ) : (
              <span className="italic">Not part of the build.</span>
            )}
          </div>
        </div>
        {(row.state === 'locked' || pickerOpen) && row.options.length > 1 ? (
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="shrink-0 rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-ink/[0.03]"
          >
            {pickerOpen ? 'Close' : pinnedName ? 'Change' : 'Choose'}
            <ChevronDown className="ml-1 inline h-3 w-3" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      {needsPick && !pickerOpen ? (
        <p className="mt-1.5 text-[11px] text-mulberry">Choose which quote to lock.</p>
      ) : null}

      {pickerOpen && row.options.length > 0 ? (
        <ul className="mt-2.5 space-y-1 border-t border-ink/8 pt-2.5">
          {row.options.map((opt) => {
            const chosen = opt.vendorId === row.pinnedVendorId;
            return (
              <li key={opt.vendorId}>
                <button
                  type="button"
                  onClick={() => {
                    onState('locked', opt.vendorId);
                    setPickerOpen(false);
                  }}
                  disabled={busy}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                    chosen
                      ? 'border-mulberry/50 bg-mulberry/10 text-mulberry'
                      : 'border-ink/12 bg-paper text-ink hover:bg-ink/[0.03]'
                  }`}
                >
                  <span className="min-w-0 truncate">{opt.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="font-mono text-xs">{peso(opt.pricePhp)}</span>
                    {chosen ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
