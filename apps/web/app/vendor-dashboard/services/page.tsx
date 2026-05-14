import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Briefcase, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorServices } from '@/lib/vendor-services';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  SERVICE_GROUPS,
  type VendorCategory,
  displayServiceLabel,
  formatPhp,
} from '@/lib/vendors';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createVendorService,
  updateVendorService,
  toggleVendorServiceActive,
  deleteVendorService,
} from './actions';

export const metadata = { title: 'Services · Vendor' };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; add?: string }>;
};

export default async function VendorServicesPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const services = await fetchVendorServices(supabase, profile.vendor_profile_id);
  const selectedCategories = new Set(services.map((s) => s.category));

  // If ?add=<category> is in the URL, the "Add service" form for that
  // category is the expanded one. Click any unselected category to expand.
  const addCategory =
    typeof search.add === 'string' &&
    (VENDOR_CATEGORIES as readonly string[]).includes(search.add) &&
    !selectedCategories.has(search.add)
      ? (search.add as VendorCategory)
      : null;

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Briefcase aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {services.length} of 28 selected
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your services</h1>
        <p className="max-w-prose text-base text-ink/65">
          Pick from the 28 categories, set a starting price, and configure crew details.
          Toggle a service to hide it from the marketplace without losing pricing history.
        </p>
      </header>

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.saved ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Services updated.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Left column — full category list, click to add. */}
        <aside className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            All categories
          </h2>
          <div className="space-y-4">
            {SERVICE_GROUPS.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.members.map((cat) => {
                    const selected = selectedCategories.has(cat);
                    return (
                      <li key={cat}>
                        {selected ? (
                          <span className="flex items-center justify-between gap-2 rounded-md bg-terracotta/10 px-2 py-1.5 text-sm text-terracotta-700">
                            <span>{VENDOR_CATEGORY_LABEL[cat]}</span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
                              Added
                            </span>
                          </span>
                        ) : (
                          <Link
                            href={`/vendor-dashboard/services?add=${cat}#add-${cat}`}
                            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                              addCategory === cat
                                ? 'bg-ink/10 text-ink'
                                : 'text-ink/75 hover:bg-ink/[0.04]'
                            }`}
                          >
                            <span>{VENDOR_CATEGORY_LABEL[cat]}</span>
                            <Plus
                              aria-hidden
                              className="h-3.5 w-3.5 text-ink/40"
                              strokeWidth={2}
                            />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Right column — selected services with editor controls. */}
        <div className="space-y-4">
          {addCategory ? (
            <section
              id={`add-${addCategory}`}
              className="space-y-3 rounded-2xl border border-terracotta/30 bg-cream p-5"
            >
              <h2 className="text-base font-semibold text-ink">
                Add: {VENDOR_CATEGORY_LABEL[addCategory]}
              </h2>
              <form action={createVendorService} className="space-y-4">
                <input type="hidden" name="category" value={addCategory} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Starting price (PHP)"
                    htmlFor={`new-price-${addCategory}`}
                    help="Whole pesos. Leave blank for 'quote on request'."
                  >
                    <input
                      id={`new-price-${addCategory}`}
                      name="starting_price_php"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 25000"
                      className="input-field"
                    />
                  </Field>
                  <Field
                    label="Crew size"
                    htmlFor={`new-crew-${addCategory}`}
                    help="How many people you bring on the day."
                  >
                    <input
                      id={`new-crew-${addCategory}`}
                      name="crew_size"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 4"
                      className="input-field"
                    />
                  </Field>
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream p-3">
                  <input
                    type="checkbox"
                    name="crew_meal_required"
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      Crew meal required
                    </span>
                    <span className="block text-xs text-ink/55">
                      Feeds the couple&rsquo;s budget automatically.
                    </span>
                  </span>
                </label>
                <div className="flex items-center justify-between">
                  <Link
                    href="/vendor-dashboard/services"
                    className="text-xs text-ink/55 hover:text-ink"
                  >
                    Cancel
                  </Link>
                  <SubmitButton className="button-primary" pendingLabel="Adding…">
                    Add service
                  </SubmitButton>
                </div>
              </form>
            </section>
          ) : null}

          {services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
              <Briefcase
                aria-hidden
                className="mx-auto mb-2 h-6 w-6 text-ink/30"
                strokeWidth={1.5}
              />
              <p className="text-sm font-medium text-ink">No services yet.</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
                Pick a category from the left to add your first service.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {services.map((svc) => (
                <li
                  key={svc.vendor_service_id}
                  className={`rounded-2xl border bg-cream p-4 ${
                    svc.is_active ? 'border-ink/10' : 'border-ink/10 opacity-70'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-base font-semibold text-ink">
                        {displayServiceLabel(svc.category)}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {svc.is_active ? 'Active' : 'Hidden'} ·{' '}
                        {formatPhp(svc.starting_price_php)} starting
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={toggleVendorServiceActive}>
                        <input
                          type="hidden"
                          name="vendor_service_id"
                          value={svc.vendor_service_id}
                        />
                        <input
                          type="hidden"
                          name="is_active"
                          value={svc.is_active ? 'false' : 'true'}
                        />
                        <button
                          type="submit"
                          aria-label={svc.is_active ? 'Hide service' : 'Show service'}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-ink/10"
                        >
                          {svc.is_active ? (
                            <Eye className="h-4 w-4" strokeWidth={1.75} />
                          ) : (
                            <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                          )}
                        </button>
                      </form>
                      <form action={deleteVendorService}>
                        <input
                          type="hidden"
                          name="vendor_service_id"
                          value={svc.vendor_service_id}
                        />
                        <button
                          type="submit"
                          aria-label="Delete service"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </form>
                    </div>
                  </div>
                  <form action={updateVendorService} className="space-y-3">
                    <input
                      type="hidden"
                      name="vendor_service_id"
                      value={svc.vendor_service_id}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Starting price (PHP)"
                        htmlFor={`price-${svc.vendor_service_id}`}
                      >
                        <input
                          id={`price-${svc.vendor_service_id}`}
                          name="starting_price_php"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={svc.starting_price_php ?? ''}
                          placeholder="e.g. 25000"
                          className="input-field"
                        />
                      </Field>
                      <Field
                        label="Crew size"
                        htmlFor={`crew-${svc.vendor_service_id}`}
                      >
                        <input
                          id={`crew-${svc.vendor_service_id}`}
                          name="crew_size"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={svc.crew_size ?? ''}
                          placeholder="e.g. 4"
                          className="input-field"
                        />
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-ink/75">
                      <input
                        type="checkbox"
                        name="crew_meal_required"
                        defaultChecked={svc.crew_meal_required}
                        className="h-4 w-4 cursor-pointer accent-terracotta"
                      />
                      <span>Crew meal required (feeds couple&rsquo;s budget)</span>
                    </label>
                    <div className="flex justify-end">
                      <SubmitButton
                        className="inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-4 text-xs font-medium text-ink hover:border-ink/40"
                        pendingLabel="Saving…"
                      >
                        Save changes
                      </SubmitButton>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
      {help ? <span className="block text-xs text-ink/55">{help}</span> : null}
    </label>
  );
}
