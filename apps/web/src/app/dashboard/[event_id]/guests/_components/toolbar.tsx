"use client";

import { RSVP_STATUSES, WEDDING_SIDES, type RsvpStatus, type WeddingSide } from "@/lib/db/types";

export type SortKey = "last_name" | "first_name" | "rsvp_responded_at" | "role";

export interface ToolbarFilterState {
  search: string;
  status: "all" | RsvpStatus;
  side: "all" | WeddingSide;
  sort: SortKey;
}

interface Props {
  state: ToolbarFilterState;
  onChange: (next: Partial<ToolbarFilterState>) => void;
  counts: {
    all: number;
    pending: number;
    attending: number;
    declined: number;
    maybe: number;
    bride: number;
    groom: number;
    both: number;
  };
}

const SORT_LABELS: Record<SortKey, string> = {
  last_name: "Last name ↓",
  first_name: "First name ↓",
  rsvp_responded_at: "Recently RSVPed ↓",
  role: "Role family ↓",
};

export function Toolbar({ state, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-surface px-3.5 py-3">
      <div className="flex flex-1 items-center gap-2.5 rounded-full bg-page-bg-soft px-3.5 py-2 lg:max-w-sm">
        <span aria-hidden className="text-ink-faint">⌕</span>
        <input
          type="search"
          aria-label="Search guests"
          placeholder="Search by name, household, or tag…"
          value={state.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="flex-1 border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      <div className="hidden h-5 w-px bg-rule lg:block" />

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          label="All"
          count={counts.all}
          active={state.status === "all"}
          onClick={() => onChange({ status: "all" })}
        />
        {RSVP_STATUSES.filter((s) => s !== "maybe").map((s) => (
          <Chip
            key={s}
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            count={counts[s]}
            active={state.status === s}
            onClick={() => onChange({ status: s })}
          />
        ))}
      </div>

      <div className="hidden h-5 w-px bg-rule lg:block" />

      <div className="flex flex-wrap items-center gap-1.5">
        {WEDDING_SIDES.map((s) => (
          <Chip
            key={s}
            label={
              s === "bride" ? "Bride's Side" : s === "groom" ? "Groom's Side" : "Both / Mutual"
            }
            count={counts[s]}
            active={state.side === s}
            onClick={() => onChange({ side: state.side === s ? "all" : s })}
          />
        ))}
      </div>

      <div className="ml-auto">
        <label className="meta-label mb-1 block">Sort</label>
        <select
          aria-label="Sort guests"
          value={state.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortKey })}
          className="rounded-full border border-rule-strong bg-surface px-3 py-1.5 text-xs text-ink hover:border-ink"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-ink bg-ink text-white"
          : "border-rule-strong text-ink-soft hover:border-ink hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`font-mono text-[10px] tracking-label-tight ${active ? "opacity-80" : "opacity-60"}`}
      >
        {count}
      </span>
    </button>
  );
}
