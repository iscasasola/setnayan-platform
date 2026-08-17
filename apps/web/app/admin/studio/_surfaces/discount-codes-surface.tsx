/**
 * DiscountCodesSurface — the voucher list body, inside the tabbed /admin/studio
 * studio (Studio Studio slice 3 · Marketing lane).
 *
 * Only the LIST/index view lives here. The voucher CRUD sub-routes stay
 * STANDALONE and are linked OUT (same principle as Accounts Studio keeping the
 * vendor/venue detail routes):
 *   • Create → /admin/discount-codes/new
 *   • Edit   → /admin/discount-codes/[id]/edit
 * Both remain reachable; the sidebar item's matchPrefix keeps Discount codes lit
 * while an admin is on those detail routes.
 *
 * 3-type model (Day 1.5, per CLAUDE.md 2026-05-29):
 *   pct_off          → "10%"
 *   pct_off_capped   → "50% up to ₱500"
 *   free             → "Free"
 *
 * Surface contract:
 *   • Stats banner — active count · disabled count · expired-still-on · redemptions
 *   • Filter strip — All / Active / Disabled / Expired (?tab=discount-codes&filter=…)
 *   • Table — code · discount · # services · expires_at · uses · status · actions
 *   • "Create code" CTA in the masthead → /admin/discount-codes/new (standalone)
 *
 * ── WHAT CHANGED 2026-08-17 ─────────────────────────────────────────────────
 * ⚖ THIS FILE WAS NOT ONE OF THE LIARS, and the distinction is worth keeping:
 * the read ended `if (rowsErr) throw new Error(...)`, so a refused query hit the
 * error boundary instead of printing "No codes yet." That is honest. It is also
 * the least useful honest answer available — a thrown page says nothing about
 * WHICH read failed or what to check. The throw is replaced by
 * <ConsoleTable readError>, which names the refusal and says plainly that
 * nothing loaded, so this is not a statement that there are no codes.
 *
 * 🔴 THE STATS WERE THE ACTUAL DEFECT HERE. The four tiles used a LOCAL `Stat`
 * typed `value: number` — it had no way to say "not measured", so any degraded
 * read that stopped short of throwing would have printed four confident zeroes,
 * including "Total redemptions 0" over a real redemption history. They are now
 * KpiStatCard, which renders `null` as an em-dash. That local `Stat` was one of
 * the 22 hand-rolled stat tiles in the admin tree; this is one fewer.
 *
 * ⚖ StatusPill is KEPT LOCAL, deliberately. A voucher's states (Active ·
 * Expired · Disabled) are derived from `is_active` and `expires_at` and mean
 * things only a voucher means; the Patiktok pill two files away renders a render
 * job's queue states off a status enum. They are both round and that is the
 * whole of the overlap. Sharing one would mean a pill taking a `variant` for
 * every caller — the 22-local-Stat problem wearing a different hat.
 *
 * Cross-references:
 *   • Day 1.5 migration: 20260529020000_voucher_system_day1_5_spec_alignment.sql
 *   • Day 1 migration (substrate): 20260529010000_voucher_system_day1.sql
 *   • Actions: app/admin/discount-codes/actions.ts
 *   • Form: app/admin/discount-codes/_components/voucher-form.tsx
 */

import Link from 'next/link';
import { Plus, BadgePercent, Pencil, Ban, CheckCircle2 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  disableDiscountCode,
  enableDiscountCode,
} from '@/app/admin/discount-codes/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { PageMasthead } from '@/app/_components/page-masthead';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';
import { ConsoleTable, type ConsoleColumn } from '@/app/admin/_components/console-table';

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

export async function DiscountCodesSurface({
  filter: filterRaw,
  created,
  updated,
  disabled,
  enabled,
}: {
  filter?: string;
  created?: string;
  updated?: string;
  disabled?: string;
  enabled?: string;
}) {
  const filter = (filterRaw ?? 'all') as Filter;
  const createdBanner = created ?? null;
  const updatedBanner = updated ?? null;
  const disabledBanner = disabled ?? null;
  const enabledBanner = enabled ?? null;

  const admin = createAdminClient();

  // Fetch all codes — small table, no need to paginate at pilot scale, and no
  // `.limit(...)`, so there is nothing to disclose as a cap. Filtering happens
  // below so the chip strip can drive UX without shipping multiple queries.
  const { data: rowsRaw, error } = await admin
    .from('discount_codes')
    .select(
      // Day 1.5 schema · pct_value + cap_centavos replace discount_value.
      'discount_code_id, code, discount_type, pct_value, cap_centavos, covered_service_keys, effective_from, expires_at, max_uses, uses_count, is_active, created_by_admin_id, created_at, updated_at',
    )
    .order('created_at', { ascending: false });
  if (error) logQueryError('AdminDiscountCodesSurface', error);

  // NULL SURVIVES TO THE RENDER. `rows` is the honest value; `listed` is the
  // flattened copy the creator lookup and the counts read.
  const rows = rowsRaw as DiscountCodeRow[] | null;
  const listed = rows ?? [];
  const measured = rows !== null;

  // Resolve unique creator user_ids in one IN-query to avoid an N+1.
  const creatorIds = Array.from(new Set(listed.map((r) => r.created_by_admin_id)));
  let creatorMap = new Map<string, { email: string; name: string }>();
  if (creatorIds.length > 0) {
    const { data: admins, error: adminsError } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .in('user_id', creatorIds);
    // A refused label lookup does not change the row count, so the table cannot
    // see it — but the reader then cannot tell who created each code.
    if (adminsError) logQueryError('DiscountCodesSurface.creatorNames', adminsError, {}, 'graceful_degrade');
    creatorMap = new Map(
      (admins ?? []).map((a: AdminLookupRow) => [
        a.user_id,
        { email: a.email ?? '—', name: a.display_name ?? a.email ?? '—' },
      ]),
    );
  }

  const now = Date.now();
  const isExpired = (r: DiscountCodeRow) => new Date(r.expires_at).getTime() < now;

  const activeRows = listed.filter((r) => r.is_active && !isExpired(r));
  const disabledRows = listed.filter((r) => !r.is_active);
  const expiredRows = listed.filter((r) => r.is_active && isExpired(r));

  // The visible slice keeps NULL when nothing was measured — a filtered view of
  // an unread list is still an unread list, never an empty one.
  const visibleRows: DiscountCodeRow[] | null = !measured
    ? null
    : filter === 'active'
      ? activeRows
      : filter === 'disabled'
        ? disabledRows
        : filter === 'expired'
          ? expiredRows
          : listed;

  // Total redemptions across every code, active or not — the pilot-day signal
  // of "are couples actually using vouchers?". Unmeasured stays unmeasured.
  const totalRedemptions = measured
    ? listed.reduce((sum, r) => sum + r.uses_count, 0)
    : null;

  // A count printed beside a filter chip over an unread list would be a lie in
  // the smallest box on the page. Unmeasured chips carry no number at all.
  const chipCount = (n: number): string => (measured ? ` (${n})` : '');

  const columns: ConsoleColumn<DiscountCodeRow>[] = [
    { header: 'Code', mono: true, cell: (row) => row.code },
    { header: 'Discount', cell: (row) => describeValue(row) },
    {
      header: 'Covers',
      hideBelow: 'lg',
      cell: (row) => (
        <span title={row.covered_service_keys.join(', ')} className="text-ink/70">
          {row.covered_service_keys.length} service
          {row.covered_service_keys.length === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      header: 'Effective until',
      hideBelow: 'lg',
      cell: (row) =>
        row.effective_from ? (
          <span className="block text-xs text-ink/70">
            {formatDate(row.effective_from)} → {formatDate(row.expires_at)}
          </span>
        ) : (
          <span>{formatDate(row.expires_at)}</span>
        ),
    },
    { header: 'Uses', hideBelow: 'md', mono: true, cell: (row) => describeUses(row) },
    {
      header: 'Status',
      cell: (row) => {
        const expired = isExpired(row);
        return (
          <StatusPill tone={!row.is_active ? 'slate' : expired ? 'amber' : 'emerald'}>
            {!row.is_active ? 'Disabled' : expired ? 'Expired' : 'Active'}
          </StatusPill>
        );
      },
    },
    {
      header: 'Created by',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-ink/70">
          {creatorMap.get(row.created_by_admin_id)?.name ?? '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      // A voucher genuinely settles on one click, and the row renders its own
      // form inside its own cell — the archetype never offers an actions API.
      // Champagne accent for the affordances that progress the workflow (Edit,
      // Enable) · slate outline for the reversible Disable.
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          {row.is_active && (
            <Link
              href={`/admin/discount-codes/${row.discount_code_id}/edit`}
              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--m-orange-4)]"
              style={{ color: 'var(--m-orange-2)', borderColor: 'var(--m-orange-3)' }}
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
              <input type="hidden" name="discount_code_id" value={row.discount_code_id} />
              <SubmitButton
                pendingLabel="Disabling…"
                className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--m-paper-2)]"
                style={{ color: 'var(--m-slate)', borderColor: 'var(--m-line)' }}
              >
                <Ban className="h-3.5 w-3.5" />
                Disable
              </SubmitButton>
            </ConfirmForm>
          ) : (
            <ConfirmForm
              action={enableDiscountCode}
              message={`Re-enable code ${row.code}?`}
            >
              <input type="hidden" name="discount_code_id" value={row.discount_code_id} />
              <SubmitButton
                pendingLabel="Enabling…"
                className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--m-orange-4)]"
                style={{ color: 'var(--m-orange-2)', borderColor: 'var(--m-orange-3)' }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Enable
              </SubmitButton>
            </ConfirmForm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageMasthead
        title="Discount codes"
        lede="Vouchers couples paste at checkout to unlock a special price. Set an expires-at on every code · pick which services it covers · optionally cap how many times it can be used."
        actions={
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
        }
      />

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
          Code <Mono>{disabledBanner}</Mono> is disabled. Existing orders that already redeemed it
          keep their special price.
        </Banner>
      )}
      {enabledBanner && (
        <Banner tone="emerald">
          Code <Mono>{enabledBanner}</Mono> is live again.
        </Banner>
      )}

      {/* Stats — at-a-glance pilot signals. `null` where nothing was measured;
          KpiStatCard renders an em-dash, never a confident zero. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStatCard label="Active codes" value={measured ? activeRows.length : null} />
        <KpiStatCard label="Disabled codes" value={measured ? disabledRows.length : null} />
        <KpiStatCard label="Expired (still on)" value={measured ? expiredRows.length : null} />
        <KpiStatCard label="Total redemptions" value={totalRedemptions} />
      </div>

      {/* Filter chips */}
      <nav
        className="flex flex-wrap items-center gap-2 text-sm"
        aria-label="Filter discount codes"
      >
        <FilterChip href="/admin/studio?tab=discount-codes" active={filter === 'all'}>
          All{chipCount(listed.length)}
        </FilterChip>
        <FilterChip
          href="/admin/studio?tab=discount-codes&filter=active"
          active={filter === 'active'}
        >
          Active{chipCount(activeRows.length)}
        </FilterChip>
        <FilterChip
          href="/admin/studio?tab=discount-codes&filter=disabled"
          active={filter === 'disabled'}
        >
          Disabled{chipCount(disabledRows.length)}
        </FilterChip>
        <FilterChip
          href="/admin/studio?tab=discount-codes&filter=expired"
          active={filter === 'expired'}
        >
          Expired{chipCount(expiredRows.length)}
        </FilterChip>
      </nav>

      <ConsoleTable
        rows={visibleRows}
        columns={columns}
        rowKey={(row) => row.discount_code_id}
        label="Discount codes"
        readPermitted
        readError={error}
        reads="the discount codes"
        minWidth="56rem"
        empty={{
          Icon: BadgePercent,
          title: filter === 'all' ? 'No codes yet' : 'Nothing in this view',
          blurb:
            filter === 'all'
              ? 'A voucher lands here the moment you create one. Give it an expires-at, pick the services it covers, then share the code — couples paste it into the “Have a code?” field at checkout.'
              : 'There are codes, just none matching this filter right now. Switch back to All to see every voucher.',
        }}
      />

      <p className="text-xs text-ink/70">
        Codes apply at checkout when couples paste them into the &ldquo;Have a code?&rdquo; field.
        Receipts show the net paid amount — no separate discount line. Disabling a code lets
        existing redemptions keep their special price.
      </p>
    </div>
  );
}

// ----- Sub-components (kept inline · single-use, surface stays tight) -----

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-sm tracking-wider" style={{ color: 'var(--m-ink)' }}>
      {children}
    </span>
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
  // Filter chips share the same border-based pill language as the table action
  // buttons (Edit · Disable · Enable) so the whole page reads as one button
  // family. Active chip fills champagne, inactive stays transparent with a slate
  // outline and a paper-2 hover wash.
  // NOTE on hover: inline `style=` wins over Tailwind `hover:bg-*` class
  // specificity, so the active state must NOT carry the hover class (otherwise
  // the orange-2 fill would persist on hover) and the inactive state
  // intentionally omits the inline background so the hover class can drive it.
  const baseClasses =
    'inline-flex items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors';
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={active ? baseClasses : `${baseClasses} hover:bg-[var(--m-paper-2)]`}
      style={
        active
          ? {
              background: 'var(--m-orange-2)',
              color: 'var(--m-paper)',
              borderColor: 'var(--m-orange-2)',
            }
          : { color: 'var(--m-slate)', borderColor: 'var(--m-line)' }
      }
    >
      {children}
    </Link>
  );
}

/**
 * A VOUCHER'S OWN STATE VOCABULARY — kept local on purpose. See the file
 * docblock: the Patiktok surface's pill renders a render job's queue states from
 * a status enum; this one derives Active / Expired / Disabled from `is_active`
 * and `expires_at`. Different values, different meanings, same round shape.
 */
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
        : {
            background: 'var(--m-paper-2)',
            color: 'var(--m-slate)',
            border: '1px solid var(--m-line)',
          };
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
    <div className="rounded-md px-4 py-3 text-sm" style={styles}>
      {children}
    </div>
  );
}
