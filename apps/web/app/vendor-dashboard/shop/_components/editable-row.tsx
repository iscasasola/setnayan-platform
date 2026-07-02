'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Pencil, Plus } from 'lucide-react';

import { Field } from '@/app/_components/forms/field';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { useToast } from '@/app/_components/toast/toast-provider';
import type { BusinessProfileItem } from '@/lib/vendor-profile';
import { ServicesPicker } from '../../_components/services-picker';
import { updateVendorProfileField, type FieldSaveResult } from '../../actions';
import { Collapsible } from '../../_components/collapsible';

/**
 * All the live field values + picker vocabulary the inline editors need. Built
 * once on the server (loadShopData) and handed to every row.
 */
export type ProfileFieldData = {
  business_name: string;
  business_owner_name: string;
  hq_address: string;
  contact_phone: string;
  contact_email: string;
  in_business_since_year: string;
  logo_url: string | null;
  logoDisplayMap: Record<string, string>;
  services: string[];
  serviceLabels?: Record<string, string>;
  extraServiceLeaves: { key: string; label: string }[];
  vendorProfileId: string;
};

const CURRENT_YEAR = new Date().getFullYear();

/**
 * One inline-editable Business-Profile checklist row. Collapsed it looks like
 * the old read-only row (status chip + label + a value preview); its right-side
 * affordance is now a real button that expands the row IN PLACE into a single-
 * field editor (the same `Field` + control primitives as the full /profile
 * form), Save/Cancel, backed by `updateVendorProfileField` — no navigation.
 *
 * The parent owns which row is open (one at a time); this component owns only
 * the form + its save lifecycle. The `business_documents` row is NOT rendered
 * here — it's a separate verification flow the parent renders as a deep-link.
 */
export function EditableRow({
  item,
  data,
  isOpen,
  onToggle,
  onSaved,
}: {
  item: BusinessProfileItem;
  data: ProfileFieldData;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState<FieldSaveResult | null, FormData>(
    updateVendorProfileField,
    null,
  );
  const handledRef = useRef<FieldSaveResult | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // TRUE when this row's collapse was self-initiated (its own trigger / Cancel /
  // Esc / a successful save) → return focus to the trigger. FALSE when the row
  // was collapsed because the user OPENED A DIFFERENT row → leave focus in the
  // newly-opened editor (don't yank it back). Deterministic (not activeElement-
  // based) so it also works when a pending SubmitButton has blurred to <body>.
  const selfCollapse = useRef(false);

  // Toast + collapse exactly once when a submission settles. Keyed on the
  // per-dispatch `state` object (a fresh reference each submit) so repeated
  // saves each fire once, and a failed save keeps the editor open + intact.
  useEffect(() => {
    if (!state || state === handledRef.current) return;
    handledRef.current = state;
    if (state.ok) {
      toast.success(`${item.label} saved.`);
      selfCollapse.current = true;
      onSaved();
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Focus management: on expand move focus into the first control; on a self-
  // initiated collapse return focus to the row's Edit/Add trigger. Effects flush
  // in DOM order, so without the `selfCollapse` guard a later-in-the-list row's
  // collapse (caused by opening an earlier row) would run AFTER the earlier row
  // focused its editor and steal focus back to the wrong, collapsed row.
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      editorRef.current
        ?.querySelector<HTMLElement>('input:not([type="hidden"]),textarea,select')
        ?.focus();
    } else if (!isOpen && wasOpen.current && selfCollapse.current) {
      triggerRef.current?.focus();
    }
    selfCollapse.current = false;
    wasOpen.current = isOpen;
  }, [isOpen]);

  const preview = fieldPreview(item.key, data);

  return (
    <li
      className="overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: isOpen ? 'var(--m-orange-3)' : 'var(--m-line)' }}
    >
      <div className="flex items-center gap-3 p-3">
        <StatusChip ok={item.ok} />
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-sm"
            style={{ color: item.ok ? 'var(--m-slate)' : 'var(--m-ink)' }}
          >
            {item.label}
          </span>
          {preview ? (
            <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
              {preview}
            </span>
          ) : null}
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            selfCollapse.current = true;
            onToggle();
          }}
          aria-expanded={isOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-terracotta transition-colors hover:bg-[color:var(--m-orange-4)]"
        >
          {isOpen ? (
            <>
              Close
              <ChevronDown className="h-3.5 w-3.5 rotate-180" strokeWidth={2} aria-hidden />
            </>
          ) : item.ok ? (
            <>
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Edit
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Add
            </>
          )}
        </button>
      </div>

      <Collapsible open={isOpen}>
        <div
          ref={editorRef}
          className="border-t px-3 pb-3 pt-3"
          style={{ borderColor: 'var(--m-line)' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              selfCollapse.current = true;
              onToggle();
            }
          }}
        >
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="field" value={item.key} />
            <FieldControl item={item} data={data} />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
            selfCollapse.current = true;
            onToggle();
          }}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ink/60 hover:bg-ink/5"
              >
                Cancel
              </button>
              <SubmitButton className="button-primary px-4 py-1.5 text-sm" pendingLabel="Saving…">
                Save
              </SubmitButton>
            </div>
          </form>
        </div>
      </Collapsible>
    </li>
  );
}

function StatusChip({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
      style={
        ok
          ? {
              background: 'color-mix(in srgb, var(--m-sage-deep) 14%, transparent)',
              color: 'var(--m-sage-deep)',
            }
          : { background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }
      }
    >
      {ok ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
      )}
    </span>
  );
}

/** Short at-a-glance preview of the current value shown on the collapsed row. */
function fieldPreview(key: string, data: ProfileFieldData): string | null {
  switch (key) {
    case 'logo':
      return data.logo_url ? 'Uploaded' : null;
    case 'business_name':
      return data.business_name || null;
    case 'business_owner_name':
      return data.business_owner_name || null;
    case 'maps_pin':
      return data.hq_address || null;
    case 'contact_phone':
      return data.contact_phone || null;
    case 'contact_email':
      return data.contact_email || null;
    case 'services':
      return data.services.length > 0
        ? `${data.services.length} selected`
        : null;
    case 'in_business_since_year':
      return data.in_business_since_year || null;
    default:
      return null;
  }
}

/** The field-specific editor control, wrapped in the shared `Field` label. */
function FieldControl({
  item,
  data,
}: {
  item: BusinessProfileItem;
  data: ProfileFieldData;
}) {
  switch (item.key) {
    case 'logo':
      return (
        <Field
          label="Logo"
          htmlFor="logo_url"
          required
          help="PNG, JPEG, or WebP up to 2 MB. Couples see this on every vendor card."
        >
          <FileUpload
            bucket="media"
            pathPrefix={`vendors/${data.vendorProfileId}/logo`}
            name="logo_url"
            currentValue={data.logo_url}
            initialDisplayUrls={data.logoDisplayMap}
            maxSizeMB={2}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            variant="square"
          />
        </Field>
      );
    case 'business_name':
      return (
        <Field label="Shop name" htmlFor="business_name" required>
          <input
            id="business_name"
            name="business_name"
            required
            maxLength={128}
            defaultValue={data.business_name}
            placeholder="Your studio / company name"
            className="input-field"
          />
        </Field>
      );
    case 'business_owner_name':
      return (
        <Field
          label="Business owner"
          htmlFor="business_owner_name"
          help="Kept private — never shown publicly."
        >
          <input
            id="business_owner_name"
            name="business_owner_name"
            maxLength={128}
            defaultValue={data.business_owner_name}
            placeholder="Owner / representative full name"
            className="input-field"
          />
        </Field>
      );
    case 'maps_pin':
      return (
        <Field
          label="Company address"
          htmlFor="hq_address"
          required
          help="Lets couples see how far you are from their venue. A street address places you more precisely than a city."
        >
          <input
            id="hq_address"
            name="hq_address"
            maxLength={500}
            defaultValue={data.hq_address}
            placeholder="123 Katipunan Ave, Quezon City, Metro Manila"
            className="input-field"
          />
        </Field>
      );
    case 'contact_phone':
      return (
        <Field label="Contact number" htmlFor="contact_phone" required>
          <input
            id="contact_phone"
            name="contact_phone"
            type="tel"
            defaultValue={data.contact_phone}
            placeholder="+63 917 …"
            className="input-field"
          />
        </Field>
      );
    case 'contact_email':
      return (
        <Field label="Company email" htmlFor="contact_email" required>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={data.contact_email}
            placeholder="hello@yourstudio.ph"
            className="input-field"
          />
        </Field>
      );
    case 'services':
      return (
        <Field
          label="Services covered"
          htmlFor="services"
          help="Tick the categories you offer. Add custom services for anything not on the list."
        >
          <div className="max-h-[40vh] overflow-y-auto rounded-lg">
            <ServicesPicker
              name="services"
              initial={data.services}
              labels={data.serviceLabels}
              extraCanonicals={data.extraServiceLeaves}
            />
          </div>
        </Field>
      );
    case 'in_business_since_year':
      return (
        <Field
          label="EST"
          htmlFor="in_business_since_year"
          required
          help="The year your business was established. Shown to couples as “X years in business.”"
        >
          <input
            id="in_business_since_year"
            name="in_business_since_year"
            type="number"
            min={1900}
            max={CURRENT_YEAR}
            defaultValue={data.in_business_since_year}
            placeholder="2017"
            className="input-field"
          />
        </Field>
      );
    default:
      return null;
  }
}
