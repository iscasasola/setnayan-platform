"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TopNavProps {
  coupleNames: string;
  eventMeta: string;
  userInitials: string;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/landing", label: "Landing Page" },
  { href: "/dashboard/guests", label: "Guests" },
  { href: "/dashboard/schedule", label: "Schedule" },
  { href: "/dashboard/suppliers", label: "Suppliers" },
  { href: "/dashboard/gallery", label: "Gallery" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export function DashboardTopNav({
  coupleNames,
  eventMeta,
  userInitials,
}: TopNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href));

  // Couple monogram (e.g., "M&J" — derived from couple names)
  const monogram = coupleNames
    .split("&")
    .map((p) => p.trim()[0] ?? "")
    .filter(Boolean)
    .join("&");

  return (
    <header className="hidden border-b border-rule bg-surface lg:block">
      {/* Desktop nav (lg+) — mobile gets its own page-specific app header */}
      <div className="flex items-center justify-between gap-6 px-8 py-3.5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-6 w-6 rounded-full"
            style={{
              background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
            }}
          />
          <span className="font-serif text-lg font-medium tracking-tight">
            Tayo
            <span className="text-ink-soft italic font-normal"> · couple</span>
          </span>
        </Link>

        <nav className="flex gap-1">
          {NAV_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-2 text-[13px] font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "text-ink-soft hover:bg-page-bg-soft hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2 rounded-full border border-rule bg-page-bg-soft px-3 py-1.5 pr-3.5 text-xs font-medium">
            <span
              className="grid h-[22px] w-[22px] place-items-center rounded-full font-serif text-[11px] text-white"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-deep))",
              }}
              aria-hidden
            >
              {monogram}
            </span>
            <div className="leading-tight">
              <div className="text-[12px] font-medium">{coupleNames}</div>
              <div className="meta-label">{eventMeta}</div>
            </div>
          </div>
          <SignOutButton />
          <div className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[12px] font-semibold text-white tracking-label-tight">
            {userInitials}
          </div>
        </div>
      </div>

    </header>
  );
}

function SignOutButton() {
  return (
    <form action="/auth/signout" method="POST">
      <button
        type="submit"
        className="rounded-full border border-rule px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:border-ink hover:text-ink"
      >
        Sign out
      </button>
    </form>
  );
}
