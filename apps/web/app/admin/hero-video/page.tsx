import { redirect } from 'next/navigation';

/**
 * Legacy /admin/hero-video → Studio Studio redirect (Studio Studio slice 1).
 *
 * The Homepage hero video editor now lives at /admin/studio?tab=hero-video;
 * its body was re-homed byte-identical into
 * app/admin/studio/_surfaces/hero-video-surface.tsx. This stub forwards to the
 * studio route so bookmarks + deep-links land on the Hero video tab (the page
 * reads no search params of its own).
 *
 * NOTE: hero-uploader.tsx + actions.ts are intentionally NOT moved — the
 * re-homed surface imports HeroUploader from here.
 */
export const dynamic = 'force-dynamic';

export default async function AdminHeroVideoRedirect() {
  redirect('/admin/studio?tab=hero-video');
}
