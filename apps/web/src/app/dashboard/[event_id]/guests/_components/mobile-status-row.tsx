"use client";

import type { Guest } from "@/lib/db/types";

export function MobileStatusRow({ guests }: { guests: Guest[] }) {
  let attending = 0;
  let pending = 0;
  let declined = 0;
  for (const g of guests) {
    if (g.rsvp_status === "attending") attending++;
    else if (g.rsvp_status === "pending") pending++;
    else if (g.rsvp_status === "declined") declined++;
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto bg-page-bg px-4 py-3 lg:hidden"
      style={{ scrollbarWidth: "none" }}
    >
      <Pill kind="attending" num={attending} label="going" />
      <Pill kind="pending" num={pending} label="pending" />
      <Pill kind="declined" num={declined} label="declined" />
    </div>
  );
}

function Pill({
  kind,
  num,
  label,
}: {
  kind: "attending" | "pending" | "declined";
  num: number;
  label: string;
}) {
  const styles =
    kind === "attending"
      ? {
          background: "var(--rsvp-attending-soft)",
          borderColor: "rgba(111, 167, 118, 0.25)",
          color: "#355C3A",
        }
      : kind === "pending"
        ? {
            background: "var(--rsvp-pending-soft)",
            borderColor: "rgba(214, 151, 68, 0.25)",
            color: "#7A4F0F",
          }
        : {
            background: "var(--rsvp-declined-soft)",
            borderColor: "rgba(196, 106, 85, 0.25)",
            color: "#7A2F1E",
          };
  return (
    <div
      className="inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium"
      style={styles}
    >
      <span className="font-serif text-[18px] font-semibold leading-none tracking-tight">
        {num}
      </span>
      <span className="text-[12px] font-medium opacity-80">{label}</span>
    </div>
  );
}
