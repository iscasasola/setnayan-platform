import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { TIER_LABEL, type VendorTier } from '@/lib/vendor-tier-caps';
import { setHelpMessageStatus } from './actions';
import { HelpMessenger, type HelpThread } from './_components/help-messenger';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Messages · Admin' };

type HelpMessageRow = {
  message_id: string;
  public_id: string;
  user_id: string | null;
  sender_email: string;
  sender_name: string | null;
  topic: string | null;
  subject: string;
  body: string;
  status: 'new' | 'in_progress' | 'closed';
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  submitter_vendor_tier: VendorTier | null;
  priority_rank: number | null;
};

type Props = { searchParams: Promise<{ status?: string; m?: string }> };

export default async function AdminHelpPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const filter = (search.status ?? 'open') as 'open' | 'all' | 'new' | 'in_progress' | 'closed';

  const admin = createAdminClient();
  let query = admin
    .from('help_messages')
    .select(
      'message_id,public_id,user_id,sender_email,sender_name,topic,subject,body,status,admin_notes,resolved_at,created_at,updated_at,submitter_vendor_tier,priority_rank',
    )
    // Priority support: paid vendors (enterprise>pro>solo>verified/free) float
    // above non-vendor requests; within a priority band, freshest first.
    .order('priority_rank', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (filter === 'open') query = query.in('status', ['new', 'in_progress']);
  else if (filter === 'new' || filter === 'in_progress' || filter === 'closed')
    query = query.eq('status', filter);
  const { data, error } = await query;
  if (error) {
    logQueryError('AdminHelpPage (help_messages)', error);
  }
  const items = (data ?? []) as Array<HelpMessageRow & { updated_at: string | null }>;

  // ➕ The shop's own name beside a supplier's message (admin supplier slice, 2026-10-28) — one read, by owner.
  const owners = [...new Set(items.filter((m) => m.submitter_vendor_tier && m.user_id).map((m) => m.user_id as string))];
  const shopByOwner = new Map<string, string>();
  if (owners.length > 0) {
    const { data: shops, error: shopErr } = await admin.from('vendor_profiles').select('user_id, business_name').in('user_id', owners);
    if (shopErr) logQueryError('AdminHelpPage (shop names)', shopErr);
    for (const sh of (shops ?? []) as Array<{ user_id: string; business_name: string | null }>) {
      if (sh.business_name?.trim() && !shopByOwner.has(sh.user_id)) shopByOwner.set(sh.user_id, sh.business_name.trim());
    }
  }
  const threads: HelpThread[] = items.map((m) => ({
    message_id: m.message_id,
    public_id: m.public_id,
    user_id: m.user_id,
    sender_name: m.sender_name,
    sender_email: m.sender_email,
    shop_name: m.user_id ? (shopByOwner.get(m.user_id) ?? null) : null,
    topic: m.topic,
    subject: m.subject,
    body: m.body,
    status: m.status,
    admin_notes: m.admin_notes,
    created_at: m.created_at,
    updated_at: m.updated_at,
    tier_label: m.submitter_vendor_tier ? TIER_LABEL[m.submitter_vendor_tier] : null,
  }));
  // A wide screen opens the first conversation; a phone starts on the list (?m= opens one).
  const openId = search.m ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* The page starts at its content. Replies to a signed-in person reach them IN THE APP
          (help_ticket_replied); this slice adds no email. */}
      <PageMasthead title="Messages" />
      <HelpMessenger threads={threads} filter={filter} openId={openId} failed={Boolean(error)} nowMs={Date.now()} action={setHelpMessageStatus} />
    </div>
  );
}
