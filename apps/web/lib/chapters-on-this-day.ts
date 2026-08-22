import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { chapterHasReadableContent } from '@/lib/creator-chapters';

/**
 * The stories written about ONE celebration, for the people of that celebration.
 *
 * Owner, 2026-08-20: *"they also get to choose whether it is only me, private
 * (all in that event only), public."* This is the read behind the middle
 * answer — the one that had no surface at all before it.
 *
 * ── WHO IS ALLOWED THROUGH ──────────────────────────────────────────────────
 * 🔒 **"THE PEOPLE OF THIS CELEBRATION" IS NOT "WHOEVER OPENED THE PAGE."**
 * Four of six production events are private, but two are not — and on a PUBLIC
 * event page a passer-by is just a visitor. Placing an event-only chapter there
 * without an identity check would publish it to the internet under the name
 * "private". The caller proves the viewer is a host, a booked supplier, a guest
 * holding a seat, or a signed-in seat-holder BEFORE calling this; there is no
 * argument here that can be set to "public".
 *
 * ── WHAT IT RETURNS ─────────────────────────────────────────────────────────
 * Chapters attached to this celebration that are shared at all (`event` or
 * `published`) AND that the HOST has put on their day. That second predicate is
 * the 2026-08-15 ruling and it is load-bearing: attaching is the author's act,
 * appearing where Setnayan speaks about this celebration is the host's. A
 * supplier's piece waits for the couple; the couple's own is stamped
 * automatically by the database.
 *
 * 🪤 A FAILED READ RETURNS AN EMPTY LIST, and the caller renders nothing — the
 * same value as "nobody has written one". That is the right RENDER (an error
 * panel on somebody's wedding page is worse) but it must never be reported as a
 * measured zero, which is why nothing here counts anything.
 */
export type ChapterOnThisDay = {
  publicId: string;
  title: string;
  /** Present only for a chapter whose author has a public page to link to. */
  href: string | null;
  authorName: string;
  /** True when this chapter is public anyway — the block says so. */
  isPublic: boolean;
  day: string | null;
};

export async function loadChaptersOnThisDay(
  eventId: string,
): Promise<ChapterOnThisDay[]> {
  if (!eventId) return [];
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const { data, error } = await admin
    .from('creator_chapters')
    .select('public_id, title, body, embed_url, status, user_id, published_at, happened_on')
    .eq('event_id', eventId)
    .in('status', ['event', 'published'])
    .not('host_included_at', 'is', null)
    .order('published_at', { ascending: false });
  if (error) {
    // Rejected, not thrown — the only symptom of a phantom column or a refused
    // read is an absence, so it is at least logged.
    console.error('[chapters-on-this-day] read failed', eventId, error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    public_id: string;
    title: string;
    body: string | null;
    embed_url: string | null;
    status: string;
    user_id: string;
    published_at: string | null;
    happened_on: string | null;
  }>;
  const readable = rows.filter((r) => chapterHasReadableContent(r));
  if (readable.length === 0) return [];

  const { data: people } = await admin
    .from('users')
    .select('user_id, display_name, slug, public_profile_enabled')
    .in('user_id', [...new Set(readable.map((r) => r.user_id))]);
  const byUser = new Map(
    ((people ?? []) as Array<{
      user_id: string;
      display_name: string | null;
      slug: string | null;
      public_profile_enabled: boolean | null;
    }>).map((p) => [p.user_id, p]),
  );

  return readable.map((r) => {
    const author = byUser.get(r.user_id);
    // 🔗 THE LINK IS ONLY OFFERED WHEN THE CHAPTER PAGE WOULD ACTUALLY OPEN.
    // That page serves PUBLISHED chapters on PUBLIC profiles only, so linking
    // an event-only piece — or a public one by somebody whose page is hidden —
    // would hand these readers a dead end dressed as a story.
    const linkable =
      r.status === 'published' && !!author?.slug && author?.public_profile_enabled === true;
    return {
      publicId: r.public_id,
      title: r.title,
      href: linkable ? `/u/${author!.slug}/c/${r.public_id}` : null,
      authorName: author?.display_name?.trim() || 'Someone who was there',
      isPublic: r.status === 'published',
      day: r.happened_on ?? (r.published_at ? r.published_at.slice(0, 10) : null),
    };
  });
}
