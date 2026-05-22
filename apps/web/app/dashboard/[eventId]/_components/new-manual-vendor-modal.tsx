'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { X, Check, Camera, AlertCircle, Upload } from 'lucide-react';
import {
  createManualVendor,
  attachManualVendorToCategory,
} from '../vendors/actions';

// Modal for the "+ Add new manual vendor" path inside ManualVendorDropdown.
//
// Owner directive 2026-05-22: manual vendor input must capture Photo +
// Vendor Name + Contact Person + Contact Number. Photo is optional in
// the schema (host can skip and add later) but the form treats it as
// strongly encouraged — every other field is required.
//
// Two-step submit on Save:
//   1. createManualVendor → returns manual_vendor_id (incl. photo upload
//      if a file was picked)
//   2. attachManualVendorToCategory → wires the new row into the
//      current planning card
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
// thumb-zone; desktop = centered modal on dim backdrop.

type Props = {
  eventId: string;
  category: string;
  categoryLabel: string;
  onClose: () => void;
  onCreated: () => void;
};

export function NewManualVendorModal({
  eventId,
  category,
  categoryLabel,
  onClose,
  onCreated,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initial focus on Vendor Name + ESC closes. Tiny accessibility win.
  useEffect(() => {
    firstFieldRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const createResult = await createManualVendor(fd);
      if (createResult.status === 'not_signed_in') {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.href = `/login?next=${next}`;
        return;
      }
      if (createResult.status === 'error') {
        setErrorMsg(createResult.message ?? 'Could not save.');
        return;
      }
      // Manual vendor created — now wire it into the current category.
      const attachFd = new FormData();
      attachFd.set('event_id', eventId);
      attachFd.set('manual_vendor_id', createResult.manualVendorId);
      attachFd.set('category', category);
      const attachResult = await attachManualVendorToCategory(attachFd);
      if (attachResult.status === 'not_signed_in') {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.href = `/login?next=${next}`;
        return;
      }
      if (attachResult.status === 'error') {
        // Manual vendor was saved successfully but attach failed. The
        // host can re-pick from the dropdown without re-entering the
        // contact info — surface that gracefully.
        setErrorMsg(
          `${attachResult.message} (Saved the contact — pick them from the list to attach.)`,
        );
        return;
      }
      onCreated();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-manual-vendor-heading"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        // Click backdrop to close, but ignore clicks inside the form.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border-t border-ink/10 bg-cream p-5 shadow-2xl sm:rounded-2xl sm:border"
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
              Add a contact
            </h2>
            <p className="mt-1 text-xs text-ink/65">
              Save once · reuse anywhere on your plan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-3.5"
          encType="multipart/form-data"
        >
          <input type="hidden" name="event_id" value={eventId} />

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
                className="inline-flex items-center gap-1.5 self-start rounded-md border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta"
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

          <Field label="Vendor name" htmlFor="manual-vendor-name" required>
            <input
              ref={firstFieldRef}
              id="manual-vendor-name"
              name="business_name"
              type="text"
              required
              maxLength={128}
              disabled={pending}
              placeholder="e.g. Tito Marcel"
              className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
            />
          </Field>

          <Field
            label="Contact person"
            htmlFor="manual-vendor-contact-person"
            required
            hint="Who to call · usually the same as Vendor name."
          >
            <input
              id="manual-vendor-contact-person"
              name="contact_person"
              type="text"
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
            hint="Mobile preferred · e.g. +63 917 555 1234"
          >
            <input
              id="manual-vendor-contact-number"
              name="contact_number"
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

          {errorMsg ? (
            <p
              role="alert"
              className="flex items-center gap-1.5 rounded-md border border-rose-300/50 bg-rose-50/60 px-2.5 py-1.5 text-[11px] text-rose-900"
            >
              <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {errorMsg}
            </p>
          ) : null}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-terracotta/40 bg-terracotta px-3.5 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700 disabled:cursor-default disabled:opacity-60 sm:px-5"
            >
              {pending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                <>
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Save &amp; add
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-[0.08em] text-ink/65"
      >
        {label}
        {required ? <span className="ml-0.5 text-terracotta">*</span> : null}
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
