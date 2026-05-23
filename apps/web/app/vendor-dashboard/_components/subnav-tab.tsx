'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { countUnread } from '@/lib/notifications';

type Props = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  match: 'exact' | 'prefix';
  /**
   * When set, the tab subscribes to Supabase Realtime for this user's
   * notifications so the badge stays live without a page reload. The
   * `badge` prop becomes the initial value (server-rendered) and is
   * superseded by the live count after the first SUBSCRIBED event.
   */
  liveNotificationsUserId?: string;
};

export function VendorSubnavTab({
  href,
  label,
  icon,
  badge,
  match,
  liveNotificationsUserId,
}: Props) {
  const pathname = usePathname();
  const isActive = match === 'exact' ? pathname === href : pathname.startsWith(href);

  // Live-count overlay. Defaults to the server-rendered `badge` value; once
  // the Realtime channel is subscribed, this state takes over.
  const [liveBadge, setLiveBadge] = useState<number | undefined>(badge);
  useEffect(() => {
    setLiveBadge(badge);
  }, [badge]);

  // 2026-05-23 — Same Realtime channel collision fix as
  // UnreadBellBadge. Multiple VendorSubnavTab instances mount per
  // page (one per nav tab) with the SAME liveNotificationsUserId →
  // Supabase Realtime returns the same channel singleton → 2nd mount
  // .on() throws on already-subscribed channel. useId() gives each tab
  // a unique stable suffix so each gets its own channel.
  const instanceId = useId();

  useEffect(() => {
    if (!liveNotificationsUserId) return;
    const supabase = createClient();
    let cancelled = false;
    const refresh = async () => {
      try {
        const fresh = await countUnread(supabase, liveNotificationsUserId);
        if (cancelled) return;
        setLiveBadge(fresh);
      } catch {
        // Transient — next Realtime event will heal.
      }
    };
    const channel = supabase
      .channel(`notif-unread-tab-${liveNotificationsUserId}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${liveNotificationsUserId}`,
        },
        () => setLiveBadge((n) => (n ?? 0) + 1),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${liveNotificationsUserId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refresh();
      });
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [liveNotificationsUserId, instanceId]);

  const renderBadge = liveBadge;
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
      {renderBadge && renderBadge > 0 ? (
        <span
          className={`rounded-full px-1.5 font-mono text-[10px] ${
            isActive ? 'bg-cream/20 text-cream' : 'bg-ink/10 text-ink/65'
          }`}
        >
          {renderBadge > 9 ? '9+' : renderBadge}
        </span>
      ) : null}
    </Link>
  );
}
