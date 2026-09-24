/**
 * onboarding-hub-pro.ts — the PURE decisions behind the third card on the
 * onboarding services step: Event Hub Pro (`COUPLE_WEBSITE_PRO`).
 *
 * ⚖ Owner, 2026-09-25: *"so now on the onboarding also, there are 3 things they
 * can purchase Papic, Setnayan AI, Event Hub Pro."*
 *
 * Modelled on the Setnayan AI card, and deliberately nothing more: a yes/no that
 * adds to the running total and is minted as one more line on the SAME
 * onboarding bill. It asks and never blocks — the event is committed first and a
 * refused line simply is not charged (lib/onboarding-services-orders.ts).
 *
 * ── WHY THIS IS ITS OWN MODULE ─────────────────────────────────────────────
 * The mint lives behind `import 'server-only'`, which throws under the unit
 * runner, so its decisions could only ever be pinned by reading its source. The
 * three questions that decide whether Pro is billed are pulled out here as
 * plain functions of already-measured inputs, and the mint calls them. Nothing
 * here reads a database, and nothing here holds a price.
 *
 * ⛔ NO FIGURE, AND NO COPY OF ITS OWN. The price is the catalog row
 * (`platform_retail_catalog_v2`, priced through `setupPricePhp` exactly like the
 * Papic rungs), and the words are the existing Event Hub PRO offer copy
 * (`addOnHeroCopy('website-pro')`, the sentence the Pro buy page already opens
 * with). This file only decides how that one sentence is laid out.
 */

/**
 * Split the existing Pro offer sentence into a headline and its detail.
 *
 * The catalog blurb reads "<what it is> — <what it adds>." The card shows the
 * first half as its title and hides the list behind the house `(i)`, so the step
 * stays short. A blurb with no dash is shown whole as the headline with nothing
 * behind the `(i)` — never a half-sentence, never invented filler.
 */
export function splitProOffer(blurb: string): { headline: string; detail: string | null } {
  const text = blurb.trim();
  const at = text.indexOf(' — ');
  if (at <= 0) return { headline: text, detail: null };
  const head = text.slice(0, at).trim();
  const tail = text.slice(at + 3).trim();
  if (!head || !tail) return { headline: text, detail: null };
  return {
    headline: /[.!?]$/.test(head) ? head : `${head}.`,
    detail: tail.charAt(0).toUpperCase() + tail.slice(1),
  };
}

/**
 * Does this event type get the card at all? Only when the type has the Event Hub
 * (`website` surface — the same `surfaceEnabled(profile, 'website')` the
 * dashboard's Launch row reads) AND the catalog gave a real, positive price.
 * Selling the upgrade to a hub that does not exist is a fake door; quoting it at
 * ₱0 reads as free.
 */
export function hubProOffered(input: {
  websiteEnabled: boolean;
  pricePhp: number | null | undefined;
}): boolean {
  const p = input.pricePhp;
  return (
    input.websiteEnabled === true && typeof p === 'number' && Number.isFinite(p) && p > 0
  );
}

/**
 * The bill line for Event Hub Pro, or null — decided at MINT time, on the
 * server, against the freshly-committed event.
 *
 * Every input is re-measured there, never taken from the browser:
 *   • `selected`       — the couple ticked it (the only thing the client decides)
 *   • `websiteEnabled` — the event's STORED type has an Event Hub
 *   • `alreadyOwned`   — the event already owns or has Pro active (an internal
 *                        or founder-seat host, a comp grant, an earlier order).
 *                        🔑 Never sold twice: an owner is charged nothing.
 *   • `unitPhp`        — the active catalog row's sign-up price, or null
 */
export function hubProBillLine(input: {
  selected: boolean;
  websiteEnabled: boolean;
  alreadyOwned: boolean;
  unitPhp: number | null;
}): { quantity: 1; unitPhp: number } | null {
  if (!input.selected) return null;
  if (input.alreadyOwned) return null;
  if (!hubProOffered({ websiteEnabled: input.websiteEnabled, pricePhp: input.unitPhp })) {
    return null;
  }
  return { quantity: 1, unitPhp: input.unitPhp as number };
}
