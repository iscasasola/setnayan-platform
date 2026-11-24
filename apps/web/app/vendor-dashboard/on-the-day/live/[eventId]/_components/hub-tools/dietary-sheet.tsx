import type { ComponentType, SVGProps } from 'react';
import { setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';
import { ReadFailedNote } from '@/app/vendor-dashboard/_components/set-two/read-failed';
import { formatCount } from '@/lib/format-number';
import { initialsOf, mealWord, type DietaryRead } from '@/lib/hub-tool-entries';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;

/**
 * ② PER-PERSON SHEET, READ-ONLY — Dietary & allergies (DECISION_LOG 2026-11-23; drawing
 * `prototypes/hub_tools_working_2026-10-28/`: "Only guests who said yes to sharing it. No other health data, ever.").
 *
 * The rows are the coming guests' OWN RSVP answers — their meal pick and the dietary note they typed — read through
 * `vendor_event_dietary_list`, which answers only a supplier booked under a food category (DECISION_LOG 2026-10-28:
 * "shown to the booked caterer only, food needs only"). Nothing here is typed by the supplier and nothing is stored.
 * Three honest states: could not read · not yours to see (who it is for) · the list (or nobody wrote anything).
 */
export function DietarySheet({ read, icon: Ic, title }: { read: DietaryRead; icon: Icon; title: string }) {
  const head = (end?: string) => (
    <h3 className="flex items-center gap-2">
      <Ic aria-hidden className="h-5 w-5 text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">{title}</span>
      {end ? <span className="text-sn-md font-semibold tabular-nums text-[color:var(--m-slate-2)]">{end}</span> : null}
    </h3>
  );

  if (read.state === 'unread') {
    return (
      <div data-hub-tool="dietary_and_allergies" data-hub-tool-state="unread">
        {head()}
        <ReadFailedNote mark="dietary">We couldn&rsquo;t load the guests&rsquo; dietary answers right now.</ReadFailedNote>
      </div>
    );
  }
  if (read.state === 'not_food') {
    return (
      <div data-hub-tool="dietary_and_allergies" data-hub-tool-state="not_food">
        {head()}
        <p>
          Guests&rsquo; dietary answers are shared with the supplier booked for the food (catering, cake or the bar) only.
          You&rsquo;re not booked for food on this event.
        </p>
      </div>
    );
  }

  return (
    <div data-hub-tool="dietary_and_allergies" data-hub-tool-state="ok">
      {head(read.withNote > 0 ? `${formatCount(read.withNote)} with a note` : undefined)}
      <p>From the guests&rsquo; RSVPs — only what each one chose to write. Coming guests only.</p>
      {read.meals.length > 0 ? (
        <p className="!text-ink" data-hub-dietary-meals="">
          {read.meals.map((m) => `${formatCount(m.count)} ${mealWord(m.meal)}`).join(' · ')}
        </p>
      ) : null}
      {read.guests.length === 0 ? (
        <p data-hub-tool-empty="">No coming guest has written a dietary note or picked a meal yet.</p>
      ) : (
        <ul className="-mx-3">
          {read.guests.map((g) => (
            <li key={g.id} className={setTwo.row} data-hub-tool-row="">
              <span aria-hidden className={`${setTwo.rowIcon} text-sn-sm font-bold`}>
                {initialsOf(g.name)}
              </span>
              <span className={`${setTwo.rowBody} ${setTwo.wrap}`}>
                <b className={setTwo.rowTitle}>{g.name}</b>
                <span className={setTwo.rowSub}>
                  {[g.dietary, g.meal ? mealWord(g.meal) : null, g.table ? `Table ${g.table}` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
