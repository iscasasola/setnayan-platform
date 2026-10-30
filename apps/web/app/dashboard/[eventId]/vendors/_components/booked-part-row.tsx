'use client';

/**
 * BOOKED'S FIRST ROW — "[ Team ▾ ]  3 booked · 1 without a price" (owner 2026-10-29, *"so booked has budget and
 * schedule."*; the approved final Suppliers design, 2026-10-30 — the prototype's `.crow`: `partDrop()` + its count).
 *
 *   Team ▾       the Booked body (the rows)
 *   Budget ▾     the shipped Budget page, whole            ₱297,500 agreed · ₱120,000 paid
 *   Schedule ▾   the shipped Schedule page, whole          7 moments
 *
 * ONE dropdown (the shared `PickMenu` — owner 2026-09-28, *"if there are choices … drop down menu"*), never a pill
 * row. A pick goes to that part's own address (`lib/pillar-parts.ts` `bookedParts`), the way the Budget part has
 * since 2026-09-29: each part is a whole shipped screen, drawn by the server with its own reads, so opening the
 * Suppliers page never pays for the Budget's or the Schedule's.
 *
 * The line beside it is the part's own count, decided by the screen that owns the numbers (the Booked body, the
 * Budget page, the Schedule page) — this row only places it.
 */
import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PillarPart } from '@/lib/pillar-parts';

export function BookedPartRow({
  parts,
  current,
  line,
  action,
}: {
  parts: readonly PillarPart[];
  current: string;
  /** "3 booked · 1 without a price" · "₱297,500 agreed · ₱120,000 paid" · "7 moments". */
  line?: ReactNode;
  /** One action at the row's end, where the prototype puts one (the Schedule's Announce). */
  action?: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pb-4"
      data-booked-parts={current}
      aria-busy={pending || undefined}
    >
      <PickMenu
        label="Booked: Team, Budget or Schedule"
        value={current}
        options={parts.map((p) => ({ key: p.key, label: p.label }))}
        onPick={(key) => {
          const next = parts.find((p) => p.key === key);
          if (!next || key === current) return;
          start(() => router.push(next.href));
        }}
        dataAttr="data-booked-part-pick"
        className="border border-ink/10 text-[15px] font-semibold"
      />
      <span className="min-w-0 flex-1 text-[13px] text-ink/60 [overflow-wrap:anywhere]" data-booked-part-line="" aria-live="polite">
        {pending ? 'Opening…' : line}
      </span>
      {action}
    </div>
  );
}
