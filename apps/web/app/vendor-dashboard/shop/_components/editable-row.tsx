'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, MapPin, Pencil, Plus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import { Field } from '@/app/_components/forms/field';
import { FileUpload } from '@/app/_components/file-upload';
import { useToast } from '@/app/_components/toast/toast-provider';
import type { BusinessProfileItem } from '@/lib/vendor-profile';
import { ServicesPicker } from '../../_components/services-picker';
import { updateVendorProfileField, type FieldSaveResult } from '../../actions';
import { Collapsible } from '../../_components/collapsible';

// Type-only — the leaflet RUNTIME is dynamically imported inside HqAddressControl
// (browser only; leaflet touches `window` at module scope so it must never SSR).
import type { Map as LeafletMap, Marker as LeafletMarker, LeafletMouseEvent } from 'leaflet';

type LeafletModule = typeof import('leaflet');

/**
 * All the live field values + picker vocabulary the inline editors need. Built
 * once on the server (loadShopData) and handed to every row.
 */
export type ProfileFieldData = {
  business_name: string;
  business_owner_name: string;
  hq_address: string;
  /** Saved HQ pin (server geocode or a vendor-dragged map pin). Null until geocoded. */
  hq_latitude: number | null;
  hq_longitude: number | null;
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

  // BLANK plain fields render their input directly in the row (Part 1 of the
  // 2026-07-03 field-UX pass) — no expand step, so none of the isOpen machinery
  // applies to them. Once saved, `item.ok` flips on revalidate and the row
  // becomes a normal collapsed value + Edit row ("text box gone when done").
  const inlineDirect = !item.ok && INLINE_DIRECT_KEYS.has(item.key);

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
      <li className="rounded-lg border bg-white" style={{ borderColor: 'var(--m-line)' }}>
        <div className="p-3">
          <div className="flex items-center gap-3">
            <StatusChip ok={false} />
            {/* Real <label> — the inline input has no Field wrapper, and every
                plain-input id equals its item key. */}
            <label
              htmlFor={item.key}
              className="min-w-0 flex-1 truncate text-sm"
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
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
                  Saving…
                </>
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
            className="mt-2 pl-9"
            onSubmit={() => {
              dirty.current = false;
            }}
            onBlur={(e) => {
              if (formRef.current?.contains(e.relatedTarget as Node | null)) return;
              if (dirty.current) {
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
            <PlainInput key={revertNonce} itemKey={item.key} data={data} onDirty={markDirty} />
          </form>
        </div>
      </li>
    );
  }

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
          <PlainInput itemKey={item.key} data={data} onDirty={onDirty} />
        </Field>
      );
    case 'business_owner_name':
      return (
        <Field
          label="Business owner"
          htmlFor="business_owner_name"
          help="Kept private — never shown publicly."
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
          <PlainInput itemKey={item.key} data={data} onDirty={onDirty} />
        </Field>
      );
    default:
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
function PlainInput({
  itemKey,
  data,
  onDirty,
}: {
  itemKey: string;
  data: ProfileFieldData;
  onDirty: () => void;
}) {
  switch (itemKey) {
    case 'business_name':
      return (
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
      );
    case 'business_owner_name':
      return (
        <input
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
    html: '<div style="width:16px;height:16px;border-radius:9999px;background:var(--m-orange-2,#b45309);border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25),0 1px 4px rgba(0,0,0,.35)"></div>',
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void findOnMap()}
          disabled={searching}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[color:var(--m-orange-4)] disabled:opacity-60"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
        >
          {searching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden />
          ) : (
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          )}
          Find on map
        </button>
        {pin ? (
          <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--m-slate-3)' }}>
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
