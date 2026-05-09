"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  eventId: string;
}

const TABS = [
  { slug: "guests",   label: "Guests",   icon: "👥" },
  { slug: "vendors",  label: "Vendors",  icon: "💼" },
  { slug: "schedule", label: "Schedule", icon: "📅" },
  { slug: "services", label: "Services", icon: "✨" },
] as const;

export function EventBottomNav({ eventId }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-rule bg-surface/95 backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      {TABS.map((t) => {
        const active = pathname.startsWith(`/dashboard/${eventId}/${t.slug}`);
        return (
          <Link
            key={t.slug}
            href={`/dashboard/${eventId}/${t.slug}`}
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
