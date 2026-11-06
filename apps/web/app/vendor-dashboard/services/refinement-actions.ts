'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { servicesReturnBase } from '@/lib/vendor-services-return';
import { fetchSchemaWithSharedGroups } from '@/lib/vendor-service-attributes';
import { mergeServiceRefinements } from '@/lib/vendor-service-refinements-write';

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

    // The one merge — shared with the maker's one save (lib/vendor-service-refinements-write.ts). A kind with no
    // refinements schema is said, as before, rather than "saved".
    const schema = await fetchSchemaWithSharedGroups(supabase, canonicalService);
    if (!schema) {
      return redirect(
        `${base}?error=${encodeURIComponent(`No refinements for ${canonicalService}`)}`,
      );
    }
    const mergeErr = await mergeServiceRefinements(
      supabase,
      profile.vendor_profile_id,
      canonicalService,
      formData,
      schema,
    );
    if (mergeErr) {
      return redirect(`${base}?error=${encodeURIComponent(mergeErr)}`);
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
