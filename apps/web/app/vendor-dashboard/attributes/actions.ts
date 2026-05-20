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
      for (const v of rawValues) {
        if (typeof v !== 'string') continue;
        // Each form entry can itself be comma-separated.
        for (const piece of v.split(',')) {
          const trimmed = piece.trim().slice(0, 80);
          if (trimmed.length === 0) continue;
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

  const supabase = await createClient();
  const profile = await fetchOwnVendorProfile(supabase, await (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? '';
  })());
  if (!profile) {
    return redirect('/vendor-dashboard?error=no_profile');
  }

  let schema: ResolvedSchema | null;
  try {
    schema = await fetchSchemaWithSharedGroups(supabase, canonicalService);
  } catch (e) {
    return redirect(
      `/vendor-dashboard/attributes?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  if (!schema) {
    return redirect(
      `/vendor-dashboard/attributes?error=unknown_service&service=${encodeURIComponent(canonicalService)}`,
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

  // Compute visibility-minimum check inline so we can stamp the row's flag.
  const minimumFields = schema.required_for_visibility.minimum_fields ?? [];
  const meetsVisibility = minimumFields.every((k) => isFieldFilled(payload[k]));

  // Use the SQL helper for the 0-100 completeness score so the math stays
  // consistent with admin queries that call it directly.
  const { data: scoreRow, error: scoreErr } = await supabase.rpc(
    'compute_attribute_completeness',
    {
      payload,
      schema: schema.fields as unknown as Record<string, AttributeFieldDef>,
    },
  );
  const completeness =
    !scoreErr && typeof scoreRow === 'number' && Number.isFinite(scoreRow)
      ? Math.max(0, Math.min(100, Math.round(scoreRow)))
      : 0;

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
  redirect(
    `/vendor-dashboard/attributes?saved=${encodeURIComponent(canonicalService)}#${encodeURIComponent(canonicalService)}`,
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
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user!.id);
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
}
