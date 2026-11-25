/**
 * THE STAGING SEED'S PURE CORE — the target guard, the settings preamble and the summary query.
 *
 * `seed.ts` (the runner) and the CI proof (apps/web/tests/db/the-staging-seed-runs-clean.db.test.ts) both build the
 * SQL they run from here, so the proof runs the same statements the controller runs: the only difference is the
 * transport (psql against a Supabase branch, or PGlite against the replayed schema).
 *
 * No I/O and no dependency beyond the account list, so every rule is unit-tested (apps/web/lib/staging-kit.test.ts).
 */
import { PRODUCTION_SUPABASE_REF } from '../../apps/web/lib/staging-locks';
import { TOURS_SEEN } from '../../apps/web/tests/rehearsal/fixture';
import { TERMS_VERSION } from '../../apps/web/lib/terms-agreement';
import type { StagingAccountKey } from './accounts';

export { PRODUCTION_SUPABASE_REF };

const LOOPBACK: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/**
 * The Supabase project ref a URL points at, or null when it names none:
 *   https://<ref>.supabase.co                     (API)
 *   postgresql://…@db.<ref>.supabase.co:5432/…    (direct database)
 *   postgresql://postgres.<ref>:…@…pooler.supabase.com:6543/…   (pooler: the ref rides in the user name)
 */
export function supabaseRefOf(value: string): string | null {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const api = /^([a-z0-9]{20})\.supabase\.(co|in)$/.exec(host);
  if (api) return api[1]!;
  const direct = /^db\.([a-z0-9]{20})\.supabase\.(co|in)$/.exec(host);
  if (direct) return direct[1]!;
  if (/\.pooler\.supabase\.com$/.test(host)) {
    const user = /^[a-z_]+\.([a-z0-9]{20})$/.exec(decodeURIComponent(u.username).toLowerCase());
    if (user) return user[1]!;
  }
  return null;
}

/** The `ref` claim of a legacy Supabase JWT key (no signature check — this only refuses), or null. */
export function jwtRefOf(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { ref?: unknown };
    return typeof payload.ref === 'string' ? payload.ref : null;
  } catch {
    return null;
  }
}

export type StagingTarget = { ok: true; ref: string | null; local: boolean } | { ok: false; why: string };

/**
 * ⛔ May the kit WRITE to this target? Only when:
 *   · `STAGING` is exactly `1` (a writer reads narrow; the locks read wide);
 *   · every URL given names a Supabase project that is NOT production — or is this machine (a local stack);
 *   · the database and the API name the SAME project (no "API at one, database at another");
 *   · a legacy JWT service key, if given, was not minted for production.
 * A URL whose project cannot be read is refused: an unknown shape is never assumed safe.
 */
export function stagingTarget(input: {
  staging: string | undefined;
  dbUrl: string;
  apiUrl?: string;
  serviceKey?: string;
}): StagingTarget {
  if (input.staging !== '1') return { ok: false, why: 'STAGING=1 is not set — the staging kit writes only to a staging copy' };
  const refs: string[] = [];
  let local = true;
  for (const [what, url] of [['the database URL', input.dbUrl], ['the API URL', input.apiUrl]] as const) {
    if (url === undefined) continue;
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return { ok: false, why: `${what} is not a URL` };
    }
    if (LOOPBACK.has(host)) continue;
    local = false;
    const ref = supabaseRefOf(url);
    if (!ref) return { ok: false, why: `${what} (host "${host}") names no Supabase project — refused rather than guessed` };
    if (ref === PRODUCTION_SUPABASE_REF) return { ok: false, why: `${what} is PRODUCTION (${ref}) — the staging kit never writes there` };
    refs.push(ref);
  }
  if (new Set(refs).size > 1) return { ok: false, why: `the database and the API name different projects (${[...new Set(refs)].join(' vs ')})` };
  if (input.serviceKey) {
    const keyRef = jwtRefOf(input.serviceKey);
    if (keyRef === PRODUCTION_SUPABASE_REF) return { ok: false, why: 'the service key was minted for PRODUCTION' };
    if (keyRef && refs[0] && keyRef !== refs[0]) return { ok: false, why: `the service key is for ${keyRef}, the target is ${refs[0]}` };
  }
  return { ok: true, ref: refs[0] ?? null, local };
}

/** A SQL string literal. */
export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** The repo's own placeholder cover (the rehearsal fixture's), when the controller names no picture. */
export const DEFAULT_COVER = 'r2://media/test-fixtures/service-cover.webp';

/** The settings `seed.sql` reads — one statement, run in the same session just before it. */
export function seedSettingsSql(input: {
  accounts: Record<StagingAccountKey, string>;
  cover?: string;
  termsVersion?: string;
  toursSeen?: readonly string[];
}): string {
  const tours = `{${(input.toursSeen ?? TOURS_SEEN).join(',')}}`;
  return [
    'SELECT',
    `  set_config('staging.accounts', ${sqlLiteral(JSON.stringify(input.accounts))}, false),`,
    `  set_config('staging.terms_version', ${sqlLiteral(input.termsVersion ?? TERMS_VERSION)}, false),`,
    `  set_config('staging.tours_seen', ${sqlLiteral(tours)}, false),`,
    `  set_config('staging.cover', ${sqlLiteral(input.cover ?? DEFAULT_COVER)}, false);`,
  ].join('\n');
}

/**
 * What the seed made — ONE JSON value (counts, the events each checker starts from, the guest links), printed into
 * the run log and written next to the passwords in accounts.local.json. Read-only.
 */
export const SEED_SUMMARY_SQL = `
SELECT json_build_object(
  'counts', json_build_object(
    'events',        (SELECT count(*) FROM public.events WHERE slug LIKE 'stg-%'),
    'guests',        (SELECT count(*) FROM public.guests g JOIN public.events e USING (event_id) WHERE e.slug LIKE 'stg-%'),
    'shops',         (SELECT count(*) FROM public.vendor_profiles WHERE tagline LIKE 'Staging sample shop%'),
    'cards',         (SELECT count(*) FROM public.vendor_services s JOIN public.vendor_profiles p USING (vendor_profile_id) WHERE p.tagline LIKE 'Staging sample shop%'),
    'bookings',      (SELECT count(*) FROM public.event_vendors v JOIN public.events e USING (event_id) WHERE e.slug LIKE 'stg-%'),
    'chat_threads',  (SELECT count(*) FROM public.chat_threads t JOIN public.events e USING (event_id) WHERE e.slug LIKE 'stg-%'),
    'chat_messages', (SELECT count(*) FROM public.chat_messages m JOIN public.events e USING (event_id) WHERE e.slug LIKE 'stg-%'),
    'tables',        (SELECT count(*) FROM public.event_tables t JOIN public.events e USING (event_id) WHERE e.slug LIKE 'stg-%'),
    'seated',        (SELECT count(*) FROM public.event_seat_assignments a JOIN public.events e USING (event_id) WHERE e.slug LIKE 'stg-%'),
    'orders',        (SELECT count(*) FROM public.orders o JOIN public.events e USING (event_id) WHERE e.slug LIKE 'stg-%'),
    'payments',      (SELECT count(*) FROM public.event_vendor_payments p JOIN public.events e USING (event_id) WHERE e.slug LIKE 'stg-%')
  ),
  'events', (SELECT json_agg(json_build_object('slug', slug, 'event_id', event_id, 'type', event_type, 'name', display_name, 'date', event_date) ORDER BY slug)
               FROM public.events WHERE slug LIKE 'stg-%'),
  'guest_links', (SELECT json_agg(x ORDER BY x->>'rsvp', x->>'invited')
                    FROM (SELECT DISTINCT ON (g.rsvp_status, g.invitation_sent_at IS NULL, g.rsvp_set_by)
                                 json_build_object('event', e.slug, 'guest', g.first_name || ' ' || g.last_name,
                                                   'rsvp', g.rsvp_status, 'set_by', g.rsvp_set_by,
                                                   'invited', g.invitation_sent_at IS NOT NULL, 'qr_token', g.qr_token) AS x
                            FROM public.guests g JOIN public.events e USING (event_id)
                           WHERE e.slug = 'stg-bea-paolo' AND g.role = 'guest' AND g.qr_token IS NOT NULL AND g.plus_one_of_guest_id IS NULL
                           ORDER BY g.rsvp_status, g.invitation_sent_at IS NULL, g.rsvp_set_by, g.last_name) d)
) AS summary;`;

/** The counts the CI proof holds the seed to — the floor each area needs to have something to press. */
export const SEED_FLOOR = {
  events: 9,
  guests: 1000,
  shops: 15,
  bookings: 20,
  chat_threads: 10,
  chat_messages: 60,
  tables: 50,
  seated: 200,
  orders: 6,
  payments: 3,
} as const;
