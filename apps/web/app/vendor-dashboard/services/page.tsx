import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Briefcase, Clock, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorBranches } from '@/lib/vendor-branches';
import { tierCaps, asVendorTier, canPlotTimeSlots } from '@/lib/vendor-tier-caps';
import {
  fetchVendorTimeSlotsByService,
  formatSlotTime,
  SLOT_CAPACITY_MAX,
  SLOT_LABEL_MAX,
  type VendorServiceTimeSlot,
} from '@/lib/vendor-time-slots';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  SERVICE_GROUPS,
  type VendorCategory,
  displayServiceLabel,
  formatPhp,
} from '@/lib/vendors';
import { SubmitButton } from '@/app/_components/submit-button';
import { Field } from '@/app/_components/forms/field';
import {
  createVendorService,
  proposeCategory,
  updateVendorService,
  toggleVendorServiceActive,
  deleteVendorService,
  addServiceTimeSlot,
  deleteServiceTimeSlot,
  setServiceLinks,
} from './actions';

export const metadata = { title: 'Services · Vendor' };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; add?: string; requested?: string }>;
};

type CategoryRequestRow = {
  request_id: string;
  proposed_label: string;
  status: 'pending' | 'promoted' | 'mapped' | 'kept_private' | 'rejected';
  mapped_to_canonical: string | null;
  resolution_note: string | null;
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

  // Linked-services-on-card (locked spec): which OTHER categories each service
  // "comes with". Pre-checks the "Comes with" picker on each edit form. The
  // option set is the vendor's own distinct categories — a vendor can only
  // advertise coverage they actually offer (enforced again in setServiceLinks).
  const linkedByServiceId = new Map<string, Set<string>>();
  const serviceIdList = services.map((s) => s.vendor_service_id);
  if (serviceIdList.length > 0) {
    const { data: linkRows } = await supabase
      .from('vendor_service_links')
      .select('vendor_service_id, linked_canonical_service')
      .in('vendor_service_id', serviceIdList);
    for (const r of (linkRows ?? []) as {
      vendor_service_id: string;
      linked_canonical_service: string;
    }[]) {
      const set = linkedByServiceId.get(r.vendor_service_id) ?? new Set<string>();
      set.add(r.linked_canonical_service);
      linkedByServiceId.set(r.vendor_service_id, set);
    }
  }
  const distinctCategories = Array.from(new Set(services.map((s) => s.category)));

  // #1 multi-service-per-leaf: a category can now hold several listings, so we
  // track a COUNT per category (not just presence) to show on the picker.
  const serviceCountByCategory = services.reduce<Record<string, number>>(
    (m, s) => {
      m[s.category] = (m[s.category] ?? 0) + 1;
      return m;
    },
    {},
  );

  // Branch-scoped grouping (Branches V1.x) — only an Enterprise vendor that has
  // at least one (non-cancelled) branch sees the per-service "Branch" picker.
  // Everyone else: the form renders byte-for-byte as before (no select → no
  // branch_id submitted → services stay unassigned).
  let tier: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    tier = (data as { tier_state?: string } | null)?.tier_state ?? null;
  } catch {
    tier = null;
  }
  // #2 daily booking capacity: the tier caps the max bookings/day a vendor can
  // declare per service (FREE 0 / VERIFIED 1 / PRO 3 / ENTERPRISE ∞). Only show
  // the capacity input when the tier allows bookings at all (slotsCap > 0).
  const slotsCap = tierCaps(asVendorTier(tier)).slotsPerDay;
  const slotsCapForUi = Number.isFinite(slotsCap) ? slotsCap : 99;
  // #3 time-bound slots: ENTERPRISE-only plotting (slotsPerDay === Infinity).
  // The slot LIST (read + delete) shows whenever a service has slots — even for
  // a downgraded vendor — so they can clean up; only ADD is Enterprise-gated.
  const canPlotSlots = canPlotTimeSlots(tier);
  const slotsByService = await fetchVendorTimeSlotsByService(
    supabase,
    profile.vendor_profile_id,
  );
  const branches =
    tier === 'enterprise'
      ? (await fetchVendorBranches(supabase, profile.vendor_profile_id)).filter(
          (b) => b.status !== 'cancelled',
        )
      : [];
  const showBranchPicker = branches.length > 0;
  const branchLabelById = new Map(branches.map((b) => [b.branch_id, b.branch_label]));

  // The vendor's own category requests (RLS: own rows only) so they can track
  // resolution. A missing table (migration not applied) degrades to [].
  const { data: requestRows } = await supabase
    .from('taxonomy_category_requests')
    .select('request_id, proposed_label, status, mapped_to_canonical, resolution_note')
    .eq('proposed_by_vendor_id', profile.vendor_profile_id)
    .order('created_at', { ascending: false });
  const myRequests = (requestRows ?? []) as CategoryRequestRow[];

  // If ?add=<category> is in the URL, the "Add service" form for that category
  // is the expanded one. #1: a category can hold multiple listings, so the form
  // opens even for already-used categories (the create action enforces the cap).
  const addCategory =
    typeof search.add === 'string' &&
    (VENDOR_CATEGORIES as readonly string[]).includes(search.add)
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
            {services.length} of {VENDOR_CATEGORIES.length} selected
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your services</h1>
        <p className="max-w-prose text-base text-ink/65">
          Pick from the {VENDOR_CATEGORIES.length} categories, set a starting price, and configure crew details.
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
      {search.requested ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Thanks — we&rsquo;ll review your category request and get back to you. There&rsquo;s always a place for what you do.
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
                    // #1: a category can hold multiple listings now, so it stays
                    // clickable even once used — the count shows how many are
                    // added; the create action enforces the per-tier cap.
                    const count = serviceCountByCategory[cat] ?? 0;
                    return (
                      <li key={cat}>
                        <Link
                          href={`/vendor-dashboard/services?add=${cat}#add-${cat}`}
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                            addCategory === cat
                              ? 'bg-ink/10 text-ink'
                              : count > 0
                                ? 'text-terracotta-700 hover:bg-terracotta/[0.06]'
                                : 'text-ink/75 hover:bg-ink/[0.04]'
                          }`}
                        >
                          <span>{VENDOR_CATEGORY_LABEL[cat]}</span>
                          {count > 0 ? (
                            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                              {count} added
                            </span>
                          ) : (
                            <Plus
                              aria-hidden
                              className="h-3.5 w-3.5 text-ink/40"
                              strokeWidth={2}
                            />
                          )}
                        </Link>
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
                <Field
                  label="Service name (optional)"
                  htmlFor={`new-title-${addCategory}`}
                  help="Name this listing so couples can tell your offerings apart — e.g. 'Classic Booth' vs '360 Booth'."
                >
                  <input
                    id={`new-title-${addCategory}`}
                    name="title"
                    type="text"
                    maxLength={80}
                    placeholder={VENDOR_CATEGORY_LABEL[addCategory]}
                    className="input-field"
                  />
                </Field>
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
                <Field
                  label="Additional cost per added guest (PHP)"
                  htmlFor={`new-addpax-${addCategory}`}
                  help="Optional. Charged per guest above the count you quote. Leave blank for no extra charge for added guests."
                >
                  <input
                    id={`new-addpax-${addCategory}`}
                    name="added_pax_price_php"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 350"
                    className="input-field"
                  />
                </Field>
                {slotsCap > 0 ? (
                  <Field
                    label="Bookings per day (optional)"
                    htmlFor={`new-cap-${addCategory}`}
                    help={`How many of this you can serve in a day — e.g. 2 photobooths → 2. Your plan allows up to ${slotsCapForUi}.`}
                  >
                    <input
                      id={`new-cap-${addCategory}`}
                      name="daily_capacity"
                      type="number"
                      min={1}
                      max={slotsCapForUi}
                      step={1}
                      placeholder={`e.g. ${Math.min(2, slotsCapForUi)}`}
                      className="input-field"
                    />
                  </Field>
                ) : null}
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
                <LastMinuteFields idPrefix={`new-${addCategory}`} />
                {showBranchPicker ? (
                  <BranchSelect
                    id={`new-branch-${addCategory}`}
                    branches={branches}
                    defaultValue=""
                  />
                ) : null}
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
                        {svc.title?.trim() || displayServiceLabel(svc.category)}
                      </p>
                      {svc.title?.trim() ? (
                        <p className="truncate text-xs text-ink/50">
                          {displayServiceLabel(svc.category)}
                        </p>
                      ) : null}
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {svc.is_active ? 'Active' : 'Hidden'} ·{' '}
                        {formatPhp(svc.starting_price_php)} starting
                      </p>
                      {svc.branch_id && branchLabelById.has(svc.branch_id) ? (
                        <p className="text-xs text-ink/60">
                          Branch: {branchLabelById.get(svc.branch_id)}
                        </p>
                      ) : null}
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
                    <Field
                      label="Additional cost per added guest (PHP)"
                      htmlFor={`addpax-${svc.vendor_service_id}`}
                    >
                      <input
                        id={`addpax-${svc.vendor_service_id}`}
                        name="added_pax_price_php"
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={svc.added_pax_price_php ?? ''}
                        placeholder="Optional — blank = no extra charge"
                        className="input-field"
                      />
                    </Field>
                    {slotsCap > 0
                      ? (() => {
                          // #3 precedence (verifier C9): a service with >=1
                          // active time slot uses the per-slot model and the
                          // #2 daily_capacity input is disabled — slots
                          // override "Bookings per day". The field still
                          // submits its existing value (kept, not cleared).
                          const hasSlots =
                            (slotsByService.get(svc.vendor_service_id)?.length ??
                              0) > 0;
                          return (
                            <Field
                              label={`Bookings per day (max ${slotsCapForUi})`}
                              htmlFor={`cap-${svc.vendor_service_id}`}
                              help={
                                hasSlots
                                  ? 'Disabled — time slots below set capacity per window instead.'
                                  : undefined
                              }
                            >
                              <input
                                id={`cap-${svc.vendor_service_id}`}
                                name="daily_capacity"
                                type="number"
                                min={1}
                                max={slotsCapForUi}
                                step={1}
                                defaultValue={svc.daily_capacity ?? ''}
                                placeholder="e.g. 2"
                                disabled={hasSlots}
                                className="input-field disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </Field>
                          );
                        })()
                      : null}
                    <label className="flex items-center gap-2 text-sm text-ink/75">
                      <input
                        type="checkbox"
                        name="crew_meal_required"
                        defaultChecked={svc.crew_meal_required}
                        className="h-4 w-4 cursor-pointer accent-terracotta"
                      />
                      <span>Crew meal required (feeds couple&rsquo;s budget)</span>
                    </label>
                    <LastMinuteFields
                      idPrefix={svc.vendor_service_id}
                      endDefault={svc.last_minute_end_months}
                      surchargeDefault={svc.last_minute_surcharge_pct}
                    />
                    {showBranchPicker ? (
                      <BranchSelect
                        id={`branch-${svc.vendor_service_id}`}
                        branches={branches}
                        defaultValue={svc.branch_id ?? ''}
                      />
                    ) : null}
                    <div className="flex justify-end">
                      <SubmitButton
                        className="inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-4 text-xs font-medium text-ink hover:border-ink/40"
                        pendingLabel="Saving…"
                      >
                        Save changes
                      </SubmitButton>
                    </div>
                  </form>
                  {/* Linked-services-on-card — its own server action, so it
                      must NOT nest inside the update form above. Shows only
                      when the vendor offers ≥1 OTHER category to bundle in. */}
                  {distinctCategories.filter((c) => c !== svc.category).length > 0 ? (
                    <form
                      action={setServiceLinks}
                      className="mt-3 rounded-md border border-ink/10 bg-ink/[0.02] p-3"
                    >
                      <input
                        type="hidden"
                        name="vendor_service_id"
                        value={svc.vendor_service_id}
                      />
                      <p className="text-xs font-medium text-ink/75">Comes with</p>
                      <p className="mt-0.5 text-[11px] text-ink/50">
                        Other categories this service bundles in — the couple&rsquo;s
                        card shows &ldquo;comes with&rdquo; these, included in your price.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                        {distinctCategories
                          .filter((c) => c !== svc.category)
                          .map((cat) => (
                            <label
                              key={cat}
                              className="flex items-center gap-1.5 text-xs text-ink/75"
                            >
                              <input
                                type="checkbox"
                                name="linked"
                                value={cat}
                                defaultChecked={linkedByServiceId
                                  .get(svc.vendor_service_id)
                                  ?.has(cat)}
                                className="h-3.5 w-3.5 cursor-pointer accent-terracotta"
                              />
                              <span>{displayServiceLabel(cat)}</span>
                            </label>
                          ))}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <SubmitButton
                          className="inline-flex h-8 items-center justify-center rounded-md border border-ink/20 bg-cream px-3 text-[11px] font-medium text-ink hover:border-ink/40"
                          pendingLabel="Saving…"
                        >
                          Save links
                        </SubmitButton>
                      </div>
                    </form>
                  ) : null}
                  {/* #3 time-bound slots — sibling of the edit form (its own
                      server actions, so it must NOT nest inside the update
                      form). Renders whenever the service has slots OR the
                      vendor is Enterprise; the list (read+delete) shows for
                      everyone with slots, the ADD form only for Enterprise. */}
                  <SlotEditor
                    serviceId={svc.vendor_service_id}
                    slots={slotsByService.get(svc.vendor_service_id) ?? []}
                    canPlot={canPlotSlots}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Request a new category — the "There's always a place for what you do"
          on-ramp (spec 0023 §3.2c). Lands as a pending taxonomy_category_request
          for an admin to promote / map / keep-private / reject. */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink">Don&rsquo;t see your service?</h2>
          <p className="max-w-prose text-sm text-ink/65">
            Tell us what you do — we&rsquo;ll review it and add it to the directory.
          </p>
        </div>
        <form
          action={proposeCategory}
          className="grid gap-3 sm:grid-cols-[2fr_3fr_auto] sm:items-end"
        >
          <Field label="Service name" htmlFor="propose-label">
            <input
              id="propose-label"
              name="proposed_label"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Table Linen Rental"
              className="input-field"
            />
          </Field>
          <Field label="What is it? (optional)" htmlFor="propose-note">
            <input
              id="propose-note"
              name="proposed_note"
              maxLength={400}
              placeholder="A sentence so we can place it right."
              className="input-field"
            />
          </Field>
          <SubmitButton className="button-primary" pendingLabel="Sending…">
            Request
          </SubmitButton>
        </form>
        {myRequests.length > 0 ? (
          <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
            {myRequests.map((r) => (
              <li
                key={r.request_id}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">{r.proposed_label}</span>
                <RequestStatusBadge status={r.status} mapped={r.mapped_to_canonical} />
                {r.resolution_note ? (
                  <span className="text-xs text-ink/55">{r.resolution_note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}

function RequestStatusBadge({
  status,
  mapped,
}: {
  status: CategoryRequestRow['status'];
  mapped: string | null;
}) {
  const map: Record<CategoryRequestRow['status'], { label: string; tone: string }> = {
    pending: { label: 'Pending review', tone: 'bg-amber-100 text-amber-900' },
    promoted: { label: 'Added to directory ✓', tone: 'bg-emerald-100 text-emerald-800' },
    mapped: {
      label: mapped ? `Use “${mapped}”` : 'Mapped to an existing category',
      tone: 'bg-sky-100 text-sky-800',
    },
    kept_private: { label: 'Kept for your listing', tone: 'bg-ink/10 text-ink/70' },
    rejected: { label: 'Not added', tone: 'bg-rose-100 text-rose-800' },
  };
  const { label, tone } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}
    >
      {label}
    </span>
  );
}

/**
 * Last-minute booking fields (Setnayan AI §4). The vendor's per-service FLOOR
 * ("I'll still take a booking until N months before the wedding"; blank → up to
 * the night before) + an optional 0–100% surcharge for late bookings. These
 * feed the last-minute window + badge once an admin sets the category START.
 * Rendered in both the Add + Edit service forms.
 */
function LastMinuteFields({
  idPrefix,
  endDefault,
  surchargeDefault,
}: {
  idPrefix: string;
  endDefault?: number | null;
  surchargeDefault?: number | null;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-ink/10 bg-cream p-3">
      <p className="text-sm font-medium text-ink">Last-minute bookings</p>
      <p className="text-xs text-ink/55">
        Setnayan AI surfaces you to couples close to their date. Choose how late
        you&rsquo;ll still take a booking — and an optional surcharge for it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Accept until (months before)"
          htmlFor={`${idPrefix}-lm-end`}
          help="Blank = up to the night before."
        >
          <input
            id={`${idPrefix}-lm-end`}
            name="last_minute_end_months"
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 1"
            defaultValue={endDefault ?? ''}
            className="input-field"
          />
        </Field>
        <Field
          label="Late surcharge (%)"
          htmlFor={`${idPrefix}-lm-pct`}
          help="Optional, 0–100. Blank = same price."
        >
          <input
            id={`${idPrefix}-lm-pct`}
            name="last_minute_surcharge_pct"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="e.g. 15"
            defaultValue={surchargeDefault ?? ''}
            className="input-field"
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * Branch-scoped grouping picker (Branches V1.x). Only rendered for Enterprise
 * vendors that have branches; otherwise the service forms are unchanged.
 * Empty value = "Main (no branch)" → the action resolves it to null.
 */
function BranchSelect({
  id,
  branches,
  defaultValue,
}: {
  id: string;
  branches: { branch_id: string; branch_label: string }[];
  defaultValue: string;
}) {
  return (
    <Field label="Branch" htmlFor={id} help="Which location offers this service.">
      <select id={id} name="branch_id" defaultValue={defaultValue} className="input-field cursor-pointer">
        <option value="">Main (no branch)</option>
        {branches.map((b) => (
          <option key={b.branch_id} value={b.branch_id}>
            {b.branch_label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Time-bound slot sub-editor (tier #3, Enterprise). When a service has >=1
 * active slot it uses the per-slot capacity model and the #2 "Bookings per day"
 * input is disabled (slots override it). The list (read + delete) renders for
 * anyone who has slots — including a downgraded vendor cleaning up — while the
 * ADD form only renders for Enterprise (canPlot). When there are no slots and
 * the vendor isn't Enterprise, the whole block is hidden so non-Enterprise
 * vendors see no change.
 */
function SlotEditor({
  serviceId,
  slots,
  canPlot,
}: {
  serviceId: string;
  slots: VendorServiceTimeSlot[];
  canPlot: boolean;
}) {
  if (slots.length === 0 && !canPlot) return null;
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-ink/10 bg-cream p-3">
      <div className="flex items-center gap-1.5">
        <Clock aria-hidden className="h-3.5 w-3.5 text-ink/55" strokeWidth={1.75} />
        <p className="text-sm font-medium text-ink">Time slots (Enterprise)</p>
      </div>
      <p className="text-xs text-ink/55">
        Named per-day windows, each with its own capacity. When you set slots,
        couples pick one at booking and they override &ldquo;Bookings per
        day&rdquo; for this service.
      </p>

      {slots.length > 0 ? (
        <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10">
          {slots.map((slot) => (
            <li
              key={slot.slot_id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-medium text-ink">{slot.slot_label}</span>{' '}
                <span className="text-ink/60">
                  {formatSlotTime(slot.start_time)}–{formatSlotTime(slot.end_time)}
                  {' · '}up to {slot.slot_capacity}/day
                </span>
              </span>
              <form action={deleteServiceTimeSlot}>
                <input type="hidden" name="slot_id" value={slot.slot_id} />
                <button
                  type="submit"
                  aria-label={`Remove time slot ${slot.slot_label}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      {canPlot ? (
        <form
          action={addServiceTimeSlot}
          className="grid gap-2 rounded-lg border border-dashed border-ink/15 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end"
        >
          <input type="hidden" name="vendor_service_id" value={serviceId} />
          <Field label="Label" htmlFor={`slot-label-${serviceId}`}>
            <input
              id={`slot-label-${serviceId}`}
              name="slot_label"
              type="text"
              required
              maxLength={SLOT_LABEL_MAX}
              placeholder="e.g. AM Ceremony"
              className="input-field"
            />
          </Field>
          <Field label="Start" htmlFor={`slot-start-${serviceId}`}>
            <input
              id={`slot-start-${serviceId}`}
              name="start_time"
              type="time"
              required
              step={1800}
              className="input-field"
            />
          </Field>
          <Field label="End" htmlFor={`slot-end-${serviceId}`}>
            <input
              id={`slot-end-${serviceId}`}
              name="end_time"
              type="time"
              required
              step={1800}
              className="input-field"
            />
          </Field>
          <Field label="Capacity" htmlFor={`slot-cap-${serviceId}`}>
            <input
              id={`slot-cap-${serviceId}`}
              name="slot_capacity"
              type="number"
              min={1}
              max={SLOT_CAPACITY_MAX}
              step={1}
              defaultValue={1}
              className="input-field"
            />
          </Field>
          <SubmitButton
            className="inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-3 text-xs font-medium text-ink hover:border-ink/40"
            pendingLabel="Adding…"
          >
            Add slot
          </SubmitButton>
        </form>
      ) : (
        <p className="text-xs text-ink/45">
          Time slots are an Enterprise feature — these existing slots stay active
          and you can remove them anytime.
        </p>
      )}
    </div>
  );
}
