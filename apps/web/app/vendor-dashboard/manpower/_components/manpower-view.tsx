import type { ReactNode } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { ToolEmpty, ToolFail, ToolPage, ToolPin, ToolSection, type ToolChipTone } from '../../_components/tool-page';
import type { ManpowerGigRow, ManpowerGigStatus } from '../actions';
import { GigCard } from './gig-card';

/**
 * Manpower gigs — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 11, "build
 * last"). Look only: Open / Accepted / Wrapped, Accept gig (and its race-lost / already-claimed words), Mark wrapped,
 * Cancel gig with a reason (4+ characters), the open-gigs failed-read line. The page keeps NO door (owner 9 Nov).
 *
 * 🔴 A REFUSED "MY GIGS" READ IS SAID (controller 21 Nov): Accepted and Wrapped used to say "You haven't accepted any
 * gigs yet." when the read failed. `mine === null` now draws "We couldn't read your gigs just now" with Try again in
 * both. 🔒 app/vendor-dashboard/a-failed-tool-read-is-never-clean.test.ts
 * Presentational — the surface (which reads) and `/dev/supplier-tools-lab` mount it.
 */
const STATUS_LABEL: Record<ManpowerGigStatus, string> = {
  pending: 'Open',
  accepted: 'Accepted',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<ManpowerGigStatus, ToolChipTone> = {
  pending: 'wait',
  accepted: 'ok',
  completed: 'quiet',
  cancelled: 'no',
};

export function ManpowerView({
  openGigs,
  openEmpty,
  openNote,
  mine,
}: {
  openGigs: ManpowerGigRow[];
  /** What the open list says when it has no row — the surface's measured words (a failed read is never "none"). */
  openEmpty: string;
  /** Said above an open list that is shown but did not fully load. */
  openNote: string | null;
  /** The shop's own gigs — null when that read was refused. */
  mine: ManpowerGigRow[] | null;
}) {
  const accepted = mine?.filter((g) => g.status === 'accepted') ?? [];
  const wrapped = mine?.filter((g) => g.status === 'completed' || g.status === 'cancelled') ?? [];
  const unread = (
    <ToolFail
      data="manpower-mine"
      title="We couldn’t read your gigs just now."
      line="This is not a statement that you have none."
      retryHref="/vendor-dashboard/manpower"
    />
  );
  return (
    <ToolPage name="manpower">
      <ToolPin
        route="/vendor-dashboard/manpower"
        title="Manpower gigs"
        sub={
          // BIR-exempt note · the boxed "Setnayan note" is one line + ⓘ now, every word kept.
          <InfoTip label="Setnayan doesn’t touch a gig’s cash." align="start">
            Setnayan doesn&apos;t touch a gig&apos;s cash — the amount on each gig flows direct from the host to your crew.
            You handle your own Form 2307 on this. Accepting a gig is free · it stamps your business as the gig owner for
            event rewards.
          </InfoTip>
        }
      />

      <Group title="Open gigs · ready to claim" count={openGigs.length} empty={openEmpty} note={openNote}>
        {openGigs.map((gig) => (
          <GigCard key={gig.gig_id} gig={gig} mode="open" statusLabel={STATUS_LABEL[gig.status]} statusTone={STATUS_TONE[gig.status]} />
        ))}
      </Group>

      <Group title="Accepted" count={mine ? accepted.length : undefined} empty="You haven't accepted any gigs yet." unread={mine === null ? unread : null}>
        {accepted.map((gig) => (
          <GigCard key={gig.gig_id} gig={gig} mode="accepted" statusLabel={STATUS_LABEL[gig.status]} statusTone={STATUS_TONE[gig.status]} />
        ))}
      </Group>

      <Group title="Wrapped" count={mine ? wrapped.length : undefined} empty="Completed + cancelled gigs will show here." unread={mine === null ? unread : null}>
        {wrapped.map((gig) => (
          <GigCard key={gig.gig_id} gig={gig} mode="wrapped" statusLabel={STATUS_LABEL[gig.status]} statusTone={STATUS_TONE[gig.status]} />
        ))}
      </Group>
    </ToolPage>
  );
}

function Group({
  title,
  count,
  empty,
  note = null,
  unread = null,
  children,
}: {
  title: string;
  count?: number;
  empty: string;
  /** Said above a list that is shown but did not fully load. */
  note?: string | null;
  /** The read behind this group was refused — said in its place, never the empty line. */
  unread?: ReactNode;
  children: ReactNode[];
}) {
  return (
    <ToolSection label={title} count={count && count > 0 ? count : undefined} data={`manpower-${title}`}>
      {note ? (
        <p role="status" className="mb-2 text-[14px] text-[color:var(--m-slate-2)]">
          {note}
        </p>
      ) : null}
      {unread ? unread : children.length > 0 ? <ul className="sn-frame px-4 py-1">{children}</ul> : <ToolEmpty data="manpower">{empty}</ToolEmpty>}
    </ToolSection>
  );
}
