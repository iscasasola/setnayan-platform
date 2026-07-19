import { redirect } from 'next/navigation';

/**
 * Legacy /admin/menus → Ugat Studio redirect (2026-07-10). The surface now lives
 * at /admin/ugat?tab=menus; its body was re-homed into ugat/_surfaces/*.
 * actions/_components stay in this dir (the surface imports them absolutely).
 */
export const dynamic = 'force-dynamic';

export default function Redirect() {
  redirect('/admin/ugat?tab=menus');
}
