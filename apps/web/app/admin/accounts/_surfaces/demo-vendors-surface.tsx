import Link from 'next/link';
import { Database, MapPin, ExternalLink, AlertTriangle, MessageSquare } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { DEMO_MODE_COOKIE_NAME, isAdminProfile } from '@/lib/demo-mode';
import { TAXONOMY_MAP, WEDDING_FOLDER_LABEL, WEDDING_FOLDER_ORDER, type WeddingFolder } from '@/lib/taxonomy';
import { DemoVendorActions } from '@/app/admin/demo-vendors/_components/demo-vendor-actions';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';
import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * The three scan ceilings, named once each.
 *
 * 🔢 `BATCH_SCAN_LIMIT` IS THE ONE TO NOTICE and it does not behave like an
 * ordinary row cap. It limits the vendor rows SCANNED, and the batch table is
 * then AGGREGATED from them — so hitting it does not truncate the list you see,
 * it makes the numbers IN that list too small, silently. A batch showing 40
 * vendors could have 400. That is why the table below carries a `note` that
 * fires when the scan actually filled up: the `cap` prop can only speak about
 * the rows it is handed, and here those are batches, not vendors.
 */
const BATCH_SCAN_LIMIT = 2000;
const CATEGORY_SCAN_LIMIT = 5000;
const CITY_SCAN_LIMIT = 5000;

/**
 * DemoVendorsSurface — the Demo vendors LIST/overview body, re-homed
 * byte-identical from app/admin/demo-vendors/page.tsx into the tabbed
 * /admin/accounts studio (Accounts Studio slice 4, final). Behaviour is
 * unchanged: the stats overview, the "view as a couple" preview links, the
 * cleanup/regenerate actions, and the batch + per-folder + per-city breakdowns.
 *
 * The overview takes no searchParams / has no filter form, so nothing needs an
 * action="/admin/accounts" repoint. The DemoVendorActions client component is
 * imported from its existing /admin/demo-vendors/_components location (unmoved),
 * and the "Demo inquiries" link STAYS pointing at the standalone
 * /admin/demo-vendors/inquiries route (its actions live at
 * inquiries/actions.ts — untouched). This surface has no
 * logAdminDataAccess/after() audit side-effect (the original demo-vendors page
 * had none — only createAdminClient reads + the isAdminDemoModeOn cookie check,
 * both of which move with the body).
 *
 * ── 2026-08-17 · onto <ConsoleTable>, and it was NOT a looks change ──────────
 * FOUR reads here, and not one of them looked at its own `{ error }`. Every
 * result was coerced — `count ?? 0`, `data ?? []` — so a refused read produced a
 * page that looked measured and said things that were not true:
 *
 *   • "Demo vendors 0" · "Batches 0" — a confident zero for a count nobody got.
 *   • "No demo batches. Run the seed script to create one." — printed over a
 *     refused read, telling an admin to seed data that may already be there.
 *   • "Empty categories" showed the TOTAL NUMBER OF CATEGORIES, because a failed
 *     read means no category has any vendor. The worst-looking number on the
 *     page was the one produced by having no data at all, and it even tripped
 *     the amber warning styling, which reads as a measurement.
 *   • Every per-folder count fell to 0 and the per-city grid rendered empty with
 *     no heading change — an absence with nothing to explain it.
 *
 * Each read is now judged on its own, unmeasured counts render an em-dash via
 * KpiStatCard, and the derived breakdowns say when they could not be built.
 *
 * The local `Stat` re-declaration is GONE — KpiStatCard is the admin stat tile
 * and already renders the em-dash for null. It was one of 22 such local copies.
 */

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

export async function DemoVendorsSurface() {
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
      .limit(BATCH_SCAN_LIMIT),
    admin
      .from('vendor_profiles')
      .select('services')
      .eq('is_demo', true)
      .limit(CATEGORY_SCAN_LIMIT),
    admin
      .from('vendor_profiles')
      .select('location_city')
      .eq('is_demo', true)
      .limit(CITY_SCAN_LIMIT),
  ]);

  if (totalRes.error) logQueryError('AdminDemoVendors (total count)', totalRes.error);
  if (batchesRes.error) logQueryError('AdminDemoVendors (batch scan)', batchesRes.error);
  if (categoryRes.error) logQueryError('AdminDemoVendors (category scan)', categoryRes.error);
  if (cityRes.error) logQueryError('AdminDemoVendors (city scan)', cityRes.error);

  // 🪤 `count === null` MEANS "NOT MEASURED", NOT "ZERO". This was `?? 0`, so a
  // refused count rendered a confident 0 demo vendors — and the Actions panel
  // below is handed the same number, which is what decides how a cleanup button
  // describes itself.
  const totalDemoVendors = totalRes.error ? null : totalRes.count;

  const batchScan = batchesRes.error
    ? null
    : (batchesRes.data as Array<{ demo_batch_id: string; created_at: string }> | null);
  const categoryScan = categoryRes.error
    ? null
    : (categoryRes.data as Array<{ services: string[] | null }> | null);
  const cityScan = cityRes.error
    ? null
    : (cityRes.data as Array<{ location_city: string | null }> | null);

  // Build batch summary
  const batchMap = new Map<string, { count: number; min: string; max: string }>();
  for (const row of batchScan ?? []) {
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
  // null when the scan behind it was refused — an aggregate of nothing is not a
  // list of no batches, and "No demo batches. Run the seed script" is a costly
  // thing to say to someone who may already have 2,000 of them.
  const batches: BatchRow[] | null =
    batchScan === null
      ? null
      : Array.from(batchMap.entries())
          .map(([demo_batch_id, v]) => ({
            demo_batch_id,
            vendor_count: v.count,
            earliest_created_at: v.min,
            latest_created_at: v.max,
          }))
          .sort((a, b) => b.latest_created_at.localeCompare(a.latest_created_at));

  // Did the scan FILL UP? Then every vendor_count below is a floor, not a count.
  // This is the truthful disclosure for an aggregated read; `cap` alone cannot
  // say it, because the rows the table holds are batches and the ceiling is on
  // vendors.
  const batchScanFilled = (batchScan?.length ?? 0) >= BATCH_SCAN_LIMIT;

  // Per-canonical-service counts — extract the canonical_service from
  // services[] (first element by convention from the seed script).
  const perCanonical = new Map<string, number>();
  for (const row of categoryScan ?? []) {
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
  for (const row of cityScan ?? []) {
    const city = row.location_city ?? '—';
    perCity.set(city, (perCity.get(city) ?? 0) + 1);
  }
  const citySorted = Array.from(perCity.entries()).sort((a, b) => b[1] - a[1]);

  // Coverage gaps — canonical_services with 0 demo vendors (would
  // hint to owner "this category is empty; compare view will be sad here").
  //
  // 🚨 THESE TWO WERE THE MOST MISLEADING NUMBERS ON THE PAGE. They are derived
  // by ABSENCE, so a refused category scan made "Empty categories" equal to the
  // total number of categories — the single most alarming figure the tile can
  // show, produced by having no data rather than by measuring any. It also
  // crossed the >50 threshold and painted itself amber, which reads as a finding.
  // null when the scan did not happen; KpiStatCard renders an em-dash.
  const gapCount =
    categoryScan === null
      ? null
      : Object.keys(TAXONOMY_MAP).filter((k) => !perCanonical.has(k)).length;
  const lowCoverageCount =
    categoryScan === null
      ? null
      : Object.keys(TAXONOMY_MAP).filter((k) => {
          const c = perCanonical.get(k) ?? 0;
          return c > 0 && c < 3;
        }).length;

  return (
    <div>
      <PageMasthead
        className="mb-4"
        titleNode={
          <span className="flex items-center gap-2">
            <Database aria-hidden className="h-6 w-6 text-ink/70" />
            Demo Vendors
          </span>
        }
        lede={
          <>
            Synthetic vendor data for marketplace simulation. All rows are flagged{' '}
            <code className="rounded bg-ink/5 px-1 py-0.5 text-[12px]">is_demo=TRUE</code>{' '}
            and only appear publicly when the marketplace is opened with{' '}
            <code className="rounded bg-ink/5 px-1 py-0.5 text-[12px]">?demo=1</code>{' '}
            (Agent 2&apos;s gate).
          </>
        }
        actions={
          <Link
            href="/admin/demo-vendors/inquiries"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-ink/10"
          >
            <MessageSquare aria-hidden className="h-4 w-4" />
            Demo inquiries — read &amp; respond as the vendor →
          </Link>
        }
      />

      {/* The deadline warning stays OUT of the masthead: PageMasthead's lede is
          desktop-only by council lock, and a hard cleanup deadline is not
          orienting prose that a phone can afford to lose. */}
      <p className="mb-6 rounded-md border-l-4 border-warn-500 bg-warn-50 px-3 py-2 text-sm text-warn-900">
        <AlertTriangle aria-hidden className="mb-0.5 mr-1 inline-block h-4 w-4" />
        <strong>Hard cleanup deadline:</strong> 2026-12-01 (public launch). All demo
        vendors must be removed by this date. The{' '}
        <code className="font-mono text-[12px]">check-no-demo-in-prod</code> CI guard
        fails any merge that ships demo vendors past this date unless the{' '}
        <code className="font-mono text-[12px]">ALLOW_DEMO_VENDORS</code> env flag is
        explicitly set.
      </p>

      {/* ───────────────────── Stats overview ───────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Overview</h2>
        {/* Every tile takes a NUMBER OR NULL. KpiStatCard renders an em-dash for
            null, so a read that did not happen can no longer arrive as a 0 — and
            the amber "warn" tone is gone with the local Stat, because a threshold
            crossed by missing data is not a finding. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiStatCard label="Demo vendors" value={totalDemoVendors} />
          <KpiStatCard label="Batches" value={batches === null ? null : batches.length} />
          <KpiStatCard label="Empty categories" value={gapCount} />
          <KpiStatCard label="Low coverage (<3)" value={lowCoverageCount} />
        </div>
        <p className="mt-2 text-xs text-ink/70">
          Empty / low-coverage categories show how complete the simulation looks
          to a couple browsing the marketplace. Re-run the seed script with a
          higher{' '}
          <code className="rounded bg-ink/5 px-1 text-[11px]">--max</code> if
          coverage is thin.
          {categoryScan === null ? (
            <>
              {' '}
              <strong>
                The category scan was refused on this load, so those two tiles
                show an em-dash rather than a count.
              </strong>
            </>
          ) : null}
        </p>
      </section>

      {/* ───────────────────── Preview link ───────────────────── */}
      <section className="mb-8 sn-tile p-4">
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
            href="/explore?demo=1"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm text-cream hover:bg-ink/90"
          >
            <ExternalLink className="h-4 w-4" />
            /explore?demo=1
          </Link>
          <Link
            href="/explore?demo=1&category=photography"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-4 py-2 text-sm text-ink/75 hover:bg-ink/10"
          >
            Photography
          </Link>
          <Link
            href="/explore?demo=1&category=catering"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-4 py-2 text-sm text-ink/75 hover:bg-ink/10"
          >
            Catering
          </Link>
          <Link
            href="/explore?demo=1&category=wedding_coordination"
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
        <div className="sn-tile p-4">
          {/* 🔒 NO BULK ACTION OVER AN UNKNOWN COUNT. The old `?? 0` handed this
              panel a zero, whose confirmation read "Confirm: delete all 0 demo
              vendors" — a destructive control describing itself with a number
              nobody measured. A sentence takes its place, in the slot where the
              buttons would be. */}
          {totalDemoVendors === null ? (
            <p className="text-sm text-ink/70">
              The demo-vendor count could not be read on this load, so cleanup and
              regenerate are not offered here. That is deliberate: every control in
              this panel acts on <em>all</em> demo vendors, and none of them should
              be pressed against a number we do not have. Reload — if it repeats,
              the read is being refused rather than returning nothing.
            </p>
          ) : (
            <DemoVendorActions totalCount={totalDemoVendors} demoMode={demoMode} />
          )}
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
          <span className="font-normal text-ink/70">
            ({batches === null ? 'not measured' : batches.length})
          </span>
        </h2>
        <ConsoleTable
          rows={batches}
          readPermitted
          readError={batchesRes.error}
          reads="the demo batches"
          /* An honest-but-rare backstop, NOT the disclosure that matters here: it
             fires only if 2,000 scanned vendors turn out to be 2,000 distinct
             batches. The ceiling this read actually hits is on vendors, and what
             it corrupts is the per-batch COUNTS, so `note` below is what tells
             the truth. Do not read this prop as covering the scan. */
          cap={BATCH_SCAN_LIMIT}
          label="Demo batches"
          minWidth="40rem"
          rowKey={(b) => b.demo_batch_id}
          note={
            batchScanFilled ? (
              <>
                <strong>These counts are floors, not totals.</strong> The batch
                summary is built by scanning the {BATCH_SCAN_LIMIT.toLocaleString()}{' '}
                most recent demo vendors, and that scan came back full — so any
                batch below may hold more vendors than it shows, and an older batch
                may be missing entirely.
              </>
            ) : undefined
          }
          empty={{
            Icon: Database,
            title: 'No demo batches',
            blurb:
              'Nothing carries a batch id yet. Run the seed script from the terminal block above to create one.',
            verifiedNote: 'Verified: read permitted · 0 batches',
          }}
          columns={[
            {
              header: 'Batch',
              mono: true,
              cell: (b) => (
                <>
                  <span className="text-ink/85">{shortBatchId(b.demo_batch_id)}</span>
                  {b.demo_batch_id === LEGACY_BATCH_ID ? (
                    <span className="ml-2 text-ink/70">(2026-06-01 test seed)</span>
                  ) : null}
                </>
              ),
            },
            {
              header: 'Vendors',
              align: 'right',
              mono: true,
              cell: (b) => (
                <span title={batchScanFilled ? 'At least this many — the scan was full.' : undefined}>
                  {b.vendor_count.toLocaleString()}
                  {batchScanFilled ? '+' : ''}
                </span>
              ),
            },
            {
              header: 'Created',
              hideBelow: 'md',
              mono: true,
              cell: (b) => (
                <span className="text-ink/70">{fmtDate(b.earliest_created_at)}</span>
              ),
            },
            {
              header: 'Action',
              align: 'right',
              cell: (b) => (
                <DemoVendorActions
                  totalCount={b.vendor_count}
                  batchId={b.demo_batch_id}
                  compact
                />
              ),
            },
          ]}
        />
      </section>

      {/* ───────────────────── Per-folder breakdown ───────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Vendors per folder</h2>
        {categoryScan === null ? (
          <p className="rounded-md border border-dashed border-ink/15 px-4 py-6 text-sm text-ink/70">
            The scan these counts are built from was refused, so there is nothing
            to break down. Every folder would have read <strong>0</strong> — which
            is what this section used to show, and it is not what happened.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {WEDDING_FOLDER_ORDER.map((folder) => {
              const count = perFolder.get(folder) ?? 0;
              return (
                <div key={folder} className="sn-tile px-4 py-3">
                  <p className="text-sm text-ink/75">{WEDDING_FOLDER_LABEL[folder]}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {count.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───────────────────── Per-city breakdown ───────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Vendors per city</h2>
        {cityScan === null ? (
          <p className="rounded-md border border-dashed border-ink/15 px-4 py-6 text-sm text-ink/70">
            The city scan was refused, so this breakdown could not be built. It
            used to render as an empty grid with nothing to say why — an absence
            that looked like a layout, not a failure.
          </p>
        ) : citySorted.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink/15 px-4 py-6 text-sm text-ink/70">
            No demo vendor carries a city yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {citySorted.map(([city, count]) => (
              <div
                key={city}
                className="flex items-center justify-between sn-tile px-4 py-2"
              >
                <span className="flex items-center gap-1.5 text-sm text-ink/75">
                  <MapPin aria-hidden className="h-3.5 w-3.5 text-ink/70" />
                  {city}
                </span>
                <span className="font-mono text-sm tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        )}
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

// The local `Stat` re-declaration lived here. It is DELETED, not moved:
// KpiStatCard three files away is the admin stat tile and already renders an
// em-dash for a null value, which is the whole reason this surface could not
// tell a refused count from a zero. It was one of 22 such local copies against
// the one shared tile.
