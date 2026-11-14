'use client';

/**
 * 👁 VIEW AS ▾ ON THE SCHEDULE — Step 3c (owner 2026-11-01; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §3, §3b, §4, §12 Step 3;
 * the approved prototype `prototypes/schedule_chapters_2026-11-01/` — `asPick`, `personBody`, `supBody`, `supTimeBody`).
 *
 * The shipped View as dropdown on the Event Day rail (`day-rail.tsx`), extended — never a second control: on the
 * Schedule page (where chapters are drawn) it lists Everyone · A guest · Suppliers by time · By role · Suppliers (and
 * their crews), searchable because people are unlimited. Picking one lays that person's day over the rail; "back to
 * Everyone" returns to it. Everyone is the default and is the rail itself.
 *
 * 🔒 A VIEW, NEVER A WRITE: nothing here calls an action. What each view shows is decided by the pure half
 * (`lib/schedule-view-as.ts`); this file only draws it.
 * 💎 PRO (plan §3b), EXCEPT SUPPLIERS BY TIME (owner 2026-11-02, DECISION_LOG "TEN OWNER YESES" item 3: *"Suppliers by
 * time is FREE"*). On a Free event the dropdown still opens: Everyone · Suppliers by time work, and one last row —
 * "A guest, a role or a supplier", wearing the ◆ PRO mark (`PaidMark`, the one mark a paid control wears) — opens the
 * upgrade. Inside a store shell that sells no Pro that row is absent (the shell rule); the free views stay. Which views
 * a Free event may draw is ONE question, `lensAllowed` (`lib/schedule-view-as.ts`).
 * ⏰ Suppliers by time lists a Time-TBA chapter's suppliers "Time TBA" after the timed stretches — never hidden.
 * 🔒 app/dashboard/[eventId]/schedule/view-as-shows-only-whats-theirs.test.ts
 */
import { useMemo, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkState } from '@/lib/paid-mark';
import { TIME_TBA, chapterWhen, chapterWhere, type Chapter } from '@/lib/schedule-chapters';
import {
  VIEW_AS_PRO_DOOR,
  guestDay,
  lensAllowed,
  lensFromKey,
  lensKey,
  lensWords,
  roleDay,
  supplierDay,
  viewAsMenuOptions,
  type ViewAsInput,
  type ViewDay,
  type ViewLens,
} from '@/lib/schedule-view-as';
import { PickMenu } from './day-ui';
import { SideBySideView } from './side-by-side';
import { SharePdfButton } from '@/app/_components/share-pdf-button';
import { coordDay, personDay, printDayFromCard, printDayFromView, type PrintDay } from '@/lib/schedule-view-as-people';
import type { YourSchedule } from '@/lib/guest-your-schedule';

/** More options than this and the list searches (unlimited guests and suppliers — plan §3 "Unlimited people"). */
const SEARCH_FROM = 8;

export function ViewAsMenu({
  input,
  lens,
  onLens,
  compact = false,
  round = false,
}: {
  input: ViewAsInput;
  lens: ViewLens;
  onLens: (l: ViewLens) => void;
  /** The Booked frame's one line: a chip-sized button that says the current view. */
  compact?: boolean;
  /** 👤 The round button of the 4 Nov prototype (frames 1–2); the current view shows as a ring when it is not Everyone. */
  round?: boolean;
}) {
  const [query, setQuery] = useState('');
  // 💎 The ◆ PRO mark on the Free menu's door row — absent where no Pro is sold here (a store shell), never a lock.
  const mark = input.pro ? null : paidMarkState({ owns: false, storeShell: input.proHref === null, tryable: true });
  const proHref = mark ? input.proHref : null;
  const options = useMemo(
    () =>
      viewAsMenuOptions(input.data, input.pro, proHref !== null).map((o) =>
        o.key === VIEW_AS_PRO_DOOR && mark ? { ...o, hint: 'Part of Pro · opens the upgrade', icon: <PaidMark state={mark} label="Part of Pro" size="xs" /> } : o,
      ),
    [input.data, input.pro, proHref, mark],
  );
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.key === lensKey(lens) || o.key === VIEW_AS_PRO_DOOR || o.label.toLowerCase().includes(q)) : options;
  /* 📋 Slice 8 ("Changed 1 — View as shows its state"): the round 👤 stays a bare icon while the day is Everyone's, and
     becomes a tinted chip "👤 DJ Migs ✕" once a view is on — the ✕ goes back to Everyone. */
  const chip = round && lens.kind !== 'everyone';
  const menu = (
    <PickMenu
      label="View as"
      value={lensKey(lens)}
      compact={compact}
      buttonText={compact || round ? lensWords(input.data, lens) : undefined}
      trigger={
        chip ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound aria-hidden className="h-4 w-4 flex-none" strokeWidth={1.9} />
            <span className="max-w-[4.75rem] truncate text-[14px] font-semibold">{lensWords(input.data, lens)}</span>
          </span>
        ) : round ? (
          <UserRound aria-hidden className="h-5 w-5" strokeWidth={1.8} />
        ) : undefined
      }
      className={
        chip
          ? 'sn-press flex h-11 min-w-0 items-center rounded-full bg-terracotta/15 pl-3 pr-2 text-ink'
          : round
            ? 'sn-press grid h-11 w-9 flex-none place-items-center rounded-full text-ink'
            : ''
      }
      dataAttr="data-schedule-lens"
      options={shown}
      head={
        options.length > SEARCH_FROM ? (
          <li role="none" className="sticky top-0 z-[2] -mx-1.5 -mt-1.5 mb-1 bg-cream/95 p-1.5 dark:bg-raised">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/70" strokeWidth={2} />
              <input
                className="min-h-11 w-full rounded-xl border border-ink/15 bg-cream pl-9 pr-3 text-[14px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none dark:bg-raised"
                type="search"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a person"
                aria-label="Find a guest, a role or a supplier"
                data-view-as-search=""
              />
            </div>
            {q && shown.length <= 1 ? <p className="px-3 pt-2 text-xs text-ink/70">Nobody on the schedule matches “{query.trim()}”.</p> : null}
          </li>
        ) : undefined
      }
      onPick={(key) => {
        setQuery('');
        if (key === VIEW_AS_PRO_DOOR) {
          if (proHref) window.location.assign(proHref);
          return;
        }
        const next = lensFromKey(key);
        onLens(lensAllowed(input.pro, next) ? next : { kind: 'everyone' });
      }}
    />
  );
  if (!chip) return menu;
  return (
    <span className="flex flex-none items-center rounded-full bg-terracotta/15" data-view-as-chip="">
      {menu}
      <button
        type="button"
        onClick={() => onLens({ kind: 'everyone' })}
        aria-label={`Stop seeing the day as ${lensWords(input.data, lens)}`}
        data-view-as-clear=""
        className="sn-press -ml-1 grid h-11 w-7 flex-none place-items-center rounded-full text-ink/70"
      >
        <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </span>
  );
}

/** The day as the picked person sees it — drawn in place of the rail. Never for Everyone (that IS the rail). */
export function ViewAsBody({
  eventId,
  input,
  chapters,
  lens,
  onLens,
  pill = true,
  nowIso = null,
}: {
  /** 🧭 The venue's wall clock on the day — Side by side draws "Now" across every column (slice 9). */
  nowIso?: string | null;
  /** For the person's PDF (slice 6); absent (the lab) = no file button. */
  eventId?: string;
  /** The "…’s view · back to Everyone" pill — off where the page's own line under the date already says it (slice 8). */
  pill?: boolean;
  input: ViewAsInput;
  chapters: readonly Chapter[];
  lens: ViewLens;
  onLens: (l: ViewLens) => void;
}) {
  const words = lensWords(input.data, lens);
  // 👤 The person's day, worked out once: what the screen draws and what the PDF prints are the same thing.
  const drawn = useMemo(() => (lens.kind === 'suptime' || lens.kind === 'everyone' ? null : dayFor(lens, input, chapters)), [lens, input, chapters]);
  // A Free event never draws a per-person view, whatever asked for it (the menu offers none; this is the fence).
  if (!lensAllowed(input.pro, lens)) return null;
  const print = drawn ? printOf(words, drawn) : null;
  return (
    <div data-view-as={lens.kind} className="space-y-3 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={pill ? 'inline-flex items-center gap-2 rounded-full bg-terracotta/15 px-3 py-1.5 text-xs text-ink/75' : 'sr-only'}>
          {lens.kind === 'suptime' ? words : `${words}’s view`} ·
          <button type="button" onClick={() => onLens({ kind: 'everyone' })} className="font-bold text-ink underline" data-view-as-back="">
            back to Everyone
          </button>
        </p>
        {/* 📄 Their day as a file (slice 6, owner 4 Nov "Any View as person, Pro") — exactly what is drawn below. */}
        {print && eventId ? (
          <span data-view-as-pdf="">
            <SharePdfButton
              href={`/api/schedule/${eventId}/export`}
              fileName={`${fileSlug(words)}-schedule.pdf`}
              name={`Share ${words}’s schedule (PDF)`}
              papers="document"
              body={JSON.stringify(print)}
            />
          </span>
        ) : null}
      </div>
      {lens.kind === 'suptime' ? (
        <SideBySideView input={input} chapters={chapters} onLens={onLens} nowIso={nowIso} />
      ) : drawn?.kind === 'card' ? (
        <PersonCard card={drawn.card} />
      ) : drawn?.kind === 'unread' ? (
        <p role="alert" data-view-as-unread="person" className="text-[13px] font-semibold text-danger-700">
          {drawn.words}
        </p>
      ) : drawn?.kind === 'day' ? (
        <Day lens={lens} day={drawn.day} />
      ) : null}
    </div>
  );
}

type Drawn =
  | { kind: 'day'; day: ViewDay }
  | { kind: 'card'; card: YourSchedule }
  | { kind: 'unread'; words: string };

/** Which day this lens draws — one function for the screen and the file. */
function dayFor(lens: Exclude<ViewLens, { kind: 'suptime' } | { kind: 'everyone' }>, input: ViewAsInput, chapters: readonly Chapter[]): Drawn {
  switch (lens.kind) {
    case 'guest':
      return { kind: 'day', day: guestDay(chapters, input.data) };
    case 'role':
      return { kind: 'day', day: roleDay(chapters, input.data, lens.key) };
    case 'supplier':
      return { kind: 'day', day: supplierDay(chapters, input.data, lens.vendorId, lens.crew) };
    case 'coord':
      return { kind: 'day', day: coordDay(chapters, input.data, lens.vendorId) };
    case 'person': {
      // 👤 Exactly their Event Hub card today (owner 4 Nov, "What they see now") — or why it cannot be drawn.
      if (input.data.people === null) return { kind: 'unread', words: 'The guest list couldn’t be read just now, so their schedule can’t be shown. Try again in a moment.' };
      if (input.data.tasks === null) return { kind: 'unread', words: 'The tasks couldn’t be read just now, so their schedule may be missing lines. Try again in a moment.' };
      const card = personDay(chapters, input.data, lens.guestId);
      return card ? { kind: 'card', card } : { kind: 'unread', words: 'This guest is no longer on the guest list.' };
    }
  }
}

function printOf(person: string, d: Drawn): PrintDay | null {
  if (d.kind === 'day') return d.day.tasksUnread ? null : printDayFromView(person, d.day);
  if (d.kind === 'card') return d.card.kind === 'ok' ? printDayFromCard(person, d.card) : null;
  return null;
}

function fileSlug(words: string): string {
  return words.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'person';
}

/** 👤 A named guest's card, as their Event Hub › Me draws it: their call, their chapters, their lines (theirs marked). */
function PersonCard({ card }: { card: YourSchedule }) {
  if (card.kind === 'none') return <p className="py-3 text-[14px] text-ink/70">No chapter is on their invitation yet, so they see no schedule.</p>;
  return (
    <div data-view-as-card={card.stage}>
      <p className="text-[13px] text-ink/70">
        {card.stage === 'after' ? 'Their full schedule — released.' : 'Before Release they see their chapters and their call, not the lines.'}
      </p>
      {card.call ? (
        <div data-view-as-call="" className="pt-2">
          <p className="text-xs uppercase tracking-[0.06em] text-ink/70">{card.call.label}</p>
          <p className="text-[28px] font-bold leading-tight tabular-nums text-ink">{card.call.time}</p>
          {card.call.note ? <p className="text-[13px] text-ink/70">{card.call.note}</p> : null}
        </div>
      ) : null}
      {card.chapters.map((c) => (
        <section key={c.id} data-view-as-chapter={c.id} className="pt-3">
          <h3 className="text-[17px] font-semibold leading-tight text-ink">{c.name}</h3>
          <p className="text-[13px] text-ink/70">{c.line}</p>
          {c.lines.length > 0 ? (
            <ul className="mt-1 border-t border-ink/10">
              {c.lines.map((l) => (
                <li key={l.id} data-view-as-row={l.id} className="flex min-h-14 items-start gap-4 border-b border-ink/10 py-3">
                  <span className="w-[4.5rem] flex-none text-[14px] tabular-nums text-ink/80">{l.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-ink">
                      {l.title}
                      {l.mine ? <span className="ml-1.5 text-xs font-semibold text-terracotta-700">theirs</span> : null}
                    </span>
                    {l.sub ? <span className="block text-[13px] text-ink/70">{l.sub}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      {card.footnote ? <p className="pt-3 text-[13px] text-ink/70">{card.footnote}</p> : null}
    </div>
  );
}

function Day({ lens, day }: { lens: ViewLens; day: ViewDay }) {
  const empty =
    lens.kind === 'guest'
      ? 'No chapter is on the invitation yet, so guests see no schedule.'
      : lens.kind === 'supplier'
        ? 'Nothing on the schedule names them yet.'
        : lens.kind === 'coord'
          ? 'There are no chapters yet.'
          : 'Nothing on the schedule names this role yet.';
  return (
    <>
      {day.tasksUnread ? (
        <p role="alert" data-view-as-unread="" className="text-[13px] font-semibold text-warn-800">
          The tasks couldn’t be read just now, so this may be missing lines. Try again in a moment.
        </p>
      ) : null}
      {day.call ? (
        <div data-view-as-call="" className="pt-1">
          <p className="text-xs uppercase tracking-[0.06em] text-ink/70">Call time</p>
          <p className="text-[28px] font-bold leading-tight tabular-nums text-ink">{day.call.time}</p>
          <p className="text-[13px] text-ink/70">{day.call.where}</p>
        </div>
      ) : null}
      {day.chapters.length === 0 && !day.tasksUnread ? <p className="py-3 text-[14px] text-ink/70">{empty}</p> : null}
      {day.chapters.map(({ chapter: c, rows }) => (
        <section key={c.block_id} data-view-as-chapter={c.block_id} className="pt-3">
          <h3 className="text-[17px] font-semibold leading-tight text-ink">{c.label}</h3>
          <p className="text-[13px] text-ink/70" data-view-as-when={c.time_tba ? 'tba' : 'set'}>
            {c.time_tba ? TIME_TBA : chapterWhen(c)} · {chapterWhere(c)}
          </p>
          {rows.length === 0 ? (
            <p className="py-2 text-[14px] text-ink/70">{lens.kind === 'coord' ? 'No moments in it yet.' : 'Nothing shown to guests in it yet.'}</p>
          ) : (
            <ul className="mt-1 border-t border-ink/10">
              {rows.map((r) => (
                <li key={r.id} data-view-as-row={r.id} className="flex min-h-14 items-start gap-4 border-b border-ink/10 py-3">
                  <span className="w-[4.5rem] flex-none text-[14px] tabular-nums text-ink/80">{r.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-ink">
                      {r.title}
                      {r.mine ? <span data-view-as-mine="" className="ml-1.5 text-xs font-semibold text-terracotta-700">theirs</span> : null}
                    </span>
                    {r.sub ? <span className="block text-[13px] text-ink/70">{r.sub}</span> : null}
                    {r.clash ? <span className="block text-[13px] font-semibold text-danger-700">In two places at once</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
