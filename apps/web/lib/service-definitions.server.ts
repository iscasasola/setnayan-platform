import 'server-only';

/**
 * service-definitions.server.ts — the READER every service ⓘ uses (plan Track D, item D4).
 *
 * One read per request (`cache()`), sparse: `canonical_service_schemas` rows whose `hint_en` is written. The
 * sign-up picker and the card maker pass the map (or one line) to their client components; see the pure half,
 * `service-definitions.ts`, for the rule "no definition = no ⓘ".
 *
 *   const defs = await getServiceDefinitions();           // the whole sparse map, for a list of services
 *   const line = await serviceDefinition('photographer'); // one service — null = draw no ⓘ
 *
 * 🔒 FAILS TO "NO ⓘ", NEVER TO A WRONG ONE. An ⓘ is optional words, not data the person acts on, so a refused
 * read (e.g. a build running ahead of its migration) leaves every service without an ⓘ — which is exactly what an
 * unwritten definition looks like, and claims nothing untrue. The refusal is logged server-side.
 *
 * Read with the request's own client (public read policy `canonical_service_schemas_read_all` covers anon), so a
 * signed-out supplier on the sign-up door gets the same lines.
 */
import { cache } from 'react';

import { createClient } from './supabase/server';
import { serviceDefinitionIn, serviceDefinitionsFromRows, type ServiceDefinitions } from './service-definitions';

export type { ServiceDefinitions } from './service-definitions';

export const getServiceDefinitions = cache(async (): Promise<ServiceDefinitions> => {
  try {
    const sb = await createClient();
    const { data, error } = await sb.from('canonical_service_schemas').select('canonical_service, hint_en').not('hint_en', 'is', null);
    if (error) {
      console.error('[service-definitions] the ⓘ lines could not be read; every service shows no ⓘ', error.message);
      return {};
    }
    return serviceDefinitionsFromRows(data as Array<{ canonical_service: string | null; hint_en: string | null }> | null);
  } catch (e) {
    console.error('[service-definitions] the ⓘ lines could not be read; every service shows no ⓘ', e);
    return {};
  }
});

/** The one-line ⓘ of one service, or `null` (not written → draw no ⓘ). Shares the request's single read. */
export async function serviceDefinition(key: string): Promise<string | null> {
  return serviceDefinitionIn(await getServiceDefinitions(), key);
}
