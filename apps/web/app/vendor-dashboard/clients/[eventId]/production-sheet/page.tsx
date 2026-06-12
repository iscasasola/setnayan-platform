import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ChefHat, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { PrintButton } from '@/components/print-button';
import { addPortionRule, deletePortionRule } from './actions';

export const metadata = { title: 'Production Sheet · Vendor' };

/**
 * Caterer Production Sheet — Vendor Portal data-link program ②
 * (corpus 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 2).
 *
 * Live RSVP metrics (counts only — guest PII never crosses) × the vendor's
 * own per-head portion rules = deterministic ingredient totals. Setnayan
 * never invents quantities; every number traces to a rule the vendor wrote
 * and a count the couple's guest list produced. Food-relevant categories
 * only — the RPC enforces the same gate as the Brief's dietary section.
 */

type Metrics = {
  as_of: string | null;
  event_date: string | null;
  finality: { is_provisional: boolean; responded_pct: number; pending: number; maybe: number };
  headcount_scenarios: { confirmed: number; expected: number; ceiling: number };
  invited: number;
  declined: number;
  meal_counts: Record<string, number>;
  per_block_headcount: Record<string, { confirmed: number; expected: number; ceiling: number }>;
  dietary_restriction_count: number;
};

type PortionRule = {
  rule_id: string;
  label: string;
  unit: string;
  qty_per_guest: number;
  applies_to_meals: string[] | null;
  applies_to_block: string | null;
  headcount_basis: 'confirmed' | 'expected' | 'ceiling';
  waste_factor_pct: number;
};

const MEAL_LABELS: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids meal',
  no_preference: 'No preference',
  unspecified: 'Not specified yet',
};

const BLOCK_LABELS: Record<string, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  cocktails: 'Cocktails',
  after_party: 'After party',
  rehearsal_dinner: 'Rehearsal dinner',
};

const BASIS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  expected: 'Expected (+maybe)',
  ceiling: 'Ceiling (+pending)',
};

/**
 * The deterministic multiplication (§ 2.3): rule × matching live count.
 * Block-scoped rules read that block's pax at the rule's basis; meal-scoped
 * rules read confirmed meal counts (pending guests have no meal preference
 * yet — scaling them would be invention, not arithmetic).
 */
function ruleCount(rule: PortionRule, m: Metrics): { count: number; basisNote: string } {
  if (rule.applies_to_block) {
    const block = m.per_block_headcount[rule.applies_to_block];
    return {
      count: block?.[rule.headcount_basis] ?? 0,
      basisNote: `${BLOCK_LABELS[rule.applies_to_block] ?? rule.applies_to_block} · ${BASIS_LABELS[rule.headcount_basis]}`,
    };
  }
  if (rule.applies_to_meals && rule.applies_to_meals.length > 0) {
    const count = rule.applies_to_meals.reduce((sum, p) => sum + (m.meal_counts[p] ?? 0), 0);
    return {
      count,
      basisNote: `${rule.applies_to_meals.map((p) => MEAL_LABELS[p] ?? p).join(' + ')} · confirmed`,
    };
  }
  return {
    count: m.headcount_scenarios[rule.headcount_basis],
    basisNote: `All guests · ${BASIS_LABELS[rule.headcount_basis]}`,
  };
}

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ rule?: string }>;
};

export default async function ProductionSheetPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Booked + food-category gate lives in the RPC; an error bounces back to
  // the Brief (non-food vendors never land here organically).
  const { data, error } = await supabase.rpc('get_vendor_catering_metrics', {
    p_event_id: eventId,
  });
  if (error || !data) redirect(`/vendor-dashboard/clients/${eventId}`);
  const metrics = data as Metrics;

  const { data: ruleRows } = await supabase
    .from('vendor_portion_rules')
    .select(
      'rule_id, label, unit, qty_per_guest, applies_to_meals, applies_to_block, headcount_basis, waste_factor_pct',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  const rules = (ruleRows ?? []) as PortionRule[];

  const mealEntries = Object.entries(metrics.meal_counts).sort((a, b) => b[1] - a[1]);
  const blockEntries = Object.entries(metrics.per_block_headcount);
  const asOf = metrics.as_of
    ? new Date(metrics.as_of).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8 print:max-w-none print:py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/vendor-dashboard/clients/${eventId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Event brief
        </Link>
        <PrintButton label="Print production sheet" />
      </div>

      <header className="space-y-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta print:hidden">
          <ChefHat aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Production sheet</h1>
        <p className="text-sm text-ink/65">
          Live counts from the couple&rsquo;s guest list × your own per-head portion rules.
          Counts only — guest names never cross.
          {asOf ? ` Last RSVP movement: ${asOf}.` : ''}
        </p>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            metrics.finality.is_provisional
              ? 'bg-amber-100 text-amber-900'
              : 'bg-emerald-100 text-emerald-900'
          }`}
        >
          {metrics.finality.is_provisional
            ? `Provisional — ${metrics.finality.pending} pending · ${metrics.finality.maybe} maybe`
            : 'Final headcount'}
        </span>
      </header>

      {/* Headcount scenarios */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ['confirmed', 'Confirmed', 'attending now'],
            ['expected', 'Expected', 'plus maybes'],
            ['ceiling', 'Ceiling', 'if every pending shows'],
          ] as const
        ).map(([key, label, hint]) => (
          <div key={key} className="rounded-2xl border border-ink/10 bg-cream p-4 text-center">
            <p className="text-3xl font-semibold tabular-nums">
              {metrics.headcount_scenarios[key]}
            </p>
            <p className="mt-1 text-sm font-medium">{label}</p>
            <p className="text-xs text-ink/50">{hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Meal mix */}
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Meal mix (confirmed)</h2>
          {mealEntries.length === 0 ? (
            <p className="mt-2 text-sm text-ink/55">No confirmed guests yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {mealEntries.map(([pref, n]) => (
                <li key={pref} className="flex items-center justify-between text-sm">
                  <span>{MEAL_LABELS[pref] ?? pref}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
          {metrics.dietary_restriction_count > 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {metrics.dietary_restriction_count}{' '}
              {metrics.dietary_restriction_count === 1 ? 'guest has' : 'guests have'} dietary
              restriction notes — ask the couple for specifics.
            </p>
          ) : null}
        </div>

        {/* Per-block pax */}
        <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Headcount per part of the day</h2>
          <p className="mt-1 text-xs text-ink/50">
            Not everyone is invited to every part — cocktail pax ≠ dinner pax.
          </p>
          {blockEntries.length === 0 ? (
            <p className="mt-2 text-sm text-ink/55">No block assignments yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {blockEntries.map(([block, counts]) => (
                <li key={block} className="flex items-center justify-between text-sm">
                  <span>{BLOCK_LABELS[block] ?? block}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{counts.confirmed}</span>
                    <span className="text-ink/45"> / {counts.ceiling} max</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Portion rules × live counts */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Ingredient totals</h2>
        <p className="mt-1 text-xs text-ink/50">
          Your per-head rules × today&rsquo;s counts. Rules are saved to your business and
          reused on every booked event.
        </p>

        {search.rule === 'invalid' ? (
          <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Each rule needs a name, a unit, and a per-guest quantity above zero.
          </p>
        ) : null}
        {search.rule === 'error' ? (
          <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            That didn&rsquo;t save — try again.
          </p>
        ) : null}

        {rules.length === 0 ? (
          <p className="mt-3 text-sm text-ink/55">
            No portion rules yet — add your first below (e.g. &ldquo;Rice — 0.2 kg per
            guest, +10% buffer&rdquo;).
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left text-xs uppercase tracking-wide text-ink/55">
                <th className="py-2 pr-2 font-medium">Item</th>
                <th className="py-2 pr-2 font-medium">Per guest</th>
                <th className="py-2 pr-2 font-medium">Who counts</th>
                <th className="py-2 pr-2 text-right font-medium">Guests</th>
                <th className="py-2 pr-2 text-right font-medium">Total</th>
                <th className="py-2 print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rules.map((rule) => {
                const { count, basisNote } = ruleCount(rule, metrics);
                const total = Math.ceil(
                  count * rule.qty_per_guest * (1 + rule.waste_factor_pct / 100),
                );
                return (
                  <tr key={rule.rule_id}>
                    <td className="py-2 pr-2 font-medium">{rule.label}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      {fmtQty(rule.qty_per_guest)} {rule.unit}
                      {rule.waste_factor_pct > 0 ? (
                        <span className="text-xs text-ink/45"> +{fmtQty(rule.waste_factor_pct)}%</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-xs text-ink/60">{basisNote}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{count}</td>
                    <td className="py-2 pr-2 text-right font-semibold tabular-nums">
                      {total} {rule.unit}
                    </td>
                    <td className="py-2 text-right print:hidden">
                      <form action={deletePortionRule}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="rule_id" value={rule.rule_id} />
                        <button
                          type="submit"
                          aria-label={`Delete ${rule.label}`}
                          className="text-ink/40 hover:text-red-700"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Add rule */}
        <details className="mt-4 rounded-xl border border-ink/10 bg-white/50 p-3 print:hidden">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold">
            <Plus aria-hidden className="h-4 w-4" /> Add a portion rule
          </summary>
          <form action={addPortionRule} className="mt-3 grid gap-2">
            <input type="hidden" name="event_id" value={eventId} />
            <div className="grid gap-2 sm:grid-cols-3">
              <input type="text" name="label" required maxLength={120} placeholder="Item, e.g. Rice" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
              <input type="number" name="qty_per_guest" required min="0.001" step="any" placeholder="Qty per guest" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
              <input type="text" name="unit" required maxLength={30} placeholder="Unit, e.g. kg" className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm" />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/70">
              <span className="font-medium">Only these meals:</span>
              {Object.entries(MEAL_LABELS)
                .filter(([k]) => k !== 'unspecified')
                .map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-1">
                    <input type="checkbox" name={`meal_${key}`} /> {label}
                  </label>
                ))}
              <span className="text-ink/45">(none checked = all guests)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select name="applies_to_block" className="rounded-lg border border-ink/20 bg-white px-2 py-1.5" defaultValue="">
                <option value="">Whole event</option>
                {Object.entries(BLOCK_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label} only
                  </option>
                ))}
              </select>
              <select name="headcount_basis" className="rounded-lg border border-ink/20 bg-white px-2 py-1.5" defaultValue="confirmed">
                {Object.entries(BASIS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    Count: {label}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1 text-ink/70">
                Buffer %
                <input type="number" name="waste_factor_pct" min="0" max="100" step="any" defaultValue="0" className="w-16 rounded-lg border border-ink/20 bg-white px-2 py-1.5" />
              </label>
            </div>
            <button type="submit" className="justify-self-start rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream">
              Save rule
            </button>
          </form>
        </details>
      </div>

      <p className="text-xs text-ink/45">
        Every number on this sheet is your own rule multiplied by a live count — nothing is
        estimated for you. Meal-specific rules use confirmed RSVPs only (pending guests
        haven&rsquo;t picked a meal yet).
      </p>
    </section>
  );
}
