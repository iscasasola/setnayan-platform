import Link from 'next/link';
import { Search } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { Logo as BrandLogo } from '@/app/_components/logo';
import {
  TAXONOMY_MAP,
  MEGA_MENU_COLUMN_LABEL,
  type MegaMenuColumn,
  type TaxonomyEntry,
} from '@/lib/taxonomy';

export const metadata = {
  title: 'Browse vendor categories — Setnayan',
  description:
    'Full Setnayan vendor taxonomy across 5 mega-menu columns (Capture · Music · Food · Look · Coordination · Logistics · Stationery · Travel) — 192 sub-categories spanning V1.1 → V1.5+.',
};

// Read-only browse surface. Public — no auth needed. Reads
// canonical_service_schemas with the admin client (anon RLS allows SELECT on
// this table) so anonymous couples see every category, including ones that
// haven't started vendor recruitment yet. Categories without vendors will
// surface empty on the /vendors filter — that's the V1.1 phasing contract,
// not a bug.
export const dynamic = 'force-dynamic';

type SchemaRow = {
  canonical_service: string;
  display_name_en: string;
  display_name_tl: string | null;
};

type GroupedColumn = {
  column: MegaMenuColumn;
  label: string;
  rows: Array<SchemaRow & { meta: TaxonomyEntry }>;
};

type FaithKey = NonNullable<TaxonomyEntry['faith']>;

const FAITH_TONE: Record<FaithKey, string> = {
  Catholic: 'bg-sky-100 text-sky-800',
  Christian: 'bg-violet-100 text-violet-800',
  INC: 'bg-emerald-100 text-emerald-800',
  Muslim: 'bg-amber-100 text-amber-900',
  Cultural: 'bg-rose-100 text-rose-800',
};

const PHASE_BASE_TONE = 'bg-ink/5 text-ink/65';
const PHASE_TONE: Record<string, string> = {
  'V1.1 base': 'bg-emerald-100 text-emerald-800',
  'V1.1.1': 'bg-emerald-50 text-emerald-700',
  'V1.1.2': 'bg-emerald-50 text-emerald-700',
  'V1.1.3': 'bg-emerald-50 text-emerald-700',
  'V1.1.4': 'bg-emerald-50 text-emerald-700',
  'V1.1.5': 'bg-emerald-50 text-emerald-700',
  'V1.1.6': 'bg-emerald-50 text-emerald-700',
  'V1.2': 'bg-amber-50 text-amber-800',
  'V1.3': 'bg-amber-50 text-amber-800',
  'V1.4': 'bg-amber-50 text-amber-800',
  'V1.5+': 'bg-rose-50 text-rose-800',
};

const phaseRank: Record<string, number> = {
  'V1.1 base': 0,
  'V1.1.1': 1,
  'V1.1.2': 2,
  'V1.1.3': 3,
  'V1.1.4': 4,
  'V1.1.5': 5,
  'V1.1.6': 6,
  'V1.2': 7,
  'V1.3': 8,
  'V1.4': 9,
  'V1.5+': 10,
};

export default async function VendorCategoriesPage() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('canonical_service_schemas')
    .select('canonical_service, display_name_en, display_name_tl')
    .order('display_name_en', { ascending: true });

  const schemas = (rows ?? []) as SchemaRow[];

  const columns = new Map<MegaMenuColumn, GroupedColumn>();
  for (const col of [1, 2, 3, 4, 5] as MegaMenuColumn[]) {
    columns.set(col, { column: col, label: MEGA_MENU_COLUMN_LABEL[col], rows: [] });
  }
  for (const row of schemas) {
    const meta = TAXONOMY_MAP[row.canonical_service];
    if (!meta) continue;
    columns.get(meta.column)?.rows.push({ ...row, meta });
  }
  for (const bucket of columns.values()) {
    bucket.rows.sort((a, b) => {
      const ra = phaseRank[a.meta.phase] ?? 99;
      const rb = phaseRank[b.meta.phase] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.display_name_en.localeCompare(b.display_name_en);
    });
  }

  const totalRows = schemas.length;
  const liveRows = schemas.filter((r) => TAXONOMY_MAP[r.canonical_service]?.phase === 'V1.1 base').length;

  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink" aria-label="Setnayan home">
            <BrandLogo height={28} withWordmark />
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/vendors" className="text-ink/70 hover:text-ink">
              Marketplace
            </Link>
            <Link href="/login" className="text-ink/70 hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-10 max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Vendor taxonomy · {totalRows} sub-categories
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Browse vendor categories
          </h1>
          <p className="mt-3 text-base text-ink/65">
            Setnayan&rsquo;s full vendor taxonomy is structured into five mega-menu columns covering visual, audio, food, attire, and coordination. {liveRows} categories are live in V1.1 base; the rest light up incrementally as vendor pools fill in (per the V1.1.1 &rarr; V1.5+ launch sequencing).
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/vendors"
              className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5"
            >
              <Search aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Search the marketplace
            </Link>
          </div>
        </section>

        {[1, 2, 3, 4, 5].map((col) => {
          const bucket = columns.get(col as MegaMenuColumn);
          if (!bucket) return null;
          return (
            <section key={col} className="mb-10">
              <header className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  <span className="font-mono text-xs text-ink/55">Column {col}</span> · {bucket.label}
                </h2>
                <span className="font-mono text-xs text-ink/55">{bucket.rows.length} categories</span>
              </header>
              {bucket.rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/55">
                  No categories yet.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {bucket.rows.map((row) => (
                    <li key={row.canonical_service}>
                      <Link
                        href={`/vendors?category=${encodeURIComponent(row.canonical_service)}`}
                        className="group flex h-full flex-col gap-2 rounded-lg border border-ink/10 bg-cream p-3 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-ink group-hover:text-terracotta">
                            {row.display_name_en}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${PHASE_TONE[row.meta.phase] ?? PHASE_BASE_TONE}`}
                          >
                            {row.meta.phase}
                          </span>
                        </div>
                        {row.display_name_tl ? (
                          <span className="font-mono text-[11px] text-ink/45">{row.display_name_tl}</span>
                        ) : null}
                        <div className="mt-auto flex flex-wrap items-center gap-1">
                          {row.meta.faith ? (
                            <Badge tone={FAITH_TONE[row.meta.faith]}>{row.meta.faith}</Badge>
                          ) : null}
                          {row.meta.setnayan ? (
                            <Badge tone="bg-terracotta/10 text-terracotta">Setnayan</Badge>
                          ) : null}
                          {row.meta.ph ? <Badge tone="bg-sky-50 text-sky-700">PH</Badge> : null}
                          {row.meta.rental ? <Badge tone="bg-ink/5 text-ink/60">Rental</Badge> : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <section className="mb-10 rounded-xl border border-ink/10 bg-cream/60 px-5 py-4 text-sm text-ink/65">
          <p>
            <span className="font-medium text-ink">Categories with no vendors yet</span> show empty results on the marketplace search — vendor pools fill in by phase as recruitment lands. The launch order (V1.1 base → V1.1.1 → V1.5+) follows the spec corpus § Vendor_Taxonomy_V1_Master.md.
          </p>
        </section>
      </main>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${tone}`}
    >
      {children}
    </span>
  );
}
