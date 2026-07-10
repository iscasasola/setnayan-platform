import { redirect } from 'next/navigation';

/**
 * Legacy /admin/seo → Insights Studio redirect (2026-07-10). The SEO & GEO
 * audit now lives at /admin/app-performance?tab=seo; its body was re-homed into
 * app/admin/app-performance/_surfaces/seo-surface.tsx.
 */
export const dynamic = 'force-dynamic';

export default function AdminSeoRedirect() {
  redirect('/admin/app-performance?tab=seo');
}
