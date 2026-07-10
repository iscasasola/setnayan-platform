'use client';

// ============================================================================
// app/_components/appointments-section.tsx
//
// The shared, two-sided Appointments surface (Relationship Workspace +
// Appointments, PR 12). ONE client component rendered on BOTH entry pages —
// the vendor's Customer Card and the couple's Vendor Workspace — with a `role`
// prop that flips the copy + which proposals the viewer may answer.
//
// It renders:
//   • the SCHEDULER — mode (In-person / Video / Voice), a category-aware Type
//     row (presets for the vendor's category) + a persistent "Custom" chip that
//     reveals a free-text name, location (in-person), date/time, duration, note
//     → proposeAppointment.
//   • the LIST — one card per appointment with a status chip; in-person carries
//     location + Directions + Add-to-calendar, video/voice carry Join (deep-
//     links to the relationship thread). A proposal made by the OTHER side
//     shows Confirm / Propose-new / Decline; your own pending proposal shows a
//     waiting note + Cancel.
//
// Clean-theme (ivory/ink/terracotta) to match the surrounding pages. All writes
// go through the RLS-gated server actions — this component never reads/writes
// the DB directly.
// ============================================================================

import { useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquare,
  Plus,
  Video,
  Phone,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  APPOINTMENT_KIND_LABEL,
  APPOINTMENT_STATUS_META,
  type AppointmentKind,
  type AppointmentTypePreset,
  type AppointmentView,
} from '@/lib/appointments';
import {
  proposeAppointment,
  respondAppointment,
  cancelAppointment,
} from '@/app/_components/appointments-actions';

type Role = 'vendor' | 'couple';

type Props = {
  role: Role;
  eventId: string;
  vendorProfileId: string;
  returnPath: string;
  threadId: string | null;
  threadHref: string | null;
  counterpartyName: string;
  presets: AppointmentTypePreset[];
  appointments: AppointmentView[];
};

const KIND_ICON: Record<AppointmentKind, typeof Video> = {
  in_person: MapPin,
  video: Video,
  voice: Phone,
};

function formatWhen(iso: string | null): string {
  if (!iso) return 'Time to be set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Time to be set';
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(d);
}

/** Google Calendar "add event" template link — a no-server Add-to-calendar
 *  affordance for the MVP (the .ics file + reminder email are follow-ups). */
function googleCalendarUrl(a: AppointmentView): string | null {
  if (!a.scheduled_at) return null;
  const start = new Date(a.scheduled_at);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (a.duration_min ?? 60) * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: a.label,
    dates: `${stamp(start)}/${stamp(end)}`,
  });
  if (a.note) params.set('details', a.note);
  if (a.location) params.set('location', a.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function directionsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

const chipBase =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta';
const chipOn = 'border-terracotta bg-terracotta/10 text-terracotta';
const chipOff = 'border-ink/15 bg-white text-ink/70 hover:border-terracotta/40';

// ---------------------------------------------------------------------------
// Scheduler — controlled propose form.
// ---------------------------------------------------------------------------
function Scheduler({
  eventId,
  vendorProfileId,
  returnPath,
  threadId,
  presets,
}: Pick<Props, 'eventId' | 'vendorProfileId' | 'returnPath' | 'threadId' | 'presets'>) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AppointmentKind>('in_person');
  const [selectedType, setSelectedType] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [duration, setDuration] = useState<number>(60);

  const isCustom = selectedType === 'custom';
  const selectedPreset = presets.find((p) => p.type === selectedType) ?? null;
  const label = isCustom ? customName.trim() : selectedPreset?.label ?? '';
  const disabled = selectedType === '' || (isCustom && customName.trim().length === 0);

  function pickPreset(p: AppointmentTypePreset) {
    setSelectedType(p.type);
    setMode(p.default_mode);
    setDuration(p.default_duration_min);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta/30 bg-terracotta/[0.05] px-3 py-2 text-xs font-semibold text-terracotta transition hover:bg-terracotta/[0.1]"
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Propose a meeting
      </button>
    );
  }

  return (
    <form action={proposeAppointment} className="space-y-3 rounded-xl border border-ink/10 bg-white p-4">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
      <input type="hidden" name="return_path" value={returnPath} />
      {threadId ? <input type="hidden" name="thread_id" value={threadId} /> : null}
      <input type="hidden" name="kind" value={mode} />
      <input type="hidden" name="type" value={selectedType} />
      <input type="hidden" name="label" value={label} />

      {/* Mode */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/55">Mode</p>
        <div className="flex flex-wrap gap-1.5">
          {(['in_person', 'video', 'voice'] as AppointmentKind[]).map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={`${chipBase} ${mode === k ? chipOn : chipOff}`}
                aria-pressed={mode === k}
              >
                <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {APPOINTMENT_KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Type — category presets + persistent Custom */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/55">Type</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.type}
              type="button"
              onClick={() => pickPreset(p)}
              className={`${chipBase} ${selectedType === p.type ? chipOn : chipOff}`}
              aria-pressed={selectedType === p.type}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedType('custom')}
            className={`${chipBase} ${isCustom ? chipOn : chipOff}`}
            aria-pressed={isCustom}
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Custom
          </button>
        </div>
      </div>

      {isCustom ? (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/55">
            Name this appointment
          </label>
          <input
            name="custom_label"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Contract signing"
            className="w-full rounded-lg border border-ink/15 bg-cream/50 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
          />
        </div>
      ) : null}

      {mode === 'in_person' ? (
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/55">
            Location
          </label>
          <input
            name="location"
            maxLength={300}
            placeholder="Venue or address"
            className="w-full rounded-lg border border-ink/15 bg-cream/50 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/55">
            Date &amp; time
          </label>
          <input
            type="datetime-local"
            name="scheduled_at"
            required
            className="w-full rounded-lg border border-ink/15 bg-cream/50 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/55">
            Duration (min)
          </label>
          <input
            type="number"
            name="duration_min"
            min={5}
            max={1440}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-ink/15 bg-cream/50 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/55">
          Note (optional)
        </label>
        <textarea
          name="note"
          rows={2}
          maxLength={1000}
          placeholder="Anything the other side should know"
          className="w-full rounded-lg border border-ink/15 bg-cream/50 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton
          disabled={disabled}
          pendingLabel="Proposing…"
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-cream disabled:opacity-50"
        >
          Propose meeting
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-ink/55 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// One appointment card.
// ---------------------------------------------------------------------------
function AppointmentCard({
  a,
  role,
  eventId,
  vendorProfileId,
  returnPath,
  threadHref,
}: {
  a: AppointmentView;
  role: Role;
  eventId: string;
  vendorProfileId: string;
  returnPath: string;
  threadHref: string | null;
}) {
  const [proposingNew, setProposingNew] = useState(false);

  const status = APPOINTMENT_STATUS_META[a.status];
  const Icon = KIND_ICON[a.kind];
  const iMadeIt = a.initiated_by === role;
  const canRespond = a.status === 'proposed' && a.initiated_by !== null && a.initiated_by !== role;
  const isActive = a.status === 'proposed' || a.status === 'confirmed';
  const isOnline = a.kind === 'video' || a.kind === 'voice';
  const gcal = a.status === 'confirmed' ? googleCalendarUrl(a) : null;
  const joinOpen =
    !a.scheduled_at || Date.now() >= new Date(a.scheduled_at).getTime() - 10 * 60_000;

  // Shared hidden fields for every action form on this card.
  const hidden = (
    <>
      <input type="hidden" name="appointment_id" value={a.appointment_id} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <input type="hidden" name="label" value={a.label} />
    </>
  );

  return (
    <li className="rounded-xl border border-ink/10 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={1.75} />
            <span className="truncate">{a.label}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink/60">
            <span>{APPOINTMENT_KIND_LABEL[a.kind]}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 aria-hidden className="h-3 w-3" /> {formatWhen(a.scheduled_at)}
            </span>
            {a.duration_min ? (
              <>
                <span aria-hidden>·</span>
                <span>{a.duration_min} min</span>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}
        >
          {status.label}
        </span>
      </div>

      {a.location ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-ink/65">
          <MapPin aria-hidden className="h-3 w-3 shrink-0" /> <span className="truncate">{a.location}</span>
        </p>
      ) : null}
      {a.note ? <p className="mt-1.5 text-[11px] text-ink/60">{a.note}</p> : null}

      {/* Affordances — Join (online) / Directions + Add-to-calendar (in-person). */}
      {isActive ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {a.status === 'confirmed' && isOnline ? (
            joinOpen && threadHref ? (
              <Link
                href={threadHref}
                className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-2.5 py-1.5 text-[11px] font-semibold text-white"
              >
                <MessageSquare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Join
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-cream px-2.5 py-1.5 text-[11px] font-medium text-ink/45">
                <MessageSquare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {threadHref ? 'Join opens near start' : 'Join via chat'}
              </span>
            )
          ) : null}
          {a.location ? (
            <a
              href={directionsUrl(a.location)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink/70 hover:border-terracotta/40"
            >
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Directions
            </a>
          ) : null}
          {gcal ? (
            <a
              href={gcal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink/70 hover:border-terracotta/40"
            >
              <CalendarPlus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Add to calendar
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Respond controls — only on the OTHER party's live proposal. */}
      {canRespond ? (
        <div className="mt-2.5 border-t border-ink/10 pt-2.5">
          {!proposingNew ? (
            <div className="flex flex-wrap items-center gap-2">
              <form action={respondAppointment}>
                {hidden}
                <input type="hidden" name="decision" value="confirm" />
                <SubmitButton
                  pendingLabel="Confirming…"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success-600 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                >
                  <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Confirm
                </SubmitButton>
              </form>
              <button
                type="button"
                onClick={() => setProposingNew(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink/70 hover:border-terracotta/40"
              >
                <CalendarClock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Propose new time
              </button>
              <form action={respondAppointment}>
                {hidden}
                <input type="hidden" name="decision" value="decline" />
                <SubmitButton
                  pendingLabel="Declining…"
                  overlay={false}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink/60 hover:border-danger-300 hover:text-danger-700"
                >
                  <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Decline
                </SubmitButton>
              </form>
            </div>
          ) : (
            <form action={respondAppointment} className="flex flex-wrap items-end gap-2">
              {hidden}
              <input type="hidden" name="decision" value="propose_new" />
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink/55">
                  New date &amp; time
                </label>
                <input
                  type="datetime-local"
                  name="scheduled_at"
                  required
                  className="rounded-lg border border-ink/15 bg-cream/50 px-2.5 py-1.5 text-sm text-ink focus:border-terracotta focus:outline-none"
                />
              </div>
              <SubmitButton
                pendingLabel="Sending…"
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-cream"
              >
                Send new time
              </SubmitButton>
              <button
                type="button"
                onClick={() => setProposingNew(false)}
                className="text-[11px] font-medium text-ink/55 hover:text-ink"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      ) : null}

      {/* Your own pending proposal — waiting + withdraw. */}
      {a.status === 'proposed' && iMadeIt ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2.5">
          <span className="text-[11px] text-ink/55">Waiting for the other side to confirm.</span>
          <form action={cancelAppointment}>
            {hidden}
            <SubmitButton
              pendingLabel="Cancelling…"
              overlay={false}
              className="text-[11px] font-medium text-ink/55 hover:text-danger-700"
            >
              Withdraw
            </SubmitButton>
          </form>
        </div>
      ) : null}

      {/* Confirmed — allow either side to cancel. */}
      {a.status === 'confirmed' ? (
        <div className="mt-2 flex justify-end">
          <form action={cancelAppointment}>
            {hidden}
            <SubmitButton
              pendingLabel="Cancelling…"
              overlay={false}
              className="text-[11px] font-medium text-ink/45 hover:text-danger-700"
            >
              Cancel meeting
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper.
// ---------------------------------------------------------------------------
export function AppointmentsSection({
  role,
  eventId,
  vendorProfileId,
  returnPath,
  threadId,
  threadHref,
  counterpartyName,
  presets,
  appointments,
}: Props) {
  return (
    <section
      aria-labelledby="appointments-heading"
      className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="appointments-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <CalendarClock aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Appointments
        </h2>
        <Scheduler
          eventId={eventId}
          vendorProfileId={vendorProfileId}
          returnPath={returnPath}
          threadId={threadId}
          presets={presets}
        />
      </header>

      <p className="flex items-center gap-1.5 text-[11px] text-ink/55">
        <UsersIcon aria-hidden className="h-3 w-3" />
        Meetings with {counterpartyName} — in-person or online. Either side can propose; the other
        confirms.
      </p>

      {appointments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 bg-white/50 px-3 py-4 text-center text-xs text-ink/55">
          No appointments yet. Propose a meeting to get the first one on the calendar.
        </p>
      ) : (
        <ul className="space-y-2">
          {appointments.map((a) => (
            <AppointmentCard
              key={a.appointment_id}
              a={a}
              role={role}
              eventId={eventId}
              vendorProfileId={vendorProfileId}
              returnPath={returnPath}
              threadHref={threadHref}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
