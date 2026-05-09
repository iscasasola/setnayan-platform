"use client";

import { GenericTag, RoleTag, RsvpPill, SideAvatar, SideTag } from "./shared";
import type { DisplayRow } from "./pairing";
import { rowAvatarInitials, rowDisplayName, rowSubtitle } from "./pairing";
import { GROUP_LABELS, type Guest } from "@/lib/db/types";

interface Props {
  rows: DisplayRow[];
  selectedGuestId: string | null;
  onSelect: (guestId: string) => void;
  /** Map<primary.guest_id → +1 guest row>, for the plus-one cell + display. */
  plusOneByPrimaryId: Map<string, Guest>;
  /** Map<+1.guest_id → primary host>, for the "brought by" subtitle on +1 rows. */
  hostByPlusOneId: Map<string, Guest>;
}

export function DesktopList({
  rows,
  selectedGuestId,
  onSelect,
  plusOneByPrimaryId,
  hostByPlusOneId,
}: Props) {
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
          const host = hostByPlusOneId.get(id);
          const isPlusOneRow = !!host;
          const subtitle = isPlusOneRow
            ? `+1 brought by ${host.first_name}${host.last_name ? ` ${host.last_name}` : ""}`
            : rowSubtitle(row);
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
                  <strong className="truncate text-[14px] font-semibold text-ink">
                    {isPlusOneRow ? plusOneDisplayName(row.primary) : rowDisplayName(row)}
                  </strong>
                  <span className="font-mono text-[11px] tracking-label-tight text-ink-faint truncate">
                    {subtitle}
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
                  label={
                    row.primary.role === "officiant" && row.primary.rsvp_status === "attending"
                      ? "Confirmed"
                      : undefined
                  }
                />
              </div>
              <div className="font-mono text-[12px] tracking-label-tight text-ink-soft">
                {plusOneCellLabel(row, plusOneByPrimaryId, isPlusOneRow, row.primary.plus_one_mode)}
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

function plusOneDisplayName(g: Guest): string {
  const fn = g.first_name.trim();
  const ln = g.last_name.trim();
  if (!fn && !ln) return "+1 · TBA";
  return `${fn} ${ln}`.trim();
}

function plusOneCellLabel(
  row: DisplayRow,
  plusOneByPrimaryId: Map<string, Guest>,
  isPlusOneRow: boolean,
  plusOneRowMode: "full" | "limited" | null,
): React.ReactNode {
  if (isPlusOneRow) {
    const tag = plusOneRowMode === "limited" ? "+1 · limited" : "+1";
    return <span className="text-accent-deep font-medium">{tag}</span>;
  }
  if (row.kind === "pair") return "paired";
  const g = row.primary;
  if (["ring_bearer", "bible_bearer", "coin_bearer", "flower_girl"].includes(g.role)) return "child";
  if (g.role === "officiant") return "—";
  if (!g.plus_one_allowed) return "no +1";

  // Prefer the canonical +1 row over the legacy plus_one_name string.
  const linked = plusOneByPrimaryId.get(g.guest_id);
  if (linked) {
    const fn = linked.first_name.trim();
    const ln = linked.last_name.trim();
    const display = fn ? (ln ? `${fn} ${ln.charAt(0)}.` : fn) : "TBA";
    const limitedSuffix = linked.plus_one_mode === "limited" ? " (limited)" : "";
    return (
      <span className="text-accent-deep font-medium">
        + {display}
        {limitedSuffix}
      </span>
    );
  }
  if (g.plus_one_name) {
    return <span className="text-accent-deep font-medium">+ {g.plus_one_name}</span>;
  }
  return <span className="text-accent-deep font-medium">+ TBA</span>;
}
