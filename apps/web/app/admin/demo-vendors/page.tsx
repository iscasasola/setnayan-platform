/**
 * /admin/demo-vendors
 *
 * Admin surface for managing the synthetic vendor data the seed script
 * creates. PR 1 of 3 — marketplace simulation workstream (owner-approved
 * 2026-05-22 evening).
 *
 * Three things visible here:
 *   1. Aggregate stats — total demo vendor count, per-folder count, per-city
 *      count. A glance tells the owner "is the marketplace usable enough to
 *      dogfood compare view?".
 *   2. Active demo batches — group rows by demo_batch_id, show count + earliest
 *      created_at. Each batch has a "Cleanup this batch" button.
 *   3. Global actions — "Cleanup ALL Demo Vendors" + "Regenerate" buttons,
 *      plus the CLI command to spin up a new batch.
 *
 * Why this page exists alongside CLI seeding:
 *   • Owner wants a fast cleanup path (one click) without dropping to terminal.
 *   • The Dec 1 hard-cleanup deadline matters; making the cleanup surface
 *     visible in admin makes it harder to forget.
 *   • Agent 2 ships ?demo=1; this page links to /vendors?demo=1 so the owner
 *     can preview the marketplace surface as a couple sees it.
 *
 * Cross-PR coordination:
 *   • Agent 2 (demo-mode flag) — this page documents the gate URL.
 *   • Agent 3 (compare view) — this page's stats include "vendors per category"
 *     so the owner knows if a category has enough rows for a 2-3 vendor compare.
 */

import Link from 'next/link';
import { Database, Trash2, RotateCcw, MapPin, ExternalLink, AlertTriangle, MessageSquare } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { DEMO_MODE_COOKIE_NAME, isAdminProfile } from '@/lib/demo-mode';
import { TAXONOMY_MAP, WEDDING_FOLDER_LABEL, WEDDING_FOLDER_ORDER, type WeddingFolder } from '@/lib/taxonomy';
import { DemoVendorActions } from './_components/demo-vendor-actions';

export const metadata = { title: 'Demo Vendors · Admin' };

type BatchRow = {
  demo_batch_id: string;
  vendor_count: number;
  earliest_created_at: string;
  latest_created_at: string;
};

const LEGACY_BATCH_ID = '00000000-0000-0000-0000-000000000001';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function shortBatchId(uuid: string): string {
  if (uuid === LEGACY_BATCH_ID) return 'legacy';
  return uuid.slice(0, 8);
}

// Mirrors <DemoModeBanner>: demo mode is on when the admin's session carries
// the cookie. Computed server-side so the Create button can pass it to the
// seed API explicitly (robust against the httpOnly cookie not surviving the
// client fetch — the actual reason a prod Create could 403 with demo mode on).
async function isAdminDemoModeOn(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value !== '1') return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  return isAdminProfile(profile);
}

export default async function DemoVendorsAdminPage() {
  const admin = createAdminClient();
  const demoMode = await isAdminDemoModeOn();

  // Aggregate counts — full table scan over is_demo=TRUE rows. The partial
  // index on vendor_profiles_is_demo_idx makes this cheap.
  const [totalRes, batchesRes, categoryRes, cityRes] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id', { count: 'exact', head: true })
      .eq('is_demo', true),
    admin
      .from('vendor_profiles')
      .select('demo_batch_id, created_at, business_slug')
      .eq('is_demo', true)
      .not('demo_batch_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2000),
    admin
      .from('vendor_profiles')
      .select('services')
      .eq('is_demo', true)
      .limit(5000),
    admin
      .from('vendor_profiles')
      .select('location_city')
      .eq('is_demo', true)
      .limit(5000),
  ]);

  const totalDemoVendors = totalRes.count ?? 0;

  // Build batch summary
  const batchMap = new Map<string, { count: number; min: string; max: string }>();
  for (const row of (batchesRes.data ?? []) as Array<{
    demo_batch_id: string;
    created_at: string;
  }>) {
    const existing = batchMap.get(row.demo_batch_id);
    if (existing) {
      existing.count += 1;
      if (row.created_at < existing.min) existing.min = row.created_at;
      if (row.created_at > existing.max) existing.max = row.created_at;
    } else {
      batchMap.set(row.demo_batch_id, {
        count: 1,
        min: row.created_at,
        max: row.created_at,
      });
    }
  }
  const batches: BatchRow[] = Array.from(batchMap.entries())
    .map(([demo_batch_id, v]) => ({
      demo_batch_id,
      vendor_count: v.count,
      earliest_created_at: v.min,
      latest_created_at: v.max,
    }))
    .sort((a, b) =>
      b.latest_created_at.localeCompare(a.latest_created_at),
    );

  // Per-canonical-service counts — extract the canonical_service from
  // services[] (first element by convention from the seed script).
  const perCanonical = new Map<string, number>();
  for (const row of (categoryRes.data ?? []) as Array<{ services: string[] | null }>) {
    const services = row.services ?? [];
    const canonical = services[0];
    if (canonical) {
      perCanonical.set(canonical, (perCanonical.get(canonical) ?? 0) + 1);
    }
  }

  // Aggregate to folders for high-level view
  const perFolder = new Map<WeddingFolder, number>();
  for (const [canonical, count] of perCanonical) {
    const meta = TAXONOMY_MAP[canonical as keyof typeof TAXONOMY_MAP];
    const folder = (meta?.folder ?? 'planning_logistics_travel') as WeddingFolder;
    perFolder.set(folder, (perFolder.get(folder) ?? 0) + count);
  }

  // Per-city counts
  const perCity = new Map<string, number>();
  for (const row of (cityRes.data ?? []) as Array<{ location_city: string | null }>) {
    const city = row.location_city ?? '—';
    perCity.set(city, (perCity.get(city) ?? 0) + 1);
  }
  const citySorted = Array.from(perCity.entries()).sort((a, b) => b[1] - a[1]);

  // Coverage gaps — canonical_services with 0 demo vendors (would
  // hint to owner "this category is empty; compare view will be sad here")
  const gapCount = Object.keys(TAXONOMY_MAP).filter(
    (k) => !perCanonical.has(k),
  ).length;
  const lowCoverageCount = Object.keys(TAXONOMY_MAP).filter((k) => {
    const c = perCanonical.get(k) ?? 0;
    return c > 0 && c < 3;
  }).length;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Database className="h-6 w-6 text-ink/70" />
          Demo Vendors
        </h1>
        <p className="text-sm text-ink/60">
          Synthetic vendor data for marketplace simulation. All rows are flagged{' '}
          <code className="rounded bg-ink/5 px-1 py-0.5 text-[12px]">is_demo=TRUE</code>{' '}
          and only appear publicly when the marketplace is opened with{' '}
          <code className="rounded bg-ink/5 px-1 py-0.5 text-[12px]">?demo=1</code>{' '}
          (Agent 2&apos;s gate).
        </p>
        <div className="pt-1">
          <Link
            href="/admin/demo-vendors/inquiries"
            className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/10"
          >
            <MessageSquare className="h-4 w-4" />
            Demo inquiries — read &amp; respond as the vendor →
          </Link>
        </div>
        <p className="rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mb-0.5 mr-1 inline-block h-4 w-4" />
          <strong>Hard cleanup deadline:</strong> 2026-12-01 (public launch). All demo
          vendors must be removed by this date. The{' '}
          <code className="font-mono text-[12px]">check-no-demo-in-prod</code> CI guard
          fails any merge that ships demo vendors past this date unless the{' '}
          <code className="font-mono text-[12px]">ALLOW_DEMO_VENDORS</code> env flag is
          explicitly set.
        </p>
      </header>

      {/* ───────────────────── Stats overview ───────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Demo vendors" value={totalDemoVendors.toLocaleString()} />
          <Stat label="Batches" value={String(batches.length)} />
          <Stat
            label="Empty categories"
            value={String(gapCount)}
            tone={gapCount > 50 ? 'warn' : 'ok'}
          />
          <Stat
            label="Low coverage (<3)"
            value={String(lowCoverageCount)}
            tone={lowCoverageCount > 20 ? 'warn' : 'ok'}
          />
        </div>
        <p className="mt-2 text-xs text-ink/55">
          Empty / low-coverage categories show how complete the simulation looks
          to a couple browsing the marketplace. Re-run the seed script with a
          higher{' '}
          <code className="rounded bg-ink/5 px-1 text-[11px]">--max</code> if
          coverage is thin.
        </p>
      </section>

      {/* ───────────────────── Preview link ───────────────────── */}
      <section className="mb-8 rounded-xl border border-ink/10 bg-cream p-4">
        <h2 className="mb-2 text-lg font-semibold">View as a couple</h2>
        <p className="text-sm text-ink/65">
          Demo vendors are hidden from the public marketplace by default.
          Append{' '}
          <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[12px]">
            ?demo=1
          </code>{' '}
          to any /vendors URL to surface them.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/vendors?demo=1"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm text-cream hover:bg-ink/90"
          >
            <ExternalLink className="h-4 w-4" />
            /vendors?demo=1
          </Link>
          <Link
            href="/vendors?demo=1&category=photography"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-4 py-2 text-sm text-ink/75 hover:bg-ink/10"
          >
            Photography
          </Link>
          <Link
            href="/vendors?demo=1&category=catering"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-4 py-2 text-sm text-ink/75 hover:bg-ink/10"
          >
            Catering
          </Link>
          <Link
            href="/vendors?demo=1&category=wedding_coordination"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-4 py-2 text-sm text-ink/75 hover:bg-ink/10"
          >
            Coordinators
          </Link>
        </div>
        <p className="mt-2 text-xs text-ink/55">
          Demo vendors are hidden from real visitors — they surface in browse
          only while demo mode is on (open any page with{' '}
          <code className="rounded bg-ink/5 px-1">?demo=1</code>).{' '}
          {demoMode
            ? 'Demo mode is on for your session, so Create works here.'
            : 'Turn demo mode on before using Create on production.'}
        </p>
      </section>

      {/* ───────────────────── Global actions ───────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Actions</h2>
        <div className="rounded-xl border border-ink/10 bg-cream p-4">
          <DemoVendorActions totalCount={totalDemoVendors} demoMode={demoMode} />
          <div className="mt-4 rounded-md bg-ink/5 p-3 font-mono text-[12px] text-ink/75">
            <p className="mb-1 text-ink/55">Seed a fresh batch from terminal:</p>
            <p>
              pnpm -F @setnayan/web exec tsx scripts/seed-demo-vendors.ts
            </p>
            <p className="mt-2 text-ink/55">
              Flags: --append · --dry-run · --limit=N · --min=5 --max=10
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────── Batches ───────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          Batches{' '}
          <span className="font-normal text-ink/55">({batches.length})</span>
        </h2>
        {batches.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/60">
            No demo batches. Run the seed script to create one.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 bg-ink/5 text-left text-[11px] uppercase tracking-wider text-ink/55">
                  <th className="px-4 py-2 font-medium">Batch</th>
                  <th className="px-4 py-2 font-medium">Vendors</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.demo_batch_id} className="border-b border-ink/5 last:border-b-0">
                    <td className="px-4 py-3 font-mono text-[12px]">
                      <span className="text-ink/85">
                        {shortBatchId(b.demo_batch_id)}
                      </span>
                      <span className="ml-2 text-ink/40">
                        {b.demo_batch_id === LEGACY_BATCH_ID
                          ? '(2026-06-01 test seed)'
                          : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">{b.vendor_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-ink/60">{fmtDate(b.earliest_created_at)}</td>
                    <td className="px-4 py-3">
                      <DemoVendorActions
                        totalCount={b.vendor_count}
                        batchId={b.demo_batch_id}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ───────────────────── Per-folder breakdown ───────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Vendors per folder</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {WEDDING_FOLDER_ORDER.map((folder) => {
            const count = perFolder.get(folder) ?? 0;
            return (
              <div
                key={folder}
                className="rounded-lg border border-ink/10 bg-cream px-4 py-3"
              >
                <p className="text-sm text-ink/75">{WEDDING_FOLDER_LABEL[folder]}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {count.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────────────────── Per-city breakdown ───────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Vendors per city</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {citySorted.map(([city, count]) => (
            <div
              key={city}
              className="flex items-center justify-between rounded-lg border border-ink/10 bg-cream px-4 py-2"
            >
              <span className="flex items-center gap-1.5 text-sm text-ink/75">
                <MapPin className="h-3.5 w-3.5 text-ink/50" />
                {city}
              </span>
              <span className="font-mono text-sm tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────── Footer cross-PR coordination ───────────────────── */}
      <section className="mt-12 rounded-xl border border-dashed border-ink/15 p-4 text-xs text-ink/55">
        <p>
          <strong>Workstream:</strong> Marketplace simulation (owner-approved
          2026-05-22). This page is PR 1 of 3.
        </p>
        <ul className="mt-1 list-disc pl-5">
          <li>
            <strong>PR 1</strong> (this PR): seed script + schema columns + admin
            cleanup UI.
          </li>
          <li>
            <strong>PR 2</strong>: ?demo=1 query-param gate on /vendors browse.
          </li>
          <li>
            <strong>PR 3</strong>: vendor compare view (2-3 vendors side-by-side).
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}) {
  const toneClass = tone === 'warn' ? 'text-amber-700' : 'text-ink';
  return (
    <div className="rounded-lg border border-ink/10 bg-cream px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-ink/55">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
