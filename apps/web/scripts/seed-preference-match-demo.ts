/**
 * scripts/seed-preference-match-demo.ts
 *
 * Companion to scripts/seed-demo-vendors.ts — proves the Layer-B "matches your
 * preference" float (lib/preference-match.ts) end-to-end against demo data.
 *
 * WHAT IT DOES
 * ------------
 * seed-demo-vendors.ts writes the VENDOR half of the match — facet payloads in
 * `vendor_service_attributes` (cuisine_specialties, dietary_accommodations,
 * shooting_style, …). This script writes the COUPLE half: one
 * `event_vendor_preferences` row whose attribute_payload is hand-built to
 * OVERLAP the most common facet values the demo vendors actually carry. With
 * both halves present, browsing that event's vendor matcher floats the
 * overlapping demo vendors up and renders the "Matches your preference" badge
 * (Sparkles) on their cards.
 *
 * It does NOT invent facet vocabulary. It reads the demo vendors' real payloads,
 * frequency-ranks the facet values per dimension, and picks the top values — so
 * the seeded preference is guaranteed to match a large slice of the pool.
 *
 * WHY a separate script
 * ---------------------
 * The match is INERT in production (founder-only marketplace ·
 * vendor_service_attributes is empty), so there is no live data to demo against.
 * This makes the proof reproducible in any test/staging env: run the vendor seed,
 * run this, browse the matcher.
 *
 * SAFETY
 * ------
 * Reuses isNonProdUrl from seed-demo-vendors.ts — refuses to run against the prod
 * project ref. event_vendor_preferences is host-or-admin RLS; the service-role
 * client bypasses RLS exactly like the vendor seed. Writes exactly ONE row
 * (idempotent upsert on the (event_id, canonical_service) PK).
 *
 * USAGE
 * -----
 *   # 1. Seed demo vendors first (writes vendor_service_attributes):
 *   pnpm -F @setnayan/web exec tsx scripts/seed-demo-vendors.ts
 *
 *   # 2. Seed a matching couple preference (auto-picks the best service + a
 *   #    real event, then writes the overlapping preference):
 *   pnpm -F @setnayan/web exec tsx scripts/seed-preference-match-demo.ts
 *
 *   # Target a specific event / service, or just preview:
 *   pnpm -F @setnayan/web exec tsx scripts/seed-preference-match-demo.ts --event=<uuid>
 *   pnpm -F @setnayan/web exec tsx scripts/seed-preference-match-demo.ts --service=catering
 *   pnpm -F @setnayan/web exec tsx scripts/seed-preference-match-demo.ts --dry-run
 *
 * ENV (same as seed-demo-vendors.ts)
 * ----------------------------------
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) — target Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY                  — service-role; bypasses RLS
 */

import { createClient } from '@supabase/supabase-js';
import { isNonProdUrl } from './seed-demo-vendors';

// ===========================================================================
// ARGS
// ===========================================================================

type Args = {
  eventId: string | null;
  service: string | null;
  dims: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const hit = argv.find((a) => a.startsWith(`${flag}=`));
    return hit ? hit.slice(flag.length + 1) : null;
  };
  const dimsRaw = get('--dims');
  return {
    eventId: get('--event'),
    service: get('--service'),
    dims: dimsRaw ? Math.max(1, Math.min(4, Number(dimsRaw) || 2)) : 2,
    dryRun: argv.includes('--dry-run'),
  };
}

// ===========================================================================
// FACET HEURISTICS — what counts as a matchable preference dimension
// ===========================================================================

// Freeform keys are not facets — they never overlap meaningfully.
const FREEFORM_KEY = /blurb|bio|notes|note|description|about|summary|message|story/i;

/** Tokens from a payload value: array facets, or a short scalar token. */
function tokensOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 40);
  }
  if (typeof value === 'string' && value.length > 0 && value.length <= 40) return [value];
  return [];
}

type DimStat = {
  /** distinct vendor_profile_ids carrying ≥1 token for this dimension. */
  vendorCoverage: Set<string>;
  /** token → number of vendors carrying it. */
  valueFreq: Map<string, number>;
};

// ===========================================================================
// MAIN
// ===========================================================================

type AttrRow = {
  vendor_profile_id: string;
  canonical_service: string;
  attribute_payload: Record<string, unknown> | null;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '\nMissing env. Set:\n' +
        '  SUPABASE_URL=https://<project>.supabase.co\n' +
        '  SUPABASE_SERVICE_ROLE_KEY=<service-role-key>\n',
    );
    process.exit(2);
  }
  if (!isNonProdUrl(supabaseUrl)) {
    console.error(
      '\nREFUSING TO RUN against the prod project ref. This demo seed is for ' +
        'test/staging only (the live marketplace is founder-only — no demo vendor ' +
        'facets to match). Point SUPABASE_URL at a test/staging project.\n',
    );
    process.exit(2);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('\n--- Setnayan preference-match demo seed ---');
  console.log(`Target: ${supabaseUrl}`);
  console.log(`Mode: ${args.dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`);

  // 1. Pull demo-vendor facet payloads (capped sample is plenty to rank values).
  let attrQuery = admin
    .from('vendor_service_attributes')
    .select('vendor_profile_id, canonical_service, attribute_payload')
    .limit(8000);
  if (args.service) attrQuery = attrQuery.eq('canonical_service', args.service);

  const { data: attrData, error: attrErr } = await attrQuery;
  if (attrErr) {
    if (attrErr.code === '42P01') {
      console.error(
        '\nvendor_service_attributes does not exist on this DB (iteration 0044 migration not applied).\n',
      );
      process.exit(1);
    }
    console.error(`\nFailed to read vendor_service_attributes: ${attrErr.message}\n`);
    process.exit(1);
  }
  const rows = (attrData ?? []) as AttrRow[];
  if (rows.length === 0) {
    console.error(
      '\nNo vendor_service_attributes rows found. Run scripts/seed-demo-vendors.ts first ' +
        '(it writes the vendor-side facet payloads this script matches against).\n',
    );
    process.exit(1);
  }

  // 2. Aggregate facet stats per service → per dimension.
  const byService = new Map<string, Map<string, DimStat>>();
  for (const row of rows) {
    const svc = row.canonical_service;
    const payload = row.attribute_payload ?? {};
    let dims = byService.get(svc);
    if (!dims) {
      dims = new Map<string, DimStat>();
      byService.set(svc, dims);
    }
    for (const [key, value] of Object.entries(payload)) {
      if (FREEFORM_KEY.test(key)) continue;
      const tokens = tokensOf(value);
      if (tokens.length === 0) continue;
      let stat = dims.get(key);
      if (!stat) {
        stat = { vendorCoverage: new Set(), valueFreq: new Map() };
        dims.set(key, stat);
      }
      stat.vendorCoverage.add(row.vendor_profile_id);
      for (const t of tokens) stat.valueFreq.set(t, (stat.valueFreq.get(t) ?? 0) + 1);
    }
  }

  // 3. Pick the service with the richest matchable facets (most covered dims).
  const scoreService = (dims: Map<string, DimStat>): number =>
    [...dims.values()].reduce((acc, s) => acc + s.vendorCoverage.size, 0);

  let chosenService = args.service;
  if (!chosenService) {
    let best = -1;
    for (const [svc, dims] of byService) {
      const score = scoreService(dims);
      if (score > best) {
        best = score;
        chosenService = svc;
      }
    }
  }
  if (!chosenService || !byService.has(chosenService)) {
    console.error(`\nNo matchable facet dimensions found${args.service ? ` for service "${args.service}"` : ''}.\n`);
    process.exit(1);
  }
  const chosenDims = byService.get(chosenService)!;

  // 4. Build the couple preference: top `dims` dimensions by vendor coverage,
  //    top 2 values each (most common → guaranteed broad overlap).
  const rankedDims = [...chosenDims.entries()]
    .sort((a, b) => b[1].vendorCoverage.size - a[1].vendorCoverage.size)
    .slice(0, args.dims);

  const preference: Record<string, string[]> = {};
  for (const [dim, stat] of rankedDims) {
    const topValues = [...stat.valueFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([v]) => v);
    if (topValues.length > 0) preference[dim] = topValues;
  }
  if (Object.keys(preference).length === 0) {
    console.error(`\nNo usable facet values for "${chosenService}".\n`);
    process.exit(1);
  }

  // 5. Count vendors that WILL match (overlap ≥1 dimension) — the proof number.
  const prefSets = new Map<string, Set<string>>(
    Object.entries(preference).map(([d, vs]) => [d, new Set(vs)]),
  );
  const vendorPayloads = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (row.canonical_service !== chosenService) continue;
    const merged = vendorPayloads.get(row.vendor_profile_id) ?? {};
    Object.assign(merged, row.attribute_payload ?? {});
    vendorPayloads.set(row.vendor_profile_id, merged);
  }
  let willMatch = 0;
  for (const payload of vendorPayloads.values()) {
    let overlaps = false;
    for (const [dim, allowed] of prefSets) {
      const vendorTokens = new Set(tokensOf(payload[dim]));
      if ([...allowed].some((v) => vendorTokens.has(v))) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) willMatch += 1;
  }

  // 6. Resolve the target event.
  let eventId = args.eventId;
  let eventLabel = '(provided)';
  if (!eventId) {
    const { data: evData, error: evErr } = await admin
      .from('events')
      .select('event_id, display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(40);
    if (evErr) {
      console.error(`\nFailed to read events: ${evErr.message}\n`);
      process.exit(1);
    }
    const pick = (evData ?? []).find(
      (e) => !String((e as { display_name?: string }).display_name ?? '').startsWith('TEST-REVIEW'),
    ) as { event_id: string; display_name?: string } | undefined;
    if (!pick) {
      console.error(
        '\nNo real event found to attach the preference to. Pass --event=<uuid> ' +
          '(create an event in the app first, or use an existing one).\n',
      );
      process.exit(1);
    }
    eventId = pick.event_id;
    eventLabel = pick.display_name ?? '(unnamed)';
  }

  // 7. Report + write.
  console.log(`\nChosen service:  ${chosenService}`);
  console.log(`Target event:    ${eventId}  ${eventLabel}`);
  console.log(`Preference payload (couple side):`);
  for (const [dim, vals] of Object.entries(preference)) {
    const cov = chosenDims.get(dim)?.vendorCoverage.size ?? 0;
    console.log(`  • ${dim}: [${vals.join(', ')}]   (covers ${cov} demo vendors)`);
  }
  console.log(
    `\nDemo vendors offering "${chosenService}": ${vendorPayloads.size} · ` +
      `will show "Matches your preference": ${willMatch}`,
  );

  if (args.dryRun) {
    console.log('\n(dry-run: no write performed)\n');
    return;
  }

  const { error: upErr } = await admin.from('event_vendor_preferences').upsert(
    {
      event_id: eventId,
      canonical_service: chosenService,
      attribute_payload: preference,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,canonical_service' },
  );
  if (upErr) {
    if (upErr.code === '42P01') {
      console.error(
        '\nevent_vendor_preferences does not exist (migration 20260721000000 not applied).\n',
      );
      process.exit(1);
    }
    console.error(`\nUpsert failed: ${upErr.message}\n`);
    process.exit(1);
  }

  console.log(
    `\n=== Done ===\n` +
      `Wrote 1 event_vendor_preferences row.\n` +
      `Browse the matcher for event ${eventId}, category "${chosenService}" — the ` +
      `${willMatch} overlapping demo vendors float up with the "Matches your preference" badge.\n`,
  );
}

main().catch((err) => {
  console.error('\nFATAL:', err?.message ?? err);
  process.exit(1);
});
