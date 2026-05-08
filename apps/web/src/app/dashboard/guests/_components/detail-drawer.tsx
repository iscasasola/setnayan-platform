"use client";

import { useState, useTransition } from "react";
import {
  GROUP_LABELS,
  RSVP_LABELS,
  ROLE_LABELS,
  SCHEDULE_BLOCK_LABELS,
  SIDE_LABELS,
  type Guest,
  type Household,
  type RsvpStatus,
  type WeddingTable,
} from "@/lib/db/types";
import { SideAvatar } from "./shared";
import { setRsvpAction, softDeleteGuestAction } from "../actions";

interface Props {
  guest: Guest | null;
  partner: Guest | null;
  household: Household | null;
  table: WeddingTable | null;
  onClose: () => void;
  onEdit: (guestId: string) => void;
}

export function DetailDrawer({ guest, partner, household, table, onClose, onEdit }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!guest) return null;

  const displayName = guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`;
  const sideLabel = SIDE_LABELS[guest.side];
  const groupLabel = GROUP_LABELS[guest.group_category];
  const initials = ((guest.first_name[0] ?? "?") + (guest.last_name[0] ?? "?")).toUpperCase();
  const partyCount = partner ? 2 : guest.plus_one_allowed ? (guest.plus_one_name ? 2 : 1) : 1;
  const isAttending = guest.rsvp_status === "attending";

  const updateRsvp = (status: RsvpStatus) => {
    setError(null);
    startTransition(async () => {
      const r = await setRsvpAction(guest.guest_id, status);
      if (!r.ok) setError(r.error);
    });
  };

  const handleDelete = () => {
    if (!confirm(`Remove ${displayName} from your guest list?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await softDeleteGuestAction(guest.guest_id);
      if (!r.ok) {
        setError(r.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-[2px] lg:hidden"
      />
      <aside
        role="dialog"
        aria-label={`Details for ${displayName}`}
        className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-surface p-5 shadow-tayo-lg lg:absolute lg:right-0 lg:top-0 lg:bottom-auto lg:left-auto lg:inset-y-0 lg:z-10 lg:h-full lg:w-[380px] lg:rounded-l-2xl lg:border-l lg:border-rule lg:p-6"
      >
        <div className="flex items-center justify-between">
          <span className="meta-label">Guest detail</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-page-bg-soft hover:text-ink lg:h-8 lg:w-8"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3.5 border-b border-rule pb-4">
          <SideAvatar side={guest.side} initials={initials} size="lg" />
          <div className="min-w-0">
            <h3 className="font-serif text-[26px] font-medium leading-tight tracking-tight">
              {partner
                ? `${guest.first_name} & ${partner.first_name} ${guest.last_name}`
                : displayName}
            </h3>
            <div className="mt-1 font-mono text-[12px] tracking-label-mid text-ink-soft">
              {household ? `${household.name} · ${partner ? "paired entry" : "solo"}` : "Solo"}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-rsvp-declined-soft px-3 py-2 text-sm text-rsvp-declined-ink">
            {error}
          </div>
        )}

        <Section title="Categorization">
          <Row label="Side" value={sideLabel} />
          <Row label="Group" value={groupLabel} />
          <Row label="Role" value={ROLE_LABELS[guest.role]} />
          {household && <Row label="Household" value={`${household.name}${partner ? " — 2 guests" : ""}`} />}
        </Section>

        <Section title="RSVP & Events">
          <Row
            label="Status"
            value={
              <span className={isAttending ? "text-rsvp-attending" : ""}>
                {RSVP_LABELS[guest.rsvp_status]}
                {partner ? ` · 2/2` : ""}
              </span>
            }
          />
          <Row
            label="Invited to"
            value={guest.invited_to_blocks
              .map((b) => SCHEDULE_BLOCK_LABELS[b as keyof typeof SCHEDULE_BLOCK_LABELS] ?? b)
              .join(" · ")}
          />
          {guest.meal_preference && (
            <Row label="Meal" value={mealLabel(guest.meal_preference)} />
          )}
          {guest.dietary_restrictions && <Row label="Dietary" value={guest.dietary_restrictions} />}
          {table && <Row label="Seating" value={`${table.table_name}`} />}
        </Section>

        <Section title="Contact">
          <Row label="Email" value={guest.email ?? "—"} />
          <Row label="Mobile" value={guest.mobile ? maskPhone(guest.mobile) : "—"} />
          {guest.address && typeof guest.address === "object" && "city" in guest.address && (
            <Row label="Address" value={(guest.address as { city?: string }).city ?? "—"} />
          )}
        </Section>

        {guest.notes && (
          <Section title="Notes">
            <div className="rounded-lg bg-page-bg-soft px-3 py-2.5 text-[12px] leading-relaxed text-ink-soft">
              {guest.notes}
            </div>
          </Section>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {guest.custom_tags.map((tag) => (
            <span key={tag} className="pill-tag">
              <span aria-hidden className="dot" /> {tag}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 pb-2">
          <div className="flex flex-wrap gap-2">
            {(["pending", "attending", "declined", "maybe"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateRsvp(s)}
                disabled={pending || guest.rsvp_status === s}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-label-tight transition ${
                  guest.rsvp_status === s
                    ? "bg-ink text-white"
                    : "border border-rule-strong bg-surface text-ink-soft hover:border-ink hover:text-ink"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {RSVP_LABELS[s]}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onEdit(guest.guest_id)} className="btn-primary w-full justify-center">
            ✎ Edit guest
          </button>
          <button type="button" disabled className="btn-default w-full justify-center cursor-not-allowed opacity-60" title="Coming in invitations work order">
            ✉ Resend invitation
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="btn-ghost w-full justify-center text-rsvp-declined-ink"
          >
            ⊖ Remove from list
          </button>
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h5 className="meta-label mb-2.5">{title}</h5>
      <div className="flex flex-col gap-0">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-rule py-2 text-[13px] last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

function mealLabel(meal: string): string {
  const map: Record<string, string> = {
    beef: "Beef",
    chicken: "Chicken",
    fish: "Fish",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    kids: "Kids menu",
    no_preference: "No preference",
  };
  return map[meal] ?? meal;
}

function maskPhone(p: string): string {
  if (p.length < 6) return p;
  return p.slice(0, 5) + " ••• " + p.slice(-4);
}
