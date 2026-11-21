import { Info } from 'lucide-react';
import { PrintButton } from '@/components/print-button';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import { mealsWords, type CrewMealLine } from '@/lib/crew-meals';
import { ShopPill } from '@/app/vendor-dashboard/_components/kit';
import { PartCard, PartList, PartNote, PartRow, PartSec, PartText, PartTiles } from '@/app/vendor-dashboard/_components/set-two/parts';
import { ReadFailedBody } from '@/app/vendor-dashboard/_components/set-two/read-failed';
import { TheirEventPart } from '@/app/vendor-dashboard/_components/set-two/their-event-line';
import { AddRuleSheet } from './add-rule-sheet';
import { RuleRows, type RuleRow } from './rule-rows';
import { BLOCK_LABELS, MEAL_LABELS, fmtQty, ruleCount, type Metrics, type PortionRule } from './production-sheet-model';

const ROUTE = '/vendor-dashboard/clients/[eventId]/production-sheet';
const COLUMN = 'mx-auto w-full tab:max-w-5xl print:max-w-none';

const INTRO = 'Live counts from the couple’s guest list × your own per-head portion rules. Counts only — guest names never cross.';

/**
 * The production sheet, drawn from the page's reads (the lab draws it from fixtures). Supplier pages set two, page 5:
 * the three counts lead; each rule is one row on a phone (swipe to delete) and the table's columns on a computer
 * (Delete on hover); the add-rule fold is a sheet; Print sits in the top block. Every count, label, basis word and line
 * is the shipped page's; totals round up as before. Print keeps the print layout (the line, buttons and back do not print).
 */
export function ProductionSheetBody({
  eventId,
  eventName,
  metrics,
  rules,
  rulesMeasured,
  crewMeals,
  crewTotal,
  ruleFlag,
}: {
  eventId: string;
  eventName: string | null;
  metrics: Metrics;
  rules: PortionRule[];
  rulesMeasured: boolean;
  /** null = the crew meals could not be read. */
  crewMeals: CrewMealLine[] | null;
  crewTotal: number;
  ruleFlag: string | undefined;
}) {
  const mealEntries = Object.entries(metrics.meal_counts).sort((a, b) => b[1] - a[1]);
  const blockEntries = Object.entries(metrics.per_block_headcount);
  const asOf = metrics.as_of ? new Date(metrics.as_of).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const rows: RuleRow[] = rules.map((rule) => {
    const { count, basisNote } = ruleCount(rule, metrics);
    const total = Math.ceil(count * rule.qty_per_guest * (1 + rule.waste_factor_pct / 100));
    return {
      ruleId: rule.rule_id,
      label: rule.label,
      perGuest: `${fmtQty(rule.qty_per_guest)} ${rule.unit}`,
      buffer: rule.waste_factor_pct > 0 ? `+${fmtQty(rule.waste_factor_pct)}%` : null,
      basisNote,
      count,
      total: `${formatCount(total)} ${rule.unit}`,
    };
  });

  return (
    <TheirEventPart
      column={COLUMN}
      mark="production-sheet"
      route={ROUTE}
      eventId={eventId}
      eventName={eventName}
      title="Production sheet"
      end={
        <span className="print:hidden">
          <PrintButton label="Print production sheet" round />
        </span>
      }
      intro={
        <>
          <p>
            {INTRO}
            {asOf ? ` Last RSVP movement: ${asOf}.` : ''}
          </p>
          <p className="mt-2">
            <ShopPill tone={metrics.finality.is_provisional ? 'warn' : 'success'}>
              {metrics.finality.is_provisional
                ? `Provisional — ${metrics.finality.pending} pending · ${metrics.finality.maybe} maybe`
                : 'Final headcount'}
            </ShopPill>
          </p>
        </>
      }
    >
      <PartTiles
        tiles={[
          { key: 'confirmed', value: formatCount(metrics.headcount_scenarios.confirmed), label: 'Confirmed', sub: 'attending now' },
          { key: 'expected', value: formatCount(metrics.headcount_scenarios.expected), label: 'Expected', sub: 'plus maybes' },
          { key: 'ceiling', value: formatCount(metrics.headcount_scenarios.ceiling), label: 'Ceiling', sub: 'if every pending shows' },
        ]}
      />

      <div className="order-2 tab:order-1 tab:mt-2 tab:grid tab:grid-cols-2 tab:items-start tab:gap-4">
        {/* Meal mix (confirmed) */}
        <section>
          <PartSec>Meal mix (confirmed)</PartSec>
          {mealEntries.length === 0 ? (
            <PartText>No confirmed guests yet.</PartText>
          ) : (
            <PartList>
              {mealEntries.map(([pref, n]) => (
                <PartRow dense key={pref} title={<span className="font-medium">{MEAL_LABELS[pref] ?? pref}</span>} end={<span className="tabular-nums">{n}</span>} />
              ))}
            </PartList>
          )}
          {metrics.dietary_restriction_count > 0 ? (
            <PartNote tone="warn" icon={Info}>
              {formatCount(metrics.dietary_restriction_count)}{' '}
              {metrics.dietary_restriction_count === 1 ? 'guest has' : 'guests have'} dietary restriction notes — ask the
              couple for specifics.
            </PartNote>
          ) : null}
        </section>

        <section>
          {/* Per-block pax */}
          <PartSec>Headcount per part of the day</PartSec>
          <PartText>Not everyone is invited to every part — cocktail pax ≠ dinner pax.</PartText>
          {blockEntries.length === 0 ? (
            <PartText>No block assignments yet.</PartText>
          ) : (
            <PartList>
              {blockEntries.map(([block, counts]) => (
                <PartRow
                  dense
                  key={block}
                  title={<span className="font-medium">{BLOCK_LABELS[block] ?? block}</span>}
                  end={
                    <span className="tabular-nums">
                      {counts.confirmed}
                      <span className="font-normal text-[color:var(--m-slate-2)]"> / {formatCount(counts.ceiling)} max</span>
                    </span>
                  }
                />
              ))}
            </PartList>
          )}

          {/* 🍱 Crew meals — what the host set per booked supplier. A refused read is said, never "none". */}
          <div data-crew-meals="">
            <PartSec end={crewMeals && crewMeals.length > 0 ? <span data-crew-meals-total="">{formatCount(crewTotal)}</span> : null}>
              Crew meals
            </PartSec>
            <PartText>The suppliers the couple marked as fed by you, and how many from each.</PartText>
            {crewMeals === null ? (
              <PartNote tone="warn" icon={Info} role="alert">
                The crew meals couldn&rsquo;t be read just now — reload to try again.
              </PartNote>
            ) : crewMeals.length === 0 ? (
              <PartText>The couple hasn&rsquo;t marked any supplier&rsquo;s crew as fed by you yet.</PartText>
            ) : (
              <PartList>
                {crewMeals.map((l) => (
                  <PartRow
                    dense
                    key={`${l.name}|${l.category}`}
                    title={
                      <span className="font-medium">
                        {l.name}
                        {l.fromListing ? <span className="ml-1.5 text-[12px] font-normal text-[color:var(--m-slate-2)]">from their listing</span> : null}
                      </span>
                    }
                    end={<span className="tabular-nums">{mealsWords(l.meals)}</span>}
                  />
                ))}
              </PartList>
            )}
          </div>
        </section>
      </div>

      {/* Portion rules × live counts — right under the counts on a phone, after the mix and the parts on a computer */}
      <section className="order-1 tab:order-2">
      <PartSec>
        <InfoTip label="Ingredient totals">
          Your per-head rules × today&rsquo;s counts. Rules are saved to your business and reused on every booked event.
        </InfoTip>
      </PartSec>
      {ruleFlag === 'invalid' ? (
        <PartNote tone="warn" icon={Info} role="alert">
          Each rule needs a name, a unit, and a per-guest quantity above zero.
        </PartNote>
      ) : null}
      {ruleFlag === 'error' ? (
        <PartNote tone="warn" icon={Info} role="alert">
          That didn&rsquo;t save — try again.
        </PartNote>
      ) : null}
      {!rulesMeasured ? (
        <PartNote tone="accent" icon={Info} role="alert">
          <strong>We couldn&rsquo;t load your portion rules.</strong> The ingredient totals on this sheet are computed from
          them, so treat everything below as unknown rather than zero — and do not re-enter your rules, they are still saved.
        </PartNote>
      ) : null}
      <PartList>
        {rulesMeasured && rows.length === 0 ? (
          <PartText>
            No portion rules yet — add your first below (for example, how much rice per guest, and a buffer on top).
          </PartText>
        ) : null}
        {rulesMeasured && rows.length > 0 ? <RuleRows eventId={eventId} rows={rows} /> : null}
        <div className="print:hidden">
          <AddRuleSheet eventId={eventId} />
        </div>
      </PartList>
      </section>

      <PartCard className="order-3 !bg-transparent !shadow-none">
        <p>
          Every number on this sheet is your own rule multiplied by a live count — nothing is estimated for you.
          Meal-specific rules use confirmed RSVPs only (pending guests haven&rsquo;t picked a meal yet).
        </p>
      </PartCard>
    </TheirEventPart>
  );
}

/** The live counts could not be read (Honest state · new): every number comes from them, so none is shown. */
export function ProductionSheetReadFailed({ eventId, eventName }: { eventId: string; eventName: string | null }) {
  return (
    <TheirEventPart column={COLUMN} mark="production-sheet" route={ROUTE} eventId={eventId} eventName={eventName} title="Production sheet">
      <ReadFailedBody mark="production-sheet">
        We couldn&rsquo;t load the live counts right now. Every number on this sheet comes from them, so none is shown.
      </ReadFailedBody>
    </TheirEventPart>
  );
}
