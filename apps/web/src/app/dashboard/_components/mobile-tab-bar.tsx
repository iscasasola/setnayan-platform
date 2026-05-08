"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview", icon: "⌂" },
  { href: "/dashboard/guests", label: "Guests", icon: "◉" },
  { href: "/dashboard/schedule", label: "Schedule", icon: "⌚" },
  { href: "/dashboard/more", label: "More", icon: "☰" },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-rule bg-surface/95 backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      {TABS.map((t) => {
        const active =
          t.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium tracking-label-tight ${
              active ? "text-ink" : "text-ink-faint"
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              {t.icon}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
