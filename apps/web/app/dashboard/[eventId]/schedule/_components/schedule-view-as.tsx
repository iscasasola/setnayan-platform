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
import { Search } from 'lucide-react';
import { PaidMark } from '@/app/_components/paid-mark';
import { formatCount } from '@/lib/format-number';
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
  suppliersByTime,
  viewAsMenuOptions,
  type TimeItem,
  type ViewAsInput,
  type ViewDay,
  type ViewLens,
} from '@/lib/schedule-view-as';
import { PickMenu } from './day-ui';

/** More options than this and the list searches (unlimited guests and suppliers — plan §3 "Unlimited people"). */
const SEARCH_FROM = 8;

export function ViewAsMenu({
  input,
  lens,
  onLens,
  compact = false,
}: {
  input: ViewAsInput;
  lens: ViewLens;
  onLens: (l: ViewLens) => void;
  /** The Booked frame's one line: a chip-sized button that says the current view. */
  compact?: boolean;
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
  return (
    <PickMenu
      label="View as"
      value={lensKey(lens)}
      compact={compact}
      buttonText={compact ? lensWords(input.data, lens) : undefined}
      dataAttr="data-schedule-lens"
      options={shown}
      head={
        options.length > SEARCH_FROM ? (
          <li role="none" className="sticky top-0 z-[2] -mx-1.5 -mt-1.5 mb-1 bg-cream/95 p-1.5 dark:bg-raised">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" strokeWidth={2} />
              <input
                className="min-h-11 w-full rounded-xl border border-ink/15 bg-cream pl-9 pr-3 text-[14px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none dark:bg-raised"
                type="search"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a role or supplier"
                aria-label="Find a role or supplier"
                data-view-as-search=""
              />
            </div>
            {q && shown.length <= 1 ? <p className="px-3 pt-2 text-[12px] text-ink/55">Nobody on the schedule matches “{query.trim()}”.</p> : null}
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
}

/** The day as the picked person sees it — drawn in place of the rail. Never for Everyone (that IS the rail). */
export function ViewAsBody({
  input,
  chapters,
  lens,
  onLens,
}: {
  input: ViewAsInput;
  chapters: readonly Chapter[];
  lens: ViewLens;
  onLens: (l: ViewLens) => void;
}) {
  const words = lensWords(input.data, lens);
  // A Free event never draws a per-person view, whatever asked for it (the menu offers none; this is the fence).
  if (!lensAllowed(input.pro, lens)) return null;
  return (
    <div data-view-as={lens.kind} className="space-y-3 pb-28">
      <p className="inline-flex items-center gap-2 rounded-full bg-terracotta/15 px-3 py-1.5 text-xs text-ink/75">
        {lens.kind === 'suptime' ? words : `${words}’s view`} ·
        <button type="button" onClick={() => onLens({ kind: 'everyone' })} className="font-bold text-ink underline" data-view-as-back="">
          back to Everyone
        </button>
      </p>
      {lens.kind === 'suptime' ? <ByTime input={input} chapters={chapters} onLens={onLens} /> : <Day lens={lens} input={input} chapters={chapters} />}
    </div>
  );
}

function Day({ lens, input, chapters }: { lens: Exclude<ViewLens, { kind: 'suptime' }>; input: ViewAsInput; chapters: readonly Chapter[] }) {
  const day: ViewDay =
    lens.kind === 'guest'
      ? guestDay(chapters, input.data)
      : lens.kind === 'role'
        ? roleDay(chapters, input.data, lens.key)
        : lens.kind === 'supplier'
          ? supplierDay(chapters, input.data, lens.vendorId, lens.crew)
          : { chapters: [], call: null, tasksUnread: false };
  const empty =
    lens.kind === 'guest'
      ? 'No chapter is on the invitation yet, so guests see no schedule.'
      : lens.kind === 'supplier'
        ? 'Nothing on the schedule names them yet.'
        : 'Nothing on the schedule names this role yet.';
  return (
    <>
      {day.tasksUnread ? (
        <p role="alert" data-view-as-unread="" className="text-[13px] font-semibold text-danger-700">
          The tasks couldn’t be read just now, so this may be missing lines. Try again in a moment.
        </p>
      ) : null}
      {day.call ? (
        <div data-view-as-call="" className="pt-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Call time</p>
          <p className="font-display text-[28px] leading-tight text-ink">{day.call.time}</p>
          <p className="text-[13px] text-ink/60">{day.call.where}</p>
        </div>
      ) : null}
      {day.chapters.length === 0 && !day.tasksUnread ? <p className="py-3 text-[14px] text-ink/55">{empty}</p> : null}
      {day.chapters.map(({ chapter: c, rows }) => (
        <section key={c.block_id} data-view-as-chapter={c.block_id} className="pt-3">
          <h3 className="font-display text-[18px] leading-tight text-ink">{c.label}</h3>
          <p className="text-[13px] text-ink/60" data-view-as-when={c.time_tba ? 'tba' : 'set'}>
            {c.time_tba ? TIME_TBA : chapterWhen(c)} · {chapterWhere(c)}
          </p>
          {rows.length === 0 ? (
            <p className="py-2 text-[14px] text-ink/55">Nothing shown to guests in it yet.</p>
          ) : (
            <ul className="mt-1 border-t border-ink/10">
              {rows.map((r) => (
                <li key={r.id} data-view-as-row={r.id} className="flex min-h-14 items-start gap-4 border-b border-ink/10 py-3">
                  <span className="w-[4.5rem] flex-none font-mono text-[14px] text-ink/80">{r.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-ink">{r.title}</span>
                    {r.sub ? <span className="block text-[13px] text-ink/60">{r.sub}</span> : null}
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

function ByTime({ input, chapters, onLens }: { input: ViewAsInput; chapters: readonly Chapter[]; onLens: (l: ViewLens) => void }) {
  const { stretches, tba, tasksUnread } = suppliersByTime(chapters, input.data);
  // Tapping a supplier opens THEIR day — a per-person view, so Pro. On a Free event the lines are read, not pressed.
  const open = (vendorId: string) => (lensAllowed(input.pro, { kind: 'supplier', vendorId, crew: null }) ? () => onLens({ kind: 'supplier', vendorId, crew: null }) : null);
  return (
    <>
      {tasksUnread ? (
        <p role="alert" data-view-as-unread="" className="text-[13px] font-semibold text-danger-700">
          The tasks couldn’t be read just now, so this may be missing lines. Try again in a moment.
        </p>
      ) : null}
      {stretches.length === 0 && tba.length === 0 && !tasksUnread ? <p className="py-3 text-[14px] text-ink/55">No supplier has a line yet.</p> : null}
      {stretches.map((g) => (
        <section key={`${g.from}-${g.items[0]?.id}`} data-view-as-stretch="" className="pt-3">
          <p className="pb-1 text-[13px] text-ink/60">
            <b className="font-semibold text-ink">
              {g.from} to {g.to}
            </b>
            {g.suppliers > 1 ? <span data-view-as-at-once={g.suppliers}> · {formatCount(g.suppliers)} suppliers at once</span> : null}
          </p>
          <ul className="border-t border-ink/10">
            {g.items.map((i) => (
              <TimeLine key={i.id} i={i} onOpen={open(i.vendorId)} />
            ))}
          </ul>
        </section>
      ))}
      {tba.map((g) => (
        <section key={g.chapter.block_id} data-view-as-stretch="tba" data-view-as-chapter={g.chapter.block_id} className="pt-3">
          <p className="pb-1 text-[13px] text-ink/60">
            <b className="font-semibold text-ink">{g.chapter.label}</b> · {TIME_TBA} · {g.where}
            {g.suppliers > 1 ? <span data-view-as-at-once={g.suppliers}> · {formatCount(g.suppliers)} suppliers</span> : null}
          </p>
          <ul className="border-t border-ink/10">
            {g.items.map((i) => (
              <TimeLine key={i.id} i={i} onOpen={open(i.vendorId)} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** One supplier line. A button only where tapping opens their day (Pro); otherwise plain words — a frame only on what you press. */
function TimeLine({ i, onOpen }: { i: TimeItem; onOpen: (() => void) | null }) {
  const body = (
    <>
      <span className="w-[4.5rem] flex-none font-mono text-[14px] text-ink/80" data-view-as-time={i.time}>
        {i.time}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{i.who}</span>
        <span className="block text-[13px] text-ink/60">
          {i.title} · {i.sub}
          {i.until ? ` · until ${i.until}` : ''}
        </span>
        {i.clash ? <span className="block text-[13px] font-semibold text-danger-700">In two places at once</span> : null}
      </span>
    </>
  );
  return (
    <li data-view-as-line={i.id} className="border-b border-ink/10">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="sn-press flex min-h-14 w-full items-start gap-4 py-3 text-left">
          {body}
        </button>
      ) : (
        <div className="flex min-h-14 w-full items-start gap-4 py-3">{body}</div>
      )}
    </li>
  );
}
