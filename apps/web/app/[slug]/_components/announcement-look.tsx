import { BLOCK_LOOKS_STYLE_ATTR, BLOCK_MARK_ATTR, blockLooksCss, readBlockLooks } from '@/lib/block-looks';

/**
 * 📣 THE ANNOUNCEMENT'S OWN LOOK, WHERE IT IS DRAWN — the guest tree's layout (`app/[slug]/layout.tsx`), on every page
 * under `/[slug]`, outside `SiteBody` (whose mark and `<style>` are not there). `lib/block-looks.ts` keeps it in
 * `events.style_preferences.block_looks.announcements`; the layout already holds the column (`loadEventShell`).
 *
 * Drawn right BEFORE the announcement's root, inside the same wrapper: the block's one `<style>` (its rules alone —
 * the page's other blocks carry theirs in `SiteBody`'s), then its hidden mark, then (the caller's) `<aside>`. With
 * nothing kept for it, NOTHING — the layout is the same bytes as before.
 */
export function AnnouncementLook({ stylePreferences }: { stylePreferences: unknown }) {
  const look = readBlockLooks(stylePreferences).announcements;
  if (!look) return null;
  return (
    <>
      <style {...{ [BLOCK_LOOKS_STYLE_ATTR]: '' }}>{blockLooksCss({ announcements: look })}</style>
      <span hidden {...{ [BLOCK_MARK_ATTR]: 'announcements' }} />
    </>
  );
}
