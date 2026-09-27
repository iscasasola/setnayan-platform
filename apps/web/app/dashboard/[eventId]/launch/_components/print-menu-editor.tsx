'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, X, type LucideIcon } from 'lucide-react';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';
import {
  MENU_DISH_MAX,
  MENU_MAX_DISHES,
  MENU_MAX_MOMENTS,
  MENU_TITLE_MAX,
  type MenuMoment,
} from '@/lib/print-pieces';

/**
 * THE MENU EDITOR — owner 2026-09-28: *"add to print out our meals for
 * tonight. from vendors from ceremony, to cocktail to the buffet."*
 *
 * The moments of the night, in the order they happen, each with its dishes.
 * A moment's name starts from the couple's own SCHEDULE (its cocktail hour,
 * its reception & dinner — `foodMoments`), so the night is never typed twice;
 * a booked caterer's package lines start the list when the couple has typed
 * none (`readCatererMenu`). Saved to `events.print_details.menu` by the
 * `/api/hub-print/menu` form post — the same door-and-redirect the Details
 * words use, so nothing here writes on its own.
 *
 * Phone-first: every control is a 44 px target, the rows reorder with ↑ ↓
 * (no drag on a phone that is also scrolling), and nothing needs a keyboard
 * shortcut.
 */
export function PrintMenuEditor({
  eventId,
  initial,
  fromCaterer,
  suggestions,
  flash,
}: {
  eventId: string;
  /** What the editor opens with: the couple's saved menu, or their caterer's lines. */
  initial: MenuMoment[];
  /** True when `initial` is the caterer's package, not yet saved as the couple's own. */
  fromCaterer: boolean;
  /** The schedule's food moments, offered as moment names. */
  suggestions: string[];
  flash: 'saved' | 'error' | null;
}) {
  // A print-only setting (events.print_details) — no guest page reads it, so it
  // saves straight away rather than into the Event Hub draft.
  const PRINT_MENU_ENDPOINT = '/api/hub-print/menu';
  const [moments, setMoments] = useState<MenuMoment[]>(initial.length ? initial : []);
  const [started, setStarted] = useState(initial.length > 0);
  /** The one row whose move / remove buttons are showing (`m<i>` or `d<i>-<j>`). */
  const [open, setOpen] = useState<string | null>(null);

  const used = new Set(moments.map((m) => m.title.trim().toLowerCase()));
  const offers = suggestions.filter((s) => !used.has(s.toLowerCase()));
  const full = moments.length >= MENU_MAX_MOMENTS;

  const move = <T,>(list: T[], i: number, d: -1 | 1): T[] => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  };
  const setMoment = (i: number, m: MenuMoment) => setMoments((all) => all.map((x, k) => (k === i ? m : x)));
  const addMoment = (title: string) => {
    if (full) return;
    setStarted(true);
    setMoments((all) => [...all, { title, dishes: [''] }]);
  };

  // What is posted: blank dishes dropped (the server's parser drops them too).
  const payload = JSON.stringify(moments.map((m) => ({ title: m.title.trim(), dishes: m.dishes.map((d) => d.trim()).filter(Boolean) })));

  return (
    <section id="print-menu" data-print-menu-editor="" aria-labelledby="print-menu-title" className="sn-glass-bare flex scroll-mt-4 flex-col gap-3 rounded-xl p-3 sm:p-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="print-menu-title" className="font-serif text-xl text-ink">
          Your menu for the night
        </h2>
        <p className="text-sm text-ink/65">
          The moments of your night, in the order they happen, and the dishes of each. It prints as The Menu, in your
          theme.
        </p>
      </div>

      {flash === 'saved' ? (
        <p role="status" className="rounded-md border border-success-300/60 bg-success-50 px-3 py-2 text-sm text-success-800">
          Saved — your Menu card now shows these dishes.
        </p>
      ) : flash === 'error' ? (
        <p role="alert" className="rounded-md border border-danger-300/60 bg-danger-50 px-3 py-2 text-sm text-danger-800">
          That did not save. Nothing changed — please try again.
        </p>
      ) : null}

      {fromCaterer && started ? (
        <p data-print-menu-from-caterer="" className="text-sm text-ink/70">
          These are your caterer&rsquo;s package lines. Sort them into the moments of your night, then save — your
          version is what prints.
        </p>
      ) : null}

      {!started ? (
        <div data-print-menu-empty="" className="flex flex-col items-start gap-2">
          <p className="text-sm text-ink/70">Your menu card is empty, so it is not offered as a download yet.</p>
          <button type="button" onClick={() => addMoment(offers[0] ?? '')} className="button-primary inline-flex min-h-11 items-center gap-1.5">
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Add your menu
          </button>
        </div>
      ) : (
        <form action={PRINT_MENU_ENDPOINT} method="post" className="flex flex-col gap-3">
          <HubSavesImmediately />
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="menu_json" value={payload} />
          <ol className="flex flex-col gap-3">
            {moments.map((m, i) => (
              <li key={i} data-print-menu-moment={i} className="flex flex-col gap-2 rounded-xl bg-white/60 p-2 ring-1 ring-ink/10">
                <Row
                  open={open === `m${i}`}
                  onToggle={() => setOpen(open === `m${i}` ? null : `m${i}`)}
                  what={m.title || `moment ${i + 1}`}
                  input={
                    <input className="min-h-11 w-full min-w-0 rounded-lg border border-ink/15 bg-white px-3 text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-ink/40"
                      value={m.title}
                      maxLength={MENU_TITLE_MAX}
                      aria-label={`Moment ${i + 1}`}
                      onChange={(e) => setMoment(i, { ...m, title: e.target.value })}
                      placeholder="Moment — e.g. Cocktail hour"
                    />
                  }
                  actions={[
                    { label: 'Earlier', Icon: ArrowUp, disabled: i === 0, run: () => setMoments((all) => move(all, i, -1)) },
                    { label: 'Later', Icon: ArrowDown, disabled: i === moments.length - 1, run: () => setMoments((all) => move(all, i, 1)) },
                    { label: 'Remove moment', Icon: X, run: () => setMoments((all) => all.filter((_, k) => k !== i)) },
                  ]}
                />
                <ul className="flex flex-col gap-1.5">
                  {m.dishes.map((d, j) => (
                    <li key={j}>
                      <Row
                        open={open === `d${i}-${j}`}
                        onToggle={() => setOpen(open === `d${i}-${j}` ? null : `d${i}-${j}`)}
                        what={d || `dish ${j + 1}`}
                        input={
                          <input className="min-h-11 w-full min-w-0 rounded-lg border border-ink/10 bg-white px-3 text-[15px] text-ink placeholder:text-ink/40"
                            value={d}
                            maxLength={MENU_DISH_MAX}
                            aria-label={`Dish ${j + 1} of ${m.title || `moment ${i + 1}`}`}
                            onChange={(e) => setMoment(i, { ...m, dishes: m.dishes.map((x, k) => (k === j ? e.target.value : x)) })}
                            placeholder="A dish — e.g. Lechon with liver sauce"
                          />
                        }
                        actions={[
                          { label: 'Up', Icon: ArrowUp, disabled: j === 0, run: () => setMoment(i, { ...m, dishes: move(m.dishes, j, -1) }) },
                          { label: 'Down', Icon: ArrowDown, disabled: j === m.dishes.length - 1, run: () => setMoment(i, { ...m, dishes: move(m.dishes, j, 1) }) },
                          { label: 'Remove', Icon: X, run: () => setMoment(i, { ...m, dishes: m.dishes.filter((_, k) => k !== j) }) },
                        ]}
                      />
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={m.dishes.length >= MENU_MAX_DISHES}
                  onClick={() => setMoment(i, { ...m, dishes: [...m.dishes, ''] })}
                  className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-3 text-sm font-medium text-link hover:bg-ink/5 disabled:opacity-40"
                >
                  <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                  Add a dish
                </button>
              </li>
            ))}
          </ol>

          {!full ? (
            <div className="flex flex-col gap-1.5" data-print-menu-add="">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/50">Add a moment</p>
              <div className="flex flex-wrap gap-1.5">
                {offers.map((s) => (
                  <button key={s} type="button" onClick={() => addMoment(s)} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-ink/5 px-3 text-[14px] font-medium text-ink/80 hover:bg-ink/10">
                    <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    {s}
                  </button>
                ))}
                <button type="button" onClick={() => addMoment('')} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-ink/5 px-3 text-[14px] font-medium text-ink/80 hover:bg-ink/10">
                  <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  A moment of your own
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="button-primary inline-flex min-h-11 items-center">
              Save menu
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/**
 * One editable line: the field takes the whole width (a dish name is long and
 * a phone is narrow), and ONE "⋯" button reveals that line's own labelled
 * moves beneath it — every target 44 px, only one row's open at a time.
 */
function Row({
  input,
  what,
  open,
  onToggle,
  actions,
}: {
  input: ReactNode;
  what: string;
  open: boolean;
  onToggle: () => void;
  actions: Array<{ label: string; Icon: LucideIcon; disabled?: boolean; run: () => void }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">{input}</div>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Move or remove ${what}`}
          onClick={onToggle}
          className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full transition-colors ${open ? 'bg-ink text-cream' : 'text-ink/60 hover:bg-ink/5 hover:text-ink'}`}
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" />
        </button>
      </div>
      {open ? (
        <div className="flex flex-wrap gap-1.5 pl-1" data-print-menu-row-actions="">
          {actions.map(({ label, Icon, disabled, run }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={run}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-ink/5 px-3 text-[14px] font-medium text-ink/80 hover:bg-ink/10 disabled:opacity-35"
            >
              <Icon aria-hidden className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
