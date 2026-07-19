'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { servicesReturnBase } from '@/lib/vendor-services-return';
import {
  fetchSchemaWithSharedGroups,
  parseAttributeFieldValue,
  isAttributeFieldFilled,
  isChipRefinementType,
  computeAttributeCompleteness,
  ATTRIBUTE_FIELD_NAME_PREFIX,
} from '@/lib/vendor-service-attributes';

/**
 * Inline "refinement chips" writer for the fast service-card form.
 *
 * Refinements (a leaf's category-specific facets — shooting_style,
 * cuisine_specialties, …) live in `vendor_service_attributes`, keyed by
 * (vendor_profile_id, canonical_service). A `vendor_services.category` value
 * IS a canonical_service, so a service's category tells us exactly which
 * attribute row to touch.
 *
 * The full /vendor-dashboard/attributes tool submits EVERY field and replaces
 * the whole payload. This inline form only renders the CHIP-shaped fields
 * (multi_select / enum / boolean) — so it must MERGE, never replace: overlay
 * just the submitted chip keys onto the existing payload and leave the heavier
 * int / free-text fields (set in the full tool) untouched. Otherwise a quick
 * chip edit would silently wipe a vendor's carefully filled numbers.
 *
 * `refinement_keys` (comma-separated, emitted by the editor) is the authority
 * on which keys this submission owns. Each is re-validated against the live
 * schema AND re-checked to be chip-shaped before it can overwrite anything.
 */
export async function saveServiceRefinements(formData: FormData) {
  const canonicalService = String(formData.get('canonical_service') ?? '').trim();
  const base = await servicesReturnBase();
  if (!canonicalService) {
    return redirect(`${base}?error=${encodeURIComponent('Missing service category')}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/login?next=' + encodeURIComponent('/vendor-dashboard/shop'));
  }

  try {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return redirect('/vendor-dashboard?error=no_profile');

    // Full schema (category-specific + shared groups) — needed for parse defs,
    // completeness scoring, and the visibility-gate recompute so the numbers
    // stay identical to the full attributes tool.
    const schema = await fetchSchemaWithSharedGroups(supabase, canonicalService);
    if (!schema) {
      return redirect(
        `${base}?error=${encodeURIComponent(`No refinements for ${canonicalService}`)}`,
      );
    }

    // Existing payload — the merge base. A missing row = first fill.
    const { data: existingRow } = await supabase
      .from('vendor_service_attributes')
      .select('attribute_payload')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('canonical_service', canonicalService)
      .maybeSingle();
    const merged: Record<string, unknown> = {
      ...(((existingRow?.attribute_payload as Record<string, unknown>) ?? {})),
    };

    // The keys this submission is allowed to touch. Validated against the live
    // schema + restricted to chip-shaped types so a hand-crafted POST can't
    // reach in and clobber a non-chip field through this endpoint.
    const ownedKeys = String(formData.get('refinement_keys') ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const errors: string[] = [];
    for (const key of ownedKeys) {
      const def = schema.fields[key];
      if (!def || !isChipRefinementType(def.type)) continue;
      const rawValues = formData.getAll(`${ATTRIBUTE_FIELD_NAME_PREFIX}${key}`);
      const parsed = parseAttributeFieldValue(key, def, rawValues);
      if (!parsed.ok) {
        errors.push(parsed.reason);
        continue;
      }
      if (isAttributeFieldFilled(parsed.value)) {
        merged[key] = parsed.value;
      } else {
        delete merged[key];
      }
    }

    if (errors.length > 0) {
      return redirect(`${base}?error=${encodeURIComponent(errors.join('; '))}`);
    }

    // Recompute the visibility gate + completeness over the FULL merged payload
    // (not just the chips) so the listing-ready badge stays truthful.
    const minimumFields = schema.required_for_visibility.minimum_fields ?? [];
    const meetsVisibility = minimumFields.every((k) =>
      isAttributeFieldFilled(merged[k]),
    );
    const completeness = await computeAttributeCompleteness(
      supabase,
      merged,
      schema.fields,
    );

    const { error: upsertErr } = await supabase
      .from('vendor_service_attributes')
      .upsert(
        {
          vendor_profile_id: profile.vendor_profile_id,
          canonical_service: canonicalService,
          attribute_payload: merged,
          schema_version_at_fill: schema.schema_version,
          completeness_score: completeness,
          meets_visibility_minimum: meetsVisibility,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'vendor_profile_id,canonical_service' },
      );
    if (upsertErr) {
      return redirect(`${base}?error=${encodeURIComponent(upsertErr.message)}`);
    }

    revalidatePath('/vendor-dashboard/shop');
    revalidatePath('/vendor-dashboard/services');
    revalidatePath('/vendor-dashboard/attributes');
    return redirect(`${base}?saved=1`);
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    // eslint-disable-next-line no-console
    console.error('[saveServiceRefinements] unexpected throw', {
      canonical_service: canonicalService,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    const friendly = err instanceof Error ? err.message : 'unexpected error';
    return redirect(`${base}?error=${encodeURIComponent(friendly)}`);
  }
}

/** Next.js surfaces redirects by throwing `{ digest: 'NEXT_REDIRECT' }`; keep
 *  the try/catch from swallowing them. */
function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
