'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  vercelDomainsConfigured,
  addProjectDomain,
  getProjectDomain,
  verifyProjectDomain,
  removeProjectDomain,
  type VercelDomain,
} from '@/lib/vercel-domains';
import { isSetnayanHost } from '@/lib/custom-domain-resolve';

// ── Custom-domain management for the vendor's public page (PR8) ───────────────
// A vendor points their own domain (e.g. sny.theirshop.com) at Setnayan. The
// add step inserts an UNVERIFIED row (the DB guard trigger forbids a self-service
// writer setting verified_at) and registers the domain on the Vercel project.
// The verify step confirms with Vercel, then stamps verified_at via the ADMIN
// (service-role) client — the only writer the guard trigger allows.

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export type DomainRow = {
  domain_id: string;
  domain: string;
  verified: boolean;
};

export type DomainActionResult = {
  ok: boolean;
  error?: string;
  domainId?: string;
  domain?: string;
  // DNS the owner must add (routing CNAME + any Vercel ownership TXT records).
  dns?: { type: string; name: string; value: string }[];
  verified?: boolean;
};

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

function validate(domain: string): string | null {
  if (!domain) return 'Enter a domain, e.g. sny.yourshop.com';
  if (!HOSTNAME_RE.test(domain)) return 'That doesn’t look like a valid domain.';
  if (isSetnayanHost(domain)) return 'That’s a Setnayan domain — use one you own.';
  return null;
}

/** CNAME routing record + any Vercel ownership TXT records from the response. */
function dnsFrom(domain: string, v: VercelDomain | undefined): DomainActionResult['dns'] {
  const label = domain.split('.').slice(0, -2).join('.') || '@';
  const records: NonNullable<DomainActionResult['dns']> = [
    { type: 'CNAME', name: label, value: 'cname.vercel-dns.com' },
  ];
  for (const r of v?.verification ?? []) {
    if (r?.type && r?.domain && r?.value) records.push({ type: r.type, name: r.domain, value: r.value });
  }
  return records;
}

async function ownVendorId(): Promise<{ vendorId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id).catch(() => null);
  if (!profile?.vendor_profile_id) return { error: 'No vendor profile found.' };
  return { vendorId: profile.vendor_profile_id };
}

export async function addVendorDomain(rawDomain: string): Promise<DomainActionResult> {
  if (!vercelDomainsConfigured()) {
    return { ok: false, error: 'Custom domains aren’t enabled yet. Please try again later.' };
  }
  const domain = normalizeDomain(rawDomain);
  const invalid = validate(domain);
  if (invalid) return { ok: false, error: invalid };

  const owner = await ownVendorId();
  if ('error' in owner) return { ok: false, error: owner.error };

  const supabase = await createClient();
  // Insert as the vendor (RLS-gated; the guard trigger forces it unverified).
  const { data: inserted, error: insErr } = await supabase
    .from('custom_domains')
    .insert({ domain, owner_type: 'vendor', owner_id: owner.vendorId })
    .select('domain_id')
    .single();
  if (insErr || !inserted) {
    // 23505 = a verified row already owns this host.
    const taken = insErr?.code === '23505';
    return { ok: false, error: taken ? 'That domain is already in use.' : 'Could not add that domain.' };
  }
  const domainId = inserted.domain_id as string;

  const reg = await addProjectDomain(domain);
  if (!reg.ok) {
    // Roll back our row so the vendor can retry cleanly.
    await supabase.from('custom_domains').delete().eq('domain_id', domainId).eq('owner_id', owner.vendorId);
    const msg = reg.error === 'domain_already_in_use'
      ? 'That domain is attached to another site. Remove it there first.'
      : 'Could not register that domain with our host. Check the spelling and try again.';
    return { ok: false, error: msg };
  }

  const isVerified = Boolean(reg.data.verified);
  if (isVerified) {
    // DNS was already pointed at us → Vercel auto-verified on add. Stamp
    // verified_at now via the admin client (the guard trigger blocks a
    // self-service writer from setting it) so the DB matches the "Live" badge
    // and resolve_custom_domain/middleware actually serve the host. Without
    // this the row stays unverified, the domain 404s, and the (hidden) Verify
    // button offers no in-session recovery.
    const admin = createAdminClient();
    await admin
      .from('custom_domains')
      .update({ verified_at: new Date().toISOString(), vercel_domain_id: domain })
      .eq('domain_id', domainId)
      .eq('owner_id', owner.vendorId);
  }

  revalidatePath('/vendor-dashboard/website');
  return { ok: true, domainId, domain, verified: isVerified, dns: dnsFrom(domain, reg.data) };
}

export async function verifyVendorDomain(domainId: string): Promise<DomainActionResult> {
  if (!vercelDomainsConfigured()) return { ok: false, error: 'Custom domains aren’t enabled yet.' };
  const owner = await ownVendorId();
  if ('error' in owner) return { ok: false, error: owner.error };

  const supabase = await createClient();
  // Confirm the caller owns this row before touching Vercel / verifying.
  const { data: row } = await supabase
    .from('custom_domains')
    .select('domain_id, domain, owner_id')
    .eq('domain_id', domainId)
    .maybeSingle();
  if (!row || row.owner_id !== owner.vendorId) return { ok: false, error: 'Domain not found.' };

  await verifyProjectDomain(row.domain);
  const status = await getProjectDomain(row.domain);
  const verified = status.ok && Boolean(status.data.verified);
  if (!verified) {
    return { ok: false, error: 'Not verified yet — DNS can take a few minutes. Add the record, then try again.', verified: false, dns: dnsFrom(row.domain, status.ok ? status.data : undefined) };
  }

  // Stamp verified_at via the admin client — the guard trigger only lets the
  // service role write it. Ownership re-checked in the WHERE clause.
  const admin = createAdminClient();
  await admin
    .from('custom_domains')
    .update({ verified_at: new Date().toISOString(), vercel_domain_id: row.domain })
    .eq('domain_id', domainId)
    .eq('owner_id', owner.vendorId);

  revalidatePath('/vendor-dashboard/website');
  return { ok: true, verified: true };
}

export async function removeVendorDomain(domainId: string): Promise<DomainActionResult> {
  const owner = await ownVendorId();
  if ('error' in owner) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('custom_domains')
    .select('domain, owner_id')
    .eq('domain_id', domainId)
    .maybeSingle();
  if (!row || row.owner_id !== owner.vendorId) return { ok: false, error: 'Domain not found.' };

  if (vercelDomainsConfigured()) await removeProjectDomain(row.domain);
  await supabase.from('custom_domains').delete().eq('domain_id', domainId).eq('owner_id', owner.vendorId);

  revalidatePath('/vendor-dashboard/website');
  return { ok: true };
}
