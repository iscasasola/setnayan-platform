import { redirect } from 'next/navigation';

/**
 * Legacy /admin/compliance → avatar › Business & compliance (owner go 14 Nov 2026, the approved drawing
 * `admin_five_tabs_2026-11-13/admin.html` `page('business' …)`). It was the Settings studio's Compliance tab; the
 * RA 10173 facts now sit under Business identity on one screen. actions/_components stay in this dir.
 */
export const dynamic = 'force-dynamic';

export default function Redirect() {
  redirect('/admin/business');
}
