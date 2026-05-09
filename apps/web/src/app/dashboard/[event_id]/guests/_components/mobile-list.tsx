"use client";

import { familyForRole, ROLE_LABELS, type Guest } from "@/lib/db/types";
import { SideAvatar } from "./shared";
import type { DisplayRow } from "./pairing";
import { rowAvatarInitials, rowDisplayName } from "./pairing";

const SECTION_ORDER: Array<{
  label: string;
  test: (r: DisplayRow) => boolean;
}> = [
  { label: "Wedding Party", test: (r) => familyForRole(r.primary.role) === "entourage" },
  { label: "Sponsors", test: (r) => familyForRole(r.primary.role) === "sponsor" },
  { label: "Bearers & Flower Girls", test: (r) => familyForRole(r.primary.role) === "bearer" },
  {
    label: "Family & Friends",
    test: (r) => ["family", "friends"].includes(r.primary.group_category) && familyForRole(r.primary.role) === "guest",
  },
  { label: "Other", test: () => true },
];

export function MobileList({
  rows,
  onSelect,
  hostByPlusOneId,
}: {
  rows: DisplayRow[];
  onSelect: (guestId: string) => void;
  hostByPlusOneId: Map<string, Guest>;
}) {
  if (rows.length === 0) {
    return (
      <div className="lg:hidden">
        <div className="mx-4 my-6 rounded-2xl border border-rule bg-surface px-4 py-10 text-center">
          <p className="meta-label mb-1">No matches</p>
          <p className="text-sm text-ink-soft">Try clearing filters above.</p>
        </div>
      </div>
    );
  }

  // Group by section in order
  const claimed = new Set<string>();
  const sections: Array<{ label: string; items: DisplayRow[] }> = [];
  for (const sec of SECTION_ORDER) {
    const items = rows.filter((r) => !claimed.has(r.primary.guest_id) && sec.test(r));
    items.forEach((r) => claimed.add(r.primary.guest_id));
    if (items.length > 0) sections.push({ label: sec.label, items });
  }

  return (
    <div className="flex flex-col gap-2.5 px-3.5 pb-28 pt-2 lg:hidden">
      {sections.map((sec) => (
        <div key={sec.label} className="flex flex-col gap-2.5">
          <div className="px-1 pb-1 pt-3 text-[13px] font-semibold text-ink">
            {sec.label}
            <span className="ml-1.5 font-mono text-[11px] font-medium text-ink-faint tracking-label-tight">
              {sec.items.length}
            </span>
          </div>
          {sec.items.map((row) => (
            <MobileCard
              key={row.primary.guest_id}
              row={row}
              host={hostByPlusOneId.get(row.primary.guest_id) ?? null}
              onSelect={() => onSelect(row.primary.guest_id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MobileCard({
  row,
  host,
  onSelect,
}: {
  row: DisplayRow;
  host: Guest | null;
  onSelect: () => void;
}) {
  const stripeBg =
    row.primary.side === "bride"
      ? "var(--bride)"
      : row.primary.side === "groom"
        ? "var(--groom)"
        : "var(--both)";

  const isPlusOneRow = !!host;
  const displayName = isPlusOneRow
    ? plusOneCardName(row.primary)
    : rowDisplayName(row);
  const roleText = isPlusOneRow
    ? `+1 · brought by ${host.first_name}${row.primary.plus_one_mode === "limited" ? " · limited" : ""}`
    : row.kind === "pair"
      ? `${ROLE_LABELS[row.primary.role]} · paired`
      : ROLE_LABELS[row.primary.role];

  const rsvp = row.primary.rsvp_status;
  const rsvpStyles =
    rsvp === "attending"
      ? { background: "var(--rsvp-attending-soft)", color: "#355C3A" }
      : rsvp === "declined"
        ? { background: "var(--rsvp-declined-soft)", color: "#7A2F1E" }
        : rsvp === "pending"
          ? { background: "var(--rsvp-pending-soft)", color: "#7A4F0F" }
          : { background: "var(--rsvp-maybe-soft)", color: "#4F4F4F" };
  const rsvpGlyph = rsvp === "attending" ? "✓" : rsvp === "declined" ? "✕" : rsvp === "pending" ? "⏳" : "?";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-rule bg-surface px-4 py-4 pl-5 text-left active:scale-[0.99]"
      style={{ minHeight: 72 }}
    >
      {/* 4px side-coded left stripe */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: stripeBg }}
      />
      <SideAvatar side={row.primary.side} initials={rowAvatarInitials(row)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-[16px] font-semibold tracking-tight text-ink">
          {displayName}
        </div>
        <div className="truncate text-[13px] font-medium text-ink-soft">{roleText}</div>
      </div>
      <span
        aria-label={`RSVP ${rsvp}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-bold"
        style={rsvpStyles}
      >
        {rsvpGlyph}
      </span>
    </button>
  );
}

function plusOneCardName(g: Guest): string {
  const fn = g.first_name.trim();
  const ln = g.last_name.trim();
  if (!fn && !ln) return "+1 · TBA";
  return `${fn} ${ln}`.trim();
}
