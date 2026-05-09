"use client";

import { familyForRole, ROLE_LABELS, type WeddingRole, type WeddingSide } from "@/lib/db/types";

export function SideAvatar({
  side,
  initials,
  size = "md",
}: {
  side: WeddingSide;
  initials: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-14 w-14 text-base" : "h-9 w-9 text-xs";
  const gradient: Record<WeddingSide, string> = {
    bride: "linear-gradient(135deg, #D89492, var(--bride))",
    groom: "linear-gradient(135deg, #84A0C2, var(--groom))",
    both: "linear-gradient(135deg, #D9B984, var(--both))",
  };
  return (
    <span
      className={`grid ${dim} shrink-0 place-items-center rounded-full font-semibold tracking-label-tight text-white`}
      style={{ background: gradient[side] }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function SideTag({ side }: { side: WeddingSide }) {
  const className: Record<WeddingSide, string> = {
    bride: "bg-bride-soft text-bride-ink",
    groom: "bg-groom-soft text-groom-ink",
    both: "bg-both-soft text-both-ink",
  };
  const label: Record<WeddingSide, string> = {
    bride: "Bride",
    groom: "Groom",
    both: "Both",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${className[side]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label[side]}
    </span>
  );
}

export function GenericTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="pill-tag">
      <span aria-hidden className="dot" />
      {children}
    </span>
  );
}

export function RoleTag({ role }: { role: WeddingRole }) {
  const fam = familyForRole(role);
  const className =
    fam === "sponsor"
      ? "bg-role-sponsor-bg text-role-sponsor-ink"
      : fam === "entourage"
        ? "bg-role-entourage-bg text-role-entourage-ink"
        : fam === "bearer"
          ? "bg-role-bearer-bg text-role-bearer-ink"
          : "bg-page-bg-soft text-ink-soft";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {ROLE_LABELS[role]}
    </span>
  );
}

export function RsvpPill({ status, label }: { status: "pending" | "attending" | "declined" | "maybe"; label?: string }) {
  const display = label ?? (status.charAt(0).toUpperCase() + status.slice(1));
  return (
    <span className="rsvp-pill" data-status={status}>
      <span aria-hidden className="dot" />
      {display}
    </span>
  );
}
