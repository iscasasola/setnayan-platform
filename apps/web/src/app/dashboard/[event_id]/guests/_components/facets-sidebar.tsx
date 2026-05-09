"use client";

import type { Household } from "@/lib/db/types";
import type { FacetKey, FacetState } from "./facet-state";

interface Props {
  state: FacetState;
  onChange: (next: FacetKey) => void;
  counts: Record<string, number>;
  households: Household[];
  customTags: string[];
  onTagToggle: (tag: string) => void;
  selectedTags: Set<string>;
  scheduleBlockCounts: Record<string, number>;
}

const VIEW_FACETS: Array<{ key: FacetKey; label: string; countKey: string }> = [
  { key: { kind: "all" }, label: "All Guests", countKey: "all" },
  { key: { kind: "family", value: "entourage" }, label: "Wedding Party", countKey: "fam:entourage" },
  { key: { kind: "role", value: "principal_sponsor" }, label: "Principal Sponsors", countKey: "role:principal_sponsor" },
  { key: { kind: "secondary_sponsors" }, label: "Secondary Sponsors", countKey: "secondary_sponsors" },
  { key: { kind: "family", value: "bearer" }, label: "Bearers & Flower Girls", countKey: "fam:bearer" },
  { key: { kind: "group", value: "family" }, label: "Family", countKey: "group:family" },
  { key: { kind: "group", value: "friends" }, label: "Friends", countKey: "group:friends" },
  { key: { kind: "group", value: "work" }, label: "Work / Office", countKey: "group:work" },
];

export function FacetsSidebar({
  state,
  onChange,
  counts,
  households,
  customTags,
  onTagToggle,
  selectedTags,
  scheduleBlockCounts,
}: Props) {
  return (
    <aside className="sticky top-24 hidden flex-col gap-5 rounded-2xl border border-rule bg-surface p-4 lg:flex">
      <FacetGroup title="View">
        <div className="flex flex-col gap-0.5">
          {VIEW_FACETS.map((f) => (
            <FacetItem
              key={JSON.stringify(f.key)}
              label={f.label}
              count={counts[f.countKey] ?? 0}
              active={isFacetActive(state, f.key)}
              onClick={() => onChange(f.key)}
            />
          ))}
          {households.length > 0 && (
            <details className="mt-2">
              <summary className="meta-label cursor-pointer rounded-md px-2.5 py-1.5 text-ink-soft hover:bg-page-bg-soft">
                By Household ({households.length})
              </summary>
              <div className="mt-1 flex flex-col gap-0.5 pl-2">
                {households.map((h) => (
                  <FacetItem
                    key={h.household_id}
                    label={h.name}
                    count={counts[`household:${h.household_id}`] ?? 0}
                    active={isFacetActive(state, { kind: "household", value: h.household_id })}
                    onClick={() => onChange({ kind: "household", value: h.household_id })}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </FacetGroup>

      {customTags.length > 0 && (
        <FacetGroup title="Custom Tags">
          <div className="flex flex-wrap">
            {customTags.map((tag) => {
              const active = selectedTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagToggle(tag)}
                  className={`mr-1 mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? "bg-accent text-white"
                      : "bg-page-bg-soft text-ink hover:bg-accent-soft"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-accent"}`}
                  />
                  {tag}
                </button>
              );
            })}
          </div>
        </FacetGroup>
      )}

      <FacetGroup title="Events">
        <div className="flex flex-col gap-0.5">
          {Object.entries(scheduleBlockCounts).map(([block, count]) => (
            <FacetItem
              key={block}
              label={blockLabel(block)}
              count={count}
              active={isFacetActive(state, { kind: "block", value: block })}
              onClick={() => onChange({ kind: "block", value: block })}
            />
          ))}
        </div>
      </FacetGroup>
    </aside>
  );
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="meta-label mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

function FacetItem({
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
      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${
        active
          ? "bg-ink text-white"
          : "text-ink-soft hover:bg-page-bg-soft hover:text-ink"
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`ml-2 font-mono text-[10px] tracking-label-tight ${active ? "opacity-80" : "opacity-60"}`}
      >
        {count}
      </span>
    </button>
  );
}

function isFacetActive(state: FacetState, key: FacetKey): boolean {
  if (state.kind !== key.kind) return false;
  if ("value" in state && "value" in key) return state.value === key.value;
  return state.kind === key.kind;
}

function blockLabel(b: string): string {
  switch (b) {
    case "ceremony":
      return "Ceremony";
    case "reception":
      return "Reception";
    case "cocktails":
      return "Cocktails";
    case "after_party":
      return "After-Party";
    case "rehearsal_dinner":
      return "Rehearsal Dinner";
    default:
      return b;
  }
}
