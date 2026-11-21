import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Store } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchSchemaWithSharedGroups,
  fetchVendorServiceAttributes,
  listCanonicalServices,
  type ResolvedSchema,
  type VendorAttributePayload,
} from '@/lib/vendor-service-attributes';
import { ToolPage, ToolPin } from '../_components/tool-page';
import { AttributesUnread, AttributesView } from './_components/attributes-view';
import { missingLabels } from './_components/missing-labels';

export const metadata = { title: 'Service attributes · Supplier' };

type Props = {
  searchParams: Promise<{
    error?: string;
    service?: string;
    saved?: string;
    removed?: string;
    add?: string;
    /** Comma-separated field keys that are still missing for the saved
     *  service's visibility gate. Set by saveVendorServiceAttribute when
     *  the save succeeded but minimum_fields aren't all populated yet. */
    missing?: string;
  }>;
};

/**
 * Iteration 0044 — vendor-side per-canonical_service attribute fill surface.
 *
 * Vendors land on /vendor-dashboard/attributes to fill the per-category
 * fields that drive marketplace filtering + per-category showcase rendering
 * for couples. The page:
 *
 *  - Lists every vendor_service_attributes row the vendor already created,
 *    with the resolved schema (category-specific + shared groups merged)
 *    and a dynamic form per service.
 *  - Surfaces completeness_score (0-100) per service + visibility-gate
 *    pass/fail.
 *  - Includes an "Add a service" picker pulling from the full 192-entry
 *    canonical_service_schemas catalog so vendors opt in to new categories
 *    as their offerings expand.
 *
 * Crash-guarded just like the main /vendor-dashboard — any fetch failure
 * renders a friendly error UI + console.error for Sentry pickup.
 */

export default async function VendorAttributesPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let loaderState:
    | {
        ok: true;
        profile: NonNullable<Awaited<ReturnType<typeof fetchOwnVendorProfile>>>;
        payloads: VendorAttributePayload[];
        schemas: ResolvedSchema[];
        addCandidateSchema: ResolvedSchema | null;
        catalog: Awaited<ReturnType<typeof listCanonicalServices>>;
      }
    | { ok: false; message: string };
  try {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) {
      return (
        <ToolPage name="attributes">
          <ToolPin route="/vendor-dashboard/attributes" title="Attributes" />
          <p className="mt-3 text-[15px] text-[color:var(--m-slate-2)]">
            Set up your basic supplier profile first, then return here to fill in
            per-category attributes.
          </p>
          <div className="mt-4">
            <ActionButton tone="brand" main icon={Store} label="Set up profile" href="/vendor-dashboard" />
          </div>
        </ToolPage>
      );
    }

    const [payloads, catalog] = await Promise.all([
      fetchVendorServiceAttributes(supabase, profile.vendor_profile_id),
      listCanonicalServices(supabase),
    ]);

    // Resolve the schema for each canonical_service the vendor has already
    // saved a payload for. Done in parallel to keep page load tight.
    const schemaResults = await Promise.all(
      payloads.map((p) => fetchSchemaWithSharedGroups(supabase, p.canonical_service)),
    );
    const schemas: ResolvedSchema[] = schemaResults.filter(
      (s): s is ResolvedSchema => s !== null,
    );

    // If ?add=<canonical_service> is in the URL, resolve that schema too so
    // the form for a brand-new service can render below the existing list.
    let addCandidateSchema: ResolvedSchema | null = null;
    const requestedAdd = (search.add ?? '').trim();
    const alreadyHas = payloads.some((p) => p.canonical_service === requestedAdd);
    if (requestedAdd && !alreadyHas) {
      addCandidateSchema = await fetchSchemaWithSharedGroups(supabase, requestedAdd);
    }

    loaderState = {
      ok: true,
      profile,
      payloads,
      schemas,
      addCandidateSchema,
      catalog,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard/attributes] loader failed', err);
    const message = err instanceof Error ? err.message : String(err);
    loaderState = { ok: false, message };
  }

  if (!loaderState.ok) {
    // The message is logged (Sentry) above; the screen says the read failed, with Try again — never a raw error.
    return <AttributesUnread />;
  }

  const { payloads, schemas, addCandidateSchema, catalog } = loaderState;
  const error = search.error ? decodeURIComponent(search.error) : null;
  const savedService = search.saved ? decodeURIComponent(search.saved) : null;
  const removed = search.removed === '1';
  const missingKeys = search.missing
    ? decodeURIComponent(search.missing).split(',').filter((s) => s.length > 0)
    : [];
  // 🏷 LABELS, NEVER KEYS (controller 21 Nov): "Silhouettes, Fabric", not "silhouettes, fabric_type".
  const savedSchema = schemas.find((x) => x.canonical_service === savedService) ?? null;
  const missing = missingLabels(savedSchema?.fields, missingKeys);

  // Unknown ?add= service surfaces an explicit error so vendors don't pick something invalid and silently see no form.
  // The page-load try/catch handled the fetch failure already; this catches the case where the fetch succeeded but
  // returned null (canonical_service not in the catalog).
  const requestedAdd = (search.add ?? '').trim();
  const unknownAddService =
    requestedAdd.length > 0 && addCandidateSchema === null
      && !payloads.some((p) => p.canonical_service === requestedAdd);

  // Catalog rows the vendor hasn't added yet — the ＋ picker's list. Already-saved canonicals are filtered out so the
  // vendor doesn't accidentally double-add.
  const existingKeys = new Set(payloads.map((p) => p.canonical_service));
  const addable = catalog
    .filter((c) => !existingKeys.has(c.canonical_service))
    .map((c) => ({ key: c.canonical_service, en: c.display_name_en, tl: c.display_name_tl ?? null }));

  const rows = payloads.flatMap((payload) => {
    const schema = schemas.find((x) => x.canonical_service === payload.canonical_service);
    return schema ? [{ schema, payload }] : [];
  });

  return (
    <AttributesView
      rows={rows}
      fresh={addCandidateSchema}
      addable={addable}
      notices={{ error, savedService: savedSchema?.display_name_en ?? savedService, savedKey: savedService, missing, removed, unknownAdd: unknownAddService ? requestedAdd : null }}
    />
  );
}
