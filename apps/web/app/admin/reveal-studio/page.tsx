import { redirect } from 'next/navigation';

/**
 * Legacy /admin/reveal-studio → Studio Studio redirect (Studio Studio slice 1).
 *
 * The Reveal Studio now lives at /admin/studio?tab=reveal-studio; its body was
 * re-homed byte-identical into
 * app/admin/studio/_surfaces/reveal-studio-surface.tsx. This stub forwards to
 * the studio route so bookmarks + deep-links land on the Reveal Studio tab
 * (the page reads no search params of its own).
 *
 * NOTE: studio.tsx + std-video-moderation.tsx + actions.ts are intentionally
 * NOT moved — the re-homed surface imports them from here.
 */
export const dynamic = 'force-dynamic';

export default async function AdminRevealStudioRedirect() {
  redirect('/admin/studio?tab=reveal-studio');
}
