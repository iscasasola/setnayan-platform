import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * <ThreadListCard> — shared thread-row card for the MESSAGES-LIST pages.
 *
 * Extracted 2026-06-14 for the dashboard-consolidation dedup (Track A5). The
 * couple (`/dashboard/[eventId]/messages`) and vendor
 * (`/vendor-dashboard/messages`) inboxes forked identical thread-row markup
 * (the `<li>`/`<Link>` shell, the avatar slot, title + badges + last-activity
 * line, and the trailing chevron) while keeping their own role-scoped fetch.
 * The thread DETAIL view was already shared via <ChatMessageStream>; this is
 * the matching consolidation for the LIST view.
 *
 * Each list page keeps its OWN role-scoped fetch + scoping validation and
 * passes the per-role differences in as props:
 *   - `href`        — the thread detail URL (role-scoped path)
 *   - `title`       — vendor display name (couple) or event display name (vendor)
 *   - `avatar`      — optional leading node (couple shows a vendor logo/initials
 *                     avatar; vendor shows none)
 *   - `badge`       — optional inquiry-status pill (copy/colour differ per role)
 *   - `extra`       — optional extra block under the badge (vendor's
 *                     returning-client note); couple passes none
 *   - `timestampLine` — the mono last-activity line (vendor prefixes the date)
 *
 * Rendered output is byte-for-byte identical to the two former inline cards —
 * this is a pure dedup with no behaviour or visual change. The couple-only
 * follow-gate UI stays in the couple page and is NOT part of this component.
 */
export type ThreadListCardProps = {
  href: string;
  title: string;
  timestampLine: ReactNode;
  avatar?: ReactNode;
  badge?: ReactNode;
  extra?: ReactNode;
};

export function ThreadListCard({
  href,
  title,
  timestampLine,
  avatar,
  badge,
  extra,
}: ThreadListCardProps) {
  const inner = (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-ink">{title}</p>
      {badge}
      {extra}
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {timestampLine}
      </p>
    </div>
  );

  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
    >
      {avatar ? (
        <div className="flex min-w-0 items-center gap-3">
          {avatar}
          {inner}
        </div>
      ) : (
        inner
      )}
      <ArrowRight
        aria-hidden
        className="h-4 w-4 text-ink/40 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
        strokeWidth={1.75}
      />
    </Link>
  );
}

/**
 * <ThreadListAvatar> — the couple inbox's leading vendor avatar (logo or
 * initials), extracted alongside <ThreadListCard> so both the avatar markup
 * and the row shell live in one place. Vendor rows pass no avatar.
 */
export function ThreadListAvatar({
  logoUrl,
  name,
}: {
  logoUrl: string | null;
  name: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  if (logoUrl) {
    return (
      <span className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream">
        <Image
          src={logoUrl}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-mono text-xs font-semibold text-terracotta-700">
      {initials || '?'}
    </span>
  );
}
