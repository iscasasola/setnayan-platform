'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VENDOR_CATEGORIES } from '@/lib/vendors';

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function nonBlank(raw: FormDataEntryValue | null, max = 128): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, max);
}

const SLUG_RE = /^[a-z0-9-]{3,32}$/;

function parseSlug(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const lowered = raw.trim().toLowerCase();
  if (lowered.length === 0) return null;
  if (!SLUG_RE.test(lowered)) {
    throw new Error('Slug must be 3–32 chars: lowercase letters, numbers, hyphens.');
  }
  return lowered;
}

const CANONICAL_SERVICE_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

function parseServices(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    // Canonical entries — keep the enum key verbatim.
    if (CANONICAL_SERVICE_SET.has(item)) {
      if (seen.has(item)) continue;
      seen.add(item);
      out.push(item);
      continue;
    }
    // Custom entry — trim, length-check, dedupe case-insensitively.
    const trimmed = item.trim().slice(0, 48);
    if (trimmed.length === 0) continue;
    const lc = trimmed.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(trimmed);
    if (out.length >= 24) break;
  }
  return out;
}

export async function saveVendorProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let business_slug: string | null;
  try {
    business_slug = parseSlug(formData.get('business_slug'));
  } catch (e) {
    return redirect(
      `/vendor-dashboard?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  const payload = {
    business_name: nonBlank(formData.get('business_name'), 128),
    business_slug,
    tagline: nullIfBlank(formData.get('tagline')),
    logo_url: nullIfBlank(formData.get('logo_url')),
    services: parseServices(formData.get('services')),
    location_city: nullIfBlank(formData.get('location_city')),
    website: nullIfBlank(formData.get('website')),
    contact_email: nullIfBlank(formData.get('contact_email')),
    contact_phone: nullIfBlank(formData.get('contact_phone')),
    is_published: formData.get('is_published') === 'on',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('vendor_profiles')
    .update(payload)
    .eq('user_id', user.id);

  if (error) {
    return redirect(
      `/vendor-dashboard?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard');
  redirect('/vendor-dashboard?saved=1');
}
