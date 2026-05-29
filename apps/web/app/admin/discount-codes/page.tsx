/**
 * /admin/discount-codes — Day 1.5 spec-aligned voucher list view.
 *
 * WHY · Day 1.5 corrective refactor of PR #594 per CLAUDE.md 2026-05-29
 *       Day 1.5 row. 3-type model is now pct_off / pct_off_capped / free.
 *       The list-row value renderer reflects the new shape:
 *         pct_off          → "10%"
 *         pct_off_capped   → "50% up to ₱500"
 *         free             → "Free"
 *
 * Surface contract:
 *   • Stats banner — active count · disabled count · total redemptions
 *   • Filter strip — All / Active / Disabled / Expired
 *   • Table — code · discount · # services · expires_at · uses · status · actions
 *   • "Create code" CTA in the page header → /admin/discount-codes/new
 *
 * Read-only display per row. All mutations go through server actions:
 *   • Create (server action via /new sub-route)
 *   • Edit (server action via /[id]/edit sub-route)
 *   • Disable / Enable (server action inline · ConfirmForm pattern)
 *
 * Cross-references:
 *   • Day 1.5 migration: 20260529020000_voucher_system_day1_5_spec_alignment.sql
 *   • Day 1 migration (substrate): 20260529010000_voucher_system_day1.sql
 *   • Actions: ./actions.ts
 *   • Form: ./_components/voucher-form.tsx
 *   • Canonical list-page pattern: apps/web/app/admin/users/page.tsx
 *   • Canonical read-only-V1 banner pattern: apps/web/app/admin/disputes/page.tsx
 */

import Link from 'next/link';
import {
  Plus,
  BadgePercent,
  BadgeCheck,
  BadgeX,
  Pencil,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { disableDiscountCode, enableDiscountCode } from './actions';

export const metadata = { title: 'Discount codes · Admin' };

type DiscountCodeRow = {
  discount_code_id: string;
  code: string;
  discount_type: 'pct_off' | 'pct_off_capped' | 'free';
  // Day 1.5 spec: pct_value INT + cap_centavos BIGINT replace generic
  // discount_value column. Both can be NULL (free type) or non-NULL
  // (pct_off + pct_off_capped) per the DB CHECK constraint
  // `discount_codes_value_coherence_v2`.
  pct_value: number | null;
  cap_centavos: number | null;
  covered_service_keys: string[];
  effective_from: string | null;
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
  // Day 1.5 spec · 3 types · each renders differently:
  //   pct_off          → "10%"
  //   pct_off_capped   → "50% up to ₱500"
  //   free             → "Free"
  switch (row.discount_type) {
    case 'pct_off':
      return row.pct_value !== null ? `${row.pct_value}%` : '—';
    case 'pct_off_capped':
      if (row.pct_value === null || row.cap_centavos === null) return '—';
      return `${row.pct_value}% up to ${formatPesos(row.cap_centavos)}`;
    case 'free':
      return 'Free';
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
      // Day 1.5 schema · pct_value + cap_centavos replace discount_value.
      'discount_code_id, code, discount_type, pct_value, cap_centavos, covered_service_keys, effective_from, expires_at, max_uses, uses_count, is_active, created_by_admin_id, created_at, updated_at',
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
      {/* Header — h1 left, primary CTA right, both anchored to the page gutter
          so the rhythm under the header continues the same horizontal alignment.
          Explicit champagne accent on the Create code button so it reads as the
          primary surface CTA regardless of palette inheritance (the v2.1 `.m-btn`
          base sets no color · we set it here so the button is unmistakably the
          canonical action style for this page). */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
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
          style={{
            color: 'var(--m-orange-2)',
            borderColor: 'var(--m-orange-3)',
            padding: '8px 16px',
          }}
        >
          <Plus className="h-4 w-4" />
          Create code
        </Link>
      </header>

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
                    <Td>
                      {row.effective_from ? (
                        <span className="block text-xs" style={{ color: 'var(--m-slate)' }}>
                          {formatDate(row.effective_from)} → {formatDate(row.expires_at)}
                        </span>
                      ) : (
                        <span>{formatDate(row.expires_at)}</span>
                      )}
                    </Td>
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
                      {/* Action buttons share the same icon+text+pill treatment as the
                          header `+ Create code` button. Champagne accent (border + text)
                          for affordances that progress the workflow (Edit, Enable) ·
                          slate outline for the destructive-but-reversible Disable. Same
                          height + same border-radius + same hover lift across the row
                          so the actions read as one button family. */}
                      <div className="flex flex-wrap items-center gap-2">
                        {row.is_active && (
                          <Link
                            href={`/admin/discount-codes/${row.discount_code_id}/edit`}
                            className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--m-orange-4)]"
                            style={{
                              color: 'var(--m-orange-2)',
                              borderColor: 'var(--m-orange-3)',
                            }}
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
                              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--m-paper-2)]"
                              style={{
                                color: 'var(--m-slate)',
                                borderColor: 'var(--m-line)',
                              }}
                            >
                              <Ban className="h-3.5 w-3.5" />
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
                              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--m-orange-4)]"
                              style={{
                                color: 'var(--m-orange-2)',
                                borderColor: 'var(--m-orange-3)',
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
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
        Codes apply at checkout when couples paste them into the &ldquo;Have a
        code?&rdquo; field. Receipts show the net paid amount — no separate
        discount line. Disabling a code lets existing redemptions keep their
        special price.
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
  // Filter chips share the same border-based pill language as the table
  // action buttons (Edit · Disable · Enable) so the whole page reads as one
  // button family. Active chip fills champagne, inactive chip stays
  // transparent with a slate outline and a paper-2 hover background — same
  // height, same border-radius, same horizontal padding as the action row.
  // NOTE on hover: inline `style=` wins over Tailwind `hover:bg-*` class
  // specificity, so the active state must NOT carry the hover class
  // (otherwise the orange-2 fill would persist on hover) and the inactive
  // state intentionally omits the inline background so the hover class
  // can drive the paper-2 hover wash.
  const baseClasses =
    'inline-flex items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors';
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active ? baseClasses : `${baseClasses} hover:bg-[var(--m-paper-2)]`
      }
      style={
        active
          ? {
              background: 'var(--m-orange-2)',
              color: 'var(--m-paper)',
              borderColor: 'var(--m-orange-2)',
            }
          : {
              color: 'var(--m-slate)',
              borderColor: 'var(--m-line)',
            }
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
