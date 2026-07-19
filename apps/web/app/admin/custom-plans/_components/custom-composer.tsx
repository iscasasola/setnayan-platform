'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  MapPin,
  Users,
  CalendarClock,
  Images,
  Coins,
  Globe,
  Sparkles,
  BadgeCheck,
  ShieldCheck,
  Info,
  Send,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import {
  computeCustomQuote,
  CUSTOM_BASE,
  type CustomComposition,
  type CustomUnitPrices,
  type CustomDiscount,
} from '@/lib/vendor-custom-pricing';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  sendCustomQuote,
  activateCustomPlan,
  type CustomPlanActionState,
} from '../actions';

export type VendorOption = { id: string; name: string; tier: string | null };

export type LoadedPlan = {
  planId: string;
  composition: CustomComposition;
  discount: CustomDiscount | null;
  status: string;
  quoted28: number | null;
} | null;

type Props = {
  vendors: VendorOption[];
  selectedVendorId: string | null;
  catalogPrices: CustomUnitPrices;
  loadedPlan: LoadedPlan;
};

const peso = (n: number) =>
  '₱' + Math.round(n).toLocaleString('en-PH');

const DEFAULT_COMPOSITION: CustomComposition = {
  branches: 1,
  reachKm: CUSTOM_BASE.reachKm,
  nationwide: false,
  seats: CUSTOM_BASE.seats,
  slotsPerCategory: CUSTOM_BASE.slotsPerCategory,
  photos: CUSTOM_BASE.photos,
  tokensPerCycle: 0,
  domain: false,
  api_access: false,
};

/** One slider row — label + icon + live value + range input. */
function Knob({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-ink/60">{icon}</span>
        <span className="text-sm font-semibold text-ink">{label}</span>
      </div>
      {children}
      <p className="mt-1.5 text-xs text-ink/50">{hint}</p>
    </div>
  );
}

export function CustomComposer({
  vendors,
  selectedVendorId,
  catalogPrices,
  loadedPlan,
}: Props) {
  const router = useRouter();

  const [comp, setComp] = useState<CustomComposition>(
    loadedPlan?.composition ?? DEFAULT_COMPOSITION,
  );
  const [prices, setPrices] = useState<CustomUnitPrices>(catalogPrices);
  const [discountType, setDiscountType] = useState<'none' | 'amount' | 'percent'>(
    loadedPlan?.discount ? loadedPlan.discount.type : 'none',
  );
  const [discountValue, setDiscountValue] = useState<number>(
    loadedPlan?.discount?.value ?? 0,
  );
  const [channel, setChannel] = useState<'bdo' | 'gcash'>('bdo');
  const [showUnitPrices, setShowUnitPrices] = useState(false);

  const quote = useMemo(() => {
    const discount: CustomDiscount | null =
      discountType === 'none' || discountValue <= 0
        ? null
        : { type: discountType, value: discountValue };
    return computeCustomQuote(comp, prices, discount);
  }, [comp, prices, discountType, discountValue]);

  const [state, formAction] = useActionState<CustomPlanActionState, FormData>(
    sendCustomQuote,
    { status: 'idle' },
  );
  const [activateState, activateAction] = useActionState<CustomPlanActionState, FormData>(
    activateCustomPlan,
    { status: 'idle' },
  );

  const setK = <K extends keyof CustomComposition>(key: K, value: CustomComposition[K]) =>
    setComp((c) => ({ ...c, [key]: value }));
  const setP = (key: keyof CustomUnitPrices, value: number) =>
    setPrices((p) => ({ ...p, [key]: Number.isFinite(value) && value >= 0 ? value : 0 }));

  const reachSteps = comp.nationwide
    ? 0
    : Math.max(0, Math.round((Math.min(comp.reachKm, CUSTOM_BASE.reachMaxKm) - CUSTOM_BASE.reachKm) / 100));
  const extraBranches = Math.max(0, comp.branches - 1);
  const extraSeats = Math.max(0, comp.seats - CUSTOM_BASE.seats);
  const extraSlots = Math.max(0, comp.slotsPerCategory - CUSTOM_BASE.slotsPerCategory);
  const photoPacks = Math.ceil(Math.max(0, comp.photos - CUSTOM_BASE.photos) / 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ── LEFT: org picker + sliders + unit prices + discount ── */}
      <div className="space-y-6">
        {/* Org picker */}
        <div className="rounded-xl border border-ink/10 bg-cream/50 p-4">
          <label className="mb-1.5 block text-sm font-semibold text-ink">Vendor org</label>
          <select
            className="input-field h-11 w-full"
            value={selectedVendorId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              router.push(v ? `/admin/pricing?tab=custom-plans&vendor=${v}` : '/admin/pricing?tab=custom-plans');
            }}
          >
            <option value="">Select a vendor org…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.tier ? ` · ${v.tier}` : ''}
              </option>
            ))}
          </select>
          {loadedPlan ? (
            <p className="mt-2 text-xs text-ink/60">
              Current plan status: <span className="font-semibold">{loadedPlan.status}</span>
              {loadedPlan.quoted28 != null ? ` · last quoted ${peso(loadedPlan.quoted28)}/28 days` : ''}
            </p>
          ) : null}
        </div>

        {!selectedVendorId ? (
          <div className="rounded-xl border border-dashed border-ink/20 bg-white p-8 text-center text-sm text-ink/55">
            Pick a vendor org above to compose a Custom-tier plan.
          </div>
        ) : (
          <>
            {/* Sliders */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Knob
                icon={<Building2 className="h-4 w-4" strokeWidth={2} />}
                label={`Branches · ${comp.branches}`}
                hint="Main branch is included. Each additional branch adds to the cycle."
              >
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={comp.branches}
                  onChange={(e) => setK('branches', Number(e.target.value))}
                  className="w-full accent-ink"
                />
              </Knob>

              <Knob
                icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
                label={comp.nationwide ? 'Reach · Nationwide' : `Reach · ${comp.reachKm} km`}
                hint="100 km included. Step up to 500 km, or flip to nationwide."
              >
                <input
                  type="range"
                  min={CUSTOM_BASE.reachKm}
                  max={CUSTOM_BASE.reachMaxKm}
                  step={100}
                  value={comp.reachKm}
                  disabled={comp.nationwide}
                  onChange={(e) => setK('reachKm', Number(e.target.value))}
                  className="w-full accent-ink disabled:opacity-40"
                />
                <label className="mt-1.5 flex items-center gap-2 text-xs text-ink/70">
                  <input
                    type="checkbox"
                    checked={comp.nationwide}
                    onChange={(e) => setK('nationwide', e.target.checked)}
                    className="h-4 w-4 rounded border-ink/30 accent-ink"
                  />
                  Nationwide reach
                </label>
              </Knob>

              <Knob
                icon={<Users className="h-4 w-4" strokeWidth={2} />}
                label={`Team seats · ${comp.seats}`}
                hint="10 seats included. Extra seats beyond the base 10 are billed."
              >
                <input
                  type="range"
                  min={CUSTOM_BASE.seats}
                  max={100}
                  step={1}
                  value={comp.seats}
                  onChange={(e) => setK('seats', Number(e.target.value))}
                  className="w-full accent-ink"
                />
              </Knob>

              <Knob
                icon={<CalendarClock className="h-4 w-4" strokeWidth={2} />}
                label={`Event slots / category · ${comp.slotsPerCategory}`}
                hint="8 slots per category included. Add more concurrent bookings."
              >
                <input
                  type="range"
                  min={CUSTOM_BASE.slotsPerCategory}
                  max={60}
                  step={1}
                  value={comp.slotsPerCategory}
                  onChange={(e) => setK('slotsPerCategory', Number(e.target.value))}
                  className="w-full accent-ink"
                />
              </Knob>

              <Knob
                icon={<Images className="h-4 w-4" strokeWidth={2} />}
                label={`Portfolio photos · ${comp.photos}`}
                hint="300 photos included. Billed per +100-photo pack."
              >
                <input
                  type="range"
                  min={CUSTOM_BASE.photos}
                  max={3000}
                  step={100}
                  value={comp.photos}
                  onChange={(e) => setK('photos', Number(e.target.value))}
                  className="w-full accent-ink"
                />
              </Knob>

              <Knob
                icon={<Coins className="h-4 w-4" strokeWidth={2} />}
                label={`Included tokens / cycle · ${comp.tokensPerCycle}`}
                hint="Tokens granted every 28-day cycle, at flat face value."
              >
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={10}
                  value={comp.tokensPerCycle}
                  onChange={(e) => setK('tokensPerCycle', Number(e.target.value))}
                  className="w-full accent-ink"
                />
              </Knob>

              <Knob
                icon={<Globe className="h-4 w-4" strokeWidth={2} />}
                label="Custom domain"
                hint="A branded custom domain for the vendor's public website."
              >
                <label className="flex items-center gap-2 text-xs text-ink/70">
                  <input
                    type="checkbox"
                    checked={comp.domain}
                    onChange={(e) => setK('domain', e.target.checked)}
                    className="h-4 w-4 rounded border-ink/30 accent-ink"
                  />
                  Include a custom domain
                </label>
              </Knob>

              <Knob
                icon={<Terminal className="h-4 w-4" strokeWidth={2} />}
                label="API access"
                hint="Enterprise SDK — mint API keys + sync leads, bookings, availability, reviews into their own systems. Grant only when the vendor requests it."
              >
                <label className="flex items-center gap-2 text-xs text-ink/70">
                  <input
                    type="checkbox"
                    checked={comp.api_access ?? false}
                    onChange={(e) => setK('api_access', e.target.checked)}
                    className="h-4 w-4 rounded border-ink/30 accent-ink"
                  />
                  Allow API access
                </label>
              </Knob>
            </div>

            {/* Unit-price overrides (per-quote, in-memory) */}
            <div className="rounded-xl border border-ink/10 bg-white">
              <button
                type="button"
                onClick={() => setShowUnitPrices((s) => !s)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-ink/50" strokeWidth={2} />
                  Unit prices for this quote
                </span>
                <span className="text-xs font-normal text-ink/50">
                  {showUnitPrices ? 'Hide' : 'Override…'}
                </span>
              </button>
              {showUnitPrices ? (
                <div className="border-t border-ink/10 p-4">
                  <p className="mb-3 flex items-start gap-1.5 text-xs text-ink/55">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    Per-quote overrides only — they change this preview, not the
                    saved catalog. Manage the persistent prices at /admin/pricing.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ['base', 'Base / 28d'],
                        ['branch', 'Per branch'],
                        ['reachStep', 'Reach +100 km'],
                        ['reachNationwide', 'Nationwide'],
                        ['seat', 'Per extra seat'],
                        ['slot', 'Per +1 slot'],
                        ['photoPack', 'Per +100 photos'],
                        ['includedToken', 'Per token'],
                        ['domain', 'Custom domain'],
                      ] as Array<[keyof CustomUnitPrices, string]>
                    ).map(([key, label]) => (
                      <label key={key} className="block">
                        <span className="mb-1 block text-xs text-ink/60">{label}</span>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40">
                            ₱
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={prices[key]}
                            onChange={(e) => setP(key, Number(e.target.value))}
                            className="input-field h-10 w-full pl-6 text-right tabular-nums"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Discount */}
            <div className="rounded-xl border border-ink/10 bg-white p-4">
              <div className="mb-2 text-sm font-semibold text-ink">Partner discount</div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-ink/15 p-0.5">
                  {(['none', 'amount', 'percent'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDiscountType(t)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                        discountType === t
                          ? 'bg-ink text-cream'
                          : 'text-ink/60 hover:text-ink'
                      }`}
                    >
                      {t === 'none' ? 'None' : t === 'amount' ? '₱ off' : '% off'}
                    </button>
                  ))}
                </div>
                {discountType !== 'none' ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink/40">
                      {discountType === 'percent' ? '%' : '₱'}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={discountType === 'percent' ? 1 : 100}
                      max={discountType === 'percent' ? 100 : undefined}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="input-field h-10 w-32 pl-6 text-right tabular-nums"
                    />
                  </div>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-ink/50">
                Applied per 28-day cycle to the list price, then re-charm-rounded.
                Never quotes below the base fee.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: composition-first preview + send/activate ── */}
      {selectedVendorId ? (
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-ink/12 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-ink" strokeWidth={2} />
              <h2 className="text-base font-semibold text-ink">What this vendor gets</h2>
            </div>
            <p className="mb-4 text-xs text-ink/55">
              Everything in Enterprise, automatically — plus the dialed-in
              ceilings below.
            </p>

            <ul className="space-y-1.5 text-sm text-ink/80">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                All Enterprise features + white-glove onboarding
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                {comp.branches} {comp.branches === 1 ? 'branch' : 'branches'}
                {extraBranches > 0 ? ` (+${extraBranches} beyond the main)` : ' (main only)'}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                {comp.nationwide ? 'Nationwide reach' : `${comp.reachKm} km service reach`}
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                {comp.seats} team seats{extraSeats > 0 ? ` (+${extraSeats} extra)` : ''}
              </li>
              <li className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                {comp.slotsPerCategory} event slots / category
                {extraSlots > 0 ? ` (+${extraSlots})` : ''}
              </li>
              <li className="flex items-center gap-2">
                <Images className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                {comp.photos} portfolio photos
                {photoPacks > 0 ? ` (+${photoPacks} pack${photoPacks === 1 ? '' : 's'})` : ''}
              </li>
              {comp.tokensPerCycle > 0 ? (
                <li className="flex items-center gap-2">
                  <Coins className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                  {comp.tokensPerCycle} tokens included every cycle
                </li>
              ) : null}
              {comp.domain ? (
                <li className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                  Branded custom domain
                </li>
              ) : null}
              {comp.api_access ? (
                <li className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                  API access — Enterprise SDK + API keys
                </li>
              ) : null}
            </ul>

            {/* Price block */}
            <div className="mt-5 border-t border-ink/10 pt-4">
              {quote.discountValue > 0 ? (
                <div className="mb-1 flex items-center justify-between text-sm text-ink/50">
                  <span>List price</span>
                  <span className="tabular-nums line-through">{peso(quote.list28)}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink/70">Per 28 days</span>
                <span className="text-2xl font-semibold tabular-nums text-ink">
                  {peso(quote.final28)}
                </span>
              </div>
              {quote.discountValue > 0 ? (
                <div className="mt-1 flex items-center justify-between text-sm font-medium text-emerald-700">
                  <span>Partner discount</span>
                  <span className="tabular-nums">−{peso(quote.discountValue)} / cycle</span>
                </div>
              ) : null}
              <div className="mt-1 flex items-center justify-between text-sm text-ink/60">
                <span>Annual (13 cycles, first 3 free)</span>
                <span className="tabular-nums">{peso(quote.annual)}</span>
              </div>
            </div>

            {/* Assurances */}
            <div className="mt-4 space-y-1 rounded-lg bg-cream/60 p-3 text-xs text-ink/60">
              <div>0% commission on every booking, every cycle.</div>
              <div>Pay via BDO or GCash — manual apply-then-pay.</div>
              <div>Nothing is charged until the payment is approved.</div>
            </div>

            {/* Send quote */}
            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="vendor_profile_id" value={selectedVendorId} />
              <input type="hidden" name="branches" value={comp.branches} />
              <input type="hidden" name="reachKm" value={comp.reachKm} />
              <input type="hidden" name="nationwide" value={String(comp.nationwide)} />
              <input type="hidden" name="seats" value={comp.seats} />
              <input type="hidden" name="slotsPerCategory" value={comp.slotsPerCategory} />
              <input type="hidden" name="photos" value={comp.photos} />
              <input type="hidden" name="tokensPerCycle" value={comp.tokensPerCycle} />
              <input type="hidden" name="domain" value={String(comp.domain)} />
              <input type="hidden" name="api_access" value={String(comp.api_access ?? false)} />
              <input type="hidden" name="unit_base" value={prices.base} />
              <input type="hidden" name="unit_branch" value={prices.branch} />
              <input type="hidden" name="unit_reachStep" value={prices.reachStep} />
              <input type="hidden" name="unit_reachNationwide" value={prices.reachNationwide} />
              <input type="hidden" name="unit_seat" value={prices.seat} />
              <input type="hidden" name="unit_slot" value={prices.slot} />
              <input type="hidden" name="unit_photoPack" value={prices.photoPack} />
              <input type="hidden" name="unit_includedToken" value={prices.includedToken} />
              <input type="hidden" name="unit_domain" value={prices.domain} />
              <input type="hidden" name="discount_type" value={discountType} />
              <input type="hidden" name="discount_value" value={discountValue} />

              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink/60">Pay channel</span>
                <div className="inline-flex rounded-lg border border-ink/15 p-0.5">
                  {(['bdo', 'gcash'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={`rounded-md px-2.5 py-1 font-semibold uppercase transition ${
                        channel === ch ? 'bg-ink text-cream' : 'text-ink/60'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
              <input type="hidden" name="channel" value={channel} />

              <SubmitButton
                className="button-primary flex h-11 w-full items-center justify-center gap-2"
                pendingLabel="Sending quote…"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
                Send quote — {peso(quote.final28)} / 28 days
              </SubmitButton>
            </form>

            {state.status === 'quoted' ? (
              <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                {state.message}
              </p>
            ) : null}
            {state.status === 'error' ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                {state.message}
              </p>
            ) : null}

            {/* Mark active (comp / off-platform-settled) */}
            {loadedPlan ? (
              <form action={activateAction} className="mt-3 border-t border-ink/10 pt-3">
                <input type="hidden" name="vendor_profile_id" value={selectedVendorId} />
                <input type="hidden" name="custom_plan_id" value={loadedPlan.planId} />
                <SubmitButton
                  className="button-secondary flex h-10 w-full items-center justify-center gap-2 text-xs"
                  pendingLabel="Activating…"
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  Mark active (comp / settled off-platform)
                </SubmitButton>
                <p className="mt-1.5 text-[11px] text-ink/45">
                  Skips payment approval — flips the vendor to Custom immediately.
                </p>
              </form>
            ) : null}
            {activateState.status === 'activated' ? (
              <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                {activateState.message}
              </p>
            ) : null}
            {activateState.status === 'error' ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                {activateState.message}
              </p>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
