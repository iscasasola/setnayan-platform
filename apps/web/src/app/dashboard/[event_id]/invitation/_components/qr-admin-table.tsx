"use client";

import { useState, useTransition } from "react";
import { useParams } from "next/navigation";
import {
  GROUP_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  type Guest,
} from "@/lib/db/types";
import { reissueGuestTokenAction } from "../actions";

interface Props {
  guests: Guest[];
  qrSvgs: Record<string, string>;
  latestScanByGuest: Record<string, string>;
}

const SEGMENTS: Array<{ key: string; label: string }> = [
  { key: "arrival", label: "A" },
  { key: "ceremony", label: "C" },
  { key: "cocktails", label: "Co" },
  { key: "reception", label: "R" },
];

const VENDOR_CHIPS: Array<{ key: string; label: string }> = [
  { key: "floral", label: "Floral" },
  { key: "catering", label: "Catering" },
  { key: "souvenirs", label: "Souvenirs" },
  { key: "coordinator", label: "Coord." },
];

export function QrAdminTable({ guests, qrSvgs, latestScanByGuest }: Props) {
  const [filter, setFilter] = useState<"all" | "scanned" | "not_scanned" | "pending">("all");
  const filtered = guests.filter((g) => {
    if (filter === "scanned") return latestScanByGuest[g.guest_id];
    if (filter === "not_scanned") return !latestScanByGuest[g.guest_id];
    if (filter === "pending") return g.rsvp_status === "pending";
    return true;
  });

  return (
    <>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", `All · ${guests.length}`],
            ["scanned", `Scanned · ${Object.keys(latestScanByGuest).length}`],
            ["not_scanned", `Not scanned · ${guests.length - Object.keys(latestScanByGuest).length}`],
            ["pending", `Pending RSVP · ${guests.filter((g) => g.rsvp_status === "pending").length}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
              filter === k
                ? "border-ink bg-ink text-white"
                : "border-rule-strong text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-rule bg-surface lg:block">
        <div
          className="grid items-center gap-3 border-b border-rule bg-page-bg-soft px-5 py-3 font-mono text-[10px] uppercase tracking-label-wide text-ink-faint"
          style={{ gridTemplateColumns: "84px 1.4fr 0.9fr 0.7fr 0.7fr 1fr 1fr 70px" }}
        >
          <div>QR</div>
          <div>Guest · Household</div>
          <div>Invitation</div>
          <div>RSVP</div>
          <div>Account</div>
          <div>Photographed</div>
          <div>Vendor claims</div>
          <div>Action</div>
        </div>
        <ul role="list">
          {filtered.map((g) => (
            <DesktopRow
              key={g.guest_id}
              guest={g}
              qrSvg={qrSvgs[g.guest_id] ?? ""}
              lastScan={latestScanByGuest[g.guest_id] ?? null}
            />
          ))}
        </ul>
      </div>

      {/* Mobile list */}
      <ul role="list" className="flex flex-col gap-2 lg:hidden">
        {filtered.map((g) => (
          <MobileRow
            key={g.guest_id}
            guest={g}
            qrSvg={qrSvgs[g.guest_id] ?? ""}
            lastScan={latestScanByGuest[g.guest_id] ?? null}
          />
        ))}
      </ul>
    </>
  );
}

// ─── Desktop row ───────────────────────────────────────────────────────────

function DesktopRow({
  guest,
  qrSvg,
  lastScan,
}: {
  guest: Guest;
  qrSvg: string;
  lastScan: string | null;
}) {
  return (
    <li
      className="grid items-center gap-3 border-b border-rule px-5 py-3 last:border-b-0 hover:bg-surface-soft"
      style={{ gridTemplateColumns: "84px 1.4fr 0.9fr 0.7fr 0.7fr 1fr 1fr 70px" }}
    >
      <div
        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-page-bg-soft p-1.5"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ink">
          {guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`}
        </div>
        <div className="truncate font-mono text-[11px] text-ink-faint">
          {ROLE_LABELS[guest.role]} · {GROUP_LABELS[guest.group_category]}
        </div>
      </div>
      <InvitationCell guest={guest} />
      <RsvpCell guest={guest} />
      <AccountCell guest={guest} lastScan={lastScan} />
      <CoverageCell />
      <VendorCell />
      <ReissueButton guestId={guest.guest_id} guestName={`${guest.first_name} ${guest.last_name}`} />
    </li>
  );
}

function InvitationCell({ guest }: { guest: Guest }) {
  if (!guest.invitation_sent_at) return <span className="text-[12px] text-ink-faint">Not sent</span>;
  return (
    <div className="flex flex-col">
      <span className="text-[12px] font-medium text-ink">Sent</span>
      <span className="font-mono text-[10px] text-ink-faint">
        {new Date(guest.invitation_sent_at).toLocaleDateString()}
      </span>
    </div>
  );
}

function RsvpCell({ guest }: { guest: Guest }) {
  return (
    <span className="rsvp-pill" data-status={guest.rsvp_status}>
      <span aria-hidden className="dot" />
      {RSVP_LABELS[guest.rsvp_status]}
    </span>
  );
}

function AccountCell({ guest, lastScan }: { guest: Guest; lastScan: string | null }) {
  // V1: no guest accounts yet. Public for everyone. Sub-line shows scan recency.
  void guest;
  return (
    <div className="flex flex-col">
      <span
        className="inline-flex w-fit items-center gap-1 rounded-full bg-page-bg-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label-tight text-ink-soft"
      >
        Public
      </span>
      <span className="mt-0.5 font-mono text-[10px] text-ink-faint">
        {lastScan ? `Scanned ${new Date(lastScan).toLocaleDateString()}` : "Not scanned"}
      </span>
    </div>
  );
}

function CoverageCell() {
  // V1 stub — every guest renders 4 empty segment dots. Phase 2 (Tayo native)
  // populates these from photo_tags joined on segments.
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {SEGMENTS.map((s) => (
          <span
            key={s.key}
            className="grid h-5 w-5 place-items-center rounded-full border border-rule-strong bg-page-bg-soft text-[9px] font-semibold text-ink-soft"
          >
            {s.label}
          </span>
        ))}
      </div>
      <span className="font-mono text-[10px] text-ink-faint">0 photos · 0 clips</span>
    </div>
  );
}

function VendorCell() {
  // V1 stub — Phase 3 (Tayo Din) populates the chips.
  return (
    <div className="flex flex-wrap gap-1">
      {VENDOR_CHIPS.map((c) => (
        <span
          key={c.key}
          className="rounded-full bg-page-bg-soft px-2 py-0.5 text-[10px] font-medium text-ink-soft"
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

function ReissueButton({ guestId, guestName }: { guestId: string; guestName: string }) {
  const params = useParams<{ event_id: string }>();
  const eventId = params.event_id;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    if (!confirm(`Re-issue ${guestName}'s QR? Their previously printed QR will stop working.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await reissueGuestTokenAction(eventId, guestId);
      if (!r.ok) setError(r.error);
    });
  }
  return (
    <div>
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="rounded-full border border-rule-strong px-3 py-1.5 text-[11px] font-medium text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-60"
      >
        {pending ? "Re-issuing…" : "Re-issue"}
      </button>
      {error && <p className="mt-1 text-[10px] text-rsvp-declined-ink">{error}</p>}
    </div>
  );
}

// ─── Mobile row ────────────────────────────────────────────────────────────

function MobileRow({
  guest,
  qrSvg,
  lastScan,
}: {
  guest: Guest;
  qrSvg: string;
  lastScan: string | null;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-rule bg-surface p-3">
      <div
        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-page-bg-soft p-1"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-ink">
          {guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`}
        </div>
        <div className="truncate font-mono text-[11px] text-ink-faint">
          {ROLE_LABELS[guest.role]}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rsvp-pill" data-status={guest.rsvp_status}>
            <span aria-hidden className="dot" />
            {RSVP_LABELS[guest.rsvp_status]}
          </span>
          <span className="rounded-full bg-page-bg-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label-tight text-ink-soft">
            Public
          </span>
          {lastScan && (
            <span className="font-mono text-[10px] text-ink-faint">
              · scanned {new Date(lastScan).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <ReissueButton guestId={guest.guest_id} guestName={`${guest.first_name} ${guest.last_name}`} />
    </li>
  );
}
