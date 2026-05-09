"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { EventCard } from "@/lib/db/types";

interface Props {
  eventId: string;
  coupleNames: string;
  eventMeta: string;
  userInitials: string;
  switcherEvents: EventCard[];
}

const TABS = [
  { slug: "guests", label: "Guests" },
  { slug: "vendors", label: "Vendors" },
  { slug: "schedule", label: "Schedule" },
  { slug: "services", label: "In-App Services" },
] as const;

export function EventTopBar({
  eventId,
  coupleNames,
  eventMeta,
  userInitials,
  switcherEvents,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState<"switcher" | "profile" | null>(null);

  const tabActive = (slug: string) =>
    pathname.startsWith(`/dashboard/${eventId}/${slug}`);

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-surface/95 backdrop-blur">
      {/* Mobile: compact app header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(open === "switcher" ? null : "switcher")}
          className="flex min-w-0 items-center gap-2 rounded-full border border-rule bg-page-bg-soft px-3 py-1"
          aria-expanded={open === "switcher"}
          aria-label="Switch event"
        >
          <span className="truncate text-[12px] font-medium text-ink">{coupleNames}</span>
          <span aria-hidden className="text-[10px] text-ink-faint">▾</span>
        </button>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/${eventId}/services/wallet`}
            className="rounded-full border border-rule bg-page-bg-soft px-2.5 py-1 text-[11px] font-medium text-ink"
            aria-label="Wallet"
          >
            🪙 0
          </Link>
          <Link
            href="/dashboard/profile"
            className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-bold text-white"
            aria-label="Profile"
          >
            {userInitials}
          </Link>
        </div>
      </div>

      {/* Desktop: full chrome */}
      <div className="hidden items-center justify-between gap-6 px-8 py-3 lg:flex">
        <Link href={`/dashboard/${eventId}/guests`} className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-6 w-6 rounded-full"
            style={{
              background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
            }}
          />
          <span className="font-serif text-lg font-medium tracking-tight">Tayo</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen(open === "switcher" ? null : "switcher")}
          className="flex items-center gap-2 rounded-full border border-rule bg-page-bg-soft px-3 py-1.5"
          aria-expanded={open === "switcher"}
        >
          <span className="text-[13px] font-medium text-ink">{coupleNames}</span>
          <span className="text-[11px] text-ink-faint">{eventMeta}</span>
          {switcherEvents.length > 0 && (
            <span aria-hidden className="text-[10px] text-ink-faint">
              ▾
            </span>
          )}
        </button>

        <nav className="flex gap-1">
          {TABS.map((t) => {
            const active = tabActive(t.slug);
            return (
              <Link
                key={t.slug}
                href={`/dashboard/${eventId}/${t.slug}`}
                className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "text-ink-soft hover:bg-page-bg-soft hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/${eventId}/services/wallet`}
            className="rounded-full border border-rule bg-page-bg-soft px-3 py-1.5 text-[12px] font-medium text-ink hover:border-ink"
            aria-label="Wallet"
          >
            🪙 0
          </Link>
          <Link
            href="/dashboard/profile"
            className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-bold text-white"
            aria-label="Profile"
            title="Profile"
          >
            {userInitials}
          </Link>
        </div>
      </div>

      {/* Switcher dropdown */}
      {open === "switcher" && switcherEvents.length > 0 && (
        <div
          className="absolute left-4 right-4 top-full z-40 mt-2 rounded-2xl border border-rule-strong bg-surface p-2 shadow-lg lg:left-auto lg:right-auto lg:max-w-md"
          role="dialog"
          aria-label="Switch event"
        >
          <p className="meta-label px-2 py-1">Switch event</p>
          <ul>
            {switcherEvents.map((e) => {
              const active = e.event_id === eventId;
              return (
                <li key={e.event_id}>
                  <Link
                    href={`/dashboard/${e.event_id}/guests`}
                    onClick={() => setOpen(null)}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13px] ${
                      active ? "bg-page-bg-soft" : "hover:bg-page-bg-soft"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {e.is_primary && <span aria-hidden>⭐</span>}
                      <span className="font-medium text-ink">
                        {e.bride_first_name} &amp; {e.groom_first_name}
                      </span>
                    </span>
                    <span className="text-[11px] text-ink-faint">{e.event_date}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href="/dashboard"
            onClick={() => setOpen(null)}
            className="mt-1 block rounded-xl px-3 py-2 text-[12px] text-ink-soft hover:bg-page-bg-soft"
          >
            See all events →
          </Link>
        </div>
      )}
    </header>
  );
}
