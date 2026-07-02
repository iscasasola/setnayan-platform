'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Pencil, Plus } from 'lucide-react';

import { Field } from '@/app/_components/forms/field';
import { FileUpload } from '@/app/_components/file-upload';
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
 * One inline-editable Business-Profile checklist row.
 *
 * AUTO-SAVE ON COLLAPSE (owner 2026-07-02): there is no Save button. Collapsed
 * the row shows the status chip + label + a readable value preview (a real logo
 * thumbnail for the logo row). Its trigger expands the row into the same
 * `Field` + control primitives as the full /profile form. The field then saves
 * itself whenever the row COLLAPSES for any reason — you click Close, you open a
 * different row, or you press Enter — via `updateVendorProfileField`. **Cancel**
 * reverts the edit (remounts the control to its saved value) and closes without
 * saving. A required field the server rejects (e.g. a blank Shop name) re-opens
 * the row with an error toast, so an invalid value is never silently dropped.
 *
 * The parent owns which row is open (one at a time). `business_documents` is NOT
 * rendered here — the parent renders it as its own verification row.
 */
export function EditableRow({
  item,
  data,
  isOpen,
  onOpen,
  onClose,
  onReopenAfterError,
}: {
  item: BusinessProfileItem;
  data: ProfileFieldData;
  isOpen: boolean;
  /** Request that THIS row become the open one. */
  onOpen: () => void;
  /** Request that this row close (if it's the open one). */
  onClose: () => void;
  /**
   * Re-open THIS row after an async save was REJECTED — but only if the user
   * hasn't already opened a different row in the meantime (the parent no-ops
   * when another row is open, so a late rejection never steals the open slot).
   */
  onReopenAfterError: () => void;
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState<FieldSaveResult | null, FormData>(
    updateVendorProfileField,
    null,
  );
  const handledRef = useRef<FieldSaveResult | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasOpen = useRef(false);
  // Focus: TRUE when this row's collapse was self-initiated (own trigger / Esc /
  // Cancel) → return focus to the trigger. FALSE when collapsed because ANOTHER
  // row opened → leave focus in the newly-opened editor.
  const selfCollapse = useRef(false);
  // Whether the field changed since the row opened (drives whether a collapse
  // triggers a save). Set by control edits; reset once a save is fired.
  const dirty = useRef(false);
  // TRUE for a collapse caused by Cancel/Esc — skip the auto-save + revert.
  const cancelled = useRef(false);
  // Bumping this remounts the FieldControl, discarding a composite widget's
  // (FileUpload / ServicesPicker) internal state back to the saved props — how
  // Cancel reverts an edit that native uncontrolled inputs can't revert alone.
  const [revertNonce, setRevertNonce] = useState(0);

  const markDirty = () => {
    dirty.current = true;
  };

  // Settle a submission exactly once (keyed on the per-dispatch `state` object).
  // On success: toast + clear dirty. On failure (e.g. blank required field the
  // server rejected): toast the error and RE-OPEN so the value is never lost.
  useEffect(() => {
    if (!state || state === handledRef.current) return;
    handledRef.current = state;
    if (state.ok) {
      dirty.current = false;
      toast.success(`${item.label} saved.`);
    } else {
      toast.error(state.error);
      onReopenAfterError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Focus + AUTO-SAVE on collapse. On expand: focus the first control. On
  // collapse: unless it was a Cancel/Esc, submit the form if the field is dirty
  // (fires updateVendorProfileField); then return focus to the trigger only when
  // the collapse was self-initiated.
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      cancelled.current = false;
      editorRef.current
        ?.querySelector<HTMLElement>('input:not([type="hidden"]),textarea,select')
        ?.focus();
    } else if (!isOpen && wasOpen.current) {
      if (cancelled.current) {
        cancelled.current = false;
        dirty.current = false;
      } else if (dirty.current) {
        // Fire once per edit — a rejected save re-opens (settle effect) and
        // requires a fresh edit to retry, so this can't loop on a bad value.
        dirty.current = false;
        formRef.current?.requestSubmit();
      }
      if (selfCollapse.current) triggerRef.current?.focus();
    }
    selfCollapse.current = false;
    wasOpen.current = isOpen;
  }, [isOpen]);

  const cancel = () => {
    cancelled.current = true;
    setRevertNonce((n) => n + 1); // remount FieldControl → revert widget state
    selfCollapse.current = true;
    onClose();
  };

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
          <RowPreview itemKey={item.key} data={data} />
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (isOpen) {
              selfCollapse.current = true;
              onClose();
            } else {
              onOpen();
            }
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
              cancel();
            }
          }}
        >
          {/* noValidate: the on-collapse requestSubmit() must ALWAYS reach the
              server action — native constraint validation would otherwise abort
              the submit for a blank required / malformed field, silently dropping
              the edit. updateVendorProfileField validates server-side and the
              settle effect re-opens the row with a friendly error. */}
          <form ref={formRef} action={formAction} noValidate className="space-y-3">
            <input type="hidden" name="field" value={item.key} />
            <FieldControl key={revertNonce} item={item} data={data} onDirty={markDirty} />
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: 'var(--m-slate-3)' }}
                aria-live="polite"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Saves automatically when you close.'
                )}
              </span>
              <button
                type="button"
                onClick={cancel}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ink/60 hover:bg-ink/5"
              >
                Cancel
              </button>
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

/**
 * At-a-glance current value on the collapsed row. The logo renders as a real
 * thumbnail (presigned R2 URL, resolved server-side into `logoDisplayMap`);
 * every other row echoes its saved value so the whole panel is readable without
 * expanding anything.
 */
function RowPreview({ itemKey, data }: { itemKey: string; data: ProfileFieldData }) {
  if (itemKey === 'logo') {
    const url = data.logo_url ? data.logoDisplayMap[data.logo_url] : undefined;
    if (url) {
      return (
        <span className="mt-1 inline-flex h-6 w-6 overflow-hidden rounded border" style={{ borderColor: 'var(--m-line)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Your logo" className="h-full w-full object-cover" />
        </span>
      );
    }
    return data.logo_url ? (
      <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Uploaded
      </span>
    ) : null;
  }
  const text = textPreview(itemKey, data);
  return text ? (
    <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
      {text}
    </span>
  ) : null;
}

function textPreview(key: string, data: ProfileFieldData): string | null {
  switch (key) {
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
      return data.services.length > 0 ? `${data.services.length} selected` : null;
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
  onDirty,
}: {
  item: BusinessProfileItem;
  data: ProfileFieldData;
  onDirty: () => void;
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
            onChange={onDirty}
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
            onInput={onDirty}
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
            onInput={onDirty}
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
            onInput={onDirty}
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
            onInput={onDirty}
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
            onInput={onDirty}
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
              onChange={onDirty}
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
            onInput={onDirty}
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
