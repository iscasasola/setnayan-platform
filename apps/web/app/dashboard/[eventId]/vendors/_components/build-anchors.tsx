'use client';

/**
 * BuildAnchors — the Build tab's Date / Budget / Location anchors (PR D of the
 * 0016 Plan Builder redesign). Each anchor is Pinned (the couple fixed a value)
 * or Flagged (left empty → Compute / Setnayan AI will suggest it). Toggling
 * persists onto the existing `events` columns via the `setAnchor` action — no
 * migration (a populated column = Pinned, empty = Flagged).
 *
 * Client component. Editors are intentionally simple here; the candidate-date ∩
 * vendor-availability picker (the data is already resolved on the page) is the
 * immediate follow-up.
 */

import { useState, useTransition, type ReactNode } from 'react';
import { CalendarRange, Wallet, MapPin, Flag as FlagIcon, Pin as PinIcon } from 'lucide-react';
import { setAnchor } from '../build-anchors-actions';

export type AnchorData = {
  date: { iso: string | null; label: string | null; candidateCount: number };
  budget: { php: number | null };
  location: { region: string | null };
};

const peso = (php: number | null) =>
  php == null ? null : `₱${Math.round(php).toLocaleString('en-PH')}`;

export function BuildAnchors({ eventId, data }: { eventId: string; data: AnchorData }) {
  const [editing, setEditing] = useState<null | 'date' | 'budget' | 'location'>(null);
  const [pending, startTransition] = useTransition();

  function submit(anchor: 'date' | 'budget' | 'location', value: string) {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('anchor', anchor);
    fd.set('value', value);
    startTransition(async () => {
      await setAnchor(fd);
      setEditing(null);
    });
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
        Your anchors
      </div>
      <p className="mb-3 text-xs text-ink/55">
        <span className="font-medium text-ink/75">Pin</span> what’s fixed ·{' '}
        <span className="font-medium text-ink/75">Flag</span> what Setnayan should suggest.
      </p>

      <div className="space-y-2">
        <AnchorRow
          icon={<CalendarRange className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Wedding date"
          pinned={data.date.iso != null}
          valueText={data.date.label}
          flagHint={
            data.date.candidateCount > 0
              ? `Setnayan picks from your ${data.date.candidateCount} candidate date${data.date.candidateCount === 1 ? '' : 's'}`
              : 'Setnayan will suggest a date'
          }
          editing={editing === 'date'}
          pending={pending}
          onToggleEdit={() => setEditing(editing === 'date' ? null : 'date')}
          onFlag={() => submit('date', '')}
        >
          <InlineEditor
            type="date"
            defaultValue={data.date.iso ?? ''}
            placeholder=""
            onPin={(v) => submit('date', v)}
            pending={pending}
          />
        </AnchorRow>

        <AnchorRow
          icon={<Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Total budget"
          pinned={data.budget.php != null}
          valueText={peso(data.budget.php)}
          flagHint="Setnayan suggests from your pinned + flagged picks"
          editing={editing === 'budget'}
          pending={pending}
          onToggleEdit={() => setEditing(editing === 'budget' ? null : 'budget')}
          onFlag={() => submit('budget', '')}
        >
          <InlineEditor
            type="number"
            defaultValue={data.budget.php != null ? String(data.budget.php) : ''}
            placeholder="360000"
            onPin={(v) => submit('budget', v)}
            pending={pending}
          />
        </AnchorRow>

        <AnchorRow
          icon={<MapPin className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Location"
          pinned={!!data.location.region}
          valueText={data.location.region}
          flagHint="Setnayan stays open to nearby areas"
          editing={editing === 'location'}
          pending={pending}
          onToggleEdit={() => setEditing(editing === 'location' ? null : 'location')}
          onFlag={() => submit('location', '')}
        >
          <InlineEditor
            type="text"
            defaultValue={data.location.region ?? ''}
            placeholder="e.g. Tagaytay"
            onPin={(v) => submit('location', v)}
            pending={pending}
          />
        </AnchorRow>
      </div>
    </section>
  );
}

function AnchorRow({
  icon,
  label,
  pinned,
  valueText,
  flagHint,
  editing,
  pending,
  onToggleEdit,
  onFlag,
  children,
}: {
  icon: ReactNode;
  label: string;
  pinned: boolean;
  valueText: string | null;
  flagHint: string;
  editing: boolean;
  pending: boolean;
  onToggleEdit: () => void;
  onFlag: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-paper px-3 py-2.5 ${pinned ? 'border-ink/10' : 'border-dashed border-terracotta/40'}`}>
      <div className="flex items-center gap-2.5">
        {/* Flag / Pin toggle */}
        <div className="flex shrink-0 gap-1" role="group" aria-label={`${label} mode`}>
          <button
            type="button"
            onClick={onFlag}
            disabled={pending || !pinned}
            aria-pressed={!pinned}
            title="Flag — Setnayan suggests this"
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
              !pinned
                ? 'border-terracotta/50 bg-terracotta/10 text-terracotta'
                : 'border-ink/15 text-ink/35 hover:text-ink/60'
            }`}
          >
            <FlagIcon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggleEdit}
            disabled={pending}
            aria-pressed={pinned}
            title="Pin — I decide this"
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
              pinned
                ? 'border-mulberry/50 bg-mulberry/10 text-mulberry'
                : 'border-ink/15 text-ink/35 hover:text-ink/60'
            }`}
          >
            <PinIcon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
          </button>
        </div>

        <span className="shrink-0 text-ink/55">{icon}</span>

        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/45">{label}</div>
          {pinned && valueText ? (
            <div className="truncate text-sm font-semibold text-ink">{valueText}</div>
          ) : (
            <div className="truncate text-sm italic text-ink/45">{flagHint}</div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleEdit}
          disabled={pending}
          className="shrink-0 rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-ink/[0.03]"
        >
          {editing ? 'Close' : pinned ? 'Edit' : 'Set'}
        </button>
      </div>

      {editing && <div className="mt-2.5 border-t border-ink/8 pt-2.5">{children}</div>}
    </div>
  );
}

function InlineEditor({
  type,
  defaultValue,
  placeholder,
  onPin,
  pending,
}: {
  type: 'date' | 'number' | 'text';
  defaultValue: string;
  placeholder: string;
  onPin: (value: string) => void;
  pending: boolean;
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
        onClick={() => onPin(val)}
        disabled={pending || val.trim().length === 0}
        className="shrink-0 rounded-lg bg-mulberry px-3.5 py-2 text-sm font-semibold text-paper disabled:opacity-50"
      >
        Pin
      </button>
    </div>
  );
}
