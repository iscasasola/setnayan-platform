'use client';

/**
 * keep-quick-add.tsx — "Keep on my list", the guest list's quick-add way.
 *
 * ⚖ Owner 2026-09-21: *"the option of adding a quick add text box? same
 * function as the quick add on the guestlist."* One line, the capture bar's
 * grammar — `Shey Ferriol bride #Barkada ninang +2` — prefilled with the name
 * they typed on joining. Underneath, what the line MEANS, read by the same
 * parser the server uses (`readKeepLine` → `parseGuestInput`), so the preview
 * is the save. The grammar names only a few roles, so a Role pick stays for the
 * rest; when made it wins over the line.
 */
import { useMemo, useState } from 'react';
import { ROLE_LABELS, SIDE_LABELS, type GuestRole } from '@/lib/guests';
import { readKeepLine } from '@/lib/unlisted-guests';

export function KeepQuickAdd({
  defaultLine,
  offeredRoles,
  existingGroups,
}: {
  defaultLine: string;
  offeredRoles: GuestRole[];
  /** Existing group names, lower-cased — so the preview can say "new group". */
  existingGroups: string[];
}) {
  const [line, setLine] = useState(defaultLine);
  const [role, setRole] = useState('');
  const read = useMemo(() => readKeepLine(line, role, offeredRoles), [line, role, offeredRoles]);
  const known = useMemo(() => new Set(existingGroups), [existingGroups]);
  const pickable = offeredRoles.filter((r) => r !== 'bride' && r !== 'groom');

  return (
    <div className="space-y-2">
      <input
        name="line"
        value={line}
        onChange={(e) => setLine(e.target.value)}
        aria-label="Name, then side, #group, role or +N — like the guest list’s quick add"
        placeholder="Ana Cruz bride #Barkada ninang +2"
        className="input-field h-10 w-full py-1 text-sm"
        autoComplete="off"
      />
      <p className="text-[11px] text-ink/50">
        Like the guest list&rsquo;s quick add: name, then <b>bride</b>/<b>groom</b>/<b>both</b>, <b>#Group</b>,{' '}
        <b>ninong</b>/<b>ninang</b>/<b>vip</b>, <b>+1</b>…<b>+4</b>.
      </p>

      {/* What the line means — the same reading the server makes. */}
      <div aria-live="polite" className="flex flex-wrap gap-1.5 text-xs">
        {read.ok ? (
          <>
            <Chip>{[read.value.prefix, read.value.first_name, read.value.middle_name, read.value.last_name, read.value.suffix].filter(Boolean).join(' ')}</Chip>
            <Chip>{SIDE_LABELS[read.value.side]}</Chip>
            <Chip>{ROLE_LABELS[read.value.role]}</Chip>
            {read.value.groups.map((g) => (
              <Chip key={g}>
                #{g}
                {known.has(g.toLowerCase()) ? '' : ' · new group'}
              </Chip>
            ))}
            {read.value.plusOnes > 0 ? <Chip>+{read.value.plusOnes} seats beside them</Chip> : null}
          </>
        ) : (
          <span className="text-danger-800">{read.error}</span>
        )}
      </div>

      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink/70">Role</span>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className="input-field h-9 py-1 text-sm">
          <option value="">From the line (or Guest)</option>
          {pickable.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-ink/15 bg-white px-2 py-0.5 text-ink/80">{children}</span>;
}
