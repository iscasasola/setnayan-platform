'use client';

import { PictureFrameControl } from '@/app/_components/picture-frame-control';
import { DEFAULT_LOGO_FRAME, logoFrameStyle, SHOP_LOGO_UPLOAD, shopLogoLimitsWords, type LogoFrame } from '@/lib/open-shop-logo';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, Pencil, Plus, Send, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import 'leaflet/dist/leaflet.css';

import { Field } from '@/app/_components/forms/field';
import { FileUpload } from '@/app/_components/file-upload';
import { useToast } from '@/app/_components/toast/toast-provider';
import { HeldNameClaim } from './held-name-claim';
import type { BusinessProfileItem } from '@/lib/vendor-profile';
import { requestProfileCorrection, updateVendorProfileField, type FieldSaveResult } from '../../actions';
import type { LockedIdentityFieldKey } from '@/lib/vendor-corrections';
import { Collapsible } from '../../_components/collapsible';

// Type-only — the leaflet RUNTIME is dynamically imported inside HqAddressControl
// (browser only; leaflet touches `window` at module scope so it must never SSR).
import type { Map as LeafletMap, Marker as LeafletMarker, LeafletMouseEvent } from 'leaflet';
import { formatCount } from '@/lib/format-number';
import { SHOP_NAME_MAX, shopNameCounter } from '@/lib/business-slug';
import { findFairHits } from '@/lib/fair-presentation';
import type { ClaimWord } from '@/lib/service-card-checks';
import { FairNote } from '@/app/_components/fair-note';
import { IN_BUSINESS_SINCE_HELP, IN_BUSINESS_SINCE_LABEL, inBusinessSinceLine } from '@/lib/in-business-since';

type LeafletModule = typeof import('leaflet');

/**
 * All the live field values + picker vocabulary the inline editors need. Built
 * once on the server (loadShopData) and handed to every row.
 */
export type ProfileFieldData = {
  business_name: string;
  business_owner_name: string;
  hq_address: string;
  location_city: string;
  /** Saved HQ pin (server geocode or a vendor-dragged map pin). Null until geocoded. */
  hq_latitude: number | null;
  hq_longitude: number | null;
  contact_phone: string;
  contact_email: string;
  in_business_since_year: string;
  /** Venue room size + capacity, as strings for the inputs. Empty when unset
   *  or when this vendor is not a venue (the row is not offered at all then). */
  venue_width_m: string;
  venue_length_m: string;
  capacity_min: string;
  capacity_max: string;
  logo_url: string | null;
  /** The logo's align + zoom (owner 2026-11-06, A2) — drawn through `logoFrameStyle` and edited with the logo. */
  logoFrame?: LogoFrame;
  logoDisplayMap: Record<string, string>;
  services: string[];
  /** 🔢 Categories the shop runs, counted as sign-up counts them (`shopCategoryCount`) — never `services.length` (F-W1-03). */
  serviceCategoryCount: number;
  serviceLabels?: Record<string, string>;
  extraServiceLeaves: { key: string; label: string }[];
  vendorProfileId: string;
  /**
   * 🚫 The claim words this shop may not use (`loadClaimWordsFor`) — the shop name's live fair-presentation note.
   * Absent / `null` = unread: the word check waits for the save; the other checks (emoji, rank forms…) still run.
   */
  fairWords?: ClaimWord[] | null;
};

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Fields whose editor is a single plain input (text / tel / email / number).
 * When such a field is BLANK, the row renders its input DIRECTLY in the row
 * body — no "Add" click needed — and saves on blur-if-dirty (owner 2026-07-03:
 * "text boxes if blank, edit buttons if with content"). Composite editors keep
 * the expand-to-edit behavior even when blank: logo (FileUpload), services
 * (picker), and maps_pin (address + map picker — no longer a plain input).
 */
const INLINE_DIRECT_KEYS = new Set([
  'business_name',
  'business_owner_name',
  'contact_phone',
  'contact_email',
  'in_business_since_year',
]);

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
/** A flat form row: a hairline between rows, none above the first, no card. */
const FLAT_ROW = 'border-t border-ink/10 first:border-t-0';

export function EditableRow({
  item,
  data,
  isOpen,
  onOpen,
  onClose,
  onReopenAfterError,
  flat = false,
  pickedFiles = null,
}: {
  item: BusinessProfileItem;
  data: ProfileFieldData;
  isOpen: boolean;
  /**
   * 🧾 THE HOUSE FORM ROW (Today's setup steps, owner 2026-10-28 — "frames only on what you press"): no card around
   * the row — a hairline between rows, label at the left, the answer at the right. The save logic is the same.
   * Absent → the row is exactly as it was.
   */
  flat?: boolean;
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
  /** 📂 The logo row only: a file a picker outside chose (Shop › Logo › Upload photo) — fed to its uploader once. */
  pickedFiles?: readonly File[] | null;
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
  // (e.g. FileUpload) internal state back to the saved props — how
  // Cancel reverts an edit that native uncontrolled inputs can't revert alone.
  const [revertNonce, setRevertNonce] = useState(0);

  const markDirty = () => {
    dirty.current = true;
  };
  // 🚫 FAIR PRESENTATION (owner 2026-11-08): the shop name's note is open → the auto-save waits (Save off until fixed).
  // Set by the name box on every keystroke; the server asks again (`updateVendorProfileField`).
  const fairOpen = useRef(false);
  const onFair = (open: number) => {
    fairOpen.current = open > 0;
  };

  // BLANK plain fields render their input directly in the row (Part 1 of the
  // 2026-07-03 field-UX pass) — no expand step, so none of the isOpen machinery
  // applies to them. Once saved, `item.ok` flips on revalidate and the row
  // becomes a normal collapsed value + Edit row ("text box gone when done").
  const inlineDirect = !item.ok && INLINE_DIRECT_KEYS.has(item.key);
  // A shop name refused because its core is held (owner 2026-11-06) — the row shows "It's my business" under it.
  const heldName = state && !state.ok ? (state.heldName ?? null) : null;

  // Settle a submission exactly once (keyed on the per-dispatch `state` object).
  // On success: toast + clear dirty. On failure (e.g. blank required field the
  // server rejected): toast the error and RE-OPEN so the value is never lost.
  // An inline-direct row has nothing to re-open — its input is always visible
  // and keeps the rejected value, so the vendor just edits and blurs to retry.
  useEffect(() => {
    if (!state || state === handledRef.current) return;
    handledRef.current = state;
    if (state.ok) {
      dirty.current = false;
      toast.success(`${item.label} saved.`);
    } else {
      toast.error(state.error);
      if (!inlineDirect) onReopenAfterError();
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
      } else if (dirty.current && fairOpen.current) {
        // 🚫 A fair-presentation note is open — nothing is saved; the row comes back open on the note.
        onReopenAfterError();
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

  if (inlineDirect) {
    return (
      <li className={flat ? FLAT_ROW : 'rounded-lg border bg-white'} style={flat ? undefined : { borderColor: 'var(--m-line)' }} data-editable-row={flat ? 'flat' : undefined}>
        <div className={flat ? 'flex min-h-[52px] items-center gap-3 py-2' : 'p-3'}>
          <div className={flat ? 'flex min-w-0 flex-1 items-center gap-3' : 'flex items-center gap-3'}>
            <StatusChip ok={false} />
            {/* Real <label> — the inline input has no Field wrapper, and every
                plain-input id equals its item key. */}
            <label
              htmlFor={item.key}
              className={flat ? 'min-w-0 flex-1 text-sm leading-tight' : 'min-w-0 flex-1 truncate text-sm'}
              style={{ color: 'var(--m-ink)' }}
            >
              {item.label}
            </label>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 text-xs"
              style={{ color: 'var(--m-slate-3)' }}
              aria-live="polite"
            >
              {isPending ? (
                'Saving…'
              ) : null}
            </span>
          </div>
          {/* Always-visible input. Saves itself on blur ONLY when the value
              actually changed (dirty) — never on a mere focus/blur pass-through.
              Enter submits natively (onSubmit clears dirty so the following blur
              can't double-fire); Esc reverts to the saved (blank) value. Typing
              here never touches the parent's one-open-at-a-time slot — an
              inline input is not "open" in that sense. */}
          <form
            ref={formRef}
            action={formAction}
            noValidate
            className={flat ? 'w-[180px] max-w-[50%] flex-none' : 'mt-2 pl-9'}
            onSubmit={(e) => {
              // 🚫 Save is off while a fair-presentation note is open (Enter included).
              if (fairOpen.current) {
                e.preventDefault();
                return;
              }
              dirty.current = false;
            }}
            onBlur={(e) => {
              if (formRef.current?.contains(e.relatedTarget as Node | null)) return;
              if (dirty.current && !fairOpen.current) {
                dirty.current = false;
                formRef.current?.requestSubmit();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                dirty.current = false;
                setRevertNonce((n) => n + 1); // remount → back to the saved value
              }
            }}
          >
            <input type="hidden" name="field" value={item.key} />
            <PlainInput key={revertNonce} itemKey={item.key} data={data} onDirty={markDirty} onFair={onFair} />
          </form>
        </div>
        {heldName ? (
          <div className={flat ? 'pb-3 pl-9' : 'px-3 pb-3 pl-12'}>
            <HeldNameClaim key={heldName} name={heldName} />
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li
      className={flat ? FLAT_ROW : 'overflow-hidden rounded-lg border bg-white'}
      style={flat ? undefined : { borderColor: isOpen ? 'var(--m-orange-3)' : 'var(--m-line)' }}
      data-editable-row={flat ? 'flat' : undefined}
    >
      <div className={flat ? 'flex min-h-[52px] items-center gap-3 py-2' : 'flex items-center gap-3 p-3'}>
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
        {/* Design template rule 3: the shared pill button (34 in a row, presses as 44), not a hand-made link-button. */}
        <ActionButton
          ref={triggerRef}
          tone={isOpen ? 'neutral' : 'brand'}
          icon={isOpen ? <ChevronDown className="rotate-180 !h-11" strokeWidth={2} aria-hidden /> : item.ok ? Pencil : Plus}
          label={isOpen ? 'Close' : item.ok ? 'Edit' : 'Add'}
          onClick={() => {
            if (isOpen) {
              selfCollapse.current = true;
              onClose();
            } else {
              onOpen();
            }
          }}
          aria-expanded={isOpen}
          className="shrink-0"
          data-edit-field={item.key}
        />
      </div>

      <Collapsible open={isOpen}>
        <div
          ref={editorRef}
          className={flat ? 'pb-3 pl-9' : 'border-t px-3 pb-3 pt-3'}
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
            <FieldControl key={revertNonce} item={item} data={data} onDirty={markDirty} onFair={onFair} pickedFiles={revertNonce === 0 ? pickedFiles : null} />
            {heldName ? <HeldNameClaim key={heldName} name={heldName} /> : null}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: 'var(--m-slate-3)' }}
                aria-live="polite"
              >
                {isPending ? (
                  'Saving…'
                ) : (
                  'Saves automatically when you close.'
                )}
              </span>
              <ActionButton tone="neutral" icon={X} label="Cancel" onClick={cancel} className="!h-11" />
            </div>
          </form>
        </div>
      </Collapsible>
    </li>
  );
}

/**
 * The "Services covered" checklist row (owner 2026-07-03). Unlike the other
 * rows it does NOT edit a `vendor_profiles` column inline — what a vendor
 * serves is admin-taxonomy-driven, built in the Coverage flow. So this row is a
 * jump: it mirrors the collapsed-row chrome (status chip · label · preview) and
 * links to /vendor-dashboard/services (Coverage is the default tab), which
 * writes the covered leaves back into `services[]` — the same column this
 * row's completeness reads. Rendered LAST by the parent.
 */
export function ServiceCoverageRow({
  item,
  count,
  flat = false,
}: {
  item: BusinessProfileItem;
  count: number;
  /** The house form row — see `EditableRow`'s `flat`. */
  flat?: boolean;
}) {
  return (
    <li className={flat ? FLAT_ROW : 'overflow-hidden rounded-lg border bg-white'} style={flat ? undefined : { borderColor: 'var(--m-line)' }} data-editable-row={flat ? 'flat' : undefined}>
      <div className={flat ? 'flex min-h-[52px] items-center gap-3 py-2' : 'flex items-center gap-3 p-3'}>
        <StatusChip ok={item.ok} />
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-sm"
            style={{ color: item.ok ? 'var(--m-slate)' : 'var(--m-ink)' }}
          >
            {item.label}
          </span>
          <span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {item.ok
              ? `${formatCount(count)} ${count === 1 ? 'category' : 'categories'} · manage in Coverage`
              : 'Pick what you serve from our category tree'}
          </span>
        </span>
        {/* The shared pill button at the 44 px floor (was a 12 px text link-button). Same words, same address. */}
        <ActionButton
          tone="brand"
          icon={item.ok ? Pencil : Plus}
          label={item.ok ? 'Manage' : 'Add'}
          href="/vendor-dashboard/services"
          className="shrink-0 !h-11"
        />
      </div>
    </li>
  );
}

/**
 * 🏷 A ROW THAT CHANGES BY REQUEST (owner 2026-10-29: "the name of her shop is wrong so i want her to be able to send
 * a request shop name change"). A filled shop name / address on a shop Setnayan set up — or any verified shop — is
 * not saved here (`identityLockRefusal` would refuse it). The row shows the value and asks IN PLACE: "Ask to change"
 * opens one line under it ("What it should be" · Send), which files the SHIPPED request (`requestProfileCorrection` →
 * `vendor_correction_requests` → /admin/corrections). Sent, it says "Change asked · waiting" and offers nothing twice;
 * the screen never resets.
 */
export function RequestOnlyRow({
  item,
  data,
  field,
  pending: pendingAtLoad,
  flat = false,
}: {
  item: BusinessProfileItem;
  data: ProfileFieldData;
  /** The locked field this row's request is filed under (`ADMIN_SET_UP_ROW_FIELD`). */
  field: LockedIdentityFieldKey;
  /** A request for this field is already waiting on Setnayan. */
  pending: boolean;
  flat?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const pending = pendingAtLoad || sent;
  const inputId = `ask-${item.key}`;
  // 🖼 RW-268 — a logo is a picture, not words: the ask carries an upload (the editor's own uploader), and the
  // stored `r2://` key is the requested value an admin can apply. A text box here filed nothing usable.
  const isLogo = field === 'logo_url';

  async function send() {
    if (!value.trim()) {
      toast.error(isLogo ? 'Choose the new logo first.' : 'Tell us what it should say.');
      return;
    }
    const fd = new FormData();
    fd.set('field_key', field);
    fd.set('requested_value', value);
    setSending(true);
    const res = await requestProfileCorrection(null, fd);
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Sent. Setnayan will review it and let you know.');
    setSent(true);
    setOpen(false);
  }

  return (
    <li
      className={flat ? FLAT_ROW : 'overflow-hidden rounded-lg border bg-white'} // no-card-ok: the EditableRow's own shell, beside it in the same list; it opens an ask in place
      style={flat ? undefined : { borderColor: open ? 'var(--m-orange-3)' : 'var(--m-line)' }}
      data-editable-row={flat ? 'flat' : undefined}
      data-request-only={pending ? 'pending' : 'ask'}
    >
      <div className={flat ? 'flex min-h-[52px] items-center gap-3 py-2' : 'flex items-center gap-3 p-3'}>
        <StatusChip ok={item.ok} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm" style={{ color: 'var(--m-slate)' }}>
            {item.label}
          </span>
          <RowPreview itemKey={item.key} data={data} />
        </span>
        {pending ? (
          <span className="shrink-0 text-xs" style={{ color: 'var(--m-slate-3)' }} data-request-waiting="">
            Change asked · waiting
          </span>
        ) : (
          <ActionButton
            tone={open ? 'neutral' : 'brand'}
            icon={open ? X : Pencil}
            label={open ? 'Close' : 'Ask to change'}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="shrink-0 !h-11"
          />
        )}
      </div>
      <Collapsible open={open && !pending}>
        <div className={flat ? 'space-y-2 pb-3 pl-9' : 'space-y-2 border-t px-3 pb-3 pt-3'} style={{ borderColor: 'var(--m-line)' }}>
          <label htmlFor={isLogo ? undefined : inputId} className="block text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {isLogo ? 'Your new logo — Setnayan checks it, then changes it for you.' : 'What it should be — Setnayan checks it, then changes it for you.'}
          </label>
          {isLogo ? (
            <div className="space-y-2" data-logo-ask-upload="">
              <FileUpload
                bucket="media"
                pathPrefix={`vendors/${data.vendorProfileId}/logo`}
                maxSizeMB={SHOP_LOGO_UPLOAD.maxSizeMB}
                compressImage
                acceptedTypes={[...SHOP_LOGO_UPLOAD.acceptedTypes]}
                variant="square"
                roundPreview
                onChange={(v) => setValue(Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))}
              />
              <ActionButton tone="brand" icon={Send} label="Send" onClick={() => void send()} waiting={sending} disabled={sending || !value} />
            </div>
          ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={inputId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={field === 'business_name' ? SHOP_NAME_MAX : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void send();
                }
              }}
              className="input-field min-w-0 flex-1 text-sm"
            />
            <ActionButton tone="brand" icon={Send} label="Send" onClick={() => void send()} waiting={sending} disabled={sending} className="!h-11" />
          </div>
          )}
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
          : { background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }
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
          <img src={url} alt="Your logo" className="h-full w-full object-cover" style={logoFrameStyle(data.logoFrame)} />
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
    case 'in_business_since_year':
      // 🗓 "2023 · 3 years" — the year AND what couples read from it (owner 2026-10-29, "Since" is two lines).
      return inBusinessSinceLine(data.in_business_since_year, new Date().getFullYear()) ?? (data.in_business_since_year || null);
    case 'venue_size':
      return data.venue_width_m && data.venue_length_m
        ? `${data.venue_width_m} × ${data.venue_length_m} m` +
            (data.capacity_max ? ` · up to ${formatCount(Number(data.capacity_max))} guests` : '')
        : null;
    default:
      return null;
  }
}

/**
 * My Shop's logo: the shipped upload, plus the SAME round-photo framer as "Add your logo" (owner 7 Nov, prototype v21,
 * A3 — drag to move, pinch to zoom, the shared `PictureFrameControl`). The frame posts with the logo
 * (`picture="logo"` → `logo_focal_x` / `logo_focal_y` / `logo_zoom`) when the row closes, so it is moved without a
 * re-upload.
 */
function LogoRowControl({ data, onDirty, pickedFiles = null }: { data: ProfileFieldData; onDirty: () => void; pickedFiles?: readonly File[] | null }) {
  const [ref, setRef] = useState<string>(data.logo_url ?? '');
  const [preview, setPreview] = useState<string | null>(
    data.logo_url ? (data.logoDisplayMap[data.logo_url] ?? null) : null,
  );
  const [frame, setFrame] = useState<LogoFrame>(data.logoFrame ?? DEFAULT_LOGO_FRAME);
  return (
    <span className="block space-y-3">
      {/* The circle IS the editor (prototype v21): first, the bare picture; the upload under it draws no second
          picture — only `[Replace photo] [Remove]` (`pills`), the same as the open-shop logo step. */}
      <PictureFrameControl
        imageUrl={ref ? preview : null}
        frame={frame}
        picture="logo"
        onChange={(f) => {
          setFrame(f);
          onDirty();
        }}
        alt="Your logo, as couples see it"
        tipTitle="The circle is what couples see"
      />
      <FileUpload
        bucket="media"
        pathPrefix={`vendors/${data.vendorProfileId}/logo`}
        name="logo_url"
        unsavedHint="it saves when you close this row"
        currentValue={data.logo_url}
        initialDisplayUrls={data.logoDisplayMap}
        maxSizeMB={SHOP_LOGO_UPLOAD.maxSizeMB}
        // 🗜 Compressed in the browser before it is sent (owner rule 2026-09-25; THE ONE BUILD A3 W16).
        compressImage
        acceptedTypes={[...SHOP_LOGO_UPLOAD.acceptedTypes]}
        variant="square"
        roundPreview
        pills={{ replace: 'Replace photo' }}
        pickedFiles={pickedFiles}
        onChange={(v) => {
          const next = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
          setRef(next);
          if (!next) setPreview(null);
          onDirty();
        }}
        onFilePicked={(file) => {
          // A new picture starts centred — the old frame belonged to the old picture.
          setFrame(DEFAULT_LOGO_FRAME);
          try {
            setPreview(URL.createObjectURL(file));
          } catch {
            setPreview(null);
          }
        }}
      />
    </span>
  );
}

/** The field-specific editor control, wrapped in the shared `Field` label. */
function FieldControl({
  item,
  data,
  onDirty,
  onFair,
  pickedFiles = null,
}: {
  item: BusinessProfileItem;
  data: ProfileFieldData;
  onDirty: () => void;
  /** 🚫 The shop name's fair-presentation count (see `ShopNameInput`). */
  onFair?: (open: number) => void;
  pickedFiles?: readonly File[] | null;
}) {
  switch (item.key) {
    case 'logo':
      return (
        <Field
          label="Logo"
          htmlFor="logo_url"
          required
          // 📏 Written from the one logo rule (F-W1-09) — never a size or a type list typed here.
          help={`${shopLogoLimitsWords()}. Couples see this on every supplier card.`}
        >
          <LogoRowControl data={data} onDirty={onDirty} pickedFiles={pickedFiles} />
        </Field>
      );
    case 'business_name':
      return (
        <Field label="Shop name" htmlFor="business_name" required>
          <PlainInput itemKey={item.key} data={data} onDirty={onDirty} onFair={onFair} />
        </Field>
      );
    case 'business_owner_name':
      return (
        <Field
          label="Your name"
          htmlFor="business_owner_name"
          // Owner-locked 2026-08-10: the vendor's name IS their account name.
          // Saying so here is what makes that true to the person rather than
          // only in the database — otherwise "Business owner" reads as a
          // separate field they might set differently, which is exactly the
          // drift the rule exists to stop.
          help="This is your account name. Kept private — never shown publicly."
        >
          <PlainInput itemKey={item.key} data={data} onDirty={onDirty} />
        </Field>
      );
    case 'maps_pin':
      return (
        <Field
          label="Company address"
          htmlFor="hq_address"
          required
          help="Lets couples see how far you are from their venue. Drop the pin on your exact HQ."
        >
          <HqAddressControl data={data} onDirty={onDirty} />
        </Field>
      );
    case 'contact_phone':
      return (
        <Field label="Contact number" htmlFor="contact_phone" required>
          <PlainInput itemKey={item.key} data={data} onDirty={onDirty} />
        </Field>
      );
    case 'contact_email':
      return (
        <Field label="Company email" htmlFor="contact_email" required>
          <PlainInput itemKey={item.key} data={data} onDirty={onDirty} />
        </Field>
      );
    case 'in_business_since_year':
      return (
        <Field
          label={IN_BUSINESS_SINCE_LABEL}
          htmlFor="in_business_since_year"
          required
          help={`${IN_BUSINESS_SINCE_HELP}, as “N years in business.”`}
        >
          <PlainInput itemKey={item.key} data={data} onDirty={onDirty} />
        </Field>
      );
    case 'venue_size':
      return (
        <Field
          label="Room size & capacity"
          htmlFor="venue_width_m"
          help="The rectangle that best fits your function room, in metres. A couple who books you gets their seating plan sized to it instead of guessing."
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink/70">
              Width (m)
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={500}
                step="0.1"
                id="venue_width_m"
                name="venue_width_m"
                defaultValue={data.venue_width_m}
                onChange={onDirty}
                className="w-24 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink/70">
              Length (m)
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={500}
                step="0.1"
                name="venue_length_m"
                defaultValue={data.venue_length_m}
                onChange={onDirty}
                className="w-24 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink/70">
              Seats from
              <input
                type="number"
                inputMode="numeric"
                min={1}
                name="capacity_min"
                defaultValue={data.capacity_min}
                onChange={onDirty}
                className="w-24 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink/70">
              up to
              <input
                type="number"
                inputMode="numeric"
                min={1}
                name="capacity_max"
                defaultValue={data.capacity_max}
                onChange={onDirty}
                className="w-24 rounded-lg border border-ink/15 bg-cream px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink/70">
            Leave the size blank if your space has no fixed room. Both width and
            length, or neither.
          </p>
        </Field>
      );    default:
      return null;
  }
}

/**
 * The bare input element for each single-input field — ONE source of truth for
 * input names/ids/attrs, shared by the expanded editor (wrapped in `Field`) and
 * the blank-row inline-direct form (unwrapped; the row label is the `<label>`).
 * Keeping them identical is what keeps the server action's parse contract the
 * same regardless of which surface submitted.
 */
/**
 * 📏 The shop name box — 50 at most (owner 2026-11-06, `SHOP_NAME_MAX`), with the count shown only from 40
 * ("42 / 50"). Uncontrolled like every other `PlainInput` (the form posts it as typed); the length is tracked only
 * to draw the count.
 */
function ShopNameInput({
  defaultValue,
  onDirty,
  words,
  onFair,
}: {
  defaultValue: string | null | undefined;
  onDirty: () => void;
  /** 🚫 The claim words (`ProfileFieldData.fairWords`); `null`/absent = unread. */
  words?: ClaimWord[] | null;
  /** How many fair-presentation problems the name has now — the row's auto-save waits while it is above 0. */
  onFair?: (open: number) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? '');
  const counter = shopNameCounter(value.length);
  // Pure, over the list the page already read — typing costs no request. A stored name already carrying a word is
  // shown its note when the row opens (the sweep's "Edit your name"); nothing is ever taken down.
  const hits = findFairHits([{ field: 'shop_name', value }], { words: words ?? null });
  useEffect(() => onFair?.(hits.length), [hits.length, onFair]);
  return (
    <>
      <input
        id="business_name"
        name="business_name"
        required
        onInput={(e) => {
          setValue(e.currentTarget.value);
          onDirty();
        }}
        maxLength={SHOP_NAME_MAX}
        defaultValue={defaultValue ?? undefined}
        placeholder="Your studio / company name"
        className="input-field"
      />
      {counter ? (
        <span className="mt-1 block text-xs tabular-nums" style={{ color: 'var(--m-slate-3)' }} aria-live="polite">
          {counter}
        </span>
      ) : null}
      <FairNote hits={hits} field="shop_name" />
    </>
  );
}

function PlainInput({
  itemKey,
  data,
  onDirty,
  onFair,
}: {
  itemKey: string;
  data: ProfileFieldData;
  onDirty: () => void;
  onFair?: (open: number) => void;
}) {
  switch (itemKey) {
    case 'business_name':
      return <ShopNameInput defaultValue={data.business_name} onDirty={onDirty} words={data.fairWords} onFair={onFair} />;
    case 'business_owner_name':
      return (
        <input
          autoComplete="name"
          id="business_owner_name"
          name="business_owner_name"
          onInput={onDirty}
          maxLength={128}
          defaultValue={data.business_owner_name}
          placeholder="Owner / representative full name"
          className="input-field"
        />
      );
    case 'contact_phone':
      return (
        <input
          autoComplete="tel"
          inputMode="tel"
          id="contact_phone"
          name="contact_phone"
          type="tel"
          onInput={onDirty}
          defaultValue={data.contact_phone}
          placeholder="+63 917 …"
          className="input-field"
        />
      );
    case 'contact_email':
      return (
        <input
          autoComplete="email"
          id="contact_email"
          name="contact_email"
          type="email"
          onInput={onDirty}
          defaultValue={data.contact_email}
          placeholder="hello@yourstudio.ph"
          className="input-field"
        />
      );
    case 'in_business_since_year':
      return (
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
      );
    default:
      return null;
  }
}

/** Metro Manila — a sensible starting view before any pin exists. */
const PH_FALLBACK = { lat: 14.5995, lng: 120.9842 };

type Pin = {
  lat: number;
  lng: number;
  /**
   * Where the current pin came from — decides whether it's SUBMITTED with the
   * save (hidden hq_latitude/hq_longitude inputs → the server saves it directly
   * and skips its re-geocode):
   *   'saved'    — echoed from the profile row (or a client geocode the vendor
   *                then typed over). Display only, never submitted: if only the
   *                address text changed, the server re-geocodes as before.
   *   'geocoded' — fresh "Find on map" result for the CURRENT text. Submitted.
   *                Downgraded to 'saved' if the vendor edits the address after.
   *   'pinned'   — the vendor dragged the pin / clicked the map. Submitted, and
   *                sticky through later address edits — an explicit hand-placed
   *                pin is more precise than any geocode of the text.
   */
  source: 'saved' | 'geocoded' | 'pinned';
};

/** L.divIcon sidesteps Leaflet's default marker-icon URL breakage under bundlers. */
function pinIcon(L: LeafletModule) {
  return L.divIcon({
    className: '',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:var(--m-orange-2,#b45309);border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25),0 1px 4px rgba(0,0,0,.35)"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/**
 * Company-address editor: the address text input (name unchanged — the server
 * contract is identical) plus an OpenStreetMap pin picker. "Find on map"
 * geocodes the typed address client-side via Nominatim; the vendor then drags
 * the pin (or clicks the map) to the exact HQ spot. Leaflet is loaded with a
 * dynamic import on mount so it never runs during SSR.
 */
function HqAddressControl({ data, onDirty }: { data: ProfileFieldData; onDirty: () => void }) {
  const addressRef = useRef<HTMLInputElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const lastGeocodeAt = useRef(0);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pin, setPin] = useState<Pin | null>(() =>
    typeof data.hq_latitude === 'number' && typeof data.hq_longitude === 'number'
      ? { lat: data.hq_latitude, lng: data.hq_longitude, source: 'saved' }
      : null,
  );
  const initialPin = useRef(pin);

  /** Create/move the marker. `byUser` = a click/drag → pin becomes 'pinned'. */
  const placeMarker = (lat: number, lng: number, byUser: boolean) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!markerRef.current) {
      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon(L) });
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setPin({ lat: p.lat, lng: p.lng, source: 'pinned' });
        onDirty();
      });
      marker.addTo(map);
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (byUser) {
      setPin({ lat, lng, source: 'pinned' });
      onDirty();
    }
  };

  // Mount-once map init. Leaflet touches `window` at module scope, so the
  // runtime import lives here (client, post-hydration) — never in SSR.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const mod = await import('leaflet');
      const L: LeafletModule = (mod as unknown as { default?: LeafletModule }).default ?? mod;
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      leafletRef.current = L;
      const start = initialPin.current ?? PH_FALLBACK;
      const map = L.map(mapDivRef.current, { scrollWheelZoom: false });
      map.setView([start.lat, start.lng], initialPin.current ? 16 : 11);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;
      if (initialPin.current) placeMarker(start.lat, start.lng, false);
      map.on('click', (e: LeafletMouseEvent) => placeMarker(e.latlng.lat, e.latlng.lng, true));
      // The editor lives inside a Collapsible that animates from height 0 — the
      // map initializes at size 0 and must re-measure whenever the panel gets
      // real dimensions, or the tiles render blank/misaligned.
      ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
      ro.observe(mapDivRef.current);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findOnMap = async () => {
    const q = addressRef.current?.value.trim() ?? '';
    if (!q) {
      setNote('Type your address above first.');
      return;
    }
    // Debounce to Nominatim's ≤1 request/second usage policy (also guards a
    // double-clicked button).
    const now = Date.now();
    if (searching || now - lastGeocodeAt.current < 1000) return;
    lastGeocodeAt.current = now;
    setSearching(true);
    setNote(null);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'ph');
      // Identification per the Nominatim usage policy: the browser owns the
      // User-Agent header, so we identify via the documented `email` param
      // (plus the Referer the browser sends). Same contact as lib/geo.ts.
      url.searchParams.set('email', 'iscasasolaii@gmail.com');
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      const json: unknown = res.ok ? await res.json() : null;
      const first = Array.isArray(json)
        ? (json[0] as { lat?: string; lon?: string } | undefined)
        : undefined;
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        placeMarker(lat, lng, false);
        setPin({ lat, lng, source: 'geocoded' });
        mapRef.current?.setView([lat, lng], 16);
        onDirty();
      } else {
        setNote('We couldn’t find that address — click the map or drag the pin to your exact spot instead.');
      }
    } catch {
      setNote('Couldn’t reach the map search — click the map or drag the pin to your spot instead.');
    } finally {
      setSearching(false);
    }
  };

  const submitPin = pin && pin.source !== 'saved' ? pin : null;

  return (
    <div className="space-y-2">
      <input
        autoComplete="street-address"
        ref={addressRef}
        id="hq_address"
        name="hq_address"
        onInput={() => {
          onDirty();
          // Address text changed AFTER a client geocode → that geocode no longer
          // matches the text; stop submitting it so the server re-geocodes. A
          // hand-placed ('pinned') pin stays — it's the vendor's exact spot.
          setPin((p) => (p && p.source === 'geocoded' ? { ...p, source: 'saved' } : p));
        }}
        onKeyDown={(e) => {
          // Enter here looks up the address instead of collapse-saving the row —
          // otherwise it would save with a pin that never matched the new text.
          if (e.key === 'Enter') {
            e.preventDefault();
            void findOnMap();
          }
        }}
        maxLength={500}
        defaultValue={data.hq_address}
        placeholder="123 Katipunan Ave, Quezon City, Metro Manila"
        className="input-field"
      />
      {/* ── THE CITY (added 2026-08-10) ────────────────────────────────────
          Sits with the address because it is the same fact, and because this
          was the only public claim a vendor could not change: there was no city
          field anywhere on My Shop, and the admin editor refuses claimed shops.
          A vendor who typed their street here at signup vanished from every
          city search, permanently. */}
      <input
        autoComplete="address-level2"
        name="location_city"
        defaultValue={data.location_city}
        onChange={onDirty}
        maxLength={64}
        placeholder="City"
        aria-label="City"
        className="input-field"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ActionButton tone="neutral" icon={MapPin} label="Find on map" onClick={() => void findOnMap()} waiting={searching} disabled={searching} className="!h-11" />
        {pin ? (
          <span className="text-xs tabular-nums" style={{ color: 'var(--m-slate-3)' }}>
            {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
          </span>
        ) : null}
      </div>
      {note ? (
        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }} aria-live="polite">
          {note}
        </p>
      ) : null}
      <div
        ref={mapDivRef}
        className="h-[220px] w-full overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--m-line)' }}
        role="application"
        aria-label="Map — click or drag the pin to your exact address"
      />
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Drag the pin (or click the map) to your exact spot.
      </p>
      {/* A vendor-placed/geocoded pin rides along with the save; the server
          stores it directly and skips its own re-geocode. Absent → today's
          server-side geocode path runs unchanged. */}
      {submitPin ? (
        <>
          <input type="hidden" name="hq_latitude" value={submitPin.lat.toFixed(6)} />
          <input type="hidden" name="hq_longitude" value={submitPin.lng.toFixed(6)} />

        </>
      ) : null}
    </div>
  );
}
