"use client";

import { useState } from "react";
import { GROUP_CATEGORIES, GROUP_LABELS, type GroupCategory, type RsvpStatus, type WeddingSide } from "@/lib/db/types";
import { ROLE_FAMILIES, type RoleFamily } from "@/lib/db/types";
import type { ToolbarFilterState } from "./toolbar";
import { type FacetState } from "./facet-state";

interface Props {
  filter: ToolbarFilterState;
  onFilterChange: (next: Partial<ToolbarFilterState>) => void;
  facet: FacetState;
  onFacetChange: (next: FacetState) => void;
  customTags: string[];
  selectedTags: Set<string>;
  onTagToggle: (tag: string) => void;
  counts: {
    all: number;
    pending: number;
    attending: number;
    declined: number;
    bride: number;
    groom: number;
    both: number;
  };
}

export function MobileChipRail({
  filter,
  onFilterChange,
  facet,
  onFacetChange,
  customTags,
  selectedTags,
  onTagToggle,
  counts,
}: Props) {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <div
        className="flex gap-2 overflow-x-auto border-b border-rule bg-page-bg px-4 pb-3 pt-1 lg:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <Chip
          label="All"
          active={filter.status === "all" && filter.side === "all"}
          onClick={() => {
            onFilterChange({ status: "all", side: "all" });
            onFacetChange({ kind: "all" });
          }}
        />
        <Chip
          label="Pending"
          active={filter.status === "pending"}
          onClick={() => onFilterChange({ status: filter.status === "pending" ? "all" : "pending" })}
        />
        <Chip
          label="Going"
          active={filter.status === "attending"}
          onClick={() => onFilterChange({ status: filter.status === "attending" ? "all" : "attending" })}
        />
        <Chip
          label="Bride's"
          active={filter.side === "bride"}
          onClick={() => onFilterChange({ side: filter.side === "bride" ? "all" : "bride" })}
        />
        <Chip
          label="Groom's"
          active={filter.side === "groom"}
          onClick={() => onFilterChange({ side: filter.side === "groom" ? "all" : "groom" })}
        />
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-rule-strong bg-surface px-4 py-2.5 text-[14px] font-medium text-ink"
          style={{ minHeight: 38 }}
        >
          ＋ More
        </button>
      </div>

      {showMore && (
        <MoreFiltersSheet
          facet={facet}
          onFacetChange={onFacetChange}
          customTags={customTags}
          selectedTags={selectedTags}
          onTagToggle={onTagToggle}
          counts={counts}
          onClose={() => setShowMore(false)}
        />
      )}
    </>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-[14px] font-medium transition ${
        active
          ? "border-ink bg-ink text-white"
          : "border-rule-strong bg-surface text-ink-soft"
      }`}
      style={{ minHeight: 38 }}
    >
      {label}
    </button>
  );
}

function MoreFiltersSheet({
  facet,
  onFacetChange,
  customTags,
  selectedTags,
  onTagToggle,
  counts,
  onClose,
}: {
  facet: FacetState;
  onFacetChange: (next: FacetState) => void;
  customTags: string[];
  selectedTags: Set<string>;
  onTagToggle: (tag: string) => void;
  counts: Props["counts"];
  onClose: () => void;
}) {
  void counts;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm lg:hidden">
      <div className="flex max-h-[88dvh] w-full flex-col overflow-y-auto rounded-t-3xl bg-surface p-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-2xl font-medium tracking-tight">More filters</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft"
          >
            ×
          </button>
        </div>

        <Group title="Wedding party">
          {(Object.keys(ROLE_FAMILIES) as RoleFamily[]).map((fam) => (
            <FilterRow
              key={fam}
              label={
                fam === "sponsor"
                  ? "Sponsors"
                  : fam === "entourage"
                    ? "Wedding party"
                    : fam === "bearer"
                      ? "Bearers & Flower Girls"
                      : "Guests only"
              }
              active={facet.kind === "family" && facet.value === fam}
              onClick={() => onFacetChange({ kind: "family", value: fam })}
            />
          ))}
        </Group>

        <Group title="Group">
          {GROUP_CATEGORIES.map((g: GroupCategory) => (
            <FilterRow
              key={g}
              label={GROUP_LABELS[g]}
              active={facet.kind === "group" && facet.value === g}
              onClick={() => onFacetChange({ kind: "group", value: g })}
            />
          ))}
        </Group>

        {customTags.length > 0 && (
          <Group title="Custom tags">
            <div className="flex flex-wrap gap-2 px-1 py-1">
              {customTags.map((t) => {
                const active = selectedTags.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTagToggle(t)}
                    className={`rounded-full border px-3 py-2 text-[13px] font-medium transition ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-rule-strong bg-surface text-ink"
                    }`}
                    style={{ minHeight: 38 }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </Group>
        )}

        <div className="mt-4 flex justify-end gap-2 pb-2">
          <button
            type="button"
            onClick={() => {
              onFacetChange({ kind: "all" });
              for (const t of selectedTags) onTagToggle(t);
              onClose();
            }}
            className="btn-ghost"
          >
            Clear
          </button>
          <button type="button" onClick={onClose} className="btn-accent">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h4 className="meta-label mb-2">{title}</h4>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function FilterRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg px-3 py-3 text-left text-[14px] transition ${
        active ? "bg-ink text-white" : "bg-page-bg-soft text-ink"
      }`}
      style={{ minHeight: 44 }}
    >
      <span>{label}</span>
      {active && <span aria-hidden>✓</span>}
    </button>
  );
}

// Re-export type to keep the import surface flat
export type RsvpStatusRef = RsvpStatus;
export type WeddingSideRef = WeddingSide;
