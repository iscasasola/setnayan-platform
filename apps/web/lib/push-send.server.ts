import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isWebPushConfigured, sendWebPush } from '@/lib/web-push';
import { noticeSentence, pushMessage, type PushSubject } from '@/lib/push-message';

/**
 * THE PHONE-NOTIFICATION FUNNEL — the one place a push is sent from.
 *
 * Reads the facts the template needs (whose notice this is — the event's name,
 * the shop's name, or the account — and the unread count for the badge), makes
 * the `PushMessage` with `pushMessage()` (lib/push-message.ts), and hands it to
 * each channel: Web Push today (`sendWebPush`), APNs beside it next.
 *
 * 🔒 lib/every-push-goes-through-the-template.test.ts — no file but this one
 * calls a channel sender, and no file builds a push title or body inline.
 *
 * Fails soft like every push: a refused read leaves out the name or the badge,
 * never the notice; nothing here throws into the action that caused it.
 */

type Admin = ReturnType<typeof createAdminClient>;

export function isAnyPushConfigured(): boolean {
  return isWebPushConfigured();
}

/**
 * The shop a supplier-side notice is about: the one its own conversation belongs to, read through the thread.
 * ⚠ NEVER "the shop of this login" — an account can own several, and this runs with no session to say which is
 * open (`the-active-shop-is-resolved-once.test.ts`). A notice with no conversation in its link says "Setnayan"
 * rather than guess a shop's name.
 */
async function shopNameOfLink(admin: Admin, url: string): Promise<string | null> {
  const threadId = /^\/vendor-dashboard\/messages\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(url)?.[1];
  if (!threadId) return null;
  const { data: thread, error } = await admin
    .from('chat_threads')
    .select('vendor_profile_id')
    .eq('thread_id', threadId)
    .maybeSingle();
  if (error) logQueryError('push.subject.thread', error, {}, 'graceful_degrade');
  const vendorProfileId = (thread as { vendor_profile_id?: string | null } | null)?.vendor_profile_id;
  if (!vendorProfileId) return null;
  const { data: shop, error: shopError } = await admin
    .from('vendor_profiles')
    .select('business_name')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (shopError) logQueryError('push.subject.shop', shopError, {}, 'graceful_degrade');
  return (shop as { business_name?: string | null } | null)?.business_name ?? null;
}

/** Whose notice is this? A supplier-side link → the shop; an event → the event; else the account. */
async function subjectFor(admin: Admin, url: string | null, eventId: string | null): Promise<PushSubject> {
  if (url?.startsWith('/vendor-dashboard')) return { kind: 'shop', name: await shopNameOfLink(admin, url) };
  if (eventId) {
    const { data, error } = await admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle();
    if (error) logQueryError('push.subject.event', error, { eventId }, 'graceful_degrade');
    return { kind: 'event', name: (data as { display_name?: string | null } | null)?.display_name ?? null };
  }
  return { kind: 'account' };
}

/** Unread bell rows — the app badge. null (badge left alone) when the count is refused. */
async function unreadCount(admin: Admin, userId: string): Promise<number | null> {
  const { count, error } = await admin
    .from('notifications')
    .select('notification_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) {
    logQueryError('push.badge', error, {}, 'graceful_degrade');
    return null;
  }
  return count ?? null;
}

/** Send one templated notice to every channel this user has. */
export async function sendPush(
  userId: string,
  notice: { sentence: string; url: string | null; collapseKey: string; eventId: string | null; fallbackUrl?: string },
): Promise<void> {
  if (!isAnyPushConfigured()) return;
  try {
    const admin = createAdminClient();
    const [subject, badge] = await Promise.all([
      subjectFor(admin, notice.url, notice.eventId),
      unreadCount(admin, userId),
    ]);
    const message = pushMessage({
      subject,
      sentence: notice.sentence,
      url: notice.url,
      collapseKey: notice.collapseKey,
      badge,
      fallbackUrl: notice.fallbackUrl,
    });
    await sendWebPush(userId, message);
  } catch (e) {
    console.error('[push] sendPush threw:', e);
  }
}

/** A bell row's phone twin: the template's sentence + collapse key for its type. */
export async function sendPushForNotice(n: {
  userId: string;
  type: string;
  title: string;
  body: string | null;
  relatedUrl: string | null;
  eventId: string | null;
}): Promise<void> {
  const { sentence, collapseKey } = noticeSentence(n);
  await sendPush(n.userId, {
    sentence,
    url: n.relatedUrl,
    collapseKey,
    eventId: n.eventId,
    fallbackUrl: n.relatedUrl?.startsWith('/vendor-dashboard') ? '/vendor-dashboard' : n.eventId ? `/dashboard/${n.eventId}` : '/dashboard',
  });
}
