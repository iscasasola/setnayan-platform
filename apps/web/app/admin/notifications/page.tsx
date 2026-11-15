import { redirect } from 'next/navigation';

/**
 * Legacy /admin/notifications → avatar › Email delivery (owner go 14 Nov 2026, the approved drawing
 * `admin_five_tabs_2026-11-13/admin.html` `page('email-delivery' …)`). The delivery log, the morning digest, push on
 * this device and the bell all live there now.
 */
export const dynamic = 'force-dynamic';

export default function Redirect() {
  redirect('/admin/email-delivery');
}
