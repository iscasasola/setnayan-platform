'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import {
  OPEN_SHOP_ERRORS,
  OPEN_SHOP_LOGO_REQUIRED,
  isValidOpenShopEmail,
} from '@/lib/open-shop-validation';
import { FileUpload } from '@/app/_components/file-upload';
import { SERVICE_GROUPS, VENDOR_CATEGORY_LABEL } from '@/lib/vendors';
import { AddressPreview } from './address-preview';
import { CityPin } from './city-pin';
import {
  ServicePicker,
  type PickerParentView,
  type PickerLeafView,
} from './service-picker';
import { becomeVendor } from '../actions';

/**
 * The vendor onboarding wizard (owner 2026-07-03: "we just need the basic";
 * 2026-07-05 owner-required basics folded in — logo + company email are now
 * collected here, not deferred to My Shop). FOUR compact steps, one question
 * each, on ONE always-mounted form (inputs persist across steps; one submit at
 * the end):
 *
 *   1 · Your shop      — logo · shop name · web address (chosen, permanent)
 *   2 · What you do    — primary service · events you serve
 *   3 · Who you are    — name (from the account) · position · number · email
 *   4 · Where you are  — map pin, which names the city
 *
 * Was two steps until 2026-08-10. The owner sketched six; two of those pairs
 * were one question each, and one would have been a single optional field. See
 * `validateStep` for the reasoning that landed on four.
 *
 * Everything else (website, social links, exact HQ pin, EST, portfolio,
 * documents) continues on My Shop — the profile checklist + Get-verified
 * journey are the rest of the onboarding (owner 2026-07-05: keep onboarding to
 * the six basics + location; website + social move to the dashboard).
 *
 * The LOGO is optional here as of 2026-07-21 (owner decision 4: "shop logo is
 * only required before verification. starting your shop can start as name,
 * next is completing the profile, then verification"). It stays a
 * business-profile checklist item, so the vendor still sees it as an
 * outstanding row + a sub-100% completeness ring on My Shop, and still cannot
 * publish or submit for verification without it. Required-ness is read from
 * the shared OPEN_SHOP_LOGO_REQUIRED flag that the server action reads too.
 *
 * The logo upload reuses the shared <FileUpload> → R2 pattern from My Shop; the
 * primary-service labels come from the admin taxonomy (serviceLabels), falling
 * back to the in-code names.
 */
/** Four steps, one question each. See `validateStep` for why not six or two. */
export type Step = 1 | 2 | 3 | 4;
const TOTAL_STEPS = 4;

export function OpenShopWizard({
  mode,
  accountName = null,
  serviceLabels,
  serviceTree = [],
  savedServiceLabel = null,
  existingSlug = null,
  eventTypeOptions,
  vendorProfileId,
  logoDisplayMap,
  defaults,
  error,
  initialStep = 1,
}: {
  /** 'create' = no shop yet · 'complete' = shop exists but was never named. */
  mode: 'create' | 'complete';
  serviceLabels?: Record<string, string>;
  /** parent -> branch -> leaf tree (first-party SKUs already stripped).
   *  Empty = the taxonomy read failed; the wizard falls back to the flat
   *  select so a hiccup can never block a vendor from opening a shop. */
  serviceTree?: PickerParentView[];
  /** Display name for an already-saved pick, so a re-run shows a NAME. */
  savedServiceLabel?: string | null;
  /** The address this shop ALREADY holds. Present = it is settled and cannot
   *  be changed (owner 2026-08-10), so the picker renders read-only. */
  existingSlug?: string | null;
  /** The event types a vendor can serve (admin-driven roster). */
  eventTypeOptions: { key: string; label: string; emoji: string }[];
  /** Owned shop id (null before the row exists) — scopes the logo R2 prefix. */
  vendorProfileId?: string | null;
  /** r2Ref → 24h display URL, so an already-uploaded logo paints on load. */
  logoDisplayMap?: Record<string, string>;
  defaults: {
    shopName: string;
    logoUrl: string;
    primaryService: string;
    eventTypes: string[];
    locationCity: string;
    hqAddress: string;
    contactName: string;
    contactPosition: string;
    contactPhone: string;
    contactEmail: string;
  };
  error?: string;
  /** The signed-in account's own name. Shown READ-ONLY when present (owner
   *  2026-08-10: "your name (automatic from their account)") — presented, not
   *  asked. Falls back to an editable input when the account has none, because
   *  a locked EMPTY required field is a dead end. */
  accountName?: string | null;
  /** From `?step=` — the server sends `&step=N` when it rejects a field, so the
   *  wizard resumes on that step instead of discarding what was typed. */
  initialStep?: Step;
}) {
  // Seeded from `?step=` so a SERVER rejection re-renders on the step that owns
  // the rejected field, instead of dumping the vendor back to the start with
  // everything they typed on later steps gone.
  const [step, setStep] = useState<Step>(
    initialStep && initialStep >= 1 && initialStep <= TOTAL_STEPS ? initialStep : 1,
  );
  const [shopName, setShopName] = useState(defaults.shopName);
  const [logoUrl, setLogoUrl] = useState(defaults.logoUrl);
  const [service, setService] = useState(defaults.primaryService);
  // The picked leaf's LABEL, held alongside its key so the chosen row reads
  // as a name the moment it is tapped — the key alone would print
  // snake_case at the vendor.
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>(
    defaults.eventTypes?.length ? defaults.eventTypes : ['wedding'],
  );
  const toggleEvent = (k: string) =>
    setEvents((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const [stepError, setStepError] = useState<string | null>(null);
  // The form is ALWAYS MOUNTED (values survive step switches), so the gate can
  // read any step's inputs live instead of duplicating them all into state.
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * ── ONE QUESTION PER STEP (owner 2026-08-10) ──────────────────────────────
   * Four, not the six the owner first sketched and not two:
   *   1 your shop        logo · name · address
   *   2 what you do      primary service · events
   *   3 who you are      name · position · number · email
   *   4 where you are    the map
   *
   * The six collapsed because two pairs were one question each — "primary
   * service" and "events you serve" are both *what do you do*, and name /
   * position / number / email are all *how do we reach you*. And with the name
   * coming from the account, the owner's step 4 would have been a single
   * OPTIONAL box: a whole screen and a Continue tap for a field most will skip.
   * Two was rejected on height: a logo dropzone, a name, an address and a map on
   * one screen is the long scroll the split exists to prevent.
   *
   * Validation is per-step and uses the SHARED strings, so a vendor is never
   * told about a problem on a screen they cannot see. The server stays
   * authoritative — this only saves the round trip.
   */
  const validateStep = (n: Step): string | null => {
    if (n === 1) {
      if (!shopName.trim()) return OPEN_SHOP_ERRORS.shopName;
      // Same shared flag the server action gates on — the two can't drift.
      if (OPEN_SHOP_LOGO_REQUIRED && !logoUrl.trim()) return OPEN_SHOP_ERRORS.logo;
      return null;
    }
    if (n === 2) return service ? null : OPEN_SHOP_ERRORS.service;
    if (n === 3) {
      const read = (name: string) =>
        (formRef.current?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
      if (!read('contact_name').trim()) return OPEN_SHOP_ERRORS.contactName;
      if (!read('contact_phone').trim()) return OPEN_SHOP_ERRORS.contactPhone;
      if (!isValidOpenShopEmail(read('contact_email'))) return OPEN_SHOP_ERRORS.contactEmail;
      return null;
    }
    const city =
      (formRef.current?.elements.namedItem('location_city') as HTMLInputElement | null)?.value ?? '';
    return city.trim() ? null : OPEN_SHOP_ERRORS.locationCity;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((n) => (n < TOTAL_STEPS ? ((n + 1) as Step) : n));
  };

  const back = () => {
    setStepError(null);
    setStep((n) => (n > 1 ? ((n - 1) as Step) : n));
  };

  /**
   * The final gate. Walks EVERY step, not just the last one — a vendor can reach
   * step 4 and submit without the intermediate screens ever having been
   * validated (they can go back, clear a field, and jump forward). On a failure
   * it moves to the step that owns the field, so the message is never about a
   * screen the vendor cannot see.
   */
  const submitGate = (e: React.FormEvent<HTMLFormElement>) => {
    for (const n of [1, 2, 3, 4] as Step[]) {
      const err = validateStep(n);
      if (err) {
        setStepError(err);
        setStep(n);
        e.preventDefault();
        return;
      }
    }
    setStepError(null);
  };

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-lg rounded-2xl border p-5 sm:p-7"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
      >
        {/* ── PROGRESS, NOT PROSE (owner 2026-08-10) ────────────────────────
            The storefront icon, the "Open your shop" headline, the "Free during
            launch" blurb and the "How couples reach you" title are all gone —
            owner: "remove these kind of details: (less is more)". With ONE
            question per step the field label already is the title, which is what
            makes removing them safe rather than disorienting.

            "Step 1 of 2" is replaced by four segments that fill. The SHAPE
            carries the count, so no words have to; `aria-valuenow` + the label
            keep that fact available to a screen reader, which cannot see it. */}
        <div
          className="mb-6 flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step}
          aria-label={`Step ${step} of ${TOTAL_STEPS}`}
        >
          {([1, 2, 3, 4] as Step[]).map((n) => (
            <span
              key={n}
              className="h-1 flex-1 overflow-hidden rounded-full"
              style={{ background: 'var(--m-line)' }}
            >
              <span
                className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{
                  width: n <= step ? '100%' : '0%',
                  background: 'var(--m-orange-deep)',
                }}
              />
            </span>
          ))}
        </div>

        {(error || stepError) && (
          <p
            className="mt-4 rounded-lg border p-3 text-xs"
            style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)', color: 'var(--m-ink)' }}
            role="alert"
          >
            {stepError ?? error}
          </p>
        )}

        <form action={becomeVendor} onSubmit={submitGate} className="mt-5 space-y-4">
          {/* Step 1 — always mounted so values survive step switches. */}
          {/* 1 · Your shop. Always mounted, like every panel — inputs persist across
              steps and there is ONE submit at the end. */}
          <div className={step === 1 ? 'space-y-4' : 'hidden'}>
            <div className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Shop logo
                {OPEN_SHOP_LOGO_REQUIRED ? (
                  <span className="ml-1 text-terracotta">*</span>
                ) : (
                  <span className="ml-1 font-normal" style={{ color: 'var(--m-slate-3)' }}>
                    optional
                  </span>
                )}
              </span>
              <FileUpload
                bucket="media"
                pathPrefix={`vendors/${vendorProfileId ?? 'unassigned'}/logo`}
                name="logo_url"
                currentValue={logoUrl || null}
                initialDisplayUrls={logoDisplayMap ?? {}}
                onChange={(v) =>
                  setLogoUrl(Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))
                }
                maxSizeMB={10}
                compressImage
                acceptedTypes={[
                  'image/png',
                  'image/jpeg',
                  'image/webp',
                  'image/heic',
                  'image/heif',
                ]}
                variant="square"
                qrGuard
              />
              {/* ⚠ This used to end "…you'll need it to publish your shop and to
                  get verified." A VENDOR CANNOT PUBLISH THEIR SHOP — there is no
                  such control for them anywhere, and approval is what makes a
                  shop public. It was the last survivor of the same false idea
                  removed from the two QR surfaces on 2026-08-09; a sweep for
                  "publish your profile/page" missed it because this one says
                  "publish your SHOP". Getting verified is the true and only
                  reason the logo is required — it is one of the business-profile
                  fields, and the profile must be complete before documents can
                  be submitted. */}
              <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Needed before your shop is approved — add it now or later.
              </span>
            </div>
            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Shop name<span className="ml-1 text-terracotta">*</span>
              </span>
              <input
                name="shop_name"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                maxLength={128}
                placeholder="e.g. Banawe Florals"
                className="input-field"
                autoFocus
              />
              {/* The shop name IS the web address (owner 2026-08-09). Showing it
                  while they type is the only moment a vendor can still choose a
                  different name over it — afterwards the address is permanent,
                  because a save-the-date already points at it. */}
              <AddressPreview shopName={shopName} existingSlug={existingSlug} />
            </label>
          </div>
          {/* 2 · What you do. Service and events are the same question asked twice;
              splitting them would add a tap and remove no thinking. */}
          <div className={step === 2 ? 'space-y-4' : 'hidden'}>
            <div className="block space-y-1.5">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Primary service<span className="ml-1 text-terracotta">*</span>
              </span>
              {/* ── DRILL, DON'T SCROLL (owner 2026-08-09) ────────────────────
                  "primary service must branch from parent category until it
                  reaches leaf category." This was a flat <select> over ~45
                  COARSE categories; the real taxonomy is 15 groups -> 70
                  branches -> ~237 specific services, and a vendor could not say
                  what they actually do. The picker walks the real tree.

                  The flat select survives as the FALLBACK for an empty tree (a
                  failed taxonomy read). Deleting it would turn a read hiccup
                  into "you cannot open a shop", which is far worse than a
                  coarser choice for one session. */}
              {serviceTree.length > 0 ? (
                <>
                  <input type="hidden" name="primary_service" value={service} />
                  <ServicePicker
                    tree={serviceTree}
                    value={service}
                    labelForValue={
                      pickedLabel ?? (service ? (savedServiceLabel ?? null) : null)
                    }
                    onPick={(leaf: PickerLeafView | null) => {
                      setService(leaf?.canonicalService ?? '');
                      setPickedLabel(leaf?.label ?? null);
                    }}
                  />
                </>
              ) : (
                <select
                  name="primary_service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="input-field"
                >
                  <option value="" disabled>
                    Pick the one thing you&rsquo;re known for
                  </option>
                  {SERVICE_GROUPS.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {g.members.map((m) => (
                        <option key={m} value={m}>
                          {serviceLabels?.[m] ?? VENDOR_CATEGORY_LABEL[m]}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Pick one — add more later.
              </span>
            </div>
            <div className="block space-y-1.5">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Events you serve
              </span>
              {/* ── EVEN COLUMNS, NOT A RAGGED WRAP (owner 2026-08-09) ────────
                  These were `flex flex-wrap` pills, so each row packed a
                  different number of differently-sized chips — "Celebration ·
                  Travel · Corporate" on one line, "Wedding · Debut" on the next.
                  Nothing lined up and the list read as noise rather than a set
                  of choices.

                  `auto-fit` + `minmax` is the auto-adapting checklist the owner
                  asked for: the browser fits as many equal columns as the width
                  allows — 2 on a narrow phone, 3–4 on a wide one — with every
                  cell the same size and every row aligned. No breakpoint list to
                  maintain, and it cannot go ragged. `truncate` on the label
                  keeps a long name from widening its whole column. */}
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(8.5rem, 1fr))' }}
              >
                {eventTypeOptions.map((e) => {
                  const on = events.includes(e.key);
                  return (
                    <label
                      key={e.key}
                      className="flex cursor-pointer select-none items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors"
                      style={
                        on
                          ? { background: 'var(--m-ink)', color: 'var(--m-paper)', borderColor: 'var(--m-ink)' }
                          : { borderColor: 'var(--m-line)', color: 'var(--m-slate)' }
                      }
                    >
                      <input
                        type="checkbox"
                        name="event_types"
                        value={e.key}
                        checked={on}
                        onChange={() => toggleEvent(e.key)}
                        className="hidden"
                      />
                      <span aria-hidden className="shrink-0">{e.emoji}</span>
                      <span className="truncate">{e.label}</span>
                    </label>
                  );
                })}
              </div>
              <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Pick all that apply.
              </span>
            </div>
          </div>
          {/* 3 · Who you are, and how to reach you. */}
          <div className={step === 3 ? 'space-y-4' : 'hidden'}>
            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Your name<span className="ml-1 text-terracotta">*</span>
              </span>
              <input
                name="contact_name"
                // Owner 2026-08-10: "your name (automatic from their account)".
                // READONLY, not disabled — a disabled input submits NOTHING, and
                // this field is required, so disabling it would post a blank name
                // and bounce the vendor with a message about a box they cannot
                // type in. Falls back to editable when the account has no name:
                // a locked EMPTY required field is a dead end.
                readOnly={!!accountName}
                defaultValue={accountName ?? defaults.contactName}
                maxLength={128}
                placeholder="e.g. Ana Reyes"
                className="input-field"
                style={accountName ? { background: 'var(--m-paper-2)', color: 'var(--m-slate)' } : undefined}
              />
              {accountName ? (
                <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
                  From your account.
                </span>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Your position
                <span className="ml-1 font-normal" style={{ color: 'var(--m-slate-3)' }}>
                  optional
                </span>
              </span>
              {/* Owner 2026-08-10: "just text box so we know what their position
                  is." Free text, not a dropdown — no canonical list of PH
                  small-business roles covers the real answers, and a picker here
                  would refuse the true one to keep the data tidy. Optional: no
                  existing shop has one, so requiring it would block every
                  returning vendor on a field that did not exist when they
                  registered. */}
              <input
                name="contact_position"
                defaultValue={defaults.contactPosition}
                maxLength={64}
                placeholder="e.g. Owner"
                className="input-field"
              />
            </label>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Contact number<span className="ml-1 text-terracotta">*</span>
              </span>
              <input
                name="contact_phone"
                type="tel"
                inputMode="tel"
                defaultValue={defaults.contactPhone}
                maxLength={32}
                placeholder="+63 917 …"
                className="input-field"
              />
            </label>

            <label className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Company email<span className="ml-1 text-terracotta">*</span>
              </span>
              <input
                name="contact_email"
                type="email"
                defaultValue={defaults.contactEmail}
                maxLength={254}
                placeholder="hello@yourstudio.ph"
                className="input-field"
              />
            </label>
          </div>
          {/* 4 · Where you are. Its own step because the map is the one element that
              needs full attention and cannot be made smaller. */}
          <div className={step === 4 ? 'space-y-4' : 'hidden'}>
            <div className="block space-y-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                Where you are<span className="ml-1 text-terracotta">*</span>
              </span>
              {/* Owner 2026-08-10: "city should be the exact map location. which
                  will provide their city." Free text is how a marketplace ends
                  up with "QC", "Quezon city" and "Q.C." as three places. The pin
                  writes the city; the field stays editable so a rural pin that
                  resolves to a province can be corrected. */}
              <CityPin defaultCity={defaults.locationCity} defaultAddress={defaults.hqAddress} />
            </div>
          </div>


          {/* One nav row for every step. Back appears from step 2; the primary
              button becomes the real submit only on the last one — a
              SubmitButton on an earlier step would post a half-filled form. */}
          <div className="flex items-center gap-2 pt-1">
            {step > 1 ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-ink/60 hover:bg-ink/5"
                style={{ borderColor: 'var(--m-line)' }}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={next}
                className="button-primary inline-flex h-12 w-full items-center justify-center gap-2 text-sm"
              >
                Continue
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
            ) : (
              <SubmitButton
                className="button-primary inline-flex h-12 w-full items-center justify-center gap-2 text-sm"
                pendingLabel="Opening your shop…"
              >
                Open my shop — free
              </SubmitButton>
            )}
          </div>

        </form>

      </div>
    </main>
  );
}
