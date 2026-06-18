import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Eye, EyeOff, Package as PackageIcon, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { SubmitButton } from '@/app/_components/submit-button';
import { Field } from '@/app/_components/forms/field';
import { PACKAGE_CANONICAL_TO_VENDOR_CATEGORY, formatCentavosPhp } from '@/lib/vendor-packages';
import type { VendorPackageRow, VendorPackageItemRow } from '@/lib/vendor-packages';
import {
  createVendorPackage,
  updateVendorPackage,
  togglePackageActive,
  deleteVendorPackage,
  createPackageItem,
  deletePackageItem,
} from './actions';

export const metadata = { title: 'Packages · Vendor' };

type Props = {
  searchParams: Promise<{ created?: string; saved?: string; error?: string }>;
};

type PackageWithItems = VendorPackageRow & { items: VendorPackageItemRow[] };

const CANONICAL_SERVICES = Object.keys(PACKAGE_CANONICAL_TO_VENDOR_CATEGORY).sort();

function humanizeService(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function VendorPackagesPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Fetch all packages (any status) + their items in parallel
  const { data: pkgRows } = await supabase
    .from('vendor_packages')
    .select(
      'package_id,vendor_profile_id,package_name,description,total_price_centavos,consumable_budget_centavos,is_consumable_flexible,primary_canonical_service,is_active,created_at,updated_at',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('created_at', { ascending: true });

  const packages = (pkgRows ?? []) as VendorPackageRow[];
  const packageIds = packages.map((p) => p.package_id);

  let itemsByPackage = new Map<string, VendorPackageItemRow[]>();
  if (packageIds.length > 0) {
    const { data: itemRows } = await supabase
      .from('vendor_package_items')
      .select(
        'item_id,package_id,canonical_service,service_description,is_default_included,replacement_value_centavos,display_order,created_at',
      )
      .in('package_id', packageIds)
      .order('display_order', { ascending: true });
    for (const row of (itemRows ?? []) as VendorPackageItemRow[]) {
      const list = itemsByPackage.get(row.package_id) ?? [];
      list.push(row);
      itemsByPackage.set(row.package_id, list);
    }
  }

  const packagesWithItems: PackageWithItems[] = packages.map((p) => ({
    ...p,
    items: itemsByPackage.get(p.package_id) ?? [],
  }));

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <PackageIcon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {packages.length} package{packages.length === 1 ? '' : 's'}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Packages</h1>
        <p className="max-w-prose text-base text-ink/65">
          Bundle multiple services under one price — couples lock the whole package in one step.
          Great for all-in wedding venues and multi-category vendors.
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
          Package updated.
        </p>
      ) : null}
      {search.created ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Package created — add items below to build it out, then activate it.
        </p>
      ) : null}

      {/* Existing packages */}
      {packagesWithItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-10 text-center">
          <PackageIcon
            aria-hidden
            className="mx-auto mb-3 h-8 w-8 text-ink/25"
            strokeWidth={1.5}
          />
          <p className="text-base font-medium text-ink">No packages yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink/60">
            Use the form below to create your first bundled package.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {packagesWithItems.map((pkg) => (
            <li key={pkg.package_id} className="rounded-2xl border border-ink/10 bg-cream">
              {/* Package header */}
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-ink">{pkg.package_name}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
                        pkg.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-ink/5 text-ink/60'
                      }`}
                    >
                      {pkg.is_active ? 'Active' : 'Draft'}
                    </span>
                  </div>
                  <p className="font-mono text-base text-ink">
                    {formatCentavosPhp(pkg.total_price_centavos)}
                  </p>
                  {pkg.description ? (
                    <p className="max-w-prose text-sm text-ink/65">{pkg.description}</p>
                  ) : null}
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
                    {pkg.items.length} item{pkg.items.length === 1 ? '' : 's'} ·{' '}
                    {humanizeService(pkg.primary_canonical_service)}
                    {pkg.consumable_budget_centavos > 0
                      ? ` · ${formatCentavosPhp(pkg.consumable_budget_centavos)} consumable`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <form action={togglePackageActive}>
                    <input type="hidden" name="package_id" value={pkg.package_id} />
                    <input
                      type="hidden"
                      name="is_active"
                      value={pkg.is_active ? 'false' : 'true'}
                    />
                    <button
                      type="submit"
                      aria-label={pkg.is_active ? 'Deactivate package' : 'Activate package'}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-ink/10"
                    >
                      {pkg.is_active ? (
                        <Eye className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </form>
                  <form action={deleteVendorPackage}>
                    <input type="hidden" name="package_id" value={pkg.package_id} />
                    <button
                      type="submit"
                      aria-label="Delete package"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </form>
                </div>
              </div>

              {/* Edit package details */}
              <details className="border-t border-ink/10">
                <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium text-ink/70 hover:text-ink">
                  Edit details
                </summary>
                <div className="border-t border-ink/10 p-5">
                  <form action={updateVendorPackage} className="space-y-4">
                    <input type="hidden" name="package_id" value={pkg.package_id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Package name" htmlFor={`name-${pkg.package_id}`}>
                        <input
                          id={`name-${pkg.package_id}`}
                          name="package_name"
                          type="text"
                          required
                          maxLength={120}
                          defaultValue={pkg.package_name}
                          className="input-field"
                        />
                      </Field>
                      <Field
                        label="Primary service"
                        htmlFor={`primary-${pkg.package_id}`}
                        help="The main category this package leads with."
                      >
                        <select
                          id={`primary-${pkg.package_id}`}
                          name="primary_canonical_service"
                          defaultValue={pkg.primary_canonical_service}
                          className="input-field cursor-pointer"
                        >
                          {CANONICAL_SERVICES.map((s) => (
                            <option key={s} value={s}>
                              {humanizeService(s)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Description (optional)" htmlFor={`desc-${pkg.package_id}`}>
                      <textarea
                        id={`desc-${pkg.package_id}`}
                        name="description"
                        rows={3}
                        maxLength={800}
                        defaultValue={pkg.description ?? ''}
                        placeholder="What makes this package special — what's included at a glance."
                        className="input-field resize-none"
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Total price (PHP)"
                        htmlFor={`price-${pkg.package_id}`}
                        help="The all-in price couples pay for this package."
                      >
                        <input
                          id={`price-${pkg.package_id}`}
                          name="total_price_php"
                          type="number"
                          min={1}
                          step={1}
                          required
                          defaultValue={Math.round(pkg.total_price_centavos / 100)}
                          className="input-field"
                        />
                      </Field>
                      <Field
                        label="Consumable budget (PHP, optional)"
                        htmlFor={`consumable-${pkg.package_id}`}
                        help="A pool couples can spend across flexible items (food, drinks, extras)."
                      >
                        <input
                          id={`consumable-${pkg.package_id}`}
                          name="consumable_budget_php"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={
                            pkg.consumable_budget_centavos > 0
                              ? Math.round(pkg.consumable_budget_centavos / 100)
                              : ''
                          }
                          placeholder="e.g. 50000"
                          className="input-field"
                        />
                      </Field>
                    </div>
                    <label className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream p-3">
                      <input
                        type="checkbox"
                        name="is_consumable_flexible"
                        defaultChecked={pkg.is_consumable_flexible}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
                      />
                      <span>
                        <span className="block text-sm font-medium text-ink">
                          Flexible consumable
                        </span>
                        <span className="block text-xs text-ink/55">
                          When on, removing optional items shifts their value into the consumable
                          pool — total price stays fixed. When off, removing items reduces the
                          total price instead.
                        </span>
                      </span>
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
                </div>
              </details>

              {/* Package items */}
              <div className="border-t border-ink/10 p-5 space-y-4">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  Items ({pkg.items.length})
                </h3>

                {pkg.items.length > 0 ? (
                  <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
                    {pkg.items.map((item) => (
                      <li
                        key={item.item_id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate text-sm font-medium text-ink">
                            {item.service_description}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                            {humanizeService(item.canonical_service)}
                            {item.is_default_included ? ' · Default' : ' · Optional'}
                            {item.replacement_value_centavos > 0
                              ? ` · ${formatCentavosPhp(item.replacement_value_centavos)} value`
                              : ''}
                          </p>
                        </div>
                        <form action={deletePackageItem} className="shrink-0">
                          <input type="hidden" name="item_id" value={item.item_id} />
                          <button
                            type="submit"
                            aria-label={`Remove ${item.service_description}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-ink/5 text-ink/60 hover:bg-terracotta/10 hover:text-terracotta"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink/50">No items yet — add one below.</p>
                )}

                {/* Add item form */}
                <details className="rounded-xl border border-dashed border-ink/15">
                  <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink/70 hover:text-ink">
                    <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Add item
                  </summary>
                  <form action={createPackageItem} className="space-y-3 border-t border-ink/10 p-4">
                    <input type="hidden" name="package_id" value={pkg.package_id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Service category"
                        htmlFor={`item-cat-${pkg.package_id}`}
                      >
                        <select
                          id={`item-cat-${pkg.package_id}`}
                          name="canonical_service"
                          className="input-field cursor-pointer"
                        >
                          {CANONICAL_SERVICES.map((s) => (
                            <option key={s} value={s}>
                              {humanizeService(s)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="Replacement value (PHP, optional)"
                        htmlFor={`item-val-${pkg.package_id}`}
                        help="How much this item is worth if removed."
                      >
                        <input
                          id={`item-val-${pkg.package_id}`}
                          name="replacement_value_php"
                          type="number"
                          min={0}
                          step={1}
                          placeholder="e.g. 15000"
                          className="input-field"
                        />
                      </Field>
                    </div>
                    <Field
                      label="Description"
                      htmlFor={`item-desc-${pkg.package_id}`}
                      help="What the couple sees — e.g. 'Full-day photography (8 hrs, 2 photographers)'"
                    >
                      <input
                        id={`item-desc-${pkg.package_id}`}
                        name="service_description"
                        type="text"
                        required
                        maxLength={200}
                        placeholder="e.g. Bridal car rental with ribbon decoration"
                        className="input-field"
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-ink/75">
                      <input
                        type="checkbox"
                        name="is_default_included"
                        defaultChecked
                        className="h-4 w-4 cursor-pointer accent-terracotta"
                      />
                      <span>Default included (couples can remove optional items)</span>
                    </label>
                    <div className="flex justify-end">
                      <SubmitButton
                        className="inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-4 text-xs font-medium text-ink hover:border-ink/40"
                        pendingLabel="Adding…"
                      >
                        Add item
                      </SubmitButton>
                    </div>
                  </form>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create new package */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink">Create a package</h2>
          <p className="max-w-prose text-sm text-ink/65">
            Give it a name and price — you can add items and activate it after saving.
          </p>
        </div>
        <form action={createVendorPackage} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Package name" htmlFor="new-name">
              <input
                id="new-name"
                name="package_name"
                type="text"
                required
                maxLength={120}
                placeholder="e.g. Grand Ballroom Wedding Package"
                className="input-field"
              />
            </Field>
            <Field
              label="Primary service"
              htmlFor="new-primary"
              help="The main category this package leads with."
            >
              <select
                id="new-primary"
                name="primary_canonical_service"
                defaultValue="reception_venue"
                className="input-field cursor-pointer"
              >
                {CANONICAL_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {humanizeService(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="new-desc">
            <textarea
              id="new-desc"
              name="description"
              rows={2}
              maxLength={800}
              placeholder="What's included at a glance — couples see this on your profile."
              className="input-field resize-none"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Total price (PHP)"
              htmlFor="new-price"
              help="The all-in price couples pay."
            >
              <input
                id="new-price"
                name="total_price_php"
                type="number"
                min={1}
                step={1}
                required
                placeholder="e.g. 250000"
                className="input-field"
              />
            </Field>
            <Field
              label="Consumable budget (PHP, optional)"
              htmlFor="new-consumable"
              help="A flexible pool for food, drinks, or extras."
            >
              <input
                id="new-consumable"
                name="consumable_budget_php"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 50000"
                className="input-field"
              />
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <Link href="/vendor-dashboard" className="text-xs text-ink/55 hover:text-ink">
              Back to dashboard
            </Link>
            <SubmitButton className="button-primary" pendingLabel="Creating…">
              Create package
            </SubmitButton>
          </div>
        </form>
      </section>
    </section>
  );
}
