/**
 * THE CATALOGUE COPY'S PURE CORE — which admin tables a staging copy takes from production, and the one statement
 * that lands them. Used by scripts/staging/copy-catalog.ts; the upsert is proven on the replayed schema
 * (apps/web/tests/db/the-staging-seed-runs-clean.db.test.ts) and the rules here in apps/web/lib/staging-kit.test.ts.
 *
 * WHY: a staging branch is built from the migrations, so its price sheet, switches and vocabulary are what the
 * migrations wrote — not what the admin has set since. A checker reading a price on staging must read production's
 * price, or every money finding is about the copy, not the site.
 *
 * WHAT: only NON-PERSONAL tables the admin manages, each named here with its reason. The runtime check below refuses
 * any of them that has grown a link to a person's or a shop's or an event's row (a foreign key to a tenant table):
 * such a table is no longer "admin data", and copying it would copy people. Audit stamps that point at an admin's
 * account (`updated_by_admin_id` …) are copied as NULL — that account does not exist on the copy.
 */

export type CopyTable = {
  table: string;
  why: string;
  /** Columns left exactly as the staging copy has them (never overwritten from production). */
  keep?: readonly string[];
};

/** In dependency order — a table is copied after the tables it points at. */
export const COPY_TABLES: readonly CopyTable[] = [
  { table: 'platform_retail_catalog_v2', why: "couples' prices (the one price reader for every couple screen)" },
  { table: 'vendor_billing_catalog', why: "suppliers' plan prices" },
  { table: 'platform_package_catalog', why: 'package prices' },
  { table: 'papic_event_pool_config', why: 'photo-credit numbers (the event pool)' },
  { table: 'papic_tier_config', why: 'Papic tiers (point at the catalogue)' },
  { table: 'papic_one_tiers', why: 'Papic One tiers (point at the catalogue)' },
  { table: 'papic_pass_tiers', why: 'Papic pass tiers (point at the catalogue)' },
  { table: 'pricing_formula_settings', why: 'the pricing formula dials' },
  {
    table: 'platform_settings',
    why: 'site-wide switches and display values (bookings open, fees, the payment QR details)',
    // Staging keeps Maya's SANDBOX endpoint: production's live endpoint would only be refused by lock (b).
    keep: ['maya_checkout_endpoint'],
  },
  { table: 'event_type_vocab', why: 'the event types and their switches' },
  { table: 'event_type_profiles', why: 'per-event-type settings' },
  { table: 'event_type_onboarding', why: 'per-event-type onboarding' },
  { table: 'faith_vocab', why: 'the faith vocabulary' },
  { table: 'budget_allocation_config', why: 'the budget split dials' },
  { table: 'budget_band_config', why: 'the budget bands' },
  { table: 'service_categories', why: 'the category tree' },
  { table: 'canonical_service_schemas', why: 'what each service card asks' },
  { table: 'canonical_service_taxonomy', why: 'the service taxonomy' },
  { table: 'service_catalog', why: 'the service SKU list' },
  { table: 'nav_slot_override', why: "the admin's menu overrides" },
];

/** A table that points at any of these holds people, shops or events — never "admin data". */
export const TENANT_TABLES: ReadonlySet<string> = new Set([
  'public.events',
  'public.guests',
  'public.event_members',
  'public.vendor_profiles',
  'public.vendor_services',
  'public.vendor_coverages',
  'public.event_vendors',
  'public.orders',
  'public.payments',
  'public.chat_threads',
]);

/** Account tables: a column pointing here is an audit stamp, copied as NULL. */
export const ACCOUNT_TABLES: ReadonlySet<string> = new Set(['auth.users', 'public.users']);

export type TableMeta = {
  table: string;
  /** Insertable columns (no generated or identity-always columns), in table order. */
  columns: string[];
  primaryKey: string[];
  /** column → the table it references, e.g. `{ updated_by_admin_id: 'auth.users' }`. */
  foreignKeys: Record<string, string>;
};

/** The staging-side metadata query (read-only): one JSON value for every table asked for. */
export function metaSql(tables: readonly string[]): string {
  const list = tables.map((t) => `'${t.replace(/'/g, "''")}'`).join(', ');
  return `
SELECT coalesce(json_agg(json_build_object(
  'table', t.relname,
  'columns', (SELECT coalesce(json_agg(a.attname ORDER BY a.attnum), '[]') FROM pg_attribute a
               WHERE a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '' AND a.attidentity <> 'a'),
  'primaryKey', (SELECT coalesce(json_agg(a.attname ORDER BY array_position(i.indkey::int2[], a.attnum)), '[]') FROM pg_index i
                  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
                 WHERE i.indrelid = t.oid AND i.indisprimary),
  'foreignKeys', (SELECT coalesce(json_object_agg(a.attname, k.confrelid::regclass::text), '{}') FROM pg_constraint k
                   JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
                  WHERE k.conrelid = t.oid AND k.contype = 'f')
)), '[]') AS meta
FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relkind = 'r' AND t.relname IN (${list});`;
}

/** Why a table may not be copied, or null when it may. */
export function refusalFor(meta: TableMeta | undefined, spec: CopyTable): string | null {
  if (!meta) return `${spec.table} does not exist on the staging copy`;
  if (meta.primaryKey.length === 0) return `${spec.table} has no primary key — an upsert could duplicate rows`;
  const tenant = Object.entries(meta.foreignKeys).filter(([, target]) => TENANT_TABLES.has(target.includes('.') ? target : `public.${target}`));
  if (tenant.length > 0) {
    return `${spec.table} points at ${tenant.map(([c, t]) => `${t} (${c})`).join(', ')} — it holds people, shops or events, not admin data`;
  }
  return null;
}

function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`copy-catalog: not a plain identifier: ${name}`);
  return name;
}

function dollarTag(payload: string): string {
  let tag = 'stg_rows';
  for (let i = 0; payload.includes(`$${tag}$`); i += 1) tag = `stg_rows_${i}`;
  return `$${tag}$`;
}

/**
 * ONE statement that lands production's rows on the staging copy: insert, or overwrite on the primary key. Only the
 * columns BOTH sides have are written (a column production lacks keeps the copy's value, never becomes NULL);
 * `keep` columns are never written; account stamps are written as NULL. Returns null when there is nothing to copy.
 */
export function buildUpsertSql(spec: CopyTable, meta: TableMeta, rows: ReadonlyArray<Record<string, unknown>>): string | null {
  if (rows.length === 0) return null;
  const sourceCols = new Set(Object.keys(rows[0]!));
  const keep = new Set(spec.keep ?? []);
  const cols = meta.columns.filter((c) => sourceCols.has(c) && !keep.has(c)).map(ident);
  for (const pk of meta.primaryKey) {
    if (!cols.includes(pk)) throw new Error(`copy-catalog: ${spec.table}: production rows carry no primary-key column ${pk}`);
  }
  const stamps = new Set(
    Object.entries(meta.foreignKeys)
      .filter(([, target]) => ACCOUNT_TABLES.has(target.includes('.') ? target : `public.${target}`))
      .map(([c]) => c),
  );
  const table = `public.${ident(spec.table)}`;
  const payload = JSON.stringify(rows);
  const tag = dollarTag(payload);
  const select = cols.map((c) => (stamps.has(c) ? `NULL AS ${c}` : `r.${c}`)).join(', ');
  const updates = cols.filter((c) => !meta.primaryKey.includes(c)).map((c) => `${c} = EXCLUDED.${c}`);
  return [
    `INSERT INTO ${table} (${cols.join(', ')})`,
    `SELECT ${select} FROM json_populate_recordset(NULL::${table}, ${tag}${payload}${tag}::json) AS r`,
    `ON CONFLICT (${meta.primaryKey.map(ident).join(', ')}) ${updates.length ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING'};`,
  ].join('\n');
}
