'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchSchemaWithSharedGroups,
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

const FIELD_NAME_PREFIX = 'field__';

// Sample audio / video URL fields per the 2026-05-20 showcase-pattern lock
// (CLAUDE.md decision log): only YouTube + Vimeo URLs are accepted. The
// regex tolerates http/https + optional www + the canonical `youtube.com`,
// `youtu.be`, `youtube-nocookie.com`, `vimeo.com`, and `player.vimeo.com`
// embed hosts.
const YOUTUBE_VIMEO_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com)\//i;

function isSampleUrlField(fieldKey: string): boolean {
  return fieldKey.endsWith('_audio_urls') || fieldKey.endsWith('_video_urls');
}

type ParsedValueOk = { ok: true; value: unknown };
type ParsedValueErr = { ok: false; reason: string };
type ParsedValue = ParsedValueOk | ParsedValueErr;

function parseField(
  fieldKey: string,
  def: AttributeFieldDef,
  rawValues: FormDataEntryValue[],
): ParsedValue {
  // No values submitted = treated as unset / null. The visibility-gate
  // check later catches required-and-missing.
  if (rawValues.length === 0) return { ok: true, value: null };
  switch (def.type) {
    case 'boolean': {
      const hasOn = rawValues.some((v) => typeof v === 'string' && (v === 'on' || v === 'true'));
      return { ok: true, value: hasOn };
    }
    case 'int': {
      const raw = String(rawValues[0] ?? '').trim();
      if (raw === '') return { ok: true, value: null };
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        return { ok: false, reason: `${fieldKey}: must be a whole number` };
      }
      if (typeof def.min === 'number' && n < def.min) {
        return { ok: false, reason: `${fieldKey}: minimum is ${def.min}` };
      }
      if (typeof def.max === 'number' && n > def.max) {
        return { ok: false, reason: `${fieldKey}: maximum is ${def.max}` };
      }
      return { ok: true, value: n };
    }
    case 'text_short':
    case 'text_long': {
      const raw = String(rawValues[0] ?? '').trim();
      return { ok: true, value: raw === '' ? null : raw };
    }
    case 'enum': {
      const raw = String(rawValues[0] ?? '').trim();
      if (raw === '') return { ok: true, value: null };
      const allowed = (def.options ?? []) as readonly string[];
      if (!allowed.includes(raw)) {
        return { ok: false, reason: `${fieldKey}: invalid option "${raw}"` };
      }
      return { ok: true, value: raw };
    }
    case 'multi_select': {
      const allowed = new Set((def.options ?? []) as readonly string[]);
      const filtered: string[] = [];
      for (const v of rawValues) {
        if (typeof v !== 'string') continue;
        const trimmed = v.trim();
        if (!allowed.has(trimmed)) continue;
        if (filtered.includes(trimmed)) continue;
        filtered.push(trimmed);
      }
      return { ok: true, value: filtered.length > 0 ? filtered : null };
    }
    case 'multi_select_open': {
      // Freeform list — comma-separated input from the form, plus any
      // hidden inputs the client renders for pre-existing values.
      const out: string[] = [];
      const seen = new Set<string>();
      const isUrlField = isSampleUrlField(fieldKey);
      for (const v of rawValues) {
        if (typeof v !== 'string') continue;
        // Each form entry can itself be comma-separated.
        for (const piece of v.split(',')) {
          const trimmed = piece.trim().slice(0, 256);
          if (trimmed.length === 0) continue;
          if (isUrlField && !YOUTUBE_VIMEO_URL_RE.test(trimmed)) {
            return {
              ok: false,
              reason: `${fieldKey}: "${trimmed.slice(0, 60)}" is not a YouTube or Vimeo URL`,
            };
          }
          const lc = trimmed.toLowerCase();
          if (seen.has(lc)) continue;
          seen.add(lc);
          out.push(trimmed);
          if (out.length >= 50) break;
        }
        if (out.length >= 50) break;
      }
      return { ok: true, value: out.length > 0 ? out : null };
    }
    default: {
      // Unknown type — surface as null and let the form re-render with the
      // raw value preserved so the vendor doesn't lose work.
      return { ok: true, value: null };
    }
  }
}

function checkConditionalRequired(
  payload: Record<string, unknown>,
  def: AttributeFieldDef,
): boolean {
  // required_if format: "other_field=value" — true means this field is
  // required only when the other field equals the value. Per the spec § Schema.
  if (!def.required_if) return def.required === true;
  const [otherKey, expectedValue] = def.required_if.split('=');
  if (!otherKey) return false;
  const otherActual = payload[otherKey];
  if (Array.isArray(otherActual)) {
    return otherActual.includes(expectedValue ?? '');
  }
  return String(otherActual ?? '') === (expectedValue ?? '');
}

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

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
    return redirect('/login');
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
      const rawValues = formData.getAll(`${FIELD_NAME_PREFIX}${fieldKey}`);
      const parsed = parseField(fieldKey, def, rawValues);
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
      if (!checkConditionalRequired(payload, def)) continue;
      if (!isFieldFilled(payload[fieldKey])) {
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
    const stillMissing = minimumFields.filter((k) => !isFieldFilled(payload[k]));
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
        isFieldFilled(payload[k]),
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
