"use client";

import { useState, useTransition } from "react";
import {
  DANCE_STYLES,
  MEAL_PREFERENCES,
  type Guest,
  type GuestRsvpExtras,
  type RsvpStatus,
} from "@/lib/db/types";
import { submitRsvpAction } from "../../actions";

interface Props {
  guest: Guest;
  partner: Guest | null;
  rsvpDeadline: string | null;
  rsvpExtras: GuestRsvpExtras | null;
  isRegistered: boolean;
  /** 0002 v2 — Limited +1 sees the core RSVP form but the registered-extras
   *  block is hidden entirely (not rendered, not locked). */
  isLimitedPlusOne?: boolean;
}

export function RsvpForm({
  guest,
  partner,
  rsvpDeadline,
  rsvpExtras,
  isRegistered,
  isLimitedPlusOne = false,
}: Props) {
  const [status, setStatus] = useState<RsvpStatus>(guest.rsvp_status);
  const [plusOneName, setPlusOneName] = useState(guest.plus_one_name ?? "");
  const [meal, setMeal] = useState(guest.meal_preference ?? "");
  const [diet, setDiet] = useState(guest.dietary_restrictions ?? "");
  const [note, setNote] = useState(guest.notes ?? "");
  const [songRequest, setSongRequest] = useState(rsvpExtras?.song_request ?? "");
  const [danceStyle, setDanceStyle] = useState<string>(rsvpExtras?.dance_style ?? "");
  const [photoChallengesOptIn, setPhotoChallengesOptIn] = useState(
    rsvpExtras?.photo_challenges_opt_in ?? true,
  );
  const [freeformNote, setFreeformNote] = useState(rsvpExtras?.freeform_note ?? "");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(
    guest.rsvp_responded_at ? new Date(guest.rsvp_responded_at).toLocaleDateString() : null,
  );
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await submitRsvpAction(
        {
          rsvp_status: status,
          plus_one_name: plusOneName,
          meal_preference: meal || undefined,
          dietary_restrictions: diet,
          notes: note,
        },
        isRegistered
          ? {
              song_request: songRequest,
              dance_style: danceStyle || undefined,
              photo_challenges_opt_in: photoChallengesOptIn,
              freeform_note: freeformNote,
            }
          : undefined,
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSavedAt(new Date().toLocaleDateString());
    });
  }

  const deadlineLabel = rsvpDeadline
    ? `Please respond by ${new Date(`${rsvpDeadline}T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`
    : "Please respond when you can";

  return (
    <section
      className="rounded-3xl border border-accent/40 px-5 py-7 shadow-tayo-md lg:px-9 lg:py-10"
      style={{
        background: "linear-gradient(180deg, var(--surface) 0%, #FAEEE2 100%)",
      }}
    >
      <header className="text-center">
        <p className="meta-label mb-3" style={{ color: "var(--accent)" }}>
          RSVP
        </p>
        <StatusPill status={status} />
        <p className="mt-2 text-[12px] text-ink-soft">{deadlineLabel}</p>
      </header>

      <div className="mt-7 grid grid-cols-1 gap-2 lg:grid-cols-3 lg:gap-3">
        <BigChoice
          label="I'll be there"
          icon="✓"
          tone="going"
          active={status === "attending"}
          onClick={() => setStatus("attending")}
        />
        <BigChoice
          label="Maybe"
          icon="?"
          tone="maybe"
          active={status === "maybe"}
          onClick={() => setStatus("maybe")}
        />
        <BigChoice
          label="Can't make it"
          icon="✕"
          tone="no"
          active={status === "declined"}
          onClick={() => setStatus("declined")}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {guest.plus_one_allowed && (
          <Field label="Plus-one name (optional)">
            <input
              type="text"
              value={plusOneName}
              onChange={(e) => setPlusOneName(e.target.value)}
              placeholder={partner ? "Paired entry" : "Their name"}
              disabled={!!partner}
              className="rsvp-input"
            />
          </Field>
        )}
        <Field label="Meal preference">
          <select value={meal} onChange={(e) => setMeal(e.target.value)} className="rsvp-input">
            <option value="">No selection</option>
            {MEAL_PREFERENCES.map((m) => (
              <option key={m} value={m}>
                {m === "no_preference" ? "No preference" : m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dietary notes" className="lg:col-span-2">
          <input
            type="text"
            value={diet}
            onChange={(e) => setDiet(e.target.value)}
            placeholder="Allergies, restrictions, anything important"
            className="rsvp-input"
          />
        </Field>
        <Field label="Note to the couple (optional)" className="lg:col-span-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rsvp-input min-h-[88px]"
            placeholder="Anything you'd like Maria & Juan to know"
          />
        </Field>
      </div>

      {/* Registered-guest extras — hidden entirely for limited +1s (their RSVP
          path doesn't include song / challenges / etc. — those are full-tier
          features). For public guests, render in locked state with the
          🔒 indicator and the "Sign up free →" CTA below. */}
      {!isLimitedPlusOne && (
      <div
        className={`mt-6 rounded-2xl border p-5 ${
          isRegistered ? "border-rule bg-surface" : "border-dashed border-rule-strong bg-page-bg-soft/40 opacity-90"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="meta-label flex items-center gap-2" style={{ color: "var(--accent)" }}>
            {!isRegistered && <span aria-hidden>🔒</span>} Registered guest extras
          </span>
        </div>
        <p className="mb-3 text-[14px] font-medium text-ink">More ways to celebrate</p>
        <p className="mb-4 text-[13px] text-ink-soft">
          {isRegistered
            ? "Add a song, pick your dance style, opt into our photo challenges."
            : "Sign up free to add a song request, pick your dance style, and join the photo challenges."}
        </p>
        <fieldset disabled={!isRegistered} className={!isRegistered ? "opacity-55" : ""}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Field label="Song request" className="lg:col-span-2">
              <input
                type="text"
                value={songRequest}
                onChange={(e) => setSongRequest(e.target.value)}
                placeholder="e.g., Earned It · The Weeknd"
                className="rsvp-input"
              />
            </Field>
            <Field label="Dance style">
              <select
                value={danceStyle}
                onChange={(e) => setDanceStyle(e.target.value)}
                className="rsvp-input"
              >
                <option value="">No preference</option>
                {DANCE_STYLES.filter((d) => d !== "no_preference").map((d) => (
                  <option key={d} value={d}>
                    {d === "slow"
                      ? "Slow dancing"
                      : d === "line_dancing"
                        ? "Line dancing"
                        : "Hip-hop"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Photo challenges opt-in">
              <label className="rsvp-input flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={photoChallengesOptIn}
                  onChange={(e) => setPhotoChallengesOptIn(e.target.checked)}
                />
                <span className="text-[13px] text-ink">Yes, count me in</span>
              </label>
            </Field>
            <Field label="Anything else?" className="lg:col-span-2">
              <textarea
                value={freeformNote}
                onChange={(e) => setFreeformNote(e.target.value)}
                rows={2}
                className="rsvp-input min-h-[68px]"
                placeholder="Allergies, special asks, kind words"
              />
            </Field>
          </div>
        </fieldset>
        {!isRegistered && (
          <div className="mt-4">
            <button
              type="button"
              className="btn-primary text-[12px]"
              disabled
              title="Tayo guest accounts ship with the native app (Phase 2)"
            >
              Sign up free →
            </button>
          </div>
        )}
      </div>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-rsvp-declined-soft px-3 py-2 text-[13px] text-rsvp-declined-ink">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ink-soft">
          {savedAt ? `Saved ${savedAt}` : "Not yet saved."}
        </p>
        <button type="button" onClick={submit} disabled={pending} className="btn-accent">
          {pending ? "Saving…" : savedAt ? "Update RSVP" : "Save RSVP"}
        </button>
      </div>

      <style jsx>{`
        :global(.rsvp-input) {
          width: 100%;
          height: 46px;
          padding: 12px 14px;
          border: 1px solid var(--rule-strong);
          border-radius: 10px;
          background: var(--surface);
          font-size: 14px;
          color: var(--ink);
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
          line-height: 1.2;
          box-sizing: border-box;
        }
        :global(.rsvp-input:focus) {
          border-color: var(--accent);
        }
        :global(textarea.rsvp-input) {
          height: auto;
          line-height: 1.4;
          resize: vertical;
        }
      `}</style>
    </section>
  );
}

function StatusPill({ status }: { status: RsvpStatus }) {
  const map: Record<RsvpStatus, string> = {
    pending: "Pending",
    attending: "Going",
    maybe: "Maybe",
    declined: "Can't make it",
  };
  return (
    <span className="rsvp-pill" data-status={status}>
      <span aria-hidden className="dot" />
      {map[status]}
    </span>
  );
}

function BigChoice({
  label,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  tone: "going" | "maybe" | "no";
  active: boolean;
  onClick: () => void;
}) {
  const palette =
    tone === "going"
      ? { bg: "var(--rsvp-attending-soft)", border: "var(--rsvp-attending)", color: "#355C3A" }
      : tone === "maybe"
        ? { bg: "var(--rsvp-maybe-soft)", border: "var(--rsvp-maybe)", color: "#4F4F4F" }
        : { bg: "var(--rsvp-declined-soft)", border: "var(--rsvp-declined)", color: "#7A2F1E" };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-4 py-5 text-center transition active:scale-[0.99]"
      style={{
        background: active ? palette.bg : "var(--surface)",
        borderColor: active ? palette.border : "var(--rule-strong)",
        color: active ? palette.color : "var(--ink)",
        minHeight: 96,
      }}
      aria-pressed={active}
    >
      <span aria-hidden className="font-serif text-[28px] font-medium leading-none">
        {icon}
      </span>
      <span className="text-[13px] font-semibold tracking-tight">{label}</span>
    </button>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ?? ""}>
      <label className="meta-label mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
