'use client';

import Image from 'next/image';
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { X, Check, Camera, AlertCircle, Upload, ArrowLeft, MapPin } from 'lucide-react';
import {
  addManualSupplier,
  updateSelfAddedSupplier,
  type SelfAddedSupplierPrefill,
  attachMarketplaceVendorToCategory,
  searchMarketplaceVendorsByName,
  updateVendorCosts,
  type MarketplaceVendorSuggestion,
} from '../vendors/actions';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import {
  MANUAL_VENUE_ADDRESS_HINT,
  MANUAL_VENUE_ADDRESS_LABEL,
  MANUAL_VENUE_ADDRESS_MAX,
  MANUAL_VENUE_ADDRESS_PLACEHOLDER,
  manualVendorNeedsAddress,
} from '@/lib/manual-venue-address';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { AddressPinField } from './address-pin-field';
import { SupplierConnectPanel } from './supplier-connect-panel';
import { ServicesCoveredPicker } from './services-covered-picker';
import { PaymentPlanRows } from './payment-plan-rows';
import { PLAN_GROUPS, planGroupForCategory } from '@/lib/wedding-plan-groups';

// Modal for the "+ Add new manual vendor" path inside ManualVendorDropdown.
//
// Owner directive 2026-05-22: manual vendor input must capture Photo +
// Vendor Name + Contact Person + Contact Number. Photo is optional in
// the schema (host can skip and add later) but the form treats it as
// strongly encouraged — every other field is required.
//
// Owner directive 2026-05-22 (extended 2026-05-23): as the host types
// the vendor name, ALSO search the existing Setnayan marketplace.
// Matches surface in a debounced autocomplete below the input. Picking
// a match flips the modal into "linking" mode — the manual fields
// collapse, a confirmation card shows the picked vendor + Cancel
// affordance. Save inserts an event_vendors row with
// marketplace_vendor_id (not manual_vendor_id). Cross-category vendors
// (matched name doesn't list THIS card's category as a service) get an
// amber notice — host can still pick them but is informed.
//
// Two-step submit on Save (manual fallback path · unchanged):
//   1. createManualVendor → returns manual_vendor_id (incl. photo upload
//      if a file was picked)
//   2. attachManualVendorToCategory → wires the new row into the
//      current planning card
//
// Marketplace-link submit (new path):
//   1. attachMarketplaceVendorToCategory → inserts event_vendors row
//      with marketplace_vendor_id + service_id (when available)
//
// On success we call onCreated() so the parent dropdown closes + the
// page revalidates (server actions already revalidatePath the dashboard
// route — the post-submit refresh sweeps the new card into the picks
// list automatically).
//
// Brand voice: cream bg, terracotta accent, Cormorant italic for
// display name, Manrope body. WCAG 2.2 AA — focus traps via initial
// autoFocus on Vendor Name input; ESC closes; 44px tap targets.
//
// Responsive: mobile = full-width fixed bottom-sheet rising from the
// thumb-zone; desktop = centered modal on dim backdrop. Autocomplete
// dropdown scrolls if many matches; on mobile it doesn't overflow the
// modal (max-h capped + overflow-y-auto).

type Props = {
  eventId: string;
  category: string;
  categoryLabel: string;
  onClose: () => void;
  onCreated: () => void;
  /**
   * DETAILS MODE (2026-09-21). Present when the sheet is opened by tapping a
   * self-added supplier's card on Your Team, not by "Add manually". Owner:
   * "with this we have the power to update [and] improve the purchase details
   * for that vendor." Same sheet, same eight fields, pre-filled from
   * `loadSelfAddedSupplier` and saved through `updateSelfAddedSupplier` — so
   * there is one form to add a supplier and the same one to complete them.
   */
  edit?: SelfAddedSupplierPrefill;
};

// State machine for the modal's primary action.
// 'manual'  = host is typing or has typed a brand-new contact name —
//             Save creates an event_manual_vendors row + attaches.
// 'linked'  = host clicked a marketplace match — manual fields collapse,
//             confirmation card shows; Save inserts an event_vendors row
//             with marketplace_vendor_id. Cancel returns to 'manual'.
type ModalMode =
  | { kind: 'manual' }
  | { kind: 'linked'; vendor: MarketplaceVendorSuggestion };

export function NewManualVendorModal({
  eventId,
  category,
  categoryLabel,
  edit,
  onClose,
  onCreated,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /* The two categories that ARE a place owe an exact address (owner
     2026-09-20). The same predicate `createManualVendor` re-asks server-side —
     this only decides the label, the hint and the `required` attribute. */
  const addressRequired = manualVendorNeedsAddress(category);
  /* The price drives the payment plan's running total, so it is controlled
     here rather than left uncontrolled like the other text fields. */
  const isEdit = Boolean(edit);
  const [priceInput, setPriceInput] = useState(edit?.price ?? '');
  const priceNumber = (() => {
    const n = Number(priceInput.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  /* Every plan group, with the booking's own one passed separately so the
     picker can render it locked. Same set the workspace editor offers. */
  const ownGroupId = planGroupForCategory(category as VendorCategory);
  const coverOptions = PLAN_GROUPS.map((g) => ({ id: g.id as string, label: g.label }));
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Post-save step (owner 2026-06-11: adding your own vendor must be easy to
  // manage — price + invite land HERE, zero navigation). Set after the manual
  // two-step submit succeeds; the form swaps for the quick-options panel.
  // Marketplace-link mode skips it (already on Setnayan, price comes from
  // their listing).
  const [created, setCreated] = useState<{ eventVendorId: string; name: string } | null>(null);
  /** Set when the supplier saved but one of the later fields did not. */
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  // Once the vendor exists, EVERY close affordance (X, backdrop, ESC) must
  // route through onCreated so the parent refreshes the page — the row is
  // real even if the host skips the quick options.
  const dismissRef = useRef(onClose);
  useEffect(() => {
    dismissRef.current = created ? onCreated : onClose;
  }, [created, onClose, onCreated]);
  const dismiss = () => dismissRef.current();

  // Focus trap + scroll-lock + Esc-to-close via the shared hook. Mounts only
  // while open, so `open` is the constant true. Esc/close route through
  // `dismiss` so a post-save Esc still refreshes the page (dismissRef points
  // at onCreated once the vendor exists). Initial focus lands on the Vendor
  // Name input.
  useModalA11y({
    open: true,
    onClose: dismiss,
    containerRef: dialogRef,
    initialFocusRef: firstFieldRef,
  });

  // Autocomplete state — owner directive 2026-05-22.
  // `nameQuery` is the live value of the Vendor Name input. Debounced
  // 300ms before firing the search. `suggestions` holds the latest
  // server response. `searching` is true while a debounced request is
  // in flight (renders the subtle "Searching…" hint).
  const [mode, setMode] = useState<ModalMode>({ kind: 'manual' });
  const [nameQuery, setNameQuery] = useState(edit?.name ?? '');
  const [suggestions, setSuggestions] = useState<
    ReadonlyArray<MarketplaceVendorSuggestion>
  >([]);
  const [searching, setSearching] = useState(false);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  // Bumps every time the user types so a stale in-flight response can
  // be discarded (last-write-wins). Stronger than AbortController for
  // server actions, which don't expose a cancel signal.
  const queryGenerationRef = useRef(0);

  // Debounced marketplace search. Fires 300ms after typing stops to
  // avoid spamming the server on every keystroke. Empty / <2 chars
  // collapses the dropdown without a server call. The
  // queryGenerationRef pattern guarantees a slow response doesn't
  // clobber a faster newer response.
  useEffect(() => {
    if (mode.kind !== 'manual') return; // skip search while in linked mode
    // Editing a supplier who already exists: renaming them is not a request to
    // link a different marketplace shop, so the autocomplete stays quiet.
    if (isEdit) return;
    const trimmed = nameQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      setAutocompleteOpen(false);
      return;
    }
    queryGenerationRef.current += 1;
    const myGeneration = queryGenerationRef.current;
    setSearching(true);
    setAutocompleteOpen(true);
    const handle = window.setTimeout(async () => {
      const result = await searchMarketplaceVendorsByName(
        trimmed,
        eventId,
        category,
      );
      // Discard stale response.
      if (myGeneration !== queryGenerationRef.current) return;
      setSearching(false);
      if (result.status === 'ok') {
        setSuggestions(result.matches);
      } else {
        // not_signed_in / invalid_input — silently collapse. The Save
        // path will surface a hard error if the host is actually
        // signed out.
        setSuggestions([]);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [nameQuery, eventId, category, mode.kind, isEdit]);

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    setNameQuery(e.currentTarget.value);
  }

  function handlePickMarketplaceVendor(vendor: MarketplaceVendorSuggestion) {
    setMode({ kind: 'linked', vendor });
    setAutocompleteOpen(false);
    setErrorMsg(null);
  }

  function handleCancelLink() {
    setMode({ kind: 'manual' });
    setErrorMsg(null);
    // Keep the typed name so the host can keep refining without
    // re-typing.
    setTimeout(() => firstFieldRef.current?.focus(), 0);
  }

  // Photo preview lifecycle — revoke object URLs when they change OR
  // when the modal closes so we don't leak memory.
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      setPhotoPreviewUrl(null);
      return;
    }
    // Friendly client-side guard. uploadPublicAsset re-validates on the
    // server but this lets us show an early error without the round-trip.
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Photo must be an image (JPEG, PNG, WebP, or HEIC).');
      e.currentTarget.value = '';
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setErrorMsg('Photo must be 6 MB or smaller.');
      e.currentTarget.value = '';
      return;
    }
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setErrorMsg(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    // Linked-mode branch (NEW · marketplace vendor picked from
    // autocomplete). Skip the manual create + attach two-step entirely
    // and call attachMarketplaceVendorToCategory once.
    if (mode.kind === 'linked') {
      startTransition(async () => {
        const linkFd = new FormData();
        linkFd.set('event_id', eventId);
        linkFd.set('marketplace_vendor_id', mode.vendor.vendor_profile_id);
        linkFd.set('category', category);
        const result = await attachMarketplaceVendorToCategory(linkFd);
        if (result.status === 'not_signed_in') {
          const next = encodeURIComponent(
            window.location.pathname + window.location.search,
          );
          window.location.href = `/login?next=${next}`;
          return;
        }
        if (result.status === 'already_attached') {
          // The autocomplete should have filtered this out, but a
          // stale dropdown (host has two tabs open) could submit a
          // duplicate. Treat as success — the row exists.
          onCreated();
          return;
        }
        if (result.status === 'invalid_category' || result.status === 'invalid_input') {
          setErrorMsg('Could not add. Try again.');
          return;
        }
        if (result.status === 'marketplace_vendor_not_found') {
          setErrorMsg('This vendor is no longer available. Try searching again.');
          // Drop back to manual mode so the host can re-search.
          setMode({ kind: 'manual' });
          return;
        }
        if (result.status === 'error') {
          setErrorMsg(result.message ?? 'Could not add.');
          return;
        }
        onCreated();
      });
      return;
    }

    // ── Manual-mode branch: ONE call for the whole sheet (2026-09-20) ────
    // This was a two-step (`createManualVendor` → `attachManualVendorToCategory`)
    // with price arriving later from the post-save panel. With eight fields on
    // one screen that would have become four or five sequential server calls
    // from the browser, where a failure on the third leaves a supplier who
    // exists, is attached, has no price and no plan — beside a success screen.
    // `addManualSupplier` runs the sequence server-side and reports partial
    // failure as a WARNING against a real supplier, never as a failed add:
    // a couple told "failed" adds them again and gets a duplicate.
    const fd = new FormData(e.currentTarget);
    const nameEntry = fd.get('business_name');
    const savedName =
      typeof nameEntry === 'string' && nameEntry.trim().length > 0
        ? nameEntry.trim()
        : 'Your vendor';
    if (edit) {
      startTransition(async () => {
        const result = await updateSelfAddedSupplier(fd);
        if (result.status === 'not_signed_in') {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${next}`;
          return;
        }
        if (result.status === 'error') {
          setErrorMsg(result.message ?? 'Could not save.');
          return;
        }
        if (result.warning) {
          // Some of it saved and some did not — keep the sheet open on the
          // sentence that names what, rather than closing over a partial save.
          setErrorMsg(result.warning);
          return;
        }
        onCreated();
      });
      return;
    }
    startTransition(async () => {
      const result = await addManualSupplier(fd);
      if (result.status === 'not_signed_in') {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.href = `/login?next=${next}`;
        return;
      }
      if (result.status === 'error') {
        setErrorMsg(result.message ?? 'Could not save.');
        return;
      }
      setErrorMsg(null);
      // A warning is shown ON the success step, not instead of it — the
      // supplier is real and the sentence says exactly what to finish.
      setSaveWarning(result.warning ?? null);
      setCreated({ eventVendorId: result.eventVendorId, name: savedName });
    });
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-manual-vendor-heading"
      className="sn-addman-veil fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm focus:outline-none sm:items-center sm:p-4"
      onClick={(e) => {
        // Click backdrop to close, but ignore clicks inside the form.
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        /* 🔴 THE SHEET SCROLLS INSIDE THE VIEWPORT (2026-09-21) — measured live
           on production the day it shipped. Eight fields and a 200px map made
           this sheet 1,513px tall in a 768px window. It sits in a `fixed
           inset-0` overlay, which CANNOT scroll, and `sm:items-center` centred
           it — so it overflowed 372px off BOTH edges. The required Vendor name
           field sat at y = -174 and "Save & add" below the fold: a couple on a
           laptop could not reach either. The old four-field sheet fit; the
           consolidation broke it, and no source guard could see it.
           So the sheet caps its own height and scrolls, and the footer below is
           sticky, so the primary action never scrolls away on a long form.
           `dvh`, not `vh`: on a phone `vh` includes the browser chrome, which
           would push the pinned footer under the address bar. */
        className="sn-addman-sheet max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border-t border-ink/10 bg-cream p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              {categoryLabel}
            </p>
            <h2
              id="new-manual-vendor-heading"
              className="font-display text-xl italic text-ink"
            >
              {edit ? `Edit ${edit.name || 'supplier'}` : 'Add a contact'}
            </h2>
            <p className="mt-1 text-xs text-ink/65">
              {created
                ? 'Saved! Two quick options — both optional.'
                : edit
                  ? 'Complete or improve what you agreed with them.'
                  : 'Save once · reuse anywhere on your plan.'}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        {created ? (
          <PostSaveStep
            warning={saveWarning}
            eventId={eventId}
            eventVendorId={created.eventVendorId}
            vendorName={created.name}
            categoryLabel={categoryLabel}
            onDone={onCreated}
          />
        ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-3.5"
          encType="multipart/form-data"
        >
          <input type="hidden" name="event_id" value={eventId} />
          {/* The category rides along so `createManualVendor` can re-ask the
              address rule server-side. The modal is always opened FROM a
              category card, so this is never a guess. */}
          <input type="hidden" name="category" value={category} />
          {edit ? <input type="hidden" name="vendor_id" value={edit.vendorId} /> : null}

          {mode.kind === 'linked' ? (
            // LINKED MODE — host picked a marketplace vendor from the
            // autocomplete. Manual fields collapse; the picked vendor
            // shows as a confirmation card with a Cancel affordance.
            // Save inserts an event_vendors row with marketplace_vendor_id.
            <LinkedVendorConfirmation
              vendor={mode.vendor}
              currentCategoryLabel={categoryLabel}
              currentCategory={category}
              onCancel={handleCancelLink}
              disabled={pending}
            />
          ) : (
            // MANUAL MODE — the full Add-a-contact form per the existing
            // owner directive 2026-05-22. Vendor Name input now drives
            // an autocomplete dropdown that searches the marketplace.
            <>
              {/* The photo picker is ADD-only: `updateSelfAddedSupplier` does not
                  carry a photo, so offering one here would take a file and
                  silently drop it. */}
              {isEdit ? null : (
                <>
              {/* Photo upload — round preview + Choose button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Choose a photo"
                  className="group relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-ink/25 bg-cream transition-colors hover:border-terracotta/60"
                >
                  {photoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreviewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera
                      aria-hidden
                      className="h-5 w-5 text-ink/40 transition-colors group-hover:text-terracotta"
                      strokeWidth={1.75}
                    />
                  )}
                </button>
                <div className="flex flex-col gap-1 text-xs text-ink/65">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 self-start rounded-md border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta-700"
                  >
                    <Upload aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                    {photoPreviewUrl ? 'Replace photo' : 'Add photo'}
                  </button>
                  <span className="text-[10px] text-ink/45">
                    Optional — JPEG, PNG, WebP, or HEIC up to 6 MB.
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  name="photo"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
              </div>

                </>
              )}

              {/* Vendor name + marketplace autocomplete wrapper. The
                  dropdown anchors to the input via absolute positioning
                  inside this relative container so it floats above
                  whatever sits below in the form. */}
              <div className="relative">
                <Field label="Vendor name" htmlFor="manual-vendor-name" required step={0}>
                  <input
                    ref={firstFieldRef}
                    id="manual-vendor-name"
                    name="business_name"
                    type="text"
                    required
                    maxLength={128}
                    disabled={pending}
                    value={nameQuery}
                    onChange={handleNameChange}
                    onFocus={() => {
                      if (nameQuery.trim().length >= 2) setAutocompleteOpen(true);
                    }}
                    autoComplete="off"
                    placeholder="e.g. Tito Marcel"
                    className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
                  />
                </Field>
                {autocompleteOpen && nameQuery.trim().length >= 2 ? (
                  <MarketplaceAutocomplete
                    matches={suggestions}
                    searching={searching}
                    currentCategoryLabel={categoryLabel}
                    currentCategory={category}
                    onPick={handlePickMarketplaceVendor}
                    onDismiss={() => setAutocompleteOpen(false)}
                  />
                ) : null}
              </div>

              <Field
                label="Contact person"
                htmlFor="manual-vendor-contact-person"
                required
                step={1}
                hint="Who to call · usually the same as Vendor name."
              >
                <input
                  id="manual-vendor-contact-person"
                  name="contact_person"
                  type="text"
                  defaultValue={edit?.contactPerson}
                  required
                  maxLength={128}
                  disabled={pending}
                  placeholder="e.g. Marcel Santos"
                  className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
                />
              </Field>

              <Field
                label="Contact number"
                htmlFor="manual-vendor-contact-number"
                required
                step={2}
                hint="Mobile preferred · e.g. +63 917 555 1234"
              >
                <input
                  id="manual-vendor-contact-number"
                  name="contact_number"
                  defaultValue={edit?.contactNumber}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  maxLength={32}
                  disabled={pending}
                  placeholder="+63 9XX XXX XXXX"
                  className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
                />
              </Field>

              {/* Address + PIN (owner 2026-09-20 — the sheet carries an "Address
                  Pin", not an address). Required for the two categories that
                  ARE a place; the pin itself is always optional, because a
                  wrong pin routes guests somewhere real and incorrect. */}
              <div className="sn-addman-field" style={{ animationDelay: '255ms' }}>
                <AddressPinField
                  required={addressRequired}
                  disabled={pending}
                  initialAddress={edit?.address}
                  initialPin={edit?.pin ?? null}
                />
              </div>

              {/* ── The four fields that used to live on two other tabs ──────
                  Owner 2026-09-20: "how about we keep it simple?" — one sheet
                  carrying Vendor Name · Contact Person · Contact Number ·
                  Address Pin · Services Covered · Inclusions · Price ·
                  Payment Plan. Services and inclusions were on the workspace
                  Details tab, price and the plan on Payments; the couple who
                  reported this was standing on a Quote tab that rendered
                  nothing while all four sat one tab away. */}
              <div className="sn-addman-field space-y-1" style={{ animationDelay: '300ms' }}>
                <p className="block text-xs font-medium uppercase tracking-[0.08em] text-ink/65">
                  What services does this cover
                </p>
                <ServicesCoveredPicker
                  options={coverOptions}
                  ownGroupId={ownGroupId}
                  ownGroupLabel={categoryLabel}
                  initialSelected={edit?.covers ?? []}
                  disabled={pending}
                />
              </div>

              <Field
                label="Inclusions"
                htmlFor="manual-vendor-inclusions"
                hint="One per line — what the price covers."
                step={5}
              >
                <textarea
                  id="manual-vendor-inclusions"
                  name="inclusions"
                  defaultValue={edit?.inclusions}
                  rows={3}
                  disabled={pending}
                  placeholder={'e.g.\nBallroom, 6am–12mn\nTables and chairs'}
                  className="w-full resize-y rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
                />
              </Field>

              <Field
                label="Price"
                htmlFor="manual-vendor-price"
                hint="What you agreed, in pesos. The payment plan below has to add up to it."
                step={6}
              >
                <input
                  id="manual-vendor-price"
                  name="total_cost_php"
                  type="text"
                  inputMode="decimal"
                  disabled={pending}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="80000"
                  className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
                />
              </Field>

              <div className="sn-addman-field space-y-1" style={{ animationDelay: '435ms' }}>
                <p className="block text-xs font-medium uppercase tracking-[0.08em] text-ink/65">
                  Payment plan
                </p>
                {/* The running total reads the price field live, so the couple
                    sees "₱80,000 of ₱80,000" as they type rather than only
                    when the server refuses the save. */}
                <PaymentPlanRows
                  totalPhp={priceNumber}
                  disabled={pending}
                  initial={edit && edit.planRows.length > 0 ? edit.planRows : undefined}
                />
              </div>

              {/* Owner 2026-07-01: note to couples that a self-added vendor is
                  NOT Setnayan-verified. Friendly framing — we add them free so
                  the couple can manage their whole plan in one place. */}
              <p className="flex items-start gap-1.5 rounded-md border border-ink/10 bg-paper px-2.5 py-2 text-[11px] leading-snug text-ink/65">
                <AlertCircle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={2} />
                <span>
                  Heads up — vendors you add yourself aren&apos;t verified by
                  Setnayan. We add them free so you can manage your whole plan in
                  one place 💛 — just vet them yourself before booking.
                </span>
              </p>
            </>
          )}

          {errorMsg ? (
            <p
              role="alert"
              className="flex items-center gap-1.5 rounded-md border border-danger-300/50 bg-danger-50/60 px-2.5 py-1.5 text-[11px] text-danger-900"
            >
              <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {errorMsg}
            </p>
          ) : null}

          {/* PINNED FOOTER. Negative margins run it edge to edge across the
              sheet's p-5, and the matching padding puts the buttons back where
              they were. Sticky works here BECAUSE the sheet's entrance uses
              `backwards`: `both` would leave an identity transform on the
              sheet after the run, and a transformed ancestor breaks sticky the
              same way it breaks position:fixed. */}
          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-2 flex flex-col-reverse gap-2 border-t border-ink/10 bg-cream px-5 py-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-ink/15 bg-cream px-3.5 text-sm font-medium text-ink/70 transition-colors hover:text-ink disabled:opacity-60 sm:px-5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-terracotta/40 bg-mulberry px-3.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-700 disabled:cursor-default disabled:opacity-60 sm:px-5"
            >
              {pending ? (
                <>
                  <Spinner />
                  {mode.kind === 'linked' ? 'Adding…' : 'Saving…'}
                </>
              ) : mode.kind === 'linked' ? (
                <>
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Add to plan
                </>
              ) : (
                <>
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                  {edit ? 'Save changes' : <>Save &amp; add</>}
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PostSaveStep — the quick-options panel shown right after a manual contact
// is saved (owner 2026-06-11: adding your own vendor must be easy to manage).
// Two optional moves, zero navigation:
//   1. Price — one ₱ field. A priced service passes the "only priced services
//      can join the build" gate immediately, so the host can Add-to-build
//      without ever opening the workspace.
//   2. Invite — generates the idempotent auto-share claim link (same primitive
//      finalizeVendor uses at lock). When the vendor signs up through it,
//      everything the host recorded auto-links to their new account.
// ============================================================================

function PostSaveStep({
  eventId,
  eventVendorId,
  vendorName,
  categoryLabel,
  warning,
  onDone,
}: {
  eventId: string;
  eventVendorId: string;
  vendorName: string;
  categoryLabel: string;
  /** Set when the supplier saved but a later field did not — see addManualSupplier. */
  warning: string | null;
  onDone: () => void;
}) {

  return (
    <div className="space-y-3.5">
      <p className="flex items-center gap-2 rounded-md border border-success-300/50 bg-success-50/60 px-3 py-2 text-sm text-success-900">
        <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        <span>
          <span className="font-semibold">{vendorName}</span> added to {categoryLabel}.
        </span>
      </p>

      {/* ⚠ THE PRICE INPUT THAT WAS HERE IS GONE (2026-09-20). The sheet
          above now carries Price and Payment Plan, so a second input here
          would be a second writer of `total_cost_php` — and the couple has
          already answered the question. What remains is the one thing that
          genuinely only makes sense AFTER the supplier exists: their invite. */}
      {warning ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warn-300/60 bg-warn-50/70 px-3 py-2 text-xs leading-snug text-warn-900"
        >
          <AlertCircle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>{warning}</span>
        </p>
      ) : null}

      {/* The supplier's portal — extracted to SupplierConnectPanel so the
          same panel also opens from [Connect] on their card. This step used
          to be the ONLY place it existed, and it vanished when the sheet
          closed (owner 2026-09-20: "i dont have access for this qr"). */}
      <SupplierConnectPanel eventId={eventId} vendorId={eventVendorId} vendorName={vendorName} />

      <button
        type="button"
        onClick={onDone}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md border border-terracotta/40 bg-mulberry px-3.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-700"
      >
        Done
      </button>
    </div>
  );
}

// ============================================================================
// MarketplaceAutocomplete — the dropdown that surfaces below the Vendor
// Name input when the host has typed ≥2 chars. Renders 4 states:
//   1. searching                — subtle "Searching…" hint
//   2. no matches               — hidden entirely (the host can keep
//                                  typing and Save as a manual contact)
//   3. matches · serves current — standard row with Pick CTA
//   4. matches · cross-category — same row with amber notice listing
//                                  the vendor's actual service categories
//
// Mobile-friendly: max-h capped + overflow-y-auto so a long list doesn't
// overflow the modal. Click-outside is handled by the parent's onDismiss.
// ============================================================================

function MarketplaceAutocomplete({
  matches,
  searching,
  currentCategoryLabel,
  currentCategory,
  onPick,
  onDismiss,
}: {
  matches: ReadonlyArray<MarketplaceVendorSuggestion>;
  searching: boolean;
  currentCategoryLabel: string;
  currentCategory: string;
  onPick: (vendor: MarketplaceVendorSuggestion) => void;
  onDismiss: () => void;
}) {
  // State 1 — searching with no matches yet. Subtle loading hint.
  if (searching && matches.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="Marketplace vendor matches"
        className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-ink/15 bg-cream p-3 shadow-lg"
      >
        <p className="flex items-center gap-2 text-[11px] text-ink/55">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta"
          />
          Searching Setnayan vendors…
        </p>
      </div>
    );
  }

  // State 2 — empty (not searching, no matches). Per owner directive
  // 2026-05-22 + [[feedback_setnayan_no_dev_text_post_launch]], the
  // empty state is HIDDEN — the host can keep typing and Save as a
  // manual contact. No "no results" message.
  if (matches.length === 0) return null;

  // States 3 + 4 — render rows. Sorted server-side: vendors serving
  // the current category first, then by business_name.
  return (
    <div
      role="listbox"
      aria-label="Marketplace vendor matches"
      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-ink/15 bg-cream shadow-lg"
    >
      <header className="sticky top-0 flex items-center justify-end border-b border-ink/10 bg-cream px-3 py-2">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close suggestions"
          className="text-[10px] uppercase tracking-[0.1em] text-ink/45 transition-colors hover:text-ink/75"
        >
          Hide
        </button>
      </header>
      <ul className="py-1">
        {matches.map((vendor) => (
          <li key={vendor.vendor_profile_id}>
            <SuggestionRow
              vendor={vendor}
              currentCategoryLabel={currentCategoryLabel}
              currentCategory={currentCategory}
              onPick={onPick}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
  vendor,
  currentCategoryLabel,
  currentCategory,
  onPick,
}: {
  vendor: MarketplaceVendorSuggestion;
  currentCategoryLabel: string;
  currentCategory: string;
  onPick: (vendor: MarketplaceVendorSuggestion) => void;
}) {
  const isCrossCategory = !vendor.serves_current_category;
  // ALREADY RESOLVED — do not hand a raw stored-asset value to <Image>.
  // This modal is a client component, so the server-only resolver
  // (displayUrlForStoredAsset) is unreachable here. It has already run
  // upstream: searchMarketplaceVendorsByName presigns every candidate
  // through displayLogoUrl() before the suggestion crosses to the client,
  // so what lands on this field is a browser-fetchable URL, never an
  // `r2://bucket/key` ref.
  //
  // Rebound to a name that says so, because a value that has been resolved
  // must never keep reading as a bare column: that shape is exactly how an
  // r2:// ref reaches an <img> unnoticed, and it fails SILENTLY — no error,
  // no log, the picture simply never appears.
  const logoDisplayUrl = vendor.logo_display_url;
  // Compute a human-readable categories list for the cross-category
  // notice. If the vendor offers no services at all (rare), the notice
  // skips the list and just flags the mismatch.
  const otherCategories = vendor.categories.filter(
    (c) => c !== (currentCategory as VendorCategory),
  );
  const categoriesPretty = otherCategories
    .map((c) => VENDOR_CATEGORY_LABEL[c])
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      role="option"
      aria-selected="false"
      onClick={() => onPick(vendor)}
      className="group flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-terracotta/5"
    >
      <VendorLogo logoUrl={logoDisplayUrl} name={vendor.business_name} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-sm text-ink">
            {vendor.business_name}
          </span>
          {vendor.city ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-ink/55">
              <MapPin aria-hidden className="h-2.5 w-2.5" strokeWidth={1.75} />
              {vendor.city}
            </span>
          ) : null}
        </div>
        {isCrossCategory ? (
          <p className="rounded-md border border-warn-300/45 bg-warn-50/55 px-2 py-1 text-[11px] leading-snug text-warn-900">
            {categoriesPretty.length > 0 ? (
              <>
                <strong className="font-semibold">{vendor.business_name}</strong>{' '}
                doesn&apos;t list {currentCategoryLabel} as a service —
                they offer{' '}
                <span className="font-medium">{categoriesPretty}</span>. Pick
                them anyway?
              </>
            ) : (
              <>
                <strong className="font-semibold">{vendor.business_name}</strong>{' '}
                hasn&apos;t set up services on Setnayan yet. Pick them
                anyway?
              </>
            )}
          </p>
        ) : (
          <span className="text-[11px] text-ink/55">
            Pick this vendor for {currentCategoryLabel}
          </span>
        )}
      </div>
    </button>
  );
}

function LinkedVendorConfirmation({
  vendor,
  currentCategoryLabel,
  currentCategory,
  onCancel,
  disabled,
}: {
  vendor: MarketplaceVendorSuggestion;
  currentCategoryLabel: string;
  currentCategory: string;
  onCancel: () => void;
  disabled: boolean;
}) {
  const isCrossCategory = !vendor.serves_current_category;
  // ALREADY RESOLVED — same invariant as SuggestionRow above. `vendor` here
  // is the exact object the host clicked in the autocomplete (handlePick
  // stores the suggestion verbatim), so its logo was presigned server-side
  // by searchMarketplaceVendorsByName before it ever reached the client.
  // Rebound so a resolved value never reads as a bare stored-asset column.
  const logoDisplayUrl = vendor.logo_display_url;
  const otherCategories = vendor.categories.filter(
    (c) => c !== (currentCategory as VendorCategory),
  );
  const categoriesPretty = otherCategories
    .map((c) => VENDOR_CATEGORY_LABEL[c])
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-terracotta/40 bg-terracotta/5 p-3">
        <header className="mb-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-ink/55 transition-colors hover:text-ink disabled:opacity-60"
          >
            <ArrowLeft aria-hidden className="h-3 w-3" strokeWidth={2} />
            Pick different
          </button>
        </header>
        <div className="flex items-start gap-3">
          <VendorLogo logoUrl={logoDisplayUrl} name={vendor.business_name} large />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-display text-base text-ink">
              {vendor.business_name}
            </p>
            {vendor.city ? (
              <p className="flex items-center gap-0.5 text-[11px] text-ink/55">
                <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                {vendor.city}
              </p>
            ) : null}
            {vendor.categories.length > 0 ? (
              <p className="text-[11px] text-ink/65">
                Offers{' '}
                <span className="font-medium text-ink/80">
                  {vendor.categories
                    .map((c) => VENDOR_CATEGORY_LABEL[c])
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {isCrossCategory ? (
        <p
          role="note"
          className="flex items-start gap-1.5 rounded-md border border-warn-300/50 bg-warn-50/55 px-2.5 py-2 text-[11px] leading-snug text-warn-900"
        >
          <AlertCircle
            aria-hidden
            className="mt-px h-3.5 w-3.5 shrink-0"
            strokeWidth={2}
          />
          <span>
            Heads up — {vendor.business_name} doesn&apos;t list{' '}
            {currentCategoryLabel} as a service.{' '}
            {categoriesPretty.length > 0 ? (
              <>
                They cover {categoriesPretty}. Add to plan anyway and message
                them to confirm.
              </>
            ) : (
              <>Add to plan anyway and message them to confirm.</>
            )}
          </span>
        </p>
      ) : (
        <p className="text-[11px] text-ink/65">
          Adding to your <span className="font-medium">{currentCategoryLabel}</span>{' '}
          card as a considering pick. You can lock or remove them anytime.
        </p>
      )}
    </div>
  );
}

/**
 * 36×36 (small) or 48×48 (large) round avatar for marketplace vendor
 * rows. Renders logo when available, falls back to initials on a
 * terracotta tint when not. Mirrors the avatar shape used elsewhere on
 * the dashboard (ManualVendorAvatarSmall / LockedVendorAvatar).
 */
function VendorLogo({
  logoUrl,
  name,
  large = false,
}: {
  logoUrl: string | null;
  name: string;
  large?: boolean;
}) {
  const size = large ? 48 : 36;
  const initials =
    name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .filter((c) => c.length > 0)
      .slice(0, 2)
      .join('') || '?';
  const isOptimizable =
    logoUrl &&
    (logoUrl.startsWith('http://') ||
      logoUrl.startsWith('https://') ||
      logoUrl.startsWith('/'));
  if (isOptimizable) {
    return (
      <span
        className="inline-flex shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream"
        style={{ width: size, height: size }}
      >
        <Image
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-mono ${
        large ? 'text-sm' : 'text-[10px]'
      } font-semibold text-terracotta-700`}
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  /**
   * Stagger index. The sheet rises, then its fields follow just behind it —
   * `.sn-addman-field` is `sn-canvas-rise` with `backwards`, so the delay
   * holds the FROM state instead of flashing the resting one first.
   * The global prefers-reduced-motion block disables all of it.
   */
  step = 0,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  step?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="sn-addman-field space-y-1"
      style={{ animationDelay: `${120 + Math.min(step, 8) * 45}ms` }}
    >
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-[0.08em] text-ink/65"
      >
        {label}
        {required ? <span className="ml-0.5 text-terracotta-700">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[10px] text-ink/45">{hint}</p> : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" strokeLinecap="round" />
    </svg>
  );
}
