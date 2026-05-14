'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  match: 'exact' | 'prefix';
};

export function VendorSubnavTab({ href, label, icon, badge, match }: Props) {
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
      {icon}
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
