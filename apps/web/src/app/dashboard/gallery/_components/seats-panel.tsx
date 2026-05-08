"use client";

import { useTransition, useState } from "react";
import type { PaparazziSeat } from "@/lib/db/types";
import { regenerateSeatTokenAction } from "../actions";

interface Props {
  seats: PaparazziSeat[];
  tier: number | null;
}

export function SeatsPanel({ seats, tier }: Props) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (seats.length === 0 && tier === null) {
    return (
      <div className="rounded-2xl border border-dashed border-rule-strong bg-surface px-5 py-4 text-[13px] text-ink-soft">
        No Paparazzi tier purchased yet. The 3 Paparazzi (₱1,500) and 5 Paparazzi
        (₱2,500) tiers create claim-able seats here once paid.
      </div>
    );
  }

  if (seats.length === 0 && tier !== null) {
    return (
      <div className="rounded-2xl border border-rule bg-surface px-5 py-4 text-[13px] text-ink-soft">
        Tier purchased ({tier} seats) but no seat rows have been provisioned yet.
        Contact support if this persists.
      </div>
    );
  }

  const handleRegenerate = (seatId: string, idx: number) => {
    if (
      !confirm(
        `Regenerate the claim QR for seat #${idx}? The old QR stops working immediately and any current claim is revoked.`,
      )
    )
      return;
    setFeedback(null);
    setBusy(seatId);
    start(async () => {
      const r = await regenerateSeatTokenAction(seatId);
      setBusy(null);
      if (r.ok) setFeedback(`Seat #${idx} reissued.`);
      else setFeedback(`Could not reissue seat #${idx}: ${r.error}`);
    });
  };

  return (
    <section className="rounded-2xl border border-rule bg-surface px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="meta-label">Paparazzi seats</p>
        <p className="text-[12px] text-ink-soft">
          {seats.filter((s) => s.claimed_at).length}/{seats.length} claimed
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {seats.map((s) => {
          const claimed = !!s.claimed_at;
          return (
            <li
              key={s.seat_id}
              className="flex items-center justify-between gap-3 rounded-xl border border-rule px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">
                  Seat #{s.seat_index}
                  {s.role_label ? (
                    <span className="ml-1 text-ink-soft font-normal">· {s.role_label}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                  {claimed
                    ? `${s.claimer_label ?? "Claimed"} · ${s.device_platform ?? "device unknown"}`
                    : "Unclaimed · share the claim QR"}
                  {typeof s.battery_pct_last === "number"
                    ? ` · ${s.battery_pct_last}% battery`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRegenerate(s.seat_id, s.seat_index)}
                disabled={pending && busy === s.seat_id}
                className="btn-ghost text-[11px]"
                aria-label={`Regenerate claim QR for seat ${s.seat_index}`}
              >
                {pending && busy === s.seat_id ? "Reissuing…" : "Reissue QR"}
              </button>
            </li>
          );
        })}
      </ul>
      {feedback && (
        <p className="mt-3 text-[12px] text-ink-soft">{feedback}</p>
      )}
    </section>
  );
}
