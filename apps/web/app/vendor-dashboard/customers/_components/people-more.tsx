import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, QrCode, X } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
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

/**
 * THEIR ONE-TIME CODE (owner 2026-10-28, "a booked-outside customer's row holds THEIR one-time code ('Send their
 * code'; Linked / Code sent / Not linked)"). The code is the shipped Locked QR; `vendor_locked_qr_tokens.block_id`
 * names the outside booking it was made for, and its `status` says whether they used it.
 *
 *   · `unread` — the codes could not be read: the row says so and offers nothing (never "Not linked" over a refusal);
 *   · `none`   — no live code for this booking: "Not linked" · Send their code;
 *   · `sent`   — a code is waiting to be scanned: "Code sent" · Send again (the same code, shown again to share);
 *   · `linked` — they scanned it: their event is on Setnayan, booked with this shop.
 */
export type OutsideCode =
  | { state: 'unread' }
  | { state: 'none' }
  | { state: 'sent'; token: string; madeAt: string }
  | { state: 'linked'; usedAt: string | null };

export type OutsideClient = {
  blockId: string;
  name: string;
  startDate: string;
  endDate: string;
  /** The schedule it holds a date on ("Main team"). */
  schedule: string;
  contact: string | null;
  note: string | null;
  /** Their one-time code. Absent (an older caller) reads as unread — never as "Not linked". */
  code?: OutsideCode;
};

const CODE_BADGE: Record<OutsideCode['state'], { word: string; tone: BadgeTone }> = {
  unread: { word: 'Outside', tone: 'quiet' },
  none: { word: 'Not linked', tone: 'quiet' },
  sent: { word: 'Code sent', tone: 'wait' },
  linked: { word: 'Linked', tone: 'ok' },
};

/** "Send their code" opens the SHIPPED one-time-code maker with this booking's day filled and the booking named. */
export function sendCodeHref(c: Pick<OutsideClient, 'blockId' | 'startDate'>): string {
  const href = `/vendor-dashboard/invite?mode=locked&date=${c.startDate.slice(0, 10)}&block=${c.blockId}`;
  return href;
}

/** "Send again" shows the same code again, ready to share — it never makes a second one. */
export function sendAgainHref(token: string, blockId: string): string {
  const href = `/vendor-dashboard/invite?mode=locked&issued=${token}&block=${blockId}`;
  return href;
}

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
  openBlock = null,
}: {
  /** The booking just added (`?block=`) — its row opens with "Send their code" right there. */
  openBlock?: string | null;
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
      {paged.items.map((c) => {
        const code: OutsideCode = c.code ?? { state: 'unread' };
        const badge = CODE_BADGE[code.state];
        return (
        <div key={c.blockId} className="border-t border-ink/10 first-of-type:border-t-0" data-outside-row="" data-outside-code={code.state}>
          <Fold
            title={c.name}
            line={`${outsideDates(c, nowMs)} · ${c.schedule} · booked outside`}
            data="outside-client"
            defaultOpen={openBlock === c.blockId}
            lead={
              <span
                aria-hidden
                className="mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-[13px] font-semibold text-ink/70"
              >
                {initialsOf(c.name)}
              </span>
            }
            aside={<Badge tone={badge.tone} data="customer-stage">{badge.word}</Badge>}
          >
            <div className="pb-3 pl-[3.75rem] text-[13.5px] text-ink/70">
              <p>Holds {outsideDates(c, nowMs)} on {c.schedule}. Not a Setnayan booking — no chat, no reviews.</p>
              {c.contact ? <p className="mt-1">{c.contact}</p> : null}
              {c.note ? <p className="mt-1 whitespace-pre-wrap text-ink/60">{c.note}</p> : null}
              <OutsideCodeBlock c={c} code={code} nowMs={nowMs} />
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
        );
      })}
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

/**
 * THEIR ONE-TIME CODE, inside the outside booking's row — one line of state (its ⓘ holds how it works) and one button.
 * Linked says what to do next: their Setnayan booking holds the day now, so this outside entry can go.
 */
function OutsideCodeBlock({ c, code, nowMs }: { c: OutsideClient; code: OutsideCode; nowMs?: number }) {
  if (code.state === 'unread') {
    return (
      <p role="status" className="mt-3 text-[13px]" style={{ color: 'rgb(var(--color-warn))' }} data-outside-code-unread="">
        We couldn&rsquo;t check their one-time code just now. Reload to try again.
      </p>
    );
  }
  const y = nowMs === undefined ? null : new Date(nowMs + 8 * 3_600_000).toISOString().slice(0, 4);
  const line =
    code.state === 'linked'
      ? code.usedAt
        ? `They scanned it ${fmtDate(code.usedAt, y)} — booked with you on Setnayan`
        : 'They scanned it — booked with you on Setnayan'
      : code.state === 'sent'
        ? `Made ${fmtDate(code.madeAt, y)} · waiting for them to scan`
        : 'Not on Setnayan yet';
  return (
    <div className="mt-3 border-t border-ink/10 pt-3" data-outside-code-block="">
      <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
        <QrCode aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={1.75} />
        <InfoTip label="Their one-time code" labelClassName="text-[14px] font-medium text-ink" align="start">
          One code for this customer, and it works once. They scan it and their event joins Setnayan already booked with
          you — the date, the payments you agreed and your chat come with it. Once it is used, their Setnayan booking
          holds the day, so you can remove this outside entry.
        </InfoTip>
      </p>
      <p className="mt-0.5 text-[13px] text-ink/60" data-outside-code-line="">
        {line}
      </p>
      {code.state === 'none' ? (
        <div className="mt-2">
          <ActionButton tone="brand" main icon={<QrCode aria-hidden strokeWidth={1.9} />} label="Send their code" href={sendCodeHref(c)} />
        </div>
      ) : code.state === 'sent' ? (
        <div className="mt-2">
          <ActionButton tone="neutral" icon={<QrCode aria-hidden strokeWidth={1.9} />} label="Send again" href={sendAgainHref(code.token, c.blockId)} />
        </div>
      ) : null}
    </div>
  );
}

/** One chat that is not on the list — archived by you, or closed (turned down, they booked someone else, withdrawn). */
export type OtherChat = {
  threadId: string;
  /** The event's chat name — "Indalecio's Wedding (Dec 18)". */
  title: string;
  /** Why it is here — "Archived" · "You turned it down" · "They booked someone else" · "They withdrew" · "An older chat". */
  why: string;
  /** Archived by the shop — it can come back to the list. */
  archived: boolean;
};

/**
 * ARCHIVED AND CLOSED CHATS — what the retired Messages fold held that the event list does not (owner 2026-10-28:
 * the event list IS the messages, so the separate Messages fold is gone; no chat may become unreachable).
 *
 *   · every chat that is NOT a row above: the ones the shop archived, and the closed ones — turned down, booked
 *     someone else, withdrawn, an older chat on the same event. Each opens its chat, full screen.
 *   · an archived one comes back to the list with the shipped `ThreadArchiveToggle` (archive itself is in each chat's
 *     ⋮ menu); a new message brings it back on its own.
 *   · "Why you won and lost" — the shop's own logged outcomes (`InquiryOutcomesRollup`), handed in; drawn only when
 *     any are logged.
 *
 * Drawn only from a read that happened: the page hides it after a refused threads read rather than say "none".
 */
export function OtherChatsFold({
  paged,
  keepParams,
  returnTo,
  rollup = null,
  incomplete = false,
}: {
  paged: Paged<OtherChat>;
  /** Every param but `opage`. */
  keepParams: string;
  /** Where the archive toggle comes back to. */
  returnTo: string;
  rollup?: ReactNode;
  incomplete?: boolean;
}) {
  const archived = paged.items.filter((c) => c.archived).length;
  if (paged.total === 0 && !rollup) return null;
  return (
    <div id="chats" className="mt-4 scroll-mt-24 border-t border-ink/10" data-other-chats="">
      <Fold
        title="Archived and closed chats"
        line={`${formatCount(paged.total)} chat${paged.total === 1 ? '' : 's'} not on your list`}
        data="other-chats"
        anchor="chats"
      >
        <div className="pb-3">
          {rollup}
          <ul data-other-chats-list="">
            {paged.items.map((c) => (
              <li key={c.threadId} className="flex items-center gap-1 border-t border-ink/10 first:border-t-0" data-other-chat={c.archived ? 'archived' : 'closed'}>
                <Link
                  href={`/vendor-dashboard/messages/${c.threadId}`}
                  className="sn-press grid min-h-[56px] min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-ink">{c.title}</span>
                    <span className="block truncate text-[13px] text-ink/60">{c.why}</span>
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
                </Link>
                {c.archived ? <ThreadArchiveToggle threadId={c.threadId} returnTo={returnTo} archived /> : null}
              </li>
            ))}
          </ul>
          {archived > 0 ? (
            <p className="pt-2 text-[12.5px] text-ink/60">A new message brings an archived chat back to your list on its own.</p>
          ) : null}
          <ListPager paged={paged} param="opage" keepParams={keepParams} hash="chats" noun="chats" incomplete={incomplete} />
        </div>
      </Fold>
    </div>
  );
}
