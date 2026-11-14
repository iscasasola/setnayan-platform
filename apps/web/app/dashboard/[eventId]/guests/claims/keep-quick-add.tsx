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
import { useRoleNames } from '../_components/role-names-context';
import { useMemo, useState } from 'react';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { guestRoleLabel, guestRolePickLabel, SIDE_LABELS, type GuestRole } from '@/lib/guests';
import { readKeepLine } from '@/lib/unlisted-guests';
import { formatCount } from '@/lib/format-number';

export function KeepQuickAdd({
  defaultLine,
  offeredRoles,
  hasSides = true,
  existingGroups,
}: {
  defaultLine: string;
  offeredRoles: GuestRole[];
  /** False on a sideless event (`eventHasSides`): no side chip, no
   *  bride/groom/both in the hint or the placeholder. */
  hasSides?: boolean;
  /** Existing group names, lower-cased — so the preview can say "new group". */
  existingGroups: string[];
}) {
  // The couple's own words for roles (owner 2026-09-30).
  const roleNames = useRoleNames();
  const [line, setLine] = useState(defaultLine);
  const [role, setRole] = useState('');
  const read = useMemo(() => readKeepLine(line, role, offeredRoles), [line, role, offeredRoles]);
  const known = useMemo(() => new Set(existingGroups), [existingGroups]);
  const pickable = offeredRoles.filter((r) => r !== 'bride' && r !== 'groom');
  // The role words the line understands, only where this event offers them.
  const sponsorWords = offeredRoles.some((r) => r.startsWith('principal_sponsor_'));

  return (
    <div className="space-y-2">
      <input
        name="line"
        value={line}
        onChange={(e) => setLine(e.target.value)}
        aria-label={
          hasSides
            ? 'Name, then side, #group, role or +N — like the guest list’s quick add'
            : 'Name, then #group, role or +N — like the guest list’s quick add'
        }
        placeholder={['Ana Cruz', hasSides ? 'bride' : null, '#Barkada', sponsorWords ? 'ninang' : null, '+2']
          .filter(Boolean)
          .join(' ')}
        className="input-field h-10 w-full py-1 text-sm"
        autoComplete="off"
      />
      <p className="text-xs text-ink/70">
        Like the guest list&rsquo;s quick add: name, then{' '}
        {hasSides ? (
          <>
            <b>bride</b>/<b>groom</b>/<b>both</b>,{' '}
          </>
        ) : null}
        <b>#Group</b>, {sponsorWords ? (
          <>
            <b>ninong</b>/<b>ninang</b>/
          </>
        ) : null}
        <b>vip</b>, <b>+1</b>…<b>+4</b>.
      </p>

      {/* What the line means — the same reading the server makes. */}
      <div aria-live="polite" className="flex flex-wrap gap-1.5 text-xs">
        {read.ok ? (
          <>
            <Chip>{[read.value.prefix, read.value.first_name, read.value.middle_name, read.value.last_name, read.value.suffix].filter(Boolean).join(' ')}</Chip>
            {hasSides ? <Chip>{SIDE_LABELS[read.value.side]}</Chip> : null}
            <Chip>{guestRoleLabel(read.value.role, roleNames)}</Chip>
            {read.value.groups.map((g) => (
              <Chip key={g}>
                #{g}
                {known.has(g.toLowerCase()) ? '' : ' · new group'}
              </Chip>
            ))}
            {read.value.plusOnes > 0 ? <Chip>+{formatCount(read.value.plusOnes)} seats beside them</Chip> : null}
          </>
        ) : (
          <span className="text-danger-800">{read.error}</span>
        )}
      </div>

      {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rule 4): the ▾ picker, posting the same `role` field. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink/70">Role</span>
        <input type="hidden" name="role" value={role} />
        <PickMenu
          label="Role"
          value={role}
          options={[
            { key: '', label: 'From the line (or Guest)' },
            ...pickable.map((r) => ({ key: r, label: guestRolePickLabel(r, roleNames) })),
          ]}
          onPick={setRole}
          dataAttr="data-keep-role"
        />
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-ink/5 px-2 py-0.5 text-ink">{children}</span>;
}
