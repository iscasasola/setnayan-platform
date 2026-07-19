import { redirect } from 'next/navigation';

/**
 * Legacy /admin/patiktok → Studio Studio redirect (Studio Studio slice 2).
 *
 * The Patiktok render-job monitor now lives at /admin/studio?tab=patiktok; its
 * body was re-homed byte-identical into
 * app/admin/studio/_surfaces/patiktok-surface.tsx. The legacy route had no
 * search params, so this stub forwards straight to the studio tab.
 */
export const dynamic = 'force-dynamic';

export default function AdminPatiktokRedirect() {
  redirect('/admin/studio?tab=patiktok');
}
