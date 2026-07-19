import { redirect } from 'next/navigation';

/**
 * Legacy /admin/connection-logs → Insights Studio redirect (2026-07-10).
 *
 * The connection-logs readout now lives at /admin/app-performance?tab=connection-logs; its body
 * was re-homed into app/admin/app-performance/_surfaces/connection-logs-surface.tsx. This
 * stub forwards incoming deep-links + any post-action redirects onto the studio
 * tab so bookmarks keep working. actions/_components stay in this dir — the
 * re-homed surface imports them from here.
 */
export const dynamic = 'force-dynamic';

export default function ConnectionLogsRedirect() {
  redirect('/admin/app-performance?tab=connection-logs');
}
