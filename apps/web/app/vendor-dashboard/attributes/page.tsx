import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchSchemaWithSharedGroups,
  fetchVendorServiceAttributes,
  listCanonicalServices,
  type ResolvedSchema,
  type VendorAttributePayload,
} from '@/lib/vendor-service-attributes';
import { saveVendorServiceAttribute, removeVendorServiceAttribute } from './actions';
import { AttributeFieldRenderer } from './_components/attribute-field-renderer';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Service attributes · Vendor · Setnayan' };

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">No vendor profile yet</h1>
          <p className="mt-2 text-sm text-ink/65">
            Set up your basic vendor profile first, then return here to fill in
            per-category attributes.
          </p>
          <Link href="/vendor-dashboard" className="button-primary mt-4 inline-flex h-10 px-4">
            Set up profile
          </Link>
        </div>
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
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Service attributes temporarily unavailable</h1>
            <p className="text-sm text-ink/65">
              We hit an error loading your per-category attribute data. The team has been notified.
              Refresh in a minute; if it persists, reply to your last vendor email and we&rsquo;ll dig in.
            </p>
          </div>
        </div>
        {process.env.NODE_ENV !== 'production' ? (
          <pre className="mt-4 overflow-auto rounded-md border border-ink/15 bg-ink/[0.03] p-3 text-xs text-ink/65">
            {loaderState.message}
          </pre>
        ) : null}
      </div>
    );
  }

  const { profile, payloads, schemas, addCandidateSchema, catalog } = loaderState;
  const error = search.error ? decodeURIComponent(search.error) : null;
  const savedService = search.saved ? decodeURIComponent(search.saved) : null;
  const removed = search.removed === '1';
  const missingFields = search.missing
    ? decodeURIComponent(search.missing).split(',').filter((s) => s.length > 0)
    : [];

  // Unknown ?add= service surfaces an explicit error banner so vendors
  // don't pick something invalid and silently see no form. The page-load
  // try/catch handled the fetch failure already; this catches the case
  // where the fetch succeeded but returned null (canonical_service not in
  // the catalog).
  const requestedAdd = (search.add ?? '').trim();
  const unknownAddService =
    requestedAdd.length > 0 && addCandidateSchema === null
      && !payloads.some((p) => p.canonical_service === requestedAdd);

  // Catalog rows the vendor hasn't added yet — these populate the
  // "Add another service" dropdown. Already-saved canonicals are filtered
  // out so the vendor doesn't accidentally double-add.
  const existingKeys = new Set(payloads.map((p) => p.canonical_service));
  const addableCatalog = catalog.filter((c) => !existingKeys.has(c.canonical_service));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Iteration 0044 · Per-service attributes
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Service attributes
        </h1>
        <p className="text-base text-ink/65">
          Fill in the per-category fields couples will use to find vendors like you.
          Each service you offer has its own set of attributes — silhouettes if you
          design gowns, cuisine specialties if you cater, edit aesthetics if you
          shoot. Completing more fields raises your marketplace ranking and unlocks
          listing visibility.
        </p>
      </header>

      {error ? (
        <div role="alert" className="mb-5 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          <span className="font-medium">Couldn&rsquo;t save: </span>
          {error}
        </div>
      ) : null}
      {savedService && missingFields.length === 0 ? (
        <div role="status" className="mb-5 rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800">
          Saved attributes for <span className="font-medium">{savedService}</span>.
        </div>
      ) : null}
      {savedService && missingFields.length > 0 ? (
        <div role="status" className="mb-5 rounded-md border border-warn-300/60 bg-warn-50 px-4 py-3 text-sm text-warn-900">
          Saved <span className="font-medium">{savedService}</span> — but your listing
          won&rsquo;t surface in the marketplace yet. Still missing for the visibility gate:{' '}
          <span className="font-mono text-xs">{missingFields.join(', ')}</span>.
          Fill those in and save again to flip the listing-ready badge.
        </div>
      ) : null}
      {removed ? (
        <div role="status" className="mb-5 rounded-md border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/70">
          Removed that service&rsquo;s attribute payload.
        </div>
      ) : null}
      {unknownAddService ? (
        <div role="alert" className="mb-5 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          <span className="font-medium">Unknown service: </span>
          <span className="font-mono">{requestedAdd}</span> isn&rsquo;t in the catalog.
          Pick a different one from the dropdown above.
        </div>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold tracking-tight">Add another service</h2>
        <form action="" method="get" className="flex flex-wrap items-center gap-2">
          <label htmlFor="add" className="sr-only">
            Add a service to fill out
          </label>
          <select
            id="add"
            name="add"
            defaultValue=""
            className="input-field max-w-md flex-1"
          >
            <option value="">Choose a canonical service…</option>
            {addableCatalog.map((row) => (
              <option key={row.canonical_service} value={row.canonical_service}>
                {row.display_name_en}
                {row.display_name_tl ? ` · ${row.display_name_tl}` : ''}
              </option>
            ))}
          </select>
          <SubmitButton pendingLabel="Adding…" className="button-primary h-10 px-4 text-sm">
            Add
          </SubmitButton>
        </form>
        {addCandidateSchema ? (
          <div className="mt-6">
            <ServiceForm
              schema={addCandidateSchema}
              payload={null}
              isNew
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-8">
        {payloads.length === 0 && !addCandidateSchema ? (
          <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-8 text-center">
            <p className="font-medium text-ink/75">No services attributed yet.</p>
            <p className="mt-1 text-sm text-ink/55">
              Pick a canonical service from the dropdown above to start filling in attributes.
              Once saved, it&rsquo;ll show in the couple-facing marketplace under the matching category.
            </p>
          </div>
        ) : (
          payloads.map((payload) => {
            const schema = schemas.find((s) => s.canonical_service === payload.canonical_service);
            if (!schema) return null;
            return (
              <ServiceForm
                key={payload.canonical_service}
                schema={schema}
                payload={payload}
                isNew={false}
              />
            );
          })
        )}
      </section>

      <footer className="mt-10 rounded-xl border border-ink/10 bg-cream/60 px-5 py-4 text-xs text-ink/55">
        Profile ID <span className="font-mono">{profile.vendor_profile_id}</span> ·
        Schema source <span className="font-mono">canonical_service_schemas + shared_attribute_groups</span> per iteration 0044.
      </footer>
    </div>
  );
}

function ServiceForm({
  schema,
  payload,
  isNew,
}: {
  schema: ResolvedSchema;
  payload: VendorAttributePayload | null;
  isNew: boolean;
}) {
  const initialPayload = (payload?.attribute_payload ?? {}) as Record<string, unknown>;
  const completeness = payload?.completeness_score ?? 0;
  const meetsVisibility = payload?.meets_visibility_minimum ?? false;
  const facetSet = new Set(schema.filter_facets);

  return (
    <article
      id={schema.canonical_service}
      className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-tight">
            {schema.display_name_en}
            {schema.display_name_tl ? (
              <span className="ml-2 font-mono text-xs text-ink/45">{schema.display_name_tl}</span>
            ) : null}
          </h3>
          <p className="font-mono text-[11px] text-ink/45">
            canonical_service: {schema.canonical_service} · schema v{schema.schema_version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isNew ? (
            <span className="rounded-full bg-terracotta/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
              new
            </span>
          ) : (
            <>
              <CompletenessBadge value={completeness} />
              {meetsVisibility ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-700">
                  <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
                  listing-ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warn-50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-warn-800">
                  <ChevronDown aria-hidden className="h-3 w-3" strokeWidth={2} />
                  visibility gate not met
                </span>
              )}
            </>
          )}
        </div>
      </header>

      <form action={saveVendorServiceAttribute} className="space-y-5">
        <input type="hidden" name="canonical_service" value={schema.canonical_service} />

        {Object.entries(schema.fields).map(([fieldKey, def]) => (
          <AttributeFieldRenderer
            key={fieldKey}
            fieldKey={fieldKey}
            def={def}
            initial={initialPayload[fieldKey]}
            isFacet={facetSet.has(fieldKey)}
          />
        ))}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <SubmitButton pendingLabel="Saving…" className="button-primary h-10 px-4 text-sm">
            {isNew ? 'Add service + save' : 'Save'}
          </SubmitButton>
          {!isNew ? (
            <RemoveServiceButton canonicalService={schema.canonical_service} />
          ) : null}
        </div>
      </form>
    </article>
  );
}

function CompletenessBadge({ value }: { value: number }) {
  const tone =
    value >= 80
      ? 'bg-success-100 text-success-800'
      : value >= 40
        ? 'bg-warn-100 text-warn-800'
        : 'bg-ink/10 text-ink/70';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone}`}
    >
      {value}% complete
    </span>
  );
}

function RemoveServiceButton({ canonicalService }: { canonicalService: string }) {
  return (
    <form action={removeVendorServiceAttribute} className="inline">
      <input type="hidden" name="canonical_service" value={canonicalService} />
      <SubmitButton
        pendingLabel="Removing…"
        className="text-xs font-medium text-terracotta hover:underline"
      >
        Remove this service&rsquo;s payload
      </SubmitButton>
    </form>
  );
}
