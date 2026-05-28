import { createAdminClient } from '@/lib/supabase/admin';
import {
  TAXONOMY_MAP,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_ORDER,
  type WeddingFolder,
  type TaxonomyEntry,
} from '@/lib/taxonomy';

export const metadata = { title: 'Taxonomy · Admin' };

type SchemaRow = {
  canonical_service: string;
  display_name_en: string;
  display_name_tl: string | null;
  shared_attribute_groups: string[];
  filter_facets: unknown;
  required_for_visibility: unknown;
};

type Grouped = {
  folder: WeddingFolder;
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

const PHASE_TONE_BASE = 'bg-ink/5 text-ink/70';
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

export default async function AdminTaxonomyPage() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('canonical_service_schemas')
    .select(
      'canonical_service, display_name_en, display_name_tl, shared_attribute_groups, filter_facets, required_for_visibility',
    )
    .order('canonical_service', { ascending: true });

  const schemas = (rows ?? []) as SchemaRow[];

  // Bucket each row into a wedding folder via TAXONOMY_MAP. Unknown keys land
  // in a separate "Unmapped" group so admins can spot drift between DB seeds
  // and the lib/taxonomy.ts metadata map.
  const buckets = new Map<WeddingFolder, Grouped>();
  for (const folder of WEDDING_FOLDER_ORDER) {
    buckets.set(folder, { folder, label: WEDDING_FOLDER_LABEL[folder], rows: [] });
  }
  const unmapped: SchemaRow[] = [];

  for (const row of schemas) {
    const meta = TAXONOMY_MAP[row.canonical_service];
    if (!meta) {
      unmapped.push(row);
      continue;
    }
    buckets.get(meta.folder)?.rows.push({ ...row, meta });
  }

  // Sort each bucket by phase severity then display name so V1.1 base reads
  // first, then V1.1.x, then V1.2+, etc.
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
  for (const bucket of buckets.values()) {
    bucket.rows.sort((a, b) => {
      const ra = phaseRank[a.meta.phase] ?? 99;
      const rb = phaseRank[b.meta.phase] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.display_name_en.localeCompare(b.display_name_en);
    });
  }

  const totalRows = schemas.length;
  const totalMapped = totalRows - unmapped.length;
  const facetedCount = schemas.filter((r) => {
    const facets = Array.isArray(r.filter_facets) ? r.filter_facets : [];
    return facets.length > 0;
  }).length;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Iteration 0044 · V1.1 vendor taxonomy
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Taxonomy</h1>
        <p className="text-base text-ink/65">
          Read-only viewer over <code className="font-mono text-sm">canonical_service_schemas</code>, grouped into the 12 PH-grounded wedding folders from
          {' '}<code className="font-mono text-sm">Vendor_Taxonomy_V1_Master.md</code>. Faith badges surface conditionally on
          {' '}<code className="font-mono text-sm">events.ceremony_type</code> per iteration 0043; phase badges show launch sequencing.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total rows" value={totalRows} />
        <Stat label="Mapped to a folder" value={totalMapped} />
        <Stat label="With filter_facets" value={facetedCount} />
        <Stat label="Unmapped (drift)" value={unmapped.length} />
      </section>

      {WEDDING_FOLDER_ORDER.map((folder, idx) => {
        const bucket = buckets.get(folder);
        if (!bucket) return null;
        return (
          <section key={folder} className="mb-10">
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                <span className="font-mono text-xs text-ink/55">Folder {idx + 1}</span> · {bucket.label}
              </h2>
              <span className="font-mono text-xs text-ink/55">{bucket.rows.length} categories</span>
            </header>
            {bucket.rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 px-4 py-3 text-sm text-ink/55">
                No rows yet. Add a seed migration row + a lib/taxonomy.ts entry.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-cream">
                {bucket.rows.map((row) => {
                  const facets = Array.isArray(row.filter_facets) ? row.filter_facets : [];
                  const required = (row.required_for_visibility ?? {}) as Record<string, unknown>;
                  const hasRequired =
                    Object.keys(required).length > 0;
                  return (
                    <li key={row.canonical_service} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{row.display_name_en}</span>
                          {row.display_name_tl ? (
                            <span className="hidden truncate font-mono text-[11px] text-ink/45 sm:inline">
                              ({row.display_name_tl})
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-ink/45">
                          {row.canonical_service}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={PHASE_TONE[row.meta.phase] ?? PHASE_TONE_BASE}>
                          {row.meta.phase}
                        </Badge>
                        {row.meta.faith ? (
                          <Badge tone={FAITH_TONE[row.meta.faith]}>{row.meta.faith}</Badge>
                        ) : null}
                        {row.meta.setnayan ? (
                          <Badge tone="bg-terracotta/10 text-terracotta">Setnayan</Badge>
                        ) : null}
                        {row.meta.ph ? (
                          <Badge tone="bg-sky-50 text-sky-700">PH-specific</Badge>
                        ) : null}
                        {row.meta.rental ? (
                          <Badge tone="bg-ink/5 text-ink/70">Rental</Badge>
                        ) : null}
                        <Badge tone="bg-ink/5 text-ink/55">
                          {facets.length} facet{facets.length === 1 ? '' : 's'}
                        </Badge>
                        {hasRequired ? (
                          <Badge tone="bg-emerald-50 text-emerald-700">visibility gate</Badge>
                        ) : null}
                        <Badge tone="bg-ink/5 text-ink/55">
                          {row.shared_attribute_groups.length} shared
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {unmapped.length > 0 ? (
        <section className="mb-10">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-rose-700">
              ⚠ Unmapped (canonical_service rows missing from <code className="font-mono text-sm">lib/taxonomy.ts</code>)
            </h2>
            <span className="font-mono text-xs text-rose-700">{unmapped.length} rows</span>
          </header>
          <ul className="divide-y divide-rose-200 rounded-xl border border-rose-200 bg-rose-50">
            {unmapped.map((row) => (
              <li key={row.canonical_service} className="px-4 py-3 text-sm">
                <span className="font-medium text-ink">{row.display_name_en}</span>
                <span className="ml-2 font-mono text-[11px] text-ink/50">{row.canonical_service}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}>
      {children}
    </span>
  );
}
