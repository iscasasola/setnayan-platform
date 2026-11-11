/**
 * Vendor "Grow your business" recommendations — pure, deterministic builder for
 * the My Performance page (prototype "🚀 Grow your business · highest impact
 * first" block).
 *
 * Each card is derived from the vendor's OWN gaps in `vendor_activity_stats`, so
 * the list is honest — a vendor who already replies fast never sees "Reply
 * within the hour". Ranked highest-impact first by a coarse weight. This is a
 * presentation sibling of `vendor-profile-tips.ts` (which powers the fix-it
 * nudges) — kept separate so the growth cards can carry their own impact chip +
 * CTA copy + route without bending the tips shape.
 *
 * No ML — rules + weights, framework-free + unit-testable.
 */

export type GrowthRecKey =
  | 'reply_faster'
  | 'add_photos'
  | 'ask_reviews'
  | 'build_partnerships'
  | 'open_saturdays'
  // Build 6 Lane I (owner 10 Nov, "tapping shows a recommendation from us") — one rule per new graph, each fed only by
  // a number its graph already shows (`lib/vendor-analytics-graphs.ts`).
  | 'open_lost_dates'
  | 'add_team'
  | 'offer_on_card'
  | 'offer_for_month'
  | 'requote_expired';

/** Coarse expected-impact band → the chip label + tone. */
export type GrowthImpact = 'high' | 'medium' | 'low';

export type GrowthRec = {
  key: GrowthRecKey;
  title: string;
  /** One-line benefit-framed reason. */
  body: string;
  impact: GrowthImpact;
  /** Short chip copy, e.g. "High impact". */
  impactLabel: string;
  ctaLabel: string;
  ctaHref: string;
  /** Higher = ranked first. */
  weight: number;
};

/** The subset of vendor_activity_stats the recs are derived from. */
export type GrowthRecStats = {
  avg_response_minutes: number | null;
  response_rate_pct: number | null;
  review_count: number | null;
  profile_completeness_pct: number | null;
  finalized_booking_count: number | null;
  /**
   * How many live partnerships this vendor already has (accepted + active, in
   * either direction). Null = not read.
   *
   * Partnerships were complete on both sides and reachable — and NOTHING ever
   * invited a vendor into them, so nobody used them. Owner 2026-08-05 asked for
   * them promoted rather than retired; this is that promotion, in the one place
   * that already earns a vendor's attention with honest, self-derived advice.
   */
  partnership_count: number | null;
};

const IMPACT_LABEL: Record<GrowthImpact, string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Quick win',
};

/**
 * Build the ranked growth recommendations from the vendor's own stats. When
 * there is no stats row yet (brand-new vendor), returns the universal starter
 * set so the block is never empty — every card still routes somewhere real.
 *
 * `opts` — TWO RULE CHANGES (Analytics redesign, owner-approved 6 Nov 2026; controller, the honest-reads rule
 * "never advise on something that hasn't happened"):
 *   · `askedInWindow` — the inquiries the page already shows for its window (the pinned row's "asked"). Reply advice
 *     fires only once at least one couple has asked: a shop nobody has messaged is never told to reply faster.
 *     Absent (`undefined`) = a caller with no window (the rule as it was); `null` = the count could not be read —
 *     then no reply advice either (no advice on a number we do not have).
 *   · `unopenedSaturdays` — how many Saturdays a reader says the shop has not opened. `open_saturdays` fires only
 *     above 0. No shipped reader says this yet, so callers pass nothing and the rec does not fire.
 */
export type GrowthRecOpts = {
  askedInWindow?: number | null;
  unopenedSaturdays?: number | null;
  /**
   * BUILD 6 LANE I — the five new graphs' numbers. Absent or `null` (unread) → the rule does not fire: no advice on a
   * number we do not have.
   *   · `lostDates`    graph a — asks you could not take: `closed` → Open that day · `full` → Add a team.
   *   · `quietCard`    graph b — a card couples OPEN often but rarely ask about. Needs opens per card, which nothing
   *                    records yet, so no caller passes it and `offer_on_card` does not fire (the rule is ready).
   *   · `slowMonth`    graph d — the first month ahead with nothing booked between booked months, and the card the
   *                    offer seeds (`serviceId`; no active card → no door → no rule).
   *   · `expiredQuotes` graph e — quotations past their Valid until without an answer.
   */
  lostDates?: { closed: number; full: number } | null;
  quietCard?: { serviceId: string; name: string } | null;
  slowMonth?: { name: string; lastDay: string; serviceId: string | null } | null;
  expiredQuotes?: number | null;
};

export function buildGrowthRecs(stats: GrowthRecStats | null, opts: GrowthRecOpts = {}): GrowthRec[] {
  const recs: GrowthRec[] = [];

  const responseRate = Number(stats?.response_rate_pct ?? 0);
  const avgMinutes = Number(stats?.avg_response_minutes ?? 0);
  const reviewCount = Number(stats?.review_count ?? 0);
  const completeness = Number(stats?.profile_completeness_pct ?? 0);
  const hasStats = stats !== null;

  // Reply within the hour — fires when reply time is slow OR response rate is
  // sub-90%. avg===0 means "no data yet" (not instant), so we lean on the rate
  // in that case. Highest lever: fast repliers earn the First-Look head-start.
  const someoneAsked = opts.askedInWindow === undefined || (opts.askedInWindow !== null && opts.askedInWindow >= 1);
  if (someoneAsked && (!hasStats || responseRate < 90 || avgMinutes > 60)) {
    const weight = !hasStats ? 70 : Math.max(90 - responseRate, avgMinutes > 60 ? 40 : 0) + 30;
    recs.push({
      key: 'reply_faster',
      title: 'Reply within the hour',
      body: 'Fast repliers earn the First-Look head-start with couples and win more bookings.',
      impact: 'high',
      impactLabel: IMPACT_LABEL.high,
      ctaLabel: 'Open messages',
      ctaHref: '/vendor-dashboard/messages',
      weight,
    });
  }

  // Add recent photos — fires when the profile isn't ~complete. Complete
  // profiles get roughly 3× more inquiries.
  if (!hasStats || completeness < 90) {
    recs.push({
      key: 'add_photos',
      title: 'Add recent photos',
      body: hasStats
        ? `Your profile is ${Math.round(completeness)}% complete. Fresh photos get about 3× more inquiries.`
        : 'A complete profile with fresh photos gets about 3× more inquiries.',
      impact: 'high',
      impactLabel: IMPACT_LABEL.high,
      ctaLabel: 'Add photos',
      // Straight to Your collections › Add photos (step 5, 2026-10-14) — the
      // gallery editors' home, opened by its anchor.
      ctaHref: '/vendor-dashboard/collections#gallery-media',
      weight: !hasStats ? 60 : 100 - completeness,
    });
  }

  // Ask for reviews — fires when reviews are thin. Reviews are the strongest
  // trust signal and lift the Reputation pillar.
  if (!hasStats || reviewCount < 5) {
    recs.push({
      key: 'ask_reviews',
      title: 'Ask for reviews',
      body:
        reviewCount > 0
          ? `You have ${reviewCount} review${reviewCount === 1 ? '' : 's'}. Invite past couples to review you — it lifts your rating and trust.`
          : 'Invite your past couples to review you — reviews are your strongest trust signal.',
      impact: 'medium',
      impactLabel: IMPACT_LABEL.medium,
      ctaLabel: 'See reviews',
      ctaHref: '/vendor-dashboard/website#reviews',
      weight: (5 - Math.min(reviewCount, 5)) * 8 + 10,
    });
  }

  // Link up with vendors you already work with — fires only for a vendor with
  // few or no partnerships, so someone who has already built their circle never
  // sees it. Real lever: a couple who shortlists your coordinator sees YOU in
  // their results, and being included in a package is the strongest thing a
  // couple can read about you.
  const partnerships = Number(stats?.partnership_count ?? 0);
  if (!hasStats || partnerships < 3) {
    recs.push({
      key: 'build_partnerships',
      title: 'Link up with suppliers you already work with',
      body:
        partnerships > 0
          ? `You have ${partnerships} partnership${partnerships === 1 ? '' : 's'}. When a couple shortlists a supplier who vouches for you, you show up in their results.`
          : 'When a coordinator or venue you work with vouches for you, you appear in their couples’ results — with their name on it.',
      impact: 'medium',
      impactLabel: IMPACT_LABEL.medium,
      ctaLabel: 'Open partnerships',
      ctaHref: '/vendor-dashboard/partnerships',
      weight: (3 - Math.min(partnerships, 3)) * 9 + 12,
    });
  }

  // Open more Saturdays — a calendar-availability nudge. ⚠ It used to be pushed for EVERY shop, unconditionally (there
  // was no per-day open-slot signal), so a shop with every Saturday open was told to open more. RULE CHANGE (6 Nov
  // 2026): it fires only when a reader says the shop HAS Saturdays it has not opened. None does today → it does not fire.
  if (opts.unopenedSaturdays != null && opts.unopenedSaturdays > 0) {
    recs.push({
      key: 'open_saturdays',
      title: 'Open more Saturdays',
      body: 'Saturdays are the most-requested wedding day. Opening more dates puts you in front of more couples.',
      impact: 'low',
      impactLabel: IMPACT_LABEL.low,
      ctaLabel: 'Open calendar',
      ctaHref: '/vendor-dashboard/calendar',
      weight: 5,
    });
  }

  // ── BUILD 6 LANE I — the five new graphs' rules (prototype build6_makers_analytics_2026-11-10, approved 10 Nov) ──

  // a · Dates you lost — couples asked for dates you had CLOSED. Opening them puts you back in front of those couples.
  if (opts.lostDates && opts.lostDates.closed > 0) {
    recs.push({
      key: 'open_lost_dates',
      title: 'Open that day',
      body: 'Couples asked for dates you were closed on. Opening them puts you back in front of those couples next time.',
      impact: 'high',
      impactLabel: IMPACT_LABEL.high,
      ctaLabel: 'Open calendar',
      ctaHref: '/vendor-dashboard/calendar',
      weight: 40 + Math.min(opts.lostDates.closed, 10) * 4,
    });
  }
  // a · Dates you lost — couples asked for dates you were already FULL on. A second team can take a second booking.
  if (opts.lostDates && opts.lostDates.full > 0) {
    recs.push({
      key: 'add_team',
      title: 'Add a team',
      body: 'A full day can take a second booking when a second team can run it. Your schedule stays honest: one team, one event.',
      impact: 'medium',
      impactLabel: IMPACT_LABEL.medium,
      ctaLabel: 'Add a team',
      ctaHref: '/vendor-dashboard/team',
      weight: 20 + Math.min(opts.lostDates.full, 10) * 3,
    });
  }
  // b · Which card sells — a card couples open but rarely ask about needs a reason to ask today.
  if (opts.quietCard) {
    recs.push({
      key: 'offer_on_card',
      title: `Run an offer on ${opts.quietCard.name}`,
      body: 'A card couples open but rarely ask about needs a reason to ask today — an offer puts one on it.',
      impact: 'high',
      impactLabel: IMPACT_LABEL.high,
      ctaLabel: 'Run an offer',
      // 🏷 The Offer Maker (Build 6 Lane D), a new offer on this card — never a discount typed into the card itself.
      ctaHref: `/vendor-dashboard/shop?maker=offers&new=card&card=${encodeURIComponent(opts.quietCard.serviceId)}`,
      weight: 45,
    });
  }
  // d · Slow months ahead — an offer for events in the slow month: the Offer Maker's "Event date in a season", opened on
  //     that month's days (DECISION_LOG 2026-11-11: the Offer Maker IS the off-season offer; the per-card off-peak seed left).
  if (opts.slowMonth && opts.slowMonth.serviceId) {
    const m = opts.slowMonth;
    recs.push({
      key: 'offer_for_month',
      title: `Run an offer for ${m.name}`,
      body: 'An offer that runs only in a slow month fills it without cutting the price of your busy months.',
      impact: 'high',
      impactLabel: IMPACT_LABEL.high,
      ctaLabel: 'Run an offer',
      ctaHref: `/vendor-dashboard/shop?maker=offers&new=season&from=${m.lastDay.slice(0, 8)}01&to=${m.lastDay}`,
      weight: 42,
    });
  }
  // e · Quotes waiting — an expired quotation shows the couple a blocker, not your price.
  if (opts.expiredQuotes != null && opts.expiredQuotes > 0) {
    recs.push({
      key: 'requote_expired',
      title: 'Send a new quotation',
      body: 'An expired quotation shows the couple a blocker, not your price. A fresh one with a Valid-until date puts it back in front of them.',
      impact: 'high',
      impactLabel: IMPACT_LABEL.high,
      ctaLabel: 'Send a new quotation',
      ctaHref: '/vendor-dashboard/customers',
      weight: 38 + Math.min(opts.expiredQuotes, 10) * 3,
    });
  }

  return recs.sort((a, b) => b.weight - a.weight);
}

/**
 * 🤝 THE "LINK UP" DOOR FIRES ONLY WHEN SOMEBODY IS THERE TO LINK UP WITH (owner 2026-11-06: "cannot link until they
 * have served the same event"). `build_partnerships` routes to /vendor-dashboard/partnerships, whose propose list now
 * holds only the live shops this supplier has served a past event with (`lib/partners-you-served-with.server.ts`). With
 * nobody on that list the card would send them to an empty page — so it does not fire.
 *
 * A SEPARATE helper on purpose: `buildGrowthRecs` above keeps its own threshold (`partnership_count < 3`), and another
 * branch edits that function's lines — this one composes on top of it instead of reaching in.
 *
 * `eligiblePartners`: how many shops they may propose to; `null` = that read failed → the card stays as it was (the
 * partnerships page says the read failed itself — a refused read is never "nobody").
 */
export function withoutPartnershipRecWhenNobodyToLink(
  recs: GrowthRec[],
  eligiblePartners: number | null,
): GrowthRec[] {
  if (eligiblePartners === null || eligiblePartners > 0) return recs;
  return recs.filter((r) => r.key !== 'build_partnerships');
}
