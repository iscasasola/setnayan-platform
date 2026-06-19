'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Lock, Pencil, AlertTriangle, X } from 'lucide-react';
import {
  setEventCeremonyType,
  updateVenueSetting,
  updateGuestCount,
  updateEventDate,
  previewPersonalizationConflicts,
} from '../../actions';
import { deleteVendor } from '../../vendors/actions';
import { CEREMONY_LABEL, VENUE_LABEL, titleCase } from '@/lib/personalized-menu';
import type { ConflictField, ConflictService } from '@/lib/personalization-conflicts';

/**
 * GovernedFields — the four governed personalization fields on the
 * Personalization page, with the change-flow conflict warning.
 * CLAUDE.md 2026-06-02 directive 4 (scope: "All four fields now").
 *
 * ceremony · venue · guest-count · date all carry the booked-vendor
 * change-flow governance. Two states:
 *
 *   confirmedVendorCount > 0 → locked. The fields are read-only with a
 *     "contact support" note. Mirrors the existing setEventCeremonyType +
 *     updateEventDate vendor-confirmed gates (which still fire server-side
 *     as defence-in-depth).
 *
 *   confirmedVendorCount === 0 → editable. Each field has a Change button.
 *     On "Check & save" we ask the server which currently-picked services
 *     would conflict with the PROPOSED value; if any, we show those service
 *     cards (with a per-card Remove) and require an explicit "Apply anyway."
 *     If none, the change applies straight through.
 *
 * ceremony + date apply through their existing gated actions (the date
 * action throws on the vendor-lock gate; the ceremony action returns a
 * coded result). venue + guest-count apply through the new updateVenueSetting
 * / updateGuestCount actions (no hard gate — the conflict preview is the
 * soft warning, and these editors only render at confirmed === 0 anyway).
 */

const CEREMONY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'catholic', label: 'Catholic' },
  { value: 'civil', label: 'Civil' },
  { value: 'inc', label: 'INC' },
  { value: 'christian', label: 'Christian' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'mixed', label: 'Mixed / interfaith' },
];

const VENUE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'banquet_hall', label: 'Banquet hall' },
  { value: 'garden', label: 'Garden' },
  { value: 'beach', label: 'Beach' },
  { value: 'destination', label: 'Destination' },
  { value: 'heritage', label: 'Heritage venue' },
  { value: 'outdoor_tent', label: 'Outdoor / tent' },
  { value: 'civil_registrar', label: 'Civil registrar' },
];

type Props = {
  eventId: string;
  confirmedVendorCount: number;
  ceremony: string | null;
  secondaryCeremony: string | null;
  venue: string | null;
  pax: number | null;
  dateDisplay: string | null;
  dateValue: string | null;
};

const FIELD_LABEL: Record<ConflictField, string> = {
  ceremony: 'Wedding type',
  venue: 'Venue setting',
  pax: 'Guest count',
  date: 'Wedding date',
};

export function GovernedFields({
  eventId,
  confirmedVendorCount,
  ceremony,
  secondaryCeremony,
  venue,
  pax,
  dateDisplay,
  dateValue,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<ConflictField | null>(null);
  const [proposed, setProposed] = useState('');
  const [phase, setPhase] = useState<'edit' | 'confirm'>('edit');
  const [conflicts, setConflicts] = useState<ConflictService[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<ConflictField | null>(null);
  const [pending, startTransition] = useTransition();

  const locked = confirmedVendorCount > 0;
  const today = new Date().toISOString().slice(0, 10);

  function currentValueFor(field: ConflictField): string {
    if (field === 'ceremony') return ceremony ?? '';
    if (field === 'venue') return venue ?? '';
    if (field === 'pax') return pax != null && pax > 0 ? String(pax) : '';
    return dateValue ?? '';
  }

  function startEdit(field: ConflictField) {
    setOpen(field);
    setProposed(currentValueFor(field));
    setPhase('edit');
    setConflicts([]);
    setError(null);
    setSavedField(null);
  }

  function close() {
    setOpen(null);
    setPhase('edit');
    setConflicts([]);
    setError(null);
  }

  async function applyField(field: ConflictField, value: string): Promise<string | null> {
    // returns an error message, or null on success
    const fd = new FormData();
    fd.set('event_id', eventId);
    if (field === 'ceremony') {
      fd.set('ceremony_type', value);
      const res = await setEventCeremonyType(fd);
      return res.ok ? null : res.message;
    }
    if (field === 'venue') {
      fd.set('venue_setting', value);
      const res = await updateVenueSetting(fd);
      return res.ok ? null : res.message;
    }
    if (field === 'pax') {
      fd.set('estimated_pax', value);
      const res = await updateGuestCount(fd);
      return res.ok ? null : res.message;
    }
    // date — updateEventDate throws on its gates
    fd.set('event_date', value);
    fd.set('precision', 'day');
    try {
      await updateEventDate(fd);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save the date';
    }
  }

  function commit(field: ConflictField, value: string) {
    startTransition(async () => {
      const msg = await applyField(field, value);
      if (msg) {
        setError(msg);
        return;
      }
      setSavedField(field);
      close();
      router.refresh();
    });
  }

  function checkAndSave() {
    if (!open) return;
    const field = open;
    const value = proposed.trim();
    setError(null);

    // Date needs a value; venue/ceremony need a value; pax may be blank? require it.
    if (value === '') {
      setError('Pick a value first.');
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('field', field);
      fd.set('proposed_value', value);
      const res = await previewPersonalizationConflicts(fd);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (res.conflicts.length === 0) {
        // No conflicts — apply straight through.
        const msg = await applyField(field, value);
        if (msg) {
          setError(msg);
          return;
        }
        setSavedField(field);
        close();
        router.refresh();
        return;
      }
      setConflicts(res.conflicts);
      setPhase('confirm');
    });
  }

  function removeConflict(vendorId: string) {
    if (!open) return;
    const field = open;
    const value = proposed.trim();
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', vendorId);
      try {
        await deleteVendor(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not remove that service');
        return;
      }
      // Re-run the preview so the list reflects the removal.
      const pf = new FormData();
      pf.set('event_id', eventId);
      pf.set('field', field);
      pf.set('proposed_value', value);
      const res = await previewPersonalizationConflicts(pf);
      if (res.ok) setConflicts(res.conflicts);
      router.refresh();
    });
  }

  // ---- Locked state -------------------------------------------------------
  if (locked) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-start gap-2 rounded-xl border border-ink/10 bg-paper px-3.5 py-2.5">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
          <p className="text-xs text-ink/60">
            You’ve booked vendors, so your wedding type, venue, guest count, and date are locked.{' '}
            <Link href="/help" className="font-medium text-terracotta underline-offset-2 hover:underline">
              Contact support
            </Link>{' '}
            to change any of them — we’ll coordinate with your booked vendors.
          </p>
        </div>
        <LockedRow label="Wedding type" value={ceremonyDisplay(ceremony)} />
        {secondaryCeremony ? (
          <p className="pl-1 text-xs text-ink/50">
            Also honoring a {ceremonyDisplay(secondaryCeremony).toLowerCase()}.
          </p>
        ) : null}
        <LockedRow label="Venue setting" value={venueDisplay(venue)} />
        <LockedRow label="Guest count" value={pax != null && pax > 0 ? `${pax} guests` : null} />
        <LockedRow label="Wedding date" value={dateDisplay} />
      </div>
    );
  }

  // ---- Editable state -----------------------------------------------------
  return (
    <div className="space-y-2.5">
      <EditableRow
        field="ceremony"
        label={FIELD_LABEL.ceremony}
        value={ceremonyDisplay(ceremony)}
        open={open === 'ceremony'}
        saved={savedField === 'ceremony'}
        onEdit={() => startEdit('ceremony')}
      >
        <select
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Choose a type…</option>
          {CEREMONY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </EditableRow>

      {secondaryCeremony ? (
        <p className="pl-1 text-xs text-ink/50">
          Also honoring a {ceremonyDisplay(secondaryCeremony).toLowerCase()}.
        </p>
      ) : null}

      <EditableRow
        field="venue"
        label={FIELD_LABEL.venue}
        value={venueDisplay(venue)}
        open={open === 'venue'}
        saved={savedField === 'venue'}
        onEdit={() => startEdit('venue')}
      >
        <select
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Choose a setting…</option>
          {VENUE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </EditableRow>

      <EditableRow
        field="pax"
        label={FIELD_LABEL.pax}
        value={pax != null && pax > 0 ? `${pax} guests` : null}
        open={open === 'pax'}
        saved={savedField === 'pax'}
        onEdit={() => startEdit('pax')}
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          placeholder="e.g. 150"
          className={SELECT_CLASS}
        />
      </EditableRow>

      <EditableRow
        field="date"
        label={FIELD_LABEL.date}
        value={dateDisplay}
        open={open === 'date'}
        saved={savedField === 'date'}
        onEdit={() => startEdit('date')}
      >
        <input
          type="date"
          min={today}
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          className={SELECT_CLASS}
        />
        <p className="text-[11px] text-ink/50">
          Need a flexible window or year/month only?{' '}
          <Link
            href={`/dashboard/${eventId}/date-selection`}
            className="font-medium text-terracotta underline-offset-2 hover:underline"
          >
            More date options
          </Link>
          .
        </p>
      </EditableRow>

      {/* Shared editor footer — appears under whichever row is open. */}
      {open ? (
        <div className="space-y-3 rounded-xl border border-ink/10 bg-paper p-3.5">
          {phase === 'confirm' ? (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-warn-600"
                  strokeWidth={2}
                />
                <p className="text-sm text-ink/80">
                  {conflicts.length === 0 ? (
                    <>All clear — no services conflict anymore. You can apply your change.</>
                  ) : (
                    <>
                      Changing your {FIELD_LABEL[open].toLowerCase()} affects{' '}
                      <strong className="font-semibold">
                        {conflicts.length} service{conflicts.length === 1 ? '' : 's'}
                      </strong>{' '}
                      you’ve picked. Remove them now, or apply anyway and sort them out later.
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                {conflicts.map((c) => (
                  <div
                    key={c.vendor_id}
                    className="flex items-center gap-3 rounded-xl border border-warn-300/60 bg-warn-50/60 p-2.5"
                  >
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warn-100 text-xs font-semibold text-warn-800"
                    >
                      {initials(c.vendor_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{c.vendor_name}</p>
                      <p className="text-[11px] uppercase tracking-wide text-ink/45">
                        {titleCase(c.category)}
                        {c.raw_status ? ` · ${titleCase(c.raw_status)}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-warn-800">{c.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeConflict(c.vendor_id)}
                      disabled={pending}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink/15 bg-cream px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-60"
                    >
                      <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {error ? <ErrorNote message={error} /> : null}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => commit(open, proposed.trim())}
                  disabled={pending}
                  className="inline-flex items-center justify-center rounded-xl bg-mulberry px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? 'Saving…' : conflicts.length === 0 ? 'Apply change' : 'Apply anyway'}
                </button>
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="inline-flex items-center justify-center rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-cream disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* The field-specific input renders inside the open EditableRow
                  above; this footer holds the actions for both phases. */}
              {error ? <ErrorNote message={error} /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={checkAndSave}
                  disabled={pending}
                  className="inline-flex items-center justify-center rounded-xl bg-mulberry px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? 'Checking…' : 'Check & save'}
                </button>
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="inline-flex items-center justify-center rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-cream disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

const SELECT_CLASS =
  'w-full rounded-xl border border-ink/15 bg-paper px-3 py-2.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';

function EditableRow({
  field,
  label,
  value,
  open,
  saved,
  onEdit,
  children,
}: {
  field: ConflictField;
  label: string;
  value: string | null;
  open: boolean;
  saved: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-paper px-3.5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink/80">
          {label}
          <span className="ml-1.5 text-ink/55">· {value ?? 'Not set'}</span>
          {saved ? (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-success-700">
              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Saved
            </span>
          ) : null}
        </span>
        {!open ? (
          <button
            type="button"
            data-field={field}
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-cream"
          >
            <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Change
          </button>
        ) : null}
      </div>
      {open ? <div className="mt-2.5 space-y-1.5">{children}</div> : null}
    </div>
  );
}

function LockedRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-ink/10 bg-paper px-3.5 py-2.5">
      <span className="text-sm text-ink/70">{label}</span>
      <span className="text-right text-sm font-medium text-ink/85">
        {value ?? <span className="font-normal text-ink/40">Not set</span>}
      </span>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
      {message}
    </p>
  );
}

function ceremonyDisplay(value: string | null): string {
  if (!value) return 'Not set';
  return CEREMONY_LABEL[value] ?? `${titleCase(value)} ceremony`;
}

function venueDisplay(value: string | null): string | null {
  if (!value) return null;
  return VENUE_LABEL[value] ?? titleCase(value);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase() || '?';
  const last = parts[parts.length - 1] ?? '';
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}
