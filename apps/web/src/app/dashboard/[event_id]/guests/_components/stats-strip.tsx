"use client";

import { useMemo } from "react";
import type { Guest, Household } from "@/lib/db/types";

export function StatsStrip({
  guests,
  households,
  rsvpDeadline,
}: {
  guests: Guest[];
  households: Household[];
  rsvpDeadline?: string | null;
}) {
  const stats = useMemo(() => {
    const invited = guests.length;
    const attending = guests.filter((g) => g.rsvp_status === "attending").length;
    const pending = guests.filter((g) => g.rsvp_status === "pending").length;
    const declined = guests.filter((g) => g.rsvp_status === "declined").length;
    const plusOnesAllowed = guests.filter((g) => g.plus_one_allowed).length;
    const plusOnesNamed = guests.filter((g) => g.plus_one_allowed && !!g.plus_one_name).length;
    const plusOnesTba = plusOnesAllowed - plusOnesNamed;
    return {
      invited,
      attending,
      pending,
      declined,
      plusOnes: plusOnesAllowed,
      plusOnesNamed,
      plusOnesTba,
    };
  }, [guests]);

  const householdCount = households.length;
  const attendingPct = stats.invited > 0 ? Math.round((stats.attending / stats.invited) * 100) : 0;
  const declinedPct = stats.invited > 0 ? Math.round((stats.declined / stats.invited) * 100) : 0;

  const deadlineText = useMemo(() => {
    if (!rsvpDeadline) return "RSVPs ongoing";
    const today = new Date().setHours(0, 0, 0, 0);
    const target = new Date(`${rsvpDeadline}T00:00:00`).getTime();
    const days = Math.round((target - today) / 86_400_000);
    if (days < 0) return "RSVP closed";
    if (days === 0) return "RSVP closes today";
    return `RSVP closes in ${days}d`;
  }, [rsvpDeadline]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Card label="Invited" value={stats.invited} sub={`across ${householdCount} household${householdCount === 1 ? "" : "s"}`} />
      <Card
        label="Attending"
        value={stats.attending}
        sub={`${attendingPct}% confirmed`}
        accent="rsvp-attending"
      />
      <Card
        label="Pending"
        value={stats.pending}
        sub={deadlineText}
        accent="rsvp-pending"
      />
      <Card
        label="Declined"
        value={stats.declined}
        sub={`${declinedPct}% of invited`}
        accent="rsvp-declined"
      />
      <Card
        label="Plus-Ones"
        value={stats.plusOnes}
        sub={`${stats.plusOnesNamed} named · ${stats.plusOnesTba} TBA`}
      />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: "rsvp-attending" | "rsvp-pending" | "rsvp-declined";
}) {
  const valueClass =
    accent === "rsvp-attending"
      ? "text-rsvp-attending"
      : accent === "rsvp-pending"
        ? "text-rsvp-pending"
        : accent === "rsvp-declined"
          ? "text-rsvp-declined"
          : "text-ink";
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-rule bg-surface px-4 py-4 shadow-tayo-sm">
      <div className="meta-label">{label}</div>
      <div className={`font-serif text-3xl font-medium leading-none tracking-tight lg:text-[32px] ${valueClass}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] text-ink-soft">{sub}</div>
    </div>
  );
}
