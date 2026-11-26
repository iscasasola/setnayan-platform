/**
 * 🤝 WHICH PLAN SENDS A CREATOR OFFER — said ONE way (final check A5-G2-04). The Send sheet's note and the refusal a
 * free shop gets on Send used to disagree ("part of every paid plan" vs "a Pro-and-up feature"). The database floor
 * (`offer_creator_reach_hold`, migration 20271360033501) admits every paid size since 2026-11-22, so the words name
 * the first paid size, read from the plan table — never a typed plan name. Pure: the client sheet imports it too.
 */
import { FIRST_PAID_SIZE, TIER_LABEL } from '@/lib/vendor-tier-caps';

export const CREATOR_SEND_PLAN = TIER_LABEL[FIRST_PAID_SIZE];

/** The refusal a shop below the floor gets on Send. */
export const CREATOR_SEND_PLAN_LINE = `Sending an offer is part of every paid plan, from ${CREATOR_SEND_PLAN}. See plans to add it.`;
