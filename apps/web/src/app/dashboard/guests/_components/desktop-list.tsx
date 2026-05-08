"use client";

import { GenericTag, RoleTag, RsvpPill, SideAvatar, SideTag } from "./shared";
import type { DisplayRow } from "./pairing";
import { rowAvatarInitials, rowDisplayName, rowSubtitle } from "./pairing";
import { GROUP_LABELS } from "@/lib/db/types";

export function DesktopList({
  rows,
  selectedGuestId,
  onSelect,
}: {
  rows: DisplayRow[];
  selectedGuestId: string | null;
  onSelect: (guestId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-rule bg-surface px-6 py-12 text-center">
        <p className="meta-label mb-2">No matches</p>
        <p className="font-serif text-2xl text-ink">No guests match your filters</p>
        <p className="mt-2 text-sm text-ink-soft">Try clearing search or filter chips above.</p>
      </div>
    );
  }

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-rule bg-surface lg:block">
      <div
        className="grid items-center gap-3 border-b border-rule bg-page-bg-soft px-5 py-3.5 font-mono text-[10px] uppercase tracking-label-wide text-ink-faint"
        style={{ gridTemplateColumns: "1.6fr 1.1fr 1fr 0.8fr 0.7fr 36px" }}
      >
        <div>Guest · Household</div>
        <div>Side · Group</div>
        <div>Role</div>
        <div>RSVP</div>
        <div>Plus-One</div>
        <div></div>
      </div>

      <ul role="list">
        {rows.map((row) => {
          const id = row.primary.guest_id;
          const selected = selectedGuestId === id;
          return (
            <li
              key={id}
              role="button"
              tabIndex={0}
              aria-selected={selected}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(id);
                }
              }}
              className={`grid cursor-pointer items-center gap-3 border-b border-rule px-5 py-3.5 transition last:border-b-0 hover:bg-surface-soft ${
                selected ? "bg-accent-soft" : ""
              }`}
              style={{ gridTemplateColumns: "1.6fr 1.1fr 1fr 0.8fr 0.7fr 36px" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <SideAvatar side={row.primary.side} initials={rowAvatarInitials(row)} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <strong className="truncate text-[14px] font-semibold text-ink">{rowDisplayName(row)}</strong>
                  <span className="font-mono text-[11px] tracking-label-tight text-ink-faint truncate">
                    {rowSubtitle(row)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <SideTag side={row.primary.side} />
                <GenericTag>{GROUP_LABELS[row.primary.group_category]}</GenericTag>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <RoleTag role={row.primary.role} />
              </div>
              <div>
                <RsvpPill
                  status={row.primary.rsvp_status}
                  label={row.primary.role === "officiant" && row.primary.rsvp_status === "attending" ? "Confirmed" : undefined}
                />
              </div>
              <div className="font-mono text-[12px] tracking-label-tight text-ink-soft">
                {plusOneCellLabel(row)}
              </div>
              <div
                onClick={(e) => e.stopPropagation()}
                className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-page-bg-soft hover:text-ink"
              >
                ⋯
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function plusOneCellLabel(row: DisplayRow): React.ReactNode {
  if (row.kind === "pair") return "paired";
  const g = row.primary;
  if (["ring_bearer", "bible_bearer", "coin_bearer", "flower_girl"].includes(g.role)) return "child";
  if (g.role === "officiant") return "—";
  if (!g.plus_one_allowed) return "no +1";
  if (g.plus_one_name) {
    return <span className="text-accent-deep font-medium">+ {g.plus_one_name}</span>;
  }
  return <span className="text-accent-deep font-medium">+ TBA</span>;
}
