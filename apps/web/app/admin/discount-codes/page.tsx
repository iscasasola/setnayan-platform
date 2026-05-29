/**
 * /admin/discount-codes — Day 1 voucher system list view.
 *
 * WHY · Day 1 of 4-day pre-pilot voucher + inline-checkout sprint per
 *       CLAUDE.md 2026-05-29 Day 1 row. Admin manages voucher codes here ·
 *       create new + edit existing (active codes only) + disable / re-enable.
 *
 * Surface contract:
 *   • Stats banner — active count · disabled count · total redemptions
 *   • Filter strip — All / Active / Disabled / Expired
 *   • Table — code · type · value · # services · expires_at · uses · status · actions
 *   • "Create code" CTA in the page header → /admin/discount-codes/new
 *
 * Read-only display per row. All mutations go through server actions:
 *   • Create (server action via /new sub-route)
 *   • Edit (server action via /[id]/edit sub-route)
 *   • Disable / Enable (server action inline · ConfirmForm pattern)
 *
 * Cross-references:
 *   • Migration: 20260529010000_voucher_system_day1.sql
 *   • Actions: ./actions.ts
 *   • Form: ./_components/voucher-form.tsx
 *   • Canonical list-page pattern: apps/web/app/admin/users/page.tsx
 *   • Canonical read-only-V1 banner pattern: apps/web/app/admin/disputes/page.tsx
 */

import Link from 'next/link';
import { Plus, BadgePercent, BadgeCheck, BadgeX, Pencil } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { disableDiscountCode, enableDiscountCode } from './actions';

export const metadata = { title: 'Discount codes · Admin' };

type DiscountCodeRow = {
  discount_code_id: string;
  code: string;
  discount_type: 'amount_off' | 'pct_off' | 'free';
  discount_value: number | null;
  covered_service_keys: string[];
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
};

type AdminLookupRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
};

type Filter = 'all' | 'active' | 'disabled' | 'expired';

type Props = {
  searchParams: Promise<{
    filter?: string;
    created?: string;
    updated?: string;
    disabled?: string;
    enabled?: string;
  }>;
};

function formatPesos(centavos: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  });
}

function describeValue(row: DiscountCodeRow): string {
  switch (row.discount_type) {
    case 'amount_off':
      return row.discount_value !== null
        ? `${formatPesos(row.discount_value)} off`
        : '—';
    case 'pct_off':
      return row.discount_value !== null ? `${row.discount_value}% off` : '—';
    case 'free':
      return '100% off';
  }
}

function describeUses(row: DiscountCodeRow): string {
  if (row.max_uses === null) return `${row.uses_count} of ∞`;
  return `${row.uses_count} of ${row.max_uses}`;
}

export default async function AdminDiscountCodesPage({ searchParams }: Props) {
  const search = await searchParams;
  const filter = (search.filter ?? 'all') as Filter;
  const createdBanner = search.created ?? null;
  const updatedBanner = search.updated ?? null;
  const disabledBanner = search.disabled ?? null;
  const enabledBanner = search.enabled ?? null;

  const admin = createAdminClient();

  // Fetch all codes — small table, no need to paginate at pilot scale.
  // Filter client-side on `filter` so the chip strip can drive UX without
  // shipping multiple SQL queries.
  const { data: rowsRaw, error: rowsErr } = await admin
    .from('discount_codes')
    .select(
      'discount_code_id, code, discount_type, discount_value, covered_service_keys, expires_at, max_uses, uses_count, is_active, created_by_admin_id, created_at, updated_at',
    )
    .order('created_at', { ascending: false });
  if (rowsErr) {
    throw new Error(`Could not load discount codes: ${rowsErr.message}`);
  }
  const rows = (rowsRaw ?? []) as DiscountCodeRow[];

  // Fetch admin display info for the "Created by" column. We resolve unique
  // user_ids in one IN-query to avoid an N+1.
  const creatorIds = Array.from(new Set(rows.map((r) => r.created_by_admin_id)));
  let creatorMap = new Map<string, { email: string; name: string }>();
  if (creatorIds.length > 0) {
    const { data: admins } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .in('user_id', creatorIds);
    creatorMap = new Map(
      (admins ?? []).map((a: AdminLookupRow) => [
        a.user_id,
        { email: a.email ?? '—', name: a.display_name ?? a.email ?? '—' },
      ]),
    );
  }

  const now = Date.now();
  const isExpired = (r: DiscountCodeRow) =>
    new Date(r.expires_at).getTime() < now;

  const activeRows = rows.filter((r) => r.is_active && !isExpired(r));
  const disabledRows = rows.filter((r) => !r.is_active);
  const expiredRows = rows.filter((r) => r.is_active && isExpired(r));

  const visibleRows =
    filter === 'active'
      ? activeRows
      : filter === 'disabled'
        ? disabledRows
        : filter === 'expired'
          ? expiredRows
          : rows;

  // Total redemptions = sum across all codes (active + disabled). Useful
  // pilot-day signal of "are couples actually using vouchers?"
  const totalRedemptions = rows.reduce((sum, r) => sum + r.uses_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="m-display-tight text-3xl"
            style={{ color: 'var(--m-ink)' }}
          >
            Discount codes
          </h1>
          <p
            className="mt-1 max-w-2xl text-sm"
            style={{ color: 'var(--m-slate)' }}
          >
            Vouchers couples paste at checkout to unlock a special price. Set
            an expires-at on every code · pick which services it covers ·
            optionally cap how many times it can be used.
          </p>
        </div>
        <Link
          href="/admin/discount-codes/new"
          className="m-btn inline-flex items-center gap-2 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Create code
        </Link>
      </div>

      {/* Success banners — cleared on next nav */}
      {createdBanner && (
        <Banner tone="emerald">
          Code <Mono>{createdBanner}</Mono> is live. Share it where it counts.
        </Banner>
      )}
      {updatedBanner && (
        <Banner tone="emerald">
          Saved code <Mono>{updatedBanner}</Mono>.
        </Banner>
      )}
      {disabledBanner && (
        <Banner tone="amber">
          Code <Mono>{disabledBanner}</Mono> is disabled. Existing orders that
          already redeemed it keep their special price.
        </Banner>
      )}
      {enabledBanner && (
        <Banner tone="emerald">
          Code <Mono>{enabledBanner}</Mono> is live again.
        </Banner>
      )}

      {/* Stats — at-a-glance pilot signals */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active codes"
          value={activeRows.length}
          icon={<BadgeCheck className="h-4 w-4" />}
        />
        <Stat
          label="Disabled codes"
          value={disabledRows.length}
          icon={<BadgeX className="h-4 w-4" />}
        />
        <Stat
          label="Expired (still on)"
          value={expiredRows.length}
          icon={<BadgePercent className="h-4 w-4" />}
        />
        <Stat
          label="Total redemptions"
          value={totalRedemptions}
          icon={<BadgePercent className="h-4 w-4" />}
        />
      </div>

      {/* Filter chips */}
      <nav
        className="flex flex-wrap items-center gap-2 text-sm"
        aria-label="Filter discount codes"
      >
        <FilterChip href="/admin/discount-codes" active={filter === 'all'}>
          All ({rows.length})
        </FilterChip>
        <FilterChip
          href="/admin/discount-codes?filter=active"
          active={filter === 'active'}
        >
          Active ({activeRows.length})
        </FilterChip>
        <FilterChip
          href="/admin/discount-codes?filter=disabled"
          active={filter === 'disabled'}
        >
          Disabled ({disabledRows.length})
        </FilterChip>
        <FilterChip
          href="/admin/discount-codes?filter=expired"
          active={filter === 'expired'}
        >
          Expired ({expiredRows.length})
        </FilterChip>
      </nav>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-lg border"
        style={{
          background: 'var(--m-paper)',
          borderColor: 'var(--m-line)',
        }}
      >
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr
              className="border-b"
              style={{
                background: 'var(--m-paper-2)',
                borderColor: 'var(--m-line)',
                color: 'var(--m-slate)',
              }}
            >
              <Th>Code</Th>
              <Th>Discount</Th>
              <Th>Covers</Th>
              <Th>Effective until</Th>
              <Th>Uses</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center"
                  style={{ color: 'var(--m-slate)' }}
                >
                  {filter === 'all'
                    ? 'No codes yet. Create your first one to kick off pilot promos.'
                    : `No codes in this view right now.`}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const expired = isExpired(row);
                const creator = creatorMap.get(row.created_by_admin_id);
                const statusLabel = !row.is_active
                  ? 'Disabled'
                  : expired
                    ? 'Expired'
                    : 'Active';
                const statusTone: 'emerald' | 'amber' | 'slate' = !row.is_active
                  ? 'slate'
                  : expired
                    ? 'amber'
                    : 'emerald';
                return (
                  <tr
                    key={row.discount_code_id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: 'var(--m-line)' }}
                  >
                    <Td>
                      <Mono>{row.code}</Mono>
                    </Td>
                    <Td>{describeValue(row)}</Td>
                    <Td>
                      <span
                        title={row.covered_service_keys.join(', ')}
                        style={{ color: 'var(--m-slate)' }}
                      >
                        {row.covered_service_keys.length} service
                        {row.covered_service_keys.length === 1 ? '' : 's'}
                      </span>
                    </Td>
                    <Td>{formatDate(row.expires_at)}</Td>
                    <Td>{describeUses(row)}</Td>
                    <Td>
                      <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                    </Td>
                    <Td>
                      <span style={{ color: 'var(--m-slate)' }}>
                        {creator?.name ?? '—'}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        {row.is_active && (
                          <Link
                            href={`/admin/discount-codes/${row.discount_code_id}/edit`}
                            className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                            style={{ color: 'var(--m-orange-2)' }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        )}
                        {row.is_active ? (
                          <ConfirmForm
                            action={disableDiscountCode}
                            message={`Disable code ${row.code}? Existing orders that already redeemed it keep their special price.`}
                          >
                            <input
                              type="hidden"
                              name="discount_code_id"
                              value={row.discount_code_id}
                            />
                            <button
                              type="submit"
                              className="text-xs underline-offset-2 hover:underline"
                              style={{ color: 'var(--m-slate)' }}
                            >
                              Disable
                            </button>
                          </ConfirmForm>
                        ) : (
                          <ConfirmForm
                            action={enableDiscountCode}
                            message={`Re-enable code ${row.code}?`}
                          >
                            <input
                              type="hidden"
                              name="discount_code_id"
                              value={row.discount_code_id}
                            />
                            <button
                              type="submit"
                              className="text-xs underline-offset-2 hover:underline"
                              style={{ color: 'var(--m-orange-2)' }}
                            >
                              Enable
                            </button>
                          </ConfirmForm>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
        Day 1 ships admin CRUD. Day 2 wires the couple-side &ldquo;Have a code?&rdquo;
        field at checkout. Day 3 makes the BIR receipt show the net paid
        price (no separate discount line).
      </p>
    </div>
  );
}

// ----- Sub-components (kept inline · single-use, surface stays tight) -----

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3" style={{ color: 'var(--m-ink)' }}>{children}</td>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono text-sm tracking-wider"
      style={{ color: 'var(--m-ink)' }}
    >
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="m-card flex items-start gap-3 px-4 py-3"
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{
          background: 'var(--m-blush)',
          color: 'var(--m-orange-2)',
        }}
      >
        {icon}
      </div>
      <div>
        <div
          className="text-2xl font-semibold leading-tight"
          style={{ color: 'var(--m-ink)' }}
        >
          {value}
        </div>
        <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--m-slate)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="rounded-full px-3 py-1 transition-colors"
      style={
        active
          ? { background: 'var(--m-orange-2)', color: 'var(--m-paper)' }
          : { background: 'var(--m-paper-2)', color: 'var(--m-slate)' }
      }
    >
      {children}
    </Link>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'emerald' | 'amber' | 'slate';
  children: React.ReactNode;
}) {
  const styles =
    tone === 'emerald'
      ? { background: '#ECFDF5', color: '#047857', border: '1px solid #6EE7B7' }
      : tone === 'amber'
        ? { background: '#FFFBEB', color: '#B45309', border: '1px solid #FCD34D' }
        : { background: 'var(--m-paper-2)', color: 'var(--m-slate)', border: '1px solid var(--m-line)' };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={styles}
    >
      {children}
    </span>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: 'emerald' | 'amber';
  children: React.ReactNode;
}) {
  const styles =
    tone === 'emerald'
      ? { background: '#ECFDF5', color: '#047857', border: '1px solid #6EE7B7' }
      : { background: '#FFFBEB', color: '#B45309', border: '1px solid #FCD34D' };
  return (
    <div
      className="rounded-md px-4 py-3 text-sm"
      style={styles}
    >
      {children}
    </div>
  );
}
