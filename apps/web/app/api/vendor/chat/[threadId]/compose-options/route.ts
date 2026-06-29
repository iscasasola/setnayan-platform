import type { NextRequest } from 'next/server';
import { authVendorBearer } from '@/lib/api/vendor-bearer';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { fetchThreadInterests } from '@/lib/thread-interests';
import { fetchVendorServices } from '@/lib/vendor-services';
import { isCanonicalService, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';

// Native-facing compose options for the vendor chat quick-action row: the
// vendor's proposal templates + packages (for "Send proposal" / quote) and the
// offerable services gap (active services NOT already on the thread, for "Offer
// service"). Mirrors exactly what the web thread page computes server-side —
// scoped to the caller's RLS via their bearer token, and only for a thread they
// own. The actual sends re-validate everything in their cores.
export const dynamic = 'force-dynamic';

interface OfferOption {
  vendorServiceId: string;
  label: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const auth = await authVendorBearer(req);
  if (auth.response) return auth.response;
  const supabase = auth.supabase;

  const profile = await fetchOwnVendorProfile(supabase, auth.user.id);
  if (!profile) return Response.json({ error: 'not_owner', message: 'This conversation isn’t available.' }, { status: 403 });

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) {
    return Response.json({ error: 'not_owner', message: 'This conversation isn’t available.' }, { status: 403 });
  }

  // Offerable services = active services not already recorded on the thread.
  const [existingInterests, ownServices] = await Promise.all([
    fetchThreadInterests(supabase, threadId),
    fetchVendorServices(supabase, profile.vendor_profile_id),
  ]);
  const alreadyOnThread = new Set(
    existingInterests.map((r) => r.vendor_service_id).filter((v): v is string => v !== null),
  );
  const services: OfferOption[] = ownServices
    .filter((s) => s.is_active && !alreadyOnThread.has(s.vendor_service_id))
    .map((s) => ({
      vendorServiceId: s.vendor_service_id,
      label:
        s.title?.trim() ||
        (isCanonicalService(s.category)
          ? VENDOR_CATEGORY_LABEL[s.category as VendorCategory]
          : s.category),
    }));

  // Proposal templates + packages (RLS scopes both to the vendor's org).
  const [tplRes, pkgRes] = await Promise.all([
    supabase
      .from('vendor_proposal_templates')
      .select('template_id, template_name')
      .eq('vendor_profile_id', profile.vendor_profile_id),
    supabase
      .from('vendor_packages')
      .select('package_id, package_name')
      .eq('vendor_profile_id', profile.vendor_profile_id),
  ]);
  const templates = ((tplRes.data ?? []) as { template_id: string; template_name: string }[]).map((t) => ({
    id: t.template_id,
    name: t.template_name,
  }));
  const packages = ((pkgRes.data ?? []) as { package_id: string; package_name: string }[]).map((p) => ({
    id: p.package_id,
    name: p.package_name,
  }));

  // Whether the thread is open (accepted) — native gates the quick-action row on
  // this, the same way the web hides the composer until acceptance.
  const accepted = thread.inquiry_status === 'accepted';

  return Response.json({ accepted, templates, packages, services });
}
