'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { youtubeThumbFromEmbedUrl } from '@/lib/creator-chapters';

/**
 * Setnayan HQ · Storytellers actions — curate which PUBLISHED creator chapters
 * get FEATURED (pinned) + in what ORDER on the "From Our Storytellers" shelf
 * of the public /realstories hub (Storytellers council verdict 2026-07-16,
 * PR-D; owner-ratified badge word "Storyteller").
 *
 * COPY-THE-PATTERN, NOT CALL-THE-SAME-CODE: this file copies the proven
 * audit + notify + revalidate spine from app/admin/real-stories/actions.ts
 * verbatim in shape, but over its OWN gate — the wedding-only
 * assertEligibleShowcase must NEVER be generalized (verdict §4.3). Two
 * independent action sets over two independent gates:
 *
 *   events gate    = RA 10173 showcase consent (real-stories actions)
 *   chapters gate  = status='published' AND owner public_profile_enabled
 *                    AND a YouTube-derivable thumbnail (V1 thumbnail rule,
 *                    owner decision #6: non-YouTube chapters are NOT
 *                    featurable — a curation rule, not a schema change)
 *
 * Deny-by-default: publishing never lists a chapter; the owner's Feature click
 * IS the moderation review. Writes two nullable columns on `creator_chapters`
 * (showcase_featured_at / showcase_feature_rank — migration 20270818771487),
 * audits every mutation (`storytellers.feature` / `.unfeature` / `.rank`),
 * notifies the creator on feature (mirror of showcase_featured), and
 * revalidates /realstories so the shelf updates with no redeploy.
 */

const BASE = '/admin/studio?tab=storytellers';
const SAFE_ANCHOR = /[^a-z0-9-]/gi;
// Chapters are addressed by their human-facing public_id (S89C-…, Crockford
// base32 body) — validate before it ever reaches a query.
const PUBLIC_ID_RE = /^S89C-[0-9A-HJKMNP-TV-Z]{10}$/i;

function redirectBack(kind: 'ok' | 'error', msg: string, anchor?: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  const a = (anchor ?? '').replace(SAFE_ANCHOR, '').slice(0, 80).toLowerCase();
  redirect(`${BASE}&${p.toString()}${a ? `#st-${a}` : ''}`);
}

/**
 * Defense-in-depth admin gate (the /admin layout already 404s non-admins;
 * server actions re-check). Returns the acting user so writes stamp
 * admin_audit_log.actor_user_id. (Copied shape — real-stories actions.)
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return user;
}

type EligibleChapter = {
  chapterId: string;
  userId: string;
  title: string;
  wasAlreadyFeatured: boolean;
  ownerSlug: string | null;
};

/**
 * Re-assert the chapter featuring gate before writing: published, owner is a
 * live public profile, AND the stored normalized embed derives a YouTube
 * thumbnail (V1 rule — the shelf tile is thumbnail-led, so a chapter without
 * one is REFUSED, never featured blind). Returns the row facts for the write +
 * toast, or a refusal reason string.
 */
async function assertFeaturableChapter(
  admin: ReturnType<typeof createAdminClient>,
  publicId: string,
): Promise<EligibleChapter | { refused: string }> {
  const { data: ch } = await admin
    .from('creator_chapters')
    .select(
      'chapter_id, public_id, user_id, title, status, embed_url, embed_provider, showcase_featured_at',
    )
    .eq('public_id', publicId)
    .maybeSingle();
  if (!ch) return { refused: 'Chapter not found.' };
  if (ch.status !== 'published') {
    return { refused: 'Only a published chapter can be featured — this one is a draft (or was unpublished).' };
  }
  if (!youtubeThumbFromEmbedUrl(ch.embed_url as string | null)) {
    return {
      refused:
        'Not featurable yet: the Storytellers shelf uses YouTube-derived thumbnails in V1, and this chapter’s embed is not a YouTube video. It stays published on the creator’s own page.',
    };
  }
  const { data: owner } = await admin
    .from('users')
    .select('user_id, slug, public_profile_enabled, deleted_at')
    .eq('user_id', ch.user_id as string)
    .maybeSingle();
  if (!owner || owner.deleted_at || owner.public_profile_enabled !== true) {
    return { refused: 'The storyteller’s profile is not public (or was deleted), so this chapter can’t be featured.' };
  }
  return {
    chapterId: ch.chapter_id as string,
    userId: ch.user_id as string,
    title: ((ch.title as string | null) ?? '').trim() || 'A chapter',
    wasAlreadyFeatured: Boolean(ch.showcase_featured_at),
    ownerSlug: (owner.slug as string | null) ?? null,
  };
}

/**
 * Notify the creator their chapter was featured (mirror of the couple's
 * `showcase_featured` — same existing notification type, no schema change).
 * Best-effort: a failed notification never affects the feature write. Fired on
 * FIRST feature only — a re-feature/rank tweak is internal curation.
 */
async function notifyCreatorChapterFeatured(
  userId: string,
  title: string,
): Promise<void> {
  try {
    await emitNotification({
      userId,
      type: 'showcase_featured',
      title: 'Your chapter is featured on Real Stories',
      body: `“${title}” is now featured in the From Our Storytellers shelf on Setnayan’s Real Stories page.`,
      relatedUrl: '/realstories#storytellers',
    });
  } catch (e) {
    console.error('[storytellers] creator featured notify failed:', e);
  }
}

/** Pin or unpin a chapter on the /realstories Storytellers shelf. */
export async function setChapterFeatured(formData: FormData) {
  const user = await requireAdmin();
  const publicId = String(formData.get('public_id') ?? '').trim();
  const feature = String(formData.get('feature') ?? '') === '1';
  if (!PUBLIC_ID_RE.test(publicId)) redirectBack('error', 'Unknown chapter.');

  const admin = createAdminClient();

  if (feature) {
    const gate = await assertFeaturableChapter(admin, publicId);
    if ('refused' in gate) redirectBack('error', gate.refused, publicId);

    const { error } = await admin
      .from('creator_chapters')
      .update({
        showcase_featured_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('public_id', publicId);
    if (error) redirectBack('error', error.message, publicId);

    await admin.from('admin_audit_log').insert({
      action: 'storytellers.feature',
      target_table: 'creator_chapters',
      target_id: gate.chapterId,
      after_json: { public_id: publicId, showcase_featured_at: 'now' },
      actor_user_id: user.id,
    });
    // Tell the storyteller (best-effort · never blocks) — first feature only.
    if (!gate.wasAlreadyFeatured) {
      await notifyCreatorChapterFeatured(gate.userId, gate.title);
    }
    revalidatePath('/realstories');
    revalidatePath('/admin/studio');
    redirectBack('ok', `“${gate.title}” is now featured in From Our Storytellers.`, publicId);
  }

  // Unfeature — clear both the pin and any manual rank. (Also load the row
  // first so the audit row can carry the internal id + an honest toast name.)
  const { data: ch } = await admin
    .from('creator_chapters')
    .select('chapter_id, title')
    .eq('public_id', publicId)
    .maybeSingle();
  if (!ch) redirectBack('error', 'Chapter not found.', publicId);

  const { error } = await admin
    .from('creator_chapters')
    .update({
      showcase_featured_at: null,
      showcase_feature_rank: null,
      updated_at: new Date().toISOString(),
    })
    .eq('public_id', publicId);
  if (error) redirectBack('error', error.message, publicId);

  await admin.from('admin_audit_log').insert({
    action: 'storytellers.unfeature',
    target_table: 'creator_chapters',
    target_id: ch.chapter_id as string,
    after_json: { public_id: publicId, showcase_featured_at: null, showcase_feature_rank: null },
    actor_user_id: user.id,
  });
  revalidatePath('/realstories');
  revalidatePath('/admin/studio');
  redirectBack(
    'ok',
    'Removed from the Storytellers shelf. The chapter stays published on the creator’s own page.',
    publicId,
  );
}

/**
 * Set the manual sort weight for a featured chapter (lower = higher on the
 * shelf; blank clears it → sorts after ranked rows). Only meaningful while
 * the chapter is featured.
 */
export async function setChapterRank(formData: FormData) {
  const user = await requireAdmin();
  const publicId = String(formData.get('public_id') ?? '').trim();
  if (!PUBLIC_ID_RE.test(publicId)) redirectBack('error', 'Unknown chapter.');

  const raw = String(formData.get('rank') ?? '').trim();
  let rank: number | null = null;
  if (raw !== '') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 9999) {
      redirectBack('error', 'Order must be a whole number from 0 to 9999 (lower shows first), or blank.', publicId);
    }
    rank = n;
  }

  const admin = createAdminClient();
  // Guard: only a currently-featured chapter can carry a rank.
  const { data: ch } = await admin
    .from('creator_chapters')
    .select('chapter_id, title, showcase_featured_at')
    .eq('public_id', publicId)
    .maybeSingle();
  if (!ch) redirectBack('error', 'Chapter not found.', publicId);
  if (!ch.showcase_featured_at) {
    redirectBack('error', 'Feature this chapter first, then set its order.', publicId);
  }

  const { error } = await admin
    .from('creator_chapters')
    .update({ showcase_feature_rank: rank, updated_at: new Date().toISOString() })
    .eq('public_id', publicId);
  if (error) redirectBack('error', error.message, publicId);

  await admin.from('admin_audit_log').insert({
    action: 'storytellers.rank',
    target_table: 'creator_chapters',
    target_id: ch.chapter_id as string,
    after_json: { public_id: publicId, showcase_feature_rank: rank },
    actor_user_id: user.id,
  });
  revalidatePath('/realstories');
  revalidatePath('/admin/studio');
  const name = ((ch.title as string | null) ?? '').trim() || 'This chapter';
  redirectBack(
    'ok',
    rank === null ? `${name}: order cleared.` : `${name}: order set to ${rank}.`,
    publicId,
  );
}
