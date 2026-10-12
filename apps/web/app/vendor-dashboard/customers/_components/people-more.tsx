import { X } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { Badge } from '@/app/_components/badge';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { ListPager } from '../../_components/list-pager';
import { SupplierSubmit } from '../../_components/supplier-submit';
import type { Paged } from '@/lib/paginate';
import { formatCount } from '@/lib/format-number';

/**
 * CUSTOMERS › PEOPLE — the two things the retired Clients page held that the
 * roster did not (S-PR2; plan § 2 "Clients → the People list (outside clients
 * are rows with an 'Outside' pill; kept notes → …)"; prototype frame 03:
 * "Outside clients and kept notes live here too — one list, not two").
 *
 *   · OUTSIDE CLIENTS — a date the shop sold outside Setnayan, held on one of
 *     its schedules (`vendor_calendar_blocks.source = 'external_client'`). Not
 *     an app customer: no thread, no customer card. So the row OPENS IN PLACE
 *     (the shared `Fold`, as Today's "Also waiting" rows do) and holds the one
 *     thing a shop does to it — Remove, which opens the date again.
 *   · KEPT NOTES — the shop's own notes whose event was deleted (owner
 *     2026-08-24: "the supplier keeps the note, but it stops being filed under
 *     that person's name"). One fold at the foot of the list.
 *
 * Server components: every word arrives read and worded; the Remove posts the
 * shipped `removeBlock` (handed in — this file imports no action).
 */

export type OutsideClient = {
  blockId: string;
  name: string;
  startDate: string;
  endDate: string;
  /** The schedule it holds a date on ("Main team"). */
  schedule: string;
  contact: string | null;
  note: string | null;
};

function fmtDate(iso: string, thisYear: string | null = null): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    // This year's dates without the year, as the roster rows above say them.
    ...(thisYear !== null && iso.slice(0, 4) === thisYear ? {} : { year: 'numeric' }),
  });
}

/** "Oct 17" · "Dec 11 – Dec 12" · "Jan 9, 2027" — the year only when it is not this one (`nowMs`, Manila). */
export function outsideDates(c: Pick<OutsideClient, 'startDate' | 'endDate'>, nowMs?: number): string {
  const y = nowMs === undefined ? null : new Date(nowMs + 8 * 3_600_000).toISOString().slice(0, 4);
  return c.startDate === c.endDate ? fmtDate(c.startDate, y) : `${fmtDate(c.startDate, y)} – ${fmtDate(c.endDate, y)}`;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/[\s&]+/).filter(Boolean);
  if (words.length === 0) return '·';
  if (words.length === 1) return (words[0]!.slice(0, 2) || '·').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

export function OutsideClientRows({
  paged,
  incomplete,
  keepParams,
  removeBlock,
  headed,
  nowMs,
}: {
  /** One page of the shop's outside clients (already searched). */
  paged: Paged<OutsideClient>;
  /** The blocks read could not prove it reached every one. */
  incomplete: boolean;
  /** Every param but `copage`, so paging keeps the segment, filter and search. */
  keepParams: string;
  /** The shipped `removeBlock` server action. */
  removeBlock: (formData: FormData) => void | Promise<void>;
  /** Draw the small "Outside Setnayan" eyebrow (under the Setnayan rows, not when it is the whole list). */
  headed: boolean;
  /** The page's one "now" — this year's dates are said without the year. */
  nowMs?: number;
}) {
  if (paged.total === 0 && !incomplete) return null;
  return (
    <div id="outside" className="scroll-mt-24" data-customers-outside="">
      {headed ? <p className="home-k2 mt-4">Outside Setnayan</p> : null}
      {paged.items.map((c) => (
        <div key={c.blockId} className="border-t border-ink/10 first-of-type:border-t-0" data-outside-row="">
          <Fold
            title={c.name}
            line={`${outsideDates(c, nowMs)} · ${c.schedule}`}
            data="outside-client"
            lead={
              <span
                aria-hidden
                className="mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-[13px] font-semibold text-ink/70"
              >
                {initialsOf(c.name)}
              </span>
            }
            aside={<Badge tone="quiet" data="customer-stage">Outside</Badge>}
          >
            <div className="pb-3 pl-[3.75rem] text-[13.5px] text-ink/70">
              <p>Holds {outsideDates(c, nowMs)} on {c.schedule}. Not a Setnayan booking — no chat, no reviews.</p>
              {c.contact ? <p className="mt-1">{c.contact}</p> : null}
              {c.note ? <p className="mt-1 whitespace-pre-wrap text-ink/60">{c.note}</p> : null}
              <ConfirmForm
                action={removeBlock}
                title="Remove this outside client?"
                confirmLabel="Remove"
                message="Their date opens back up — that day becomes bookable on Setnayan again."
                className="mt-3"
              >
                <input type="hidden" name="return_to" value="people" />
                <input type="hidden" name="block_id" value={c.blockId} />
                <SupplierSubmit tone="danger" icon={<X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />} label="Remove" pendingLabel="Removing…" />
              </ConfirmForm>
            </div>
          </Fold>
        </div>
      ))}
      <ListPager paged={paged} param="copage" keepParams={keepParams} hash="outside" noun="outside clients" incomplete={incomplete} />
    </div>
  );
}

export type KeptNote = { noteId: string; body: string; createdAt: string };

/** The shop's notes about events that were deleted — kept, filed under nobody's name. */
export function KeptNotesFold({ notes }: { notes: readonly KeptNote[] }) {
  return (
    <div className="mt-4 border-t border-ink/10" data-kept-notes="">
      <Fold
        title="Kept notes"
        line={`${formatCount(notes.length)} note${notes.length === 1 ? '' : 's'} from events that were removed`}
        data="kept-notes"
      >
        <ul className="pb-3">
          {notes.map((n) => (
            <li key={n.noteId} className="border-t border-ink/10 py-3 first:border-t-0">
              <p className="whitespace-pre-wrap text-[14px] text-ink/80">{n.body}</p>
              <p className="mt-1 text-[12.5px] text-ink/50">Written {fmtDate(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      </Fold>
    </div>
  );
}
