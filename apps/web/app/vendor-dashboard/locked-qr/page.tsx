import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Lock, Plus, Check, Clock, Ban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { buildVendorLockUrl } from '@/lib/vendor-locked-qr';
import { VENDOR_CATEGORY_LABEL, formatPhp, type VendorCategory } from '@/lib/vendors';
import { CopyButton } from '@/app/_components/copy-button';

export const metadata = { title: 'Locked QRs · Vendor · Setnayan' };

/**
 * Vendor-side ledger of the Locked QRs this store has issued — pending (still
 * claimable), claimed (locked a booking), and void. Reads the vendor's own
 * rows via RLS (the vendor-org policy on vendor_locked_qr_tokens).
 *
 * Standalone page FOR NOW; the tokens will later be surfaced inside the vendor
 * dashboard proper (owner 2026-07-01) — this compiles them in one place so that
 * integration has a source to pull from.
 */
export const dynamic = 'force-dynamic';

type TokenRow = {
  token: string;
  public_id: string;
  event_type: string | null;
  category: string;
  total_php: number | string | null;
  initial_paid_php: number | string | null;
  status: 'pending' | 'claimed' | 'void';
  proof_r2_key: string | null;
  created_at: string;
  claimed_at: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Manila',
});

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

function StatusBadge({ status }: { status: TokenRow['status'] }) {
  const map = {
    pending: { label: 'Pending', bg: 'rgba(197,160,89,0.15)', fg: 'var(--m-orange-2)', Icon: Clock },
    claimed: { label: 'Claimed', bg: 'rgba(79,107,74,0.12)', fg: 'var(--m-sage-deep)', Icon: Check },
    void: { label: 'Void', bg: 'rgba(0,0,0,0.06)', fg: 'var(--m-slate-2)', Icon: Ban },
  }[status];
  const Icon = map.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: map.bg, color: map.fg }}
    >
      <Icon className="h-3 w-3" strokeWidth={2} /> {map.label}
    </span>
  );
}

export default async function VendorLockedQrListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;

  const { data } = await supabase
    .from('vendor_locked_qr_tokens')
    .select(
      'token, public_id, event_type, category, total_php, initial_paid_php, status, proof_r2_key, created_at, claimed_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false });
  const tokens = (data ?? []) as TokenRow[];

  const pending = tokens.filter((t) => t.status === 'pending').length;
  const claimed = tokens.filter((t) => t.status === 'claimed').length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard/shop"
        className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.18em] text-ink/50 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> My Shop
      </Link>

      <header className="mt-4 flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Lock className="h-6 w-6 text-terracotta" strokeWidth={1.75} /> Locked QRs
          </h1>
          <p className="text-sm text-ink/60">
            {tokens.length === 0
              ? 'The single-use QRs you issue to lock in a customer show up here.'
              : `${pending} pending · ${claimed} claimed · ${tokens.length} total.`}
          </p>
        </div>
        <Link
          href="/vendor-dashboard/invite?mode=locked"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-sm font-medium text-cream hover:bg-ink/90"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} /> New
        </Link>
      </header>

      {tokens.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-ink/40" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-ink/70">
            No Locked QRs yet. Create one to lock in a customer who already paid a
            downpayment.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {tokens.map((t) => {
            const total = t.total_php != null ? Number(t.total_php) : null;
            const paid = Number(t.initial_paid_php ?? 0);
            const lockUrl = buildVendorLockUrl(t.token);
            return (
              <li
                key={t.public_id}
                className="rounded-2xl border border-ink/10 bg-white/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {VENDOR_CATEGORY_LABEL[t.category as VendorCategory] ?? t.category}
                      <StatusBadge status={t.status} />
                    </p>
                    <p className="mt-0.5 text-xs text-ink/55">
                      {total != null ? formatPhp(total) : 'No total'} ·{' '}
                      {formatPhp(paid)} paid · issued {fmtDate(t.created_at)}
                      {t.status === 'claimed' ? ` · claimed ${fmtDate(t.claimed_at)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-ink/35">
                    {t.public_id}
                  </span>
                </div>

                {t.status === 'pending' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/vendor-dashboard/invite?mode=locked&issued=${t.token}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/75 hover:border-terracotta"
                    >
                      Show QR
                    </Link>
                    <CopyButton value={lockUrl} label="Copy link" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
