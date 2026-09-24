'use client';

import { ATTIRE_STYLES, ATTIRE_STYLE_LABEL, type RoleAttireMap } from '@/lib/role-dress-code';
import { groupOverrides, type GroupAttireMap } from '@/lib/role-group-dress-code';
import type { RoleGroup } from '@/lib/role-groups';

/**
 * ONE LINE FOR A WHOLE GROUP — the coarse tier above `RoleAttireField`.
 *
 * ── WHY IT EXISTS, MEASURED ────────────────────────────────────────────────
 * The busiest live event (prod, 2026-09-24) has 15 distinct roles across 83
 * people, and they fold into SIX groups of two or three roles each. The
 * ninongs and ninangs alone are 39 people who, in practice, wear two things.
 * Six sentences instead of fifteen.
 *
 * ⚠ ONLY THE GROUPS THIS EVENT ACTUALLY HAS are offered — the same rule
 * `RoleAttireField` already follows for roles, and for the same reason its
 * docblock gives: a form with every row the vocabulary allows is a form nobody
 * finishes. The vocabulary has twelve groups; a wedding shows the ones its own
 * guest list produces.
 *
 * ── 🛑 THE WARNING IS THE FEATURE, NOT A GARNISH ───────────────────────────
 * A role rule beats its group's. Without saying so, this panel is a form that
 * accepts a sentence and, for some of the people it names, changes nothing:
 * the couple types "barong, ecru" for Principal Sponsors, saves, and ninang
 * does not move because she has her own line. Correct behaviour, rendering
 * pixel-identical to a broken feature — which is how it gets reported as
 * broken and then "fixed" by removing the precedence that protects her.
 *
 * So every group that has overridden roles says so, by name, BEFORE the couple
 * types. `groupOverrides` lives in the contract rather than here precisely so
 * the next surface that edits a group inherits the warning instead of
 * rediscovering the bug.
 *
 * ⏰ CALL TIME IS THE FIRST FIELD, not the last (owner 2026-09-23: "what she
 * needs most is her call time"). Same four-parallel-array idiom the role rows
 * use — `group_key`, `group_style`, `group_note`, `group_call_time`, zipped BY
 * INDEX in `actions.ts` — so every control submits even when empty. A control
 * that vanished when blank would shift every later group's answer onto the
 * wrong people.
 */
export function GroupAttireField({
  groups,
  saved,
  roles,
  compact,
}: {
  /** The groups this event's guest list actually produces, in reading order. */
  groups: { group: RoleGroup; label: string; roleCount: number; people: number }[];
  saved: GroupAttireMap;
  /** The finer tier, read only — to name who will ignore what is typed here. */
  roles: RoleAttireMap;
  compact?: boolean;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        Once your guest list has sponsors, a wedding party or immediate family, you can dress a
        whole group in one line here.
      </p>
    );
  }

  const labelCls = compact
    ? 'text-xs font-medium text-ink/70'
    : 'text-sm font-medium text-ink/80';

  return (
    <div className="space-y-3">
      {groups.map(({ group, label, roleCount, people }) => {
        const current = saved[group];
        const overridden = groupOverrides(group, roles);
        return (
          <div key={group} className="sn-row space-y-2 p-3">
            <input type="hidden" name="group_key" value={group} />
            <div className="flex items-center gap-3">
              <span className={`${labelCls} flex-1`}>
                {label}
                <span className="ml-2 text-ink/45">
                  {people} {people === 1 ? 'person' : 'people'}
                  {roleCount > 1 ? ` · ${roleCount} roles` : ''}
                </span>
              </span>
              <label htmlFor={`group-style-${group}`} className="sr-only">
                What {label} wear
              </label>
              <select
                id={`group-style-${group}`}
                name="group_style"
                defaultValue={current?.style ?? ''}
                className="min-h-[44px] rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink focus:border-terracotta focus:outline-none"
              >
                <option value="">Not set</option>
                {ATTIRE_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {ATTIRE_STYLE_LABEL[style]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label
                htmlFor={`group-call-${group}`}
                className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink/55"
              >
                Call time
              </label>
              <input
                id={`group-call-${group}`}
                type="time"
                name="group_call_time"
                defaultValue={current?.callTime ?? ''}
                className="min-h-[44px] rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink focus:border-terracotta focus:outline-none"
              />
              <span className="text-xs text-ink/45">Optional</span>
            </div>

            <label htmlFor={`group-note-${group}`} className="sr-only">
              A note for {label}
            </label>
            <input
              id={`group-note-${group}`}
              type="text"
              name="group_note"
              maxLength={120}
              defaultValue={current?.note ?? ''}
              placeholder="Optional — e.g. ivory, not white"
              className="min-h-[44px] w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
            />

            {/* 🛑 THE ANTI-SILENCE LINE. Named people, before the typing, not a
                toast after the save — a toast is gone by the time they wonder. */}
            {overridden.length > 0 ? (
              <p className="text-xs leading-relaxed text-ink/60" data-group-overrides={group}>
                <span className="font-medium text-ink/75">
                  {overridden.length === 1 ? 'One of these has' : `${overridden.length} of these have`}
                  {' '}their own line
                </span>{' '}
                — {overridden.join(', ')} — so this line won&rsquo;t change{' '}
                {overridden.length === 1 ? 'them' : 'them'}. Clear that role&rsquo;s outfit to
                &ldquo;Not set&rdquo; below and they&rsquo;ll follow the group again.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
