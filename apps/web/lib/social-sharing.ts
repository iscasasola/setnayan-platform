/**
 * apps/web/lib/social-sharing.ts
 *
 * Social Sharing & Featuring Program helpers (canonical: corpus
 * `03_Strategy/Social_Sharing_Program_2026-06-12.md` + DECISION_LOG
 * 2026-06-12 row · schema substrate 20261203000000_social_sharing_program).
 *
 * Three program legs share this file:
 *   1. Couple creations — per-artifact `marketing_share_consents` rows; the
 *      publish gate below decides when a consented artifact becomes postable.
 *   2. Vendor verification features — unnamed (Free) vs named (Pro+) caption
 *      drafting for the admin Social Queue.
 *   3. Greetings — the queue panel renders birthdays/anniversaries itself;
 *      no helper needed here (render-only in V1).
 *
 * All posting is MANUAL (Setnayan Team copies the drafted caption to the
 * Facebook page) — no Graph API, no crons ([[project_setnayan_cron_free]]).
 */

export type ShareArtifactType =
  | 'monogram'
  | 'save_the_date'
  | 'website'
  | 'reel'
  | 'led_design';

export type ShareCreditMode = 'first_names' | 'anonymous';

/** Customer-facing labels for the consent artifact types. */
export const SHARE_ARTIFACT_LABEL: Record<ShareArtifactType, string> = {
  monogram: 'Monogram',
  save_the_date: 'Save the Date',
  website: 'Wedding website',
  reel: 'Reel',
  led_design: 'LED design',
};

/**
 * The publish gate — APP-SIDE on purpose (no review-window column exists).
 * A consented artifact is postable once `event_date + 7 days` is in the
 * past: never before the event (spoilers + empty-house safety), and the
 * 7-day buffer mirrors the couple's gallery review-window doctrine so a
 * post can't land while the couple is still curating. NULL event_date =
 * never postable (the queue keeps it in "waiting" until a date is set).
 */
export function shareConsentPublishGatePassed(eventDate: string | null): boolean {
  if (!eventDate) return false;
  const event = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(event.getTime())) return false;
  const gate = new Date(event.getTime() + 7 * 86_400_000);
  return gate.getTime() < Date.now();
}

/** "posts after {event_date + 7d}" display date for the waiting list. */
export function shareConsentPostableFrom(eventDate: string | null): string | null {
  if (!eventDate) return null;
  const event = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(event.getTime())) return null;
  return new Date(event.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Drafted Facebook caption for a couple-creation feature. Warm brand voice,
 * ≤2 hashtags (no hashtag spam). The team edits freely before posting —
 * this is a starting draft, not locked copy.
 */
export function coupleCreationCaption({
  artifactType,
  creditMode,
  coupleName,
}: {
  artifactType: ShareArtifactType;
  creditMode: ShareCreditMode;
  coupleName: string;
}): string {
  const credit =
    creditMode === 'first_names' && coupleName.trim().length > 0
      ? coupleName.trim()
      : 'one of our Setnayan couples';
  const lead: Record<ShareArtifactType, string> = {
    monogram: `This monogram belongs to ${credit} — designed on Setnayan, now part of their story.`,
    save_the_date: `${credit} said "Save the Date" in style — made on Setnayan, straight to every feed.`,
    website: `A wedding website made by ${credit} on Setnayan — every detail, one beautiful page.`,
    reel: `A little reel of love from ${credit}'s big day — made with Setnayan.`,
    led_design: `The LED wall at ${credit}'s celebration — designed on Setnayan, glowing all night.`,
  };
  return `${lead[artifactType]} Set na 'yan. ✨\n\n#Setnayan #SetNaYan`;
}

/**
 * Drafted Facebook caption for a newly verified vendor. The unnamed-vs-named
 * split is the owner-locked hybrid (tiers sell REACH; mirrors the
 * hybrid-anonymity doctrine): Free gets a category-only mention, Pro+ gets
 * the business name + a welcome line.
 */
export function vendorFeatureCaption({
  named,
  businessName,
  categoryLabel,
  region,
}: {
  named: boolean;
  businessName: string;
  categoryLabel: string;
  region: string;
}): string {
  if (named && businessName.trim().length > 0) {
    return (
      `Welcome to the marketplace, ${businessName.trim()}! 🎉 ` +
      `A newly verified ${categoryLabel.toLowerCase()} serving ${region} — ` +
      `vetted by the Setnayan team and ready for your big day.\n\n#Setnayan #SetNaYan`
    );
  }
  return (
    `A new ${categoryLabel.toLowerCase()} in ${region} just got verified ✅ — ` +
    `the Setnayan vendor marketplace keeps growing.\n\n#Setnayan #SetNaYan`
  );
}
