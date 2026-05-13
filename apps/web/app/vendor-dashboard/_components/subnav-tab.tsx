'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

type Props = {
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
  match: 'exact' | 'prefix';
};

export function VendorSubnavTab({ href, label, Icon, badge, match }: Props) {
  const pathname = usePathname();
  const isActive = match === 'exact' ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors ${
        isActive
          ? 'bg-terracotta text-cream'
          : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
      }`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span
          className={`rounded-full px-1.5 font-mono text-[10px] ${
            isActive ? 'bg-cream/20 text-cream' : 'bg-ink/10 text-ink/65'
          }`}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  );
}
