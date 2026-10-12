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
  readSupplierInvite,
  updateSelfAddedSupplier,
  type SupplierInviteView,
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
import { createPortal } from 'react-dom';
import { usePortalHost } from '@/lib/use-portal-host';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { AddressPinField } from './address-pin-field';
import { SupplierConnectPanel } from './supplier-connect-panel';
import { ServicesCoveredPicker } from './services-covered-picker';
import { PaymentPlanRows } from './payment-plan-rows';
import { PLAN_GROUPS, planGroupForCategory } from '@/lib/wedding-plan-groups';
import { OWN_RECORD_PILL } from '@/lib/add-your-own';

/** A Form row's keep: the sheet's own Save sends the form, so keeping has nothing to write. */
const KEEP = () => ({ ok: true as const });

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
  const portalHost = usePortalHost();
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

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

  // Focus trap, scroll lock and Esc are the house Sheet's own (it routes its
  // close through `dismiss`, so a post-save close still refreshes the page).

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
          setErrorMsg('This supplier is no longer available. Try searching again.');
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
    // The rows' hidden carriers are not `required` inputs, so the form cannot
    // refuse an empty one by itself: a missing required answer shakes into view.
    const missing = [
      'business_name',
      ...(isEdit ? [] : ['contact_person', 'contact_number']),
      ...(addressRequired ? ['address'] : []),
    ].some(
      (k) => String(fd.get(k) ?? '').trim().length === 0,
    );
    if (missing) {
      if (formRef.current) nudgeFormRows(formRef.current);
      return;
    }
    const nameEntry = fd.get('business_name');
    const savedName =
      typeof nameEntry === 'string' && nameEntry.trim().length > 0
        ? nameEntry.trim()
        : 'Your supplier';
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

  // ── THE CONTROLS (INTERACTION_RULES § 9, 2026-10-12) ──────────────────────
  // The house Sheet (darkens + blurs; Esc, focus trap, scroll lock, its own
  // height cap and scroll) · every typed answer a Form row that posts into this
  // form (`fieldName`) · PickMenu in the plan rows · ActionButton for every press
  // · no bordered box around anything that is only read (owner 2026-10-11:
  // frames only on what is pressed; topics end in a divider).
  // 🔑 DRAWN INTO <body>. The dashboard's page wrapper is transformed and
  // contained, so a `fixed` sheet mounted inside it is trapped under the
  // portalled Find thumb row and the bottom bar (walked 2026-10-12: the thumb row
  // sat over the walk's footer). Every sheet on this page goes to <body> — once
  // mounted, so a server render (the dev lab draws the record sheet at once)
  // never reaches for a `document` it does not have.
  if (!portalHost) return null;
  return createPortal(
    <Sheet open onClose={dismiss} labelledById="new-manual-vendor-heading" rise>
      <div className="px-5 pt-5" data-add-manual-sheet="">
        <header className="pr-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">{categoryLabel}</p>
          <h2 id="new-manual-vendor-heading" className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
            {edit ? `Edit ${edit.name || 'supplier'}` : 'Add a contact'}
          </h2>
          <p className="mt-1 text-[13px] text-ink/65">
            {created
              ? 'Saved! Two quick options — both optional.'
              : edit
                ? 'Complete or improve what you agreed with them.'
                : 'Save once · reuse anywhere on your plan.'}
          </p>
          {/* What the couple typed is THEIR RECORD until the supplier joins
              (the approved prototype's words, 2026-10-10) — said, not boxed. */}
          {edit ? (
            <p data-own-record-pill="" className="mt-1 text-[12.5px] font-medium text-warn-800 dark:text-warn-200">
              {OWN_RECORD_PILL}
            </p>
          ) : null}
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
        <form ref={formRef} onSubmit={handleSubmit} className="mt-3" encType="multipart/form-data">
          <input type="hidden" name="event_id" value={eventId} />
          {/* The category rides along so `createManualVendor` can re-ask the
              address rule server-side. The modal is always opened FROM a
              category card, so this is never a guess. */}
          <input type="hidden" name="category" value={category} />
          {edit ? <input type="hidden" name="vendor_id" value={edit.vendorId} /> : null}

          {mode.kind === 'linked' ? (
            // LINKED MODE — host picked a marketplace vendor from the
            // autocomplete. Manual fields collapse; the picked vendor
            // shows as a confirmation with a "Pick different" press.
            // Save inserts an event_vendors row with marketplace_vendor_id.
            <LinkedVendorConfirmation
              vendor={mode.vendor}
              currentCategoryLabel={categoryLabel}
              currentCategory={category}
              onCancel={handleCancelLink}
              disabled={pending}
            />
          ) : (
            <>
              {/* The photo picker is ADD-only: `updateSelfAddedSupplier` does not
                  carry a photo, so offering one here would take a file and
                  silently drop it. */}
              {isEdit ? null : (
                <div className="flex items-center gap-3 pb-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Choose a photo"
                    className="sn-press group relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-ink/25 transition-colors hover:border-sn-accent/60"
                  >
                    {photoPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreviewUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Camera aria-hidden className="h-5 w-5 text-ink/40 transition-colors group-hover:text-sn-accent" strokeWidth={1.75} />
                    )}
                  </button>
                  <div className="flex flex-col gap-1 text-xs text-ink/65">
                    <ActionButton
                      tone="neutral"
                      icon={Upload}
                      label={photoPreviewUrl ? 'Replace photo' : 'Add photo'}
                      onClick={() => fileInputRef.current?.click()}
                    />
                    <span className="text-[11px] text-ink/50">Optional — JPEG, PNG, WebP, or HEIC up to 6 MB.</span>
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
              )}

              {/* Name · contact · number — Form rows that post into this form. */}
              <div className="relative border-t border-ink/10">
                <FormRows width="wide" data="add-manual-contact">
                  <TypedRow
                    name="Supplier name"
                    fieldName="business_name"
                    value={nameQuery}
                    empty="Their name"
                    placeholder="e.g. Tito Marcel"
                    required
                    maxLength={128}
                    autoCapitalize="words"
                    attrs={{ 'data-manual-field': 'business_name' }}
                    onType={(t) => {
                      setNameQuery(t);
                      if (t.trim().length >= 2) setAutocompleteOpen(true);
                    }}
                    onKeep={KEEP}
                  />
                  <TypedRow
                    name="Contact person"
                    fieldName="contact_person"
                    value={edit?.contactPerson ?? ''}
                    placeholder="e.g. Marcel Santos"
                    // A record made by the four-step walk may hold only one of the
                    // two contacts; editing it must not demand the other.
                    required={!isEdit}
                    maxLength={128}
                    autoCapitalize="words"
                    note="Who to call · usually the same as Supplier name."
                    attrs={{ 'data-manual-field': 'contact_person' }}
                    onKeep={KEEP}
                  />
                  <TypedRow
                    name="Contact number"
                    fieldName="contact_number"
                    value={edit?.contactNumber ?? ''}
                    placeholder="+63 9XX XXX XXXX"
                    required={!isEdit}
                    maxLength={32}
                    inputMode="tel"
                    note="Mobile preferred · e.g. +63 917 555 1234"
                    attrs={{ 'data-manual-field': 'contact_number' }}
                    onKeep={KEEP}
                  />
                </FormRows>
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

              {/* Address + PIN (owner 2026-09-20 — the sheet carries an "Address
                  Pin", not an address). Required for the two categories that
                  ARE a place; the pin itself is always optional, because a
                  wrong pin routes guests somewhere real and incorrect. */}
              <div className="border-t border-ink/10 py-3">
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
                  Payment Plan. */}
              <div className="space-y-1 border-t border-ink/10 py-3">
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

              <div className="border-t border-ink/10">
                <FormRows width="wide" data="add-manual-terms">
                  <TypedRow
                    name="Inclusions"
                    fieldName="inclusions"
                    value={edit?.inclusions ?? ''}
                    long
                    maxLength={2000}
                    placeholder={'e.g.\nBallroom, 6am–12mn\nTables and chairs'}
                    note="One per line — what the price covers."
                    attrs={{ 'data-manual-field': 'inclusions' }}
                    onKeep={KEEP}
                  />
                  <TypedRow
                    name="Price"
                    fieldName="total_cost_php"
                    value={priceInput.replace(/[^\d]/g, '')}
                    amount
                    placeholder="80000"
                    note="What you agreed, in pesos. The payment plan below has to add up to it."
                    attrs={{ 'data-manual-field': 'total_cost_php' }}
                    onType={(t) => setPriceInput(t)}
                    onKeep={KEEP}
                  />
                </FormRows>
              </div>

              <div className="space-y-1 border-t border-ink/10 py-3">
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
                  NOT Setnayan-verified. Friendly framing — said on the page. */}
              <p className="flex items-start gap-1.5 border-t border-ink/10 py-3 text-[12px] leading-snug text-ink/65">
                <AlertCircle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={2} />
                <span>
                  Heads up — suppliers you add yourself aren&apos;t verified by
                  Setnayan. We add them free so you can manage your whole plan in
                  one place 💛 — just vet them yourself before booking.
                </span>
              </p>
            </>
          )}

          {/* THEIR CLAIM LINK, on the record itself (the approved prototype's
              record sheet ends with it) — the same panel the walk's last step
              and the card's Connect show. Opening the record only READS the
              link; making one is the panel's own button. */}
          {edit && mode.kind === 'manual' ? (
            <div className="border-t border-ink/10 py-3">
              <RecordLinkBlock eventId={eventId} vendorId={edit.vendorId} vendorName={edit.name || 'them'} />
            </div>
          ) : null}

          {errorMsg ? (
            <p role="alert" className="flex items-center gap-1.5 pb-2 text-[12.5px] font-medium text-danger-800 dark:text-danger-200">
              <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {errorMsg}
            </p>
          ) : null}

          {/* PINNED FOOTER — the primary action never scrolls away on a long
              sheet (the sheet scrolls inside itself; this sticks to its foot). */}
          <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-end gap-2 border-t border-ink/10 bg-cream px-5 py-3">
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onClose} disabled={pending} />
            <ActionButton
              tone="brand"
              main
              type="submit"
              icon={Check}
              label={
                pending
                  ? mode.kind === 'linked'
                    ? 'Adding…'
                    : 'Saving…'
                  : mode.kind === 'linked'
                    ? 'Add to plan'
                    : edit
                      ? 'Save changes'
                      : 'Save & add'
              }
              disabled={pending}
              className="flex-1 sm:flex-none"
            />
          </div>
        </form>
        )}
      </div>
    </Sheet>,
    portalHost,
  );
}

/**
 * The record's claim link — read first (three states, like `ConnectSupplierModal`:
 * still reading · no link yet · the link), so a couple who only opened their
 * record is never invited to mint a link that already exists.
 */
function RecordLinkBlock({
  eventId,
  vendorId,
  vendorName,
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
}) {
  const [invite, setInvite] = useState<SupplierInviteView | undefined>(undefined);
  useEffect(() => {
    let live = true;
    readSupplierInvite(eventId, vendorId)
      .then((v) => {
        if (live) setInvite(v);
      })
      .catch(() => {
        // Unreadable → offer "Create their link": that writer is idempotent and
        // hands back the existing link rather than making a second.
        if (live) setInvite(null);
      });
    return () => {
      live = false;
    };
  }, [eventId, vendorId]);
  if (invite === undefined) {
    return (
      <p className="py-2 text-xs text-ink/55" aria-live="polite">
        Checking for their link…
      </p>
    );
  }
  return <SupplierConnectPanel eventId={eventId} vendorId={vendorId} vendorName={vendorName} initial={invite} />;
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
    <div className="mt-3 space-y-3 pb-5" data-add-manual-saved="">
      <p className="flex items-center gap-2 text-[14px] text-success-800 dark:text-success-200">
        <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        <span>
          <span className="font-semibold">{vendorName}</span> added to {categoryLabel}.
        </span>
      </p>
      {/* ⚠ THE PRICE INPUT THAT WAS HERE IS GONE (2026-09-20). The sheet
          above now carries Price and Payment Plan, so a second input here
          would be a second writer of `total_cost_php`. What remains is the one
          thing that only makes sense AFTER the supplier exists: their invite. */}
      {warning ? (
        <p role="alert" className="flex items-start gap-2 text-[12.5px] leading-snug text-warn-800 dark:text-warn-200">
          <AlertCircle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>{warning}</span>
        </p>
      ) : null}

      {/* The supplier's portal — the same panel [Connect] on their card opens. */}
      <div className="border-t border-ink/10 pt-3">
        <SupplierConnectPanel eventId={eventId} vendorId={eventVendorId} vendorName={vendorName} />
      </div>

      <ActionButton tone="brand" main icon={Check} label="Done" onClick={onDone} className="w-full" />
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
        aria-label="Marketplace supplier matches"
        className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-ink/15 bg-cream p-3 shadow-lg"
      >
        <p className="flex items-center gap-2 text-[11px] text-ink/55">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta"
          />
          Searching Setnayan suppliers…
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
      aria-label="Marketplace supplier matches"
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
          <p className="text-[11.5px] leading-snug text-warn-800 dark:text-warn-200">
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
            Pick this supplier for {currentCategoryLabel}
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
    <div className="space-y-3 border-t border-ink/10 pt-3" data-add-manual-linked="">
      <div>
        <div className="flex items-start gap-3">
          <VendorLogo logoUrl={logoDisplayUrl} name={vendor.business_name} large />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-base font-semibold text-ink">{vendor.business_name}</p>
            {vendor.city ? (
              <p className="flex items-center gap-0.5 text-[11.5px] text-ink/55">
                <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                {vendor.city}
              </p>
            ) : null}
            {vendor.categories.length > 0 ? (
              <p className="text-[11.5px] text-ink/65">
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
          <ActionButton tone="neutral" icon={ArrowLeft} label="Pick different" onClick={onCancel} disabled={disabled} />
        </div>
      </div>
      {isCrossCategory ? (
        <p role="note" className="flex items-start gap-1.5 text-[12px] leading-snug text-warn-800 dark:text-warn-200">
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
          card as a considering pick. You can book or remove them anytime.
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-sn-accent/15 font-mono ${
        large ? 'text-sm' : 'text-[10px]'
      } font-semibold text-sn-accent`}
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}
