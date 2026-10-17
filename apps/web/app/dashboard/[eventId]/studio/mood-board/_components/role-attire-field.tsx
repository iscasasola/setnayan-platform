'use client';

import { ATTIRE_STYLE_LABEL, type RoleAttireMap } from '@/lib/role-dress-code';
import type { GuestRole } from '@/lib/guests';
import { formatCount } from '@/lib/format-number';

/**
 * PER-ROLE ATTIRE — the couple says what each role wears (owner 2026-09-20).
 *
 * ONLY THE ROLES ON THIS GUEST LIST are offered. The vocabulary has thirty-odd
 * roles; a wedding uses a handful, and a form with thirty rows is a form nobody
 * finishes. `roles` is resolved server-side from the couple's own guests.
 *
 * "Not set" is a real choice and it is the default: this product does not know
 * whether a ninong is in a barong or a suit, and guessing puts a sponsor in the
 * wrong clothes. An unset role tells the guest the couple has not said yet.
 *
 * The colour is NOT edited here. It comes from the mood board, through the same
 * resolver the 3D seat plan uses, so one role cannot be shown two colours by two
 * surfaces of the same product.
 */
export function RoleAttireField({
  roles,
  saved,
  compact,
  wear,
}: {
  /** The roles present on this event's guest list, with their labels. */
  roles: { role: GuestRole; label: string; count: number }[];
  saved: RoleAttireMap;
  compact?: boolean;
  /** The Wear as Studio › Mood Board & Dress Code says it (`wearSaid`) — the one place it is picked (2026-10-17). */
  wear?: Readonly<Record<string, string>>;
}) {
  if (roles.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        Once your guest list has ninongs, ninangs or a wedding party, each role can be given its own
        outfit here.
      </p>
    );
  }

  const labelCls = compact
    ? 'text-xs font-medium text-ink/70'
    : 'text-sm font-medium text-ink/80';

  return (
    <div className="space-y-3">
      {roles.map(({ role, label, count }) => {
        const current = saved[role];
        return (
          <div key={role} className="sn-row space-y-2 p-3">
            <input type="hidden" name="role_key" value={role} />
            <div className="flex items-center gap-3">
              <span className={`${labelCls} flex-1`}>
                {label}
                <span className="ml-2 text-ink/45">
                  {formatCount(count)} {count === 1 ? 'person' : 'people'}
                </span>
              </span>
              {/* 👗 The Wear is the Studio's (2026-10-17): said here as the Studio says it, posted back unchanged so the
                  zipped arrays stay aligned and the stored Wear is never rewritten from here. */}
              <input type="hidden" name="role_style" value={current?.style ?? ''} />
              <span className="max-w-[55%] text-right text-xs leading-snug text-ink/65" data-role-wear={role}>
                {wear?.[`roles:${role}`] ?? (current?.style ? ATTIRE_STYLE_LABEL[current.style] : 'Not said yet')}
              </span>
            </div>
            {/* ⏰ CALL TIME (owner 2026-09-23: “what she needs most is her call
                time”). `type="time"` so a phone offers its own wheel and the
                value is always `HH:MM` — never “1pm”, “1:00” or “one”, which
                `sanitizeCallTime` would drop on the floor rather than repair.

                ⚠ IT SUBMITS EVEN WHEN EMPTY, and it has to: this row is one of
                FOUR parallel arrays (`role_key`, `role_style`, `role_note`,
                `role_call_time`) that the action zips BY INDEX. A control that
                vanished when blank would shift every later role's time onto the
                wrong person. */}
            <div className="flex items-center gap-3">
              <label
                htmlFor={`role-call-${role}`}
                className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink/55"
              >
                Call time
              </label>
              <input
                id={`role-call-${role}`}
                type="time"
                name="role_call_time"
                defaultValue={current?.callTime ?? ''}
                className="min-h-[44px] rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink focus:border-terracotta focus:outline-none"
              />
              <span className="text-xs text-ink/45">Optional</span>
            </div>
            <label htmlFor={`role-note-${role}`} className="sr-only">
              A note for {label}
            </label>
            <input
              id={`role-note-${role}`}
              type="text"
              name="role_note"
              maxLength={120}
              defaultValue={current?.note ?? ''}
              placeholder="Optional — e.g. ivory, not white"
              className="min-h-[44px] w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
            />
          </div>
        );
      })}
    </div>
  );
}
