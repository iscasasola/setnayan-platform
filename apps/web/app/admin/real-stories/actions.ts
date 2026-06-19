'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Setnayan HQ · Real Stories actions — curate which published, consent-gated
 * wedding editorials get FEATURED (pinned) + in what ORDER on the public
 * /realstories index, and which fills the hero slot.
 *
 * PR D of the Real Stories featuring program. Writes two nullable columns on
 * `events` (showcase_featured_at / showcase_feature_rank — migration
 * 20261221000000). Featuring is curation ON TOP of the RA 10173 consent gate
 * (loadShowcaseCandidatesForAdmin only ever surfaces consented, past-grace,
 * public-slug weddings), never a bypass of it — so we re-assert that gate
 * here before writing, and never feature an event that doesn't qualify.
 *
 * Patterns mirror /admin/event-types/actions.ts: requireAdmin defense-in-depth,
 * admin-client (service-role) writes, an admin_audit_log row per mutation,
 * redirectBack with ?ok=/?error= + #row anchors, and revalidatePath('/realstories')
 * so the public page updates with no redeploy.
 */

const BASE = '/admin/real-stories';
const SAFE_ANCHOR = /[^a-z0-9-]/g;
// event_id is a UUID — validate before it ever reaches a query.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function redirectBack(kind: 'ok' | 'error', msg: string, anchor?: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  const a = (anchor ?? '').toLowerCase().replace(SAFE_ANCHOR, '').slice(0, 80);
  redirect(`${BASE}?${p.toString()}${a ? `#rs-${a}` : ''}`);
}

/**
 * Defense-in-depth admin gate (the /admin layout already 404s non-admins;
 * server actions re-check). Returns the acting user so writes stamp
 * admin_audit_log.actor_user_id.
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

/**
 * Re-assert the RA 10173 showcase-eligibility gate for a single event before
 * featuring it — consented couple member, past T+30d, wedding, public slug.
 * Returns the display name (for the toast) or null if it doesn't qualify.
 * Honesty lock: the curated sample is an in-code constant with no events row,
 * so it can never reach this path.
 */
async function assertEligibleShowcase(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<string | null> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const { data: ev } = await admin
    .from('events')
    .select('event_id, display_name, event_type, slug, event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) return null;
  if (ev.event_type !== 'wedding') return null;
  if (!ev.slug) return null;
  if (!ev.event_date || (ev.event_date as string) > cutoff) return null;

  // A couple member of this event must have opted in to public showcase inclusion.
  const { data: members } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple');
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  if (memberIds.length === 0) return null;

  const { data: consenters } = await admin
    .from('users')
    .select('user_id')
    .in('user_id', memberIds)
    .not('public_summary_consent_at', 'is', null)
    .is('deleted_at', null)
    .limit(1);
  if (!consenters || consenters.length === 0) return null;

  return (ev.display_name as string | null)?.trim() || 'A Setnayan wedding';
}

/**
 * Notify the couple (every couple-type event member) that their wedding was
 * featured on Real Stories (Notification Foundation · Phase B). Deep-links to
 * the public showcase index. Best-effort: a failed notification never affects
 * the feature write that already landed. Fired on feature only — a pure admin
 * re-order (setShowcaseRank) is internal curation and would be misleading to
 * re-announce as "featured" each time, so it stays silent.
 */
async function notifyCoupleShowcaseFeatured(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  displayName: string,
): Promise<void> {
  try {
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');
    const memberIds = (members ?? [])
      .map((m) => m.user_id as string)
      .filter((id): id is string => Boolean(id));
    if (memberIds.length === 0) return;

    await Promise.all(
      memberIds.map((userId) =>
        emitNotification({
          userId,
          type: 'showcase_featured',
          title: 'Your wedding is featured on Real Stories',
          body: `${displayName} is now featured in the Setnayan Real Stories showcase. Couples planning their own day will see your story.`,
          relatedUrl: '/realstories',
        }),
      ),
    );
  } catch (e) {
    console.error('[real-stories] couple showcase-featured notify failed:', e);
  }
}

/** Pin or unpin a wedding on /realstories. */
export async function setShowcaseFeatured(formData: FormData) {
  const user = await requireAdmin();
  const eventId = String(formData.get('event_id') ?? '').trim();
  const feature = String(formData.get('feature') ?? '') === '1';
  if (!UUID_RE.test(eventId)) redirectBack('error', 'Unknown wedding.');

  const admin = createAdminClient();

  if (feature) {
    const name = await assertEligibleShowcase(admin, eventId);
    if (!name) {
      redirectBack(
        'error',
        'That wedding no longer qualifies for Real Stories (consent withdrawn, slug removed, or inside the 30-day grace window). It can’t be featured.',
        eventId,
      );
    }
    const { error } = await admin
      .from('events')
      .update({ showcase_featured_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('event_id', eventId);
    if (error) redirectBack('error', error.message, eventId);

    await admin.from('admin_audit_log').insert({
      action: 'real_stories.feature',
      target_table: 'events',
      target_id: eventId,
      after_json: { showcase_featured_at: 'now' },
      actor_user_id: user.id,
    });
    // Tell the couple they've been featured (best-effort · never blocks).
    await notifyCoupleShowcaseFeatured(admin, eventId, name as string);
    revalidatePath('/realstories');
    revalidatePath(BASE);
    redirectBack('ok', `${name} is now featured on Real Stories.`, eventId);
  }

  // Unfeature — clear both the pin and any manual rank.
  const { error } = await admin
    .from('events')
    .update({ showcase_featured_at: null, showcase_feature_rank: null, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);
  if (error) redirectBack('error', error.message, eventId);

  await admin.from('admin_audit_log').insert({
    action: 'real_stories.unfeature',
    target_table: 'events',
    target_id: eventId,
    after_json: { showcase_featured_at: null, showcase_feature_rank: null },
    actor_user_id: user.id,
  });
  revalidatePath('/realstories');
  revalidatePath(BASE);
  redirectBack('ok', 'Removed from the Real Stories feature list. The wedding stays published at its own page.', eventId);
}

/**
 * Set the manual sort weight for a featured wedding (lower = higher on the
 * page; blank clears it → sorts after ranked rows). Only meaningful while the
 * wedding is featured.
 */
export async function setShowcaseRank(formData: FormData) {
  const user = await requireAdmin();
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!UUID_RE.test(eventId)) redirectBack('error', 'Unknown wedding.');

  const raw = String(formData.get('rank') ?? '').trim();
  let rank: number | null = null;
  if (raw !== '') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 9999) {
      redirectBack('error', 'Order must be a whole number from 0 to 9999 (lower shows first), or blank.', eventId);
    }
    rank = n;
  }

  const admin = createAdminClient();
  // Guard: only a currently-featured wedding can carry a rank.
  const { data: ev } = await admin
    .from('events')
    .select('display_name, showcase_featured_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) redirectBack('error', 'Wedding not found.', eventId);
  if (!ev.showcase_featured_at) {
    redirectBack('error', 'Feature this wedding first, then set its order.', eventId);
  }

  const { error } = await admin
    .from('events')
    .update({ showcase_feature_rank: rank, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);
  if (error) redirectBack('error', error.message, eventId);

  await admin.from('admin_audit_log').insert({
    action: 'real_stories.rank',
    target_table: 'events',
    target_id: eventId,
    after_json: { showcase_feature_rank: rank },
    actor_user_id: user.id,
  });
  revalidatePath('/realstories');
  revalidatePath(BASE);
  const name = (ev.display_name as string | null)?.trim() || 'This wedding';
  redirectBack(
    'ok',
    rank === null ? `${name}: order cleared.` : `${name}: order set to ${rank}.`,
    eventId,
  );
}
