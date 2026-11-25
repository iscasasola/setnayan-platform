import { Eye, Info, MapPin } from 'lucide-react';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { formatCount } from '@/lib/format-number';
import { doorPoint, planAspect } from '@/lib/seat-plan-engine';
import { mealsOf, supplierPlanOf, tableUnits, type Plan, type PlanObject } from '@/lib/supplier-seat-plan';
import { PlanPoster } from '@/app/_components/plan-poster';
import { ShopPill } from '@/app/vendor-dashboard/_components/kit';
import { PartList, PartNote, PartRow, PartSec, PartText, setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';
import { ReadFailedBody } from '@/app/vendor-dashboard/_components/set-two/read-failed';
import { TheirEventPart } from '@/app/vendor-dashboard/_components/set-two/their-event-line';

const ROUTE = '/vendor-dashboard/clients/[eventId]/seat-plan';
const COLUMN = 'mx-auto w-full tab:max-w-5xl';

export type { Plan } from '@/lib/supplier-seat-plan';

const MEAL_LABELS: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids',
  no_preference: 'No pref.',
};

/** ⏱ A schedule time is the venue wall clock — read its digits, never re-zone. */
function fmtWindowTime(iso: string | null): string | null {
  if (!iso) return null;
  return formatWallClock(iso) || null;
}

function PinMarker({ o }: { o: PlanObject }) {
  return (
    <div
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${o.is_mine ? 'z-10' : ''}`}
      style={{ left: `${o.x}%`, top: `${o.y}%` }}
      title={o.vendor_name ? `${o.label} · ${o.vendor_name}` : o.label}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-sn-2xs font-semibold shadow-sm ${
          o.is_mine
            ? 'border-transparent bg-sn-accent text-sn-on-accent shadow-[0_0_0_3px_var(--surface-soft)]'
            : 'border-[color:var(--m-line)] bg-[rgb(var(--sn-frame-bg))] text-[color:var(--m-slate-2)]'
        }`}
      >
        {o.is_mine ? 'YOU' : '•'}
      </span>
      <span className="mt-0.5 max-w-24 truncate rounded bg-[rgb(var(--sn-frame-bg))] px-1 text-sn-3xs font-semibold leading-tight text-ink">
        {o.label}
      </span>
    </div>
  );
}



/**
 * The seat plan, built to the approved locked-parts frame d ("Seats, view only", 21 Nov 2026) and the set-two parity
 * table: the shipped words in the top block with the eye pill "View only", "You can look, not move.", your pins in the
 * accent (pin only — no tinted tables, decided 4), every landmark, the cocktail window under the map, and the tables
 * as rows with their covers. Drawn from the page's read (the lab draws it from fixtures).
 */
export function SeatPlanBody({ eventId, eventName, plan }: { eventId: string; eventName: string | null; plan: Plan }) {
  const placed = plan.tables.filter((t) => t.x !== null && t.y !== null);
  const totalSeated = plan.tables.reduce((n, t) => n + t.seated, 0);
  // A7-16: the engine's plan — its room (sized, or the default room), its doors on their walls, its tables.
  const drawn = supplierPlanOf(plan);
  const seatedById = Object.fromEntries(placed.map((t) => [t.table_id, t.seated]));
  const doorAt = (id: string) => {
    const d = drawn.doors.find((x) => x.id === id);
    if (!d) return null;
    // The door sits ON its wall; its word pill is kept inside the frame so it is never clipped.
    const p = doorPoint(d);
    const inside = (v: number) => Math.min(92, Math.max(8, v));
    return { x: inside(p.x), y: inside(p.y) };
  };
  const entranceAt = doorAt('entrance');
  const serviceAt = doorAt('service');
  const units = tableUnits([...placed, ...plan.tables.filter((t) => t.x === null || t.y === null)]);
  const objects = plan.objects ?? [];
  const myPins = objects.filter((o) => o.is_mine);
  const cocktail = plan.cocktail;
  const cocktailWindow = cocktail?.window
    ? `${cocktail.window.label}${fmtWindowTime(cocktail.window.start_at) ? ` · ${fmtWindowTime(cocktail.window.start_at)}${fmtWindowTime(cocktail.window.end_at) ? `–${fmtWindowTime(cocktail.window.end_at)}` : ''}` : ''}`
    : null;
  const showMap = placed.length > 0 || cocktail !== null || objects.length > 0;

  return (
    <TheirEventPart
      column={COLUMN}
      mark="seat-plan"
      route={ROUTE}
      eventId={eventId}
      eventName={eventName}
      title="Seats"
      end={
        <ShopPill tone="action">
          <Eye aria-hidden className="h-3 w-3" />
          View only
        </ShopPill>
      }
      intro={
        <p>
          The couple&rsquo;s published floor plan — {plan.tables.length} tables, {formatCount(totalSeated)} guests
          seated. Counts only; guest names stay private.
        </p>
      }
    >
      {myPins.length > 0 ? (
        <PartNote tone="accent" icon={MapPin}>
          <strong>Your spot:</strong>{' '}
          {myPins
            .map((p) => `${p.label} — ${p.zone === 'cocktail' ? (cocktail?.label ?? 'cocktail area') : 'reception room'}`)
            .join(' · ')}
        </PartNote>
      ) : null}

      {/* Floor map — one blueprint: reception room + the cocktail/waiting area */}
      {showMap ? (
        <div
          className="relative mx-3 mt-2 overflow-hidden rounded-[var(--m-r-md)] bg-[rgb(var(--sn-frame-bg))] shadow-[var(--sn-frame-shadow-tile)] tab:mx-0"
          style={{ aspectRatio: `${planAspect(drawn.room)}` }}
          data-seat-plan-map=""
        >
          {/* A7-16: the walls, doors and tables are the engine's own drawing — the hosts' picture, chairs filled as seated. */}
          <PlanPoster plan={drawn} roomName="Reception room" seated={seatedById} className="absolute inset-0 h-full w-full text-ink/70" />
          <div
            className="absolute flex items-center justify-center rounded-[var(--m-r-sm)] bg-[color:var(--surface-soft)] text-sn-3xs font-bold uppercase tracking-wider text-[rgb(var(--color-link))]"
            style={{ left: `${plan.stage.x - plan.stage.w / 2}%`, top: `${plan.stage.y - plan.stage.h / 2}%`, width: `${plan.stage.w}%`, height: `${plan.stage.h}%` }}
          >
            Stage
          </div>
          {plan.dance ? (
            <div
              className="absolute flex items-center justify-center rounded-[var(--m-r-sm)] border border-dashed border-[color:var(--m-line)] text-sn-3xs font-bold uppercase tracking-wider text-[color:var(--m-slate-2)]"
              style={{ left: `${plan.dance.x - plan.dance.w / 2}%`, top: `${plan.dance.y - plan.dance.h / 2}%`, width: `${plan.dance.w}%`, height: `${plan.dance.h}%` }}
            >
              Dance floor
            </div>
          ) : null}
          {entranceAt ? (
            <span
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-sn-3xs font-bold ${setTwo.mapPill}`}
              style={{ left: `${entranceAt.x}%`, top: `${entranceAt.y}%` }}
            >
              Entrance
            </span>
          ) : null}
          {serviceAt ? (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--color-ok))] px-1.5 py-0.5 text-sn-3xs font-bold text-[rgb(var(--sn-frame-bg))]"
              style={{ left: `${serviceAt.x}%`, top: `${serviceAt.y}%` }}
            >
              Service
            </span>
          ) : null}
          {cocktail ? (
            <div
              className="absolute flex items-start justify-start rounded-[var(--m-r-md)] border-2 border-dashed border-sn-accent/60 bg-[color:var(--surface-soft)] p-1.5 text-sn-3xs font-bold uppercase tracking-wider text-sn-accent"
              style={{ left: `${cocktail.x - cocktail.w / 2}%`, top: `${cocktail.y - cocktail.h / 2}%`, width: `${cocktail.w}%`, height: `${cocktail.h}%` }}
            >
              {cocktail.label}
            </div>
          ) : null}
          {objects.map((o) => (
            <PinMarker key={o.object_id} o={o} />
          ))}
        </div>
      ) : null}

      <PartNote icon={Info}>You can look, not move. Tables stay where the hosts put them.</PartNote>

      {cocktailWindow ? (
        <PartText>
          <strong>{cocktail?.label}</strong> · live during {cocktailWindow}
        </PartText>
      ) : null}

      {/* The tables, as rows — the same row as every list */}
      <PartSec>{plan.dietary_included ? 'Covers per table' : 'Tables'}</PartSec>
      {plan.dietary_included &&
      units.some((u) => {
        const seated = u.members.reduce((n, m) => n + m.src.seated, 0);
        const meals = mealsOf(u.members.map((m) => m.src));
        return meals !== null && Object.values(meals).reduce((n, v) => n + v, 0) < seated;
      }) ? (
        // A7-17: the covers add up to fewer than "seated" on some tables — say why, so the caterer does not plate short.
        <PartNote icon={Info}>
          Covers leave out seated guests the hosts did not count for you, so a table&rsquo;s covers can be fewer than its seated guests.
        </PartNote>
      ) : null}
      <PartList>
        {units.map((u) => {
          const members = u.members.map((m) => m.src);
          const seated = members.reduce((n, m) => n + m.seated, 0);
          const meals = plan.dietary_included ? mealsOf(members) : null;
          const joined = u.isLinked && members.length > 1 ? ` · ${members.map((m) => m.label).join(' & ')}` : '';
          const notPlaced = members.every((m) => m.x === null || m.y === null) ? ' · not placed on the map yet' : '';
          return (
            <PartRow
              key={u.key}
              title={u.label}
              sub={`${formatCount(seated)} of ${formatCount(u.capacity)} seated${notPlaced}${joined}`}
              end={
                meals ? (
                  <span className="flex max-w-[55%] flex-wrap justify-end gap-1">
                    {Object.entries(meals)
                      .sort((a, b) => b[1] - a[1])
                      .map(([pref, n]) => (
                        <ShopPill key={pref}>
                          {MEAL_LABELS[pref] ?? pref} · {n}
                        </ShopPill>
                      ))}
                  </span>
                ) : null
              }
            />
          );
        })}
      </PartList>
    </TheirEventPart>
  );
}

/** The plan could not be read (Honest state · new): the shell and the title stay, and say so. */
export function SeatPlanReadFailed({ eventId, eventName }: { eventId: string; eventName: string | null }) {
  return (
    <TheirEventPart column={COLUMN} mark="seat-plan" route={ROUTE} eventId={eventId} eventName={eventName} title="Seats">
      <ReadFailedBody mark="seat-plan">We couldn&rsquo;t load the couple&rsquo;s floor plan right now.</ReadFailedBody>
    </TheirEventPart>
  );
}
