import { redirect } from 'next/navigation';

/**
 * Legacy /admin/demo-vendors → Accounts Studio redirect (Accounts Studio
 * slice 4, final).
 *
 * The Demo vendors LIST/overview now lives at /admin/accounts?tab=demo-vendors;
 * its body was re-homed byte-identical into
 * app/admin/accounts/_surfaces/demo-vendors-surface.tsx. The overview takes no
 * search params + has no filter form, so this stub forwards nothing beyond the
 * tab itself — bookmarks + deep-links to the old list route land on the Demo
 * vendors tab.
 *
 * NOTE: inquiries/ + inquiries/[threadId]/ (the "respond as the vendor" flows)
 * + inquiries/actions.ts + _components/demo-vendor-actions.tsx + loading.tsx
 * are intentionally NOT moved — they stay standalone. The re-homed surface
 * imports the DemoVendorActions client component from its existing
 * _components location, and the "Demo inquiries" link points at the standalone
 * inquiries route.
 */
export const dynamic = 'force-dynamic';

export default async function AdminDemoVendorsRedirect() {
  redirect('/admin/accounts?tab=demo-vendors');
}
