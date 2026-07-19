'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchSchemaWithSharedGroups,
  parseAttributeFieldValue,
  checkAttributeConditionalRequired,
  isAttributeFieldFilled,
  ATTRIBUTE_FIELD_NAME_PREFIX,
  type ResolvedSchema,
} from '@/lib/vendor-service-attributes';
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';

/**
 * Iteration 0044 — vendor attribute payload writer.
 *
 * The action receives a FormData submission from
 * /vendor-dashboard/attributes/_components/attribute-form.tsx. It:
 *
 *   1. Authenticates the vendor (their vendor_profile_id is the upsert key).
 *   2. Resolves the canonical_service_schemas row + shared_attribute_groups
 *      so we know the field shape we're parsing into.
 *   3. Parses every FormData value against the field's declared type
 *      (boolean / int / text / enum / multi_select / multi_select_open).
 *   4. Validates required + required_if + min constraints with friendly
 *      errors returned via the URL query param.
 *   5. Upserts vendor_service_attributes (composite PK
 *      vendor_profile_id × canonical_service).
 *   6. Asks the SQL helper `public.compute_attribute_completeness` to
 *      recompute the 0-100 completeness score from the new payload + the
 *      schema, writes it back into the row, and updates
 *      meets_visibility_minimum.
 *
 * The completeness math lives in SQL so admin queries and triggers can
 * call it directly (per the helper comment in migration 20260521010000).
 */

// Attribute-field parsing/validation helpers (parseAttributeFieldValue,
// checkAttributeConditionalRequired, isAttributeFieldFilled, the field-name
// prefix + URL regex) now live in @/lib/vendor-service-attributes so the fast
// service-card form's inline refinement chips share the exact same semantics.

export async function saveVendorServiceAttribute(formData: FormData) {
  const canonicalService = String(formData.get('canonical_service') ?? '').trim();
  if (!canonicalService) {
    return redirect('/vendor-dashboard/attributes?error=missing_canonical_service');
  }

  // Clean auth check — explicit /login redirect when unauthenticated rather
  // than the IIFE-then-no-profile-redirect path the original draft used.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Preserve the destination via ?next= so re-auth lands the vendor
    // back on the attributes form, not on the customer dashboard. Bare
    // redirect('/login') was the bug #9 pattern caught in the sweep.
    return redirect(
      '/login?next=' + encodeURIComponent('/vendor-dashboard/attributes'),
    );
  }

  // Everything below talks to Postgres. Wrap the lot in try/catch so any
  // unexpected throw (Supabase outage, RLS edge, RPC arg-shape mismatch,
  // schema_version conflict) renders a friendly inline banner instead of
  // crashing the page with a generic Next.js 5xx digest.
  try {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) {
      return redirect('/vendor-dashboard?error=no_profile');
    }

    const schema = await fetchSchemaWithSharedGroups(supabase, canonicalService);
    if (!schema) {
      return redirect(
        `/vendor-dashboard/attributes?error=${encodeURIComponent(`Unknown service: ${canonicalService}`)}`,
      );
    }

    // Parse every field from the form against its declared type.
    const payload: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const [fieldKey, def] of Object.entries(schema.fields)) {
      const rawValues = formData.getAll(`${ATTRIBUTE_FIELD_NAME_PREFIX}${fieldKey}`);
      const parsed = parseAttributeFieldValue(fieldKey, def, rawValues);
      if (!parsed.ok) {
        errors.push(parsed.reason);
        continue;
      }
      if (parsed.value !== null && parsed.value !== undefined) {
        payload[fieldKey] = parsed.value;
      }
    }

    // Required + required_if check — fire after the full pass so we can read
    // the parsed payload for required_if conditions.
    for (const [fieldKey, def] of Object.entries(schema.fields)) {
      if (!checkAttributeConditionalRequired(payload, def)) continue;
      if (!isAttributeFieldFilled(payload[fieldKey])) {
        errors.push(`${fieldKey}: required`);
      }
    }

    if (errors.length > 0) {
      return redirect(
        `/vendor-dashboard/attributes?error=${encodeURIComponent(errors.join('; '))}&service=${encodeURIComponent(canonicalService)}`,
      );
    }

    // Visibility gate check + per-field missing detail surfaced via the
    // ?missing= query param so the page can highlight exactly which
    // minimum_fields the vendor still owes for marketplace listing.
    const minimumFields = schema.required_for_visibility.minimum_fields ?? [];
    const stillMissing = minimumFields.filter((k) => !isAttributeFieldFilled(payload[k]));
    const meetsVisibility = stillMissing.length === 0;

    // Use the SQL helper for the 0-100 completeness score so the math stays
    // consistent with admin queries that call it directly. If the RPC
    // errors (unlikely but possible on schema_version drift), fall back to
    // a JS-side calculation: filled / total fields.
    let completeness = 0;
    const { data: scoreRow, error: scoreErr } = await supabase.rpc(
      'compute_attribute_completeness',
      {
        payload,
        schema: schema.fields as unknown as Record<string, AttributeFieldDef>,
      },
    );
    if (!scoreErr && typeof scoreRow === 'number' && Number.isFinite(scoreRow)) {
      completeness = Math.max(0, Math.min(100, Math.round(scoreRow)));
    } else {
      // JS-side fallback: count filled fields against total schema fields.
      // Mirrors the SQL helper's definition (non-null + non-empty arrays /
      // strings count as filled).
      const totalFields = Object.keys(schema.fields).length;
      const filledFields = Object.keys(schema.fields).filter((k) =>
        isAttributeFieldFilled(payload[k]),
      ).length;
      completeness =
        totalFields === 0 ? 0 : Math.round((filledFields * 100) / totalFields);
    }

    const { error: upsertErr } = await supabase.from('vendor_service_attributes').upsert(
      {
        vendor_profile_id: profile.vendor_profile_id,
        canonical_service: canonicalService,
        attribute_payload: payload,
        schema_version_at_fill: schema.schema_version,
        completeness_score: completeness,
        meets_visibility_minimum: meetsVisibility,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vendor_profile_id,canonical_service' },
    );

    if (upsertErr) {
      return redirect(
        `/vendor-dashboard/attributes?error=${encodeURIComponent(upsertErr.message)}&service=${encodeURIComponent(canonicalService)}`,
      );
    }

    revalidatePath('/vendor-dashboard/attributes');
    const missingParam = stillMissing.length > 0
      ? `&missing=${encodeURIComponent(stillMissing.join(','))}`
      : '';
    redirect(
      `/vendor-dashboard/attributes?saved=${encodeURIComponent(canonicalService)}${missingParam}#${encodeURIComponent(canonicalService)}`,
    );
  } catch (err) {
    // Next.js `redirect()` works by throwing — `isRedirectError` filters
    // those out so we don't accidentally swallow them as application errors.
    // Anything else gets console.error'd for Sentry pickup + redirected
    // with a friendly inline message.
    if (isNextRedirectError(err)) {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.error('[saveVendorServiceAttribute] unexpected throw', {
      canonical_service: canonicalService,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    const friendly = err instanceof Error ? err.message : 'unexpected error';
    return redirect(
      `/vendor-dashboard/attributes?error=${encodeURIComponent(friendly)}&service=${encodeURIComponent(canonicalService)}`,
    );
  }
}

/**
 * Detect Next.js's internal "redirect happened" thrown error so the try/catch
 * wrapping the action's main body doesn't accidentally swallow it. Next.js
 * surfaces redirects by throwing an object with `digest: 'NEXT_REDIRECT'`.
 */
function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

export async function removeVendorServiceAttribute(formData: FormData) {
  const canonicalService = String(formData.get('canonical_service') ?? '').trim();
  if (!canonicalService) {
    return redirect('/vendor-dashboard/attributes?error=missing_canonical_service');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/login');
  }

  try {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) {
      return redirect('/vendor-dashboard?error=no_profile');
    }

    const { error } = await supabase
      .from('vendor_service_attributes')
      .delete()
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('canonical_service', canonicalService);
    if (error) {
      return redirect(
        `/vendor-dashboard/attributes?error=${encodeURIComponent(error.message)}`,
      );
    }

    revalidatePath('/vendor-dashboard/attributes');
    redirect('/vendor-dashboard/attributes?removed=1');
  } catch (err) {
    if (isNextRedirectError(err)) {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.error('[removeVendorServiceAttribute] unexpected throw', {
      canonical_service: canonicalService,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    const friendly = err instanceof Error ? err.message : 'unexpected error';
    return redirect(
      `/vendor-dashboard/attributes?error=${encodeURIComponent(friendly)}`,
    );
  }
}
