/**
 * lib/supplier-plan-public-words.ts — WHAT THE PUBLIC PAGES SAY A SUPPLIER PLAN INCLUDES, read from the gates.
 *
 * WHY (fix pass on PR #8019, 22 Nov). The owner moved the special tools to Pro and Ultra only (DECISION_LOG 21 Nov
 * "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP", 22 Nov "THERE IS NO MAX PLAN"), and
 * `SPECIALIZED_TOOLS_INCLUDED_TIERS` moved with it — but two public pages had the line TYPED on the Plus row
 * (`/pricing`: "All specialized tools"; `/features`: "All specialized tools included"), so both kept promising Plus
 * something it no longer has. Typed copy cannot follow a gate. Here the line is PLACED by the gate's own list:
 *   · it sits on the first paid plan `SPECIALIZED_TOOLS_INCLUDED_TIERS` names (today: Pro);
 *   · a paid plan below that says what it really has — its numbers from `TIER_CAPS`, in the plan ladder's own nouns
 *     (live cards · people · GB), or, where the page lists lines, the Plan page's own tools words
 *     (`specializedToolsLine`, lib/vendor-plan-rows.ts): "The free set · all of them from Pro".
 *
 * No price is here, and no number is typed: every figure is `TIER_CAPS`.
 * PURE. 🔒 lib/public-plan-surfaces-follow-the-tools-gate.test.ts
 */
import { countNoun, formatCount } from './format-number';
import { SPECIALIZED_TOOLS_INCLUDED_TIERS } from './specialized-tools-access';
import { PLAN_CHATBOT_LEVEL } from './vendor-ai-level';
import { specializedToolsLine } from './vendor-plan-rows';
import { STORAGE_GB, TIER_CAPS, type VendorTier } from './vendor-tier-caps';

/** The three plans a shop pays for, in ladder order (Plus · Pro · Ultra). */
export const PAID_SUPPLIER_TIERS = ['solo', 'pro', 'enterprise'] as const;
export type PaidSupplierTier = (typeof PAID_SUPPLIER_TIERS)[number];

/** The first paid plan that includes every specialized tool — the gate's own list. Null when no paid plan does. */
export function specializedToolsFromTier(): PaidSupplierTier | null {
  return PAID_SUPPLIER_TIERS.find((t) => SPECIALIZED_TOOLS_INCLUDED_TIERS.includes(t)) ?? null;
}

/** The first paid plan whose chatbot is the smarter level (`PLAN_CHATBOT_LEVEL` — the gate the inbox reads). */
function smarterChatbotFromTier(): PaidSupplierTier | null {
  return PAID_SUPPLIER_TIERS.find((t) => PLAN_CHATBOT_LEVEL[t] === 'advanced') ?? null;
}

/**
 * What a plan HOLDS, in the ladder's own nouns: "10 live cards · 2 people · 5 GB". People include the owner
 * (`agentAccounts` + 1); a plan with no storage allowance leaves the GB out. Every number is `TIER_CAPS`.
 */
export function planHoldsWords(tier: VendorTier): string {
  const c = TIER_CAPS[tier];
  const parts = [
    Number.isFinite(c.serviceCardsTotal) ? countNoun(c.serviceCardsTotal, 'live card', 'live cards') : null,
    Number.isFinite(c.agentAccounts) ? countNoun(c.agentAccounts + 1, 'person', 'people') : null,
    c.storageBytes !== null ? `${formatCount(c.storageBytes / STORAGE_GB)} GB` : null,
  ];
  return parts.filter((p): p is string => p !== null).join(' · ');
}

/**
 * `/pricing` › For suppliers — the one line under a paid plan's name: what the plan ADDS.
 *   · the plan the tools gate opens on says "all specialized tools"; a plan below it says what it holds instead;
 *   · the plan the smarter chatbot opens on says so; Ultra's line is its limits.
 */
export function pricingSupplierPlanWhat(tier: PaidSupplierTier): string {
  const toolsHere = specializedToolsFromTier() === tier;
  const smarterHere = smarterChatbotFromTier() === tier;
  if (tier === 'enterprise') {
    const adds = [toolsHere ? 'all specialized tools' : null, PLAN_CHATBOT_LEVEL.enterprise === 'advanced' ? 'the smarter AI chatbot' : null].filter(Boolean);
    return ['The highest limits', ...adds].join(adds.length > 1 ? ', ' : ' and ');
  }
  const adds = [toolsHere ? 'all specialized tools' : null, smarterHere ? 'the smarter AI chatbot' : null].filter((p): p is string => p !== null);
  if (adds.length === 0) return planHoldsWords(tier);
  // Alone, the tools line keeps the words it always had on this page.
  if (adds.length === 1 && toolsHere) return 'All specialized tools';
  return `Adds ${adds.join(' and ')}`;
}

/** `/features` › Supplier plans — the tools line of one paid plan's column. */
export const FEATURES_ALL_TOOLS_LINE = 'All specialized tools included';

/**
 * The line a paid plan's `/features` column carries about the specialized tools, or null (a plan above the first one
 * that includes them says "Everything in <the plan below>" and repeats nothing).
 *   · the first plan the gate includes → `FEATURES_ALL_TOOLS_LINE`;
 *   · a paid plan BELOW it → the Plan page's own words for that plan ("Specialized tools: the free set · all of them
 *     from Pro"), so the column says what the plan really has.
 */
export function featuresSupplierToolsLine(tier: PaidSupplierTier): string | null {
  const from = specializedToolsFromTier();
  if (from === tier) return FEATURES_ALL_TOOLS_LINE;
  if (from === null || PAID_SUPPLIER_TIERS.indexOf(tier) < PAID_SUPPLIER_TIERS.indexOf(from)) {
    const line = specializedToolsLine(tier);
    return `Specialized tools: ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
  }
  return null;
}
