import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType =
  | 'chat_message'
  | 'order_quoted'
  | 'order_paid'
  | 'payment_matched'
  | 'payment_rejected'
  | 'rsvp_received'
  | 'review_request';

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  chat_message: 'New message',
  order_quoted: 'Order quoted',
  order_paid: 'Order paid',
  payment_matched: 'Payment matched',
  payment_rejected: 'Payment rejected',
  rsvp_received: 'RSVP received',
  review_request: 'Review request',
};

export const NOTIFICATION_TYPE_TONE: Record<NotificationType, string> = {
  chat_message: 'bg-sky-100 text-sky-800',
  order_quoted: 'bg-amber-100 text-amber-900',
  order_paid: 'bg-emerald-200 text-emerald-900',
  payment_matched: 'bg-emerald-100 text-emerald-800',
  payment_rejected: 'bg-rose-100 text-rose-800',
  rsvp_received: 'bg-terracotta/15 text-terracotta-700',
  review_request: 'bg-amber-100 text-amber-900',
};

export type NotificationRow = {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_url: string | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchOwnNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id,user_id,type,title,body,related_url,read_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`fetchOwnNotifications failed: ${error.message}`);
  return (data ?? []) as NotificationRow[];
}

export async function countUnread(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return count ?? 0;
}

export function relativeTime(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}
