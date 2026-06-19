'use client';

import Image from 'next/image';
import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Plus, UserPlus, Check, ChevronDown } from 'lucide-react';
import { attachManualVendorToCategory } from '../vendors/actions';
import { NewManualVendorModal } from './new-manual-vendor-modal';

// ManualVendorDropdown — replacement for the "Add" inline-form CTA on
// every planning card. Per CLAUDE.md 2026-05-22 owner directive:
//
//   "When we add a vendor for the card, can we show a drop down of all
//    manually added vendors, so we can choose them as well, and have an
//    option to add a new one if not there?"
//
// Two behaviors in one button:
//   1. If host has saved manual vendors on this event → tapping "Add"
//      opens a dropdown listing each one (avatar + business_name +
//      contact_person). Tapping a row calls
//      attachManualVendorToCategory and adds it to THIS category's
//      planning card. Useful for "Tito Marcel" being both Coordinator
//      AND Host/MC — one tap per category.
//   2. The dropdown also has a "+ Add new contact" row at the bottom
//      that opens NewManualVendorModal. Brand-new manual vendors land
//      in the dropdown after save, so subsequent attaches in OTHER
//      categories don't re-prompt for photo + contact info.
//   3. If host has NO manual vendors yet → tapping "Add" goes straight
//      to the modal (no empty dropdown).
//
// Mobile behavior: dropdown becomes bottom-sheet via fixed positioning
// + responsive width. Desktop: popover anchored to the button. The
// modal handles its own mobile-vs-desktop shape (see
// new-manual-vendor-modal.tsx).
//
// "Already attached to this category" affordance: rows for manual
// vendors already saved into this card's category get a "✓ Added"
// badge + are disabled. Prevents accidental duplicate attaches.
//
// Brand voice: cream popover, terracotta accent, no dev text.

export type ManualVendorOption = {
  manual_vendor_id: string;
  business_name: string;
  contact_person: string;
  photo_url: string | null;
};

type Props = {
  eventId: string;
  category: string;
  /** Pretty label for the category — surfaces in the modal header so the
   *  host knows which card they're saving into. */
  categoryLabel: string;
  /** All manual vendors created on this event. Source of truth lives in
   *  page.tsx, threaded down through PlanningGroups. */
  manualVendors: ReadonlyArray<ManualVendorOption>;
  /** Set of manual_vendor_ids ALREADY attached to this card's category.
   *  Drives the "✓ Added" disabled state per row. */
  alreadyAttachedIds: ReadonlySet<string>;
};

export function ManualVendorDropdown({
  eventId,
  category,
  categoryLabel,
  manualVendors,
  alreadyAttachedIds,
}: Props) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + ESC closes the popover. Modal handles its own
  // dismissal; we don't double-close here.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function handleTriggerClick() {
    setAttachError(null);
    // If no manual vendors yet, skip the empty dropdown and go straight
    // to the "+ Add new" modal — saves the host one tap.
    if (manualVendors.length === 0) {
      setModalOpen(true);
      return;
    }
    setOpen((v) => !v);
  }

  function handleAttachExisting(manualVendorId: string) {
    if (pendingId || alreadyAttachedIds.has(manualVendorId)) return;
    setAttachError(null);
    setPendingId(manualVendorId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('manual_vendor_id', manualVendorId);
      fd.set('category', category);
      const result = await attachManualVendorToCategory(fd);
      setPendingId(null);
      if (result.status === 'ok') {
        // Auto-close so the host sees the planning grid refresh.
        setOpen(false);
        return;
      }
      if (result.status === 'not_signed_in') {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.href = `/login?next=${next}`;
        return;
      }
      setAttachError(result.message ?? 'Could not add. Try again.');
    });
  }

  function handleOpenAddNew() {
    setOpen(false);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
  }

  function handleModalCreated() {
    setModalOpen(false);
    // Server action already revalidatePath'd the dashboard route —
    // the next render will include the new option in manualVendors
    // automatically. We don't need to mutate local state.
  }

  return (
    <div ref={containerRef} className="relative inline-flex flex-1">
      {/* HEIGHT · `h-11` (44px exact) matches the sibling Search vendors
       *  CTA in PlanCardCTAs + the MarketplaceTeaseStrip pills + every
       *  button in the marketplace FilterDrawer/StickyMarketplaceHeader.
       *  Prior `min-h-[36px]` made the Add trigger 8px shorter than the
       *  adjacent Search vendors button which itself was only ~32px tall
       *  before this PR — the row read as two small buttons. CLAUDE.md
       *  2026-05-30 owner directive: "button height are still
       *  inconsistent. we want them to have the same height so
       *  familiarity is easy." */}
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add
        {manualVendors.length > 0 ? (
          <ChevronDown
            aria-hidden
            className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        ) : null}
      </button>

      {open && manualVendors.length > 0 ? (
        <div
          role="menu"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-ink/15 bg-cream shadow-lg sm:left-auto sm:right-0 sm:w-72"
        >
          <p className="border-b border-ink/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Your saved contacts
          </p>
          <ul className="py-1">
            {manualVendors.map((mv) => {
              const isAttached = alreadyAttachedIds.has(mv.manual_vendor_id);
              const isPending = pendingId === mv.manual_vendor_id;
              return (
                <li key={mv.manual_vendor_id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleAttachExisting(mv.manual_vendor_id)}
                    disabled={isAttached || isPending}
                    className={`group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      isAttached
                        ? 'cursor-default opacity-60'
                        : isPending
                          ? 'cursor-default bg-terracotta/5'
                          : 'hover:bg-terracotta/5'
                    }`}
                  >
                    <ManualVendorAvatarSmall
                      photoUrl={mv.photo_url}
                      name={mv.business_name}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-ink">
                        {mv.business_name}
                      </span>
                      <span className="truncate text-[11px] text-ink/55">
                        {mv.contact_person}
                      </span>
                    </span>
                    {isAttached ? (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-success-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-success-800">
                        <Check
                          aria-hidden
                          className="h-2.5 w-2.5"
                          strokeWidth={2.5}
                        />
                        Added
                      </span>
                    ) : isPending ? (
                      <Spinner />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={handleOpenAddNew}
            className="flex w-full items-center gap-2 border-t border-ink/10 px-3 py-2.5 text-left text-sm font-medium text-terracotta transition-colors hover:bg-terracotta/5"
          >
            <UserPlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Add a new contact
          </button>
          {attachError ? (
            <p className="border-t border-danger-200/60 bg-danger-50/60 px-3 py-2 text-[11px] text-danger-900">
              {attachError}
            </p>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <NewManualVendorModal
          eventId={eventId}
          category={category}
          categoryLabel={categoryLabel}
          onClose={handleModalClose}
          onCreated={handleModalCreated}
        />
      ) : null}
    </div>
  );
}

/**
 * Small 32×32 round avatar for dropdown list rows. Reuses the same
 * 4-tier resolution conceptually as LockedVendorAvatar in
 * planning-groups.tsx — but with manual vendor photos as PRIORITY 1
 * (no marketplace fallback, since manual vendors are off-platform by
 * definition; no service photo, since manual vendors don't book
 * vendor_services). Falls back to initials-on-terracotta when no
 * photo uploaded.
 */
function ManualVendorAvatarSmall({
  photoUrl,
  name,
}: {
  photoUrl: string | null;
  name: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .filter((c) => c.length > 0)
      .slice(0, 2)
      .join('') || '?';
  const isOptimizable =
    photoUrl &&
    (photoUrl.startsWith('http://') ||
      photoUrl.startsWith('https://') ||
      photoUrl.startsWith('/'));
  if (isOptimizable) {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-cream">
        <Image
          src={photoUrl}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-mono text-[10px] font-semibold text-terracotta-700"
    >
      {initials}
    </span>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 animate-spin text-terracotta"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" strokeLinecap="round" />
    </svg>
  );
}
