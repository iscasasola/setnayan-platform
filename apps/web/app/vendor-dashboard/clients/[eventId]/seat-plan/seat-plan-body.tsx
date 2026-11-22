import { Eye, Info, MapPin } from 'lucide-react';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { formatCount } from '@/lib/format-number';
import { ShopPill } from '@/app/vendor-dashboard/_components/kit';
import { PartList, PartNote, PartRow, PartSec, PartText, setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';
import { ReadFailedBody } from '@/app/vendor-dashboard/_components/set-two/read-failed';
import { TheirEventPart } from '@/app/vendor-dashboard/_components/set-two/their-event-line';

const ROUTE = '/vendor-dashboard/clients/[eventId]/seat-plan';
const COLUMN = 'mx-auto w-full tab:max-w-5xl';

type PlanTable = {
  table_id: string;
  label: string;
  table_type: string;
  capacity: number;
  x: number | null;
  y: number | null;
  rotation_deg: number;
  sort_order: number;
  seated: number;
  meal_counts: Record<string, number> | null;
};

type PlanObject = {
  object_id: string;
  zone: 'reception' | 'cocktail';
  object_type: string;
  label: string;
  x: number;
  y: number;
  is_mine: boolean;
  vendor_name: string | null;
};

type PlanCocktail = {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  venue: { width_m: number | null; length_m: number | null };
  window: { label: string; start_at: string | null; end_at: string | null } | null;
};

export type Plan = {
  published_at: string;
  venue: { width_m: number | null; length_m: number | null };
  stage: { x: number; y: number; w: number; h: number };
  dance: { x: number; y: number; w: number; h: number } | null;
  entrance: { x: number; y: number } | null;
  service_entrance: { x: number; y: number } | null;
  cocktail: PlanCocktail | null;
  dietary_included: boolean;
  tables: PlanTable[];
  objects: PlanObject[];
};

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
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm ${
          o.is_mine
            ? 'border-transparent bg-sn-accent text-sn-on-accent shadow-[0_0_0_3px_var(--surface-soft)]'
            : 'border-[color:var(--m-line)] bg-[rgb(var(--sn-frame-bg))] text-[color:var(--m-slate-2)]'
        }`}
      >
        {o.is_mine ? 'YOU' : '•'}
      </span>
      <span className="mt-0.5 max-w-24 truncate rounded bg-[rgb(var(--sn-frame-bg))] px-1 text-[9px] font-semibold leading-tight text-ink">
        {o.label}
      </span>
    </div>
  );
}

function isRound(tableType: string): boolean {
  return tableType.startsWith('round') || tableType.startsWith('crescent');
}


/**
 * The seat plan, built to the approved locked-parts frame d ("Seats, view only", 21 Nov 2026) and the set-two parity
 * table: the shipped words in the top block with the eye pill "View only", "You can look, not move.", your pins in the
 * accent (pin only — no tinted tables, decided 4), every landmark, the cocktail window under the map, and the tables
 * as rows with their covers. Drawn from the page's read (the lab draws it from fixtures).
 */
export function SeatPlanBody({ eventId, eventName, plan }: { eventId: string; eventName: string | null; plan: Plan }) {
  const placed = plan.tables.filter((t) => t.x !== null && t.y !== null);
  const unplaced = plan.tables.filter((t) => t.x === null || t.y === null);
  const totalSeated = plan.tables.reduce((n, t) => n + t.seated, 0);
  // Canvas aspect from real venue dimensions when set; editor default 4:3.
  const aspect =
    plan.venue.width_m && plan.venue.length_m
      ? plan.venue.width_m / plan.venue.length_m
      : 4 / 3;
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
          style={{ aspectRatio: `${aspect}` }}
          data-seat-plan-map=""
        >
          <div
            className="absolute flex items-center justify-center rounded-[var(--m-r-sm)] bg-[color:var(--surface-soft)] text-[9px] font-bold uppercase tracking-wider text-[rgb(var(--color-link))]"
            style={{ left: `${plan.stage.x - plan.stage.w / 2}%`, top: `${plan.stage.y - plan.stage.h / 2}%`, width: `${plan.stage.w}%`, height: `${plan.stage.h}%` }}
          >
            Stage
          </div>
          {plan.dance ? (
            <div
              className="absolute flex items-center justify-center rounded-[var(--m-r-sm)] border border-dashed border-[color:var(--m-line)] text-[9px] font-bold uppercase tracking-wider text-[color:var(--m-slate-2)]"
              style={{ left: `${plan.dance.x - plan.dance.w / 2}%`, top: `${plan.dance.y - plan.dance.h / 2}%`, width: `${plan.dance.w}%`, height: `${plan.dance.h}%` }}
            >
              Dance floor
            </div>
          ) : null}
          {plan.entrance ? (
            <span
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${setTwo.mapPill}`}
              style={{ left: `${plan.entrance.x}%`, top: `${plan.entrance.y}%` }}
            >
              Entrance
            </span>
          ) : null}
          {plan.service_entrance ? (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--color-ok))] px-1.5 py-0.5 text-[9px] font-bold text-[rgb(var(--sn-frame-bg))]"
              style={{ left: `${plan.service_entrance.x}%`, top: `${plan.service_entrance.y}%` }}
            >
              Service
            </span>
          ) : null}
          {cocktail ? (
            <div
              className="absolute flex items-start justify-start rounded-[var(--m-r-md)] border-2 border-dashed border-sn-accent/60 bg-[color:var(--surface-soft)] p-1.5 text-[9px] font-bold uppercase tracking-wider text-sn-accent"
              style={{ left: `${cocktail.x - cocktail.w / 2}%`, top: `${cocktail.y - cocktail.h / 2}%`, width: `${cocktail.w}%`, height: `${cocktail.h}%` }}
            >
              {cocktail.label}
            </div>
          ) : null}
          {objects.map((o) => (
            <PinMarker key={o.object_id} o={o} />
          ))}
          {placed.map((t) => (
            <div
              key={t.table_id}
              className={`absolute flex h-[9%] min-h-9 w-[9%] min-w-9 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center bg-[color:var(--m-paper-2)] text-center ${
                isRound(t.table_type) ? 'rounded-full' : 'rounded-[var(--m-r-sm)]'
              }`}
              style={{ left: `${t.x}%`, top: `${t.y}%`, transform: `translate(-50%, -50%) rotate(${t.rotation_deg}deg)` }}
              title={`${t.label} · ${t.seated}/${t.capacity} seated`}
            >
              <span className="px-0.5 text-[9px] font-bold leading-tight text-ink">{t.label}</span>
              <span className="text-[9px] tabular-nums text-[color:var(--m-slate-2)]">
                {formatCount(t.seated)}/{formatCount(t.capacity)}
              </span>
            </div>
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
      <PartList>
        {[...placed, ...unplaced].map((t) => (
          <PartRow
            key={t.table_id}
            title={t.label}
            sub={`${formatCount(t.seated)} of ${formatCount(t.capacity)} seated${t.x === null ? ' · not placed on the map yet' : ''}`}
            end={
              plan.dietary_included && t.meal_counts ? (
                <span className="flex max-w-[55%] flex-wrap justify-end gap-1">
                  {Object.entries(t.meal_counts)
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
        ))}
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
