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

// ⛔ 'led_design' was removed 2026-08-11 with the LED wall backdrop itself.
// Setnayan does not make an LED design, so it cannot feature one — the caption
// ("The LED wall at …'s celebration — designed on Setnayan") was still drafted
// and still wired to the posting queue, so the claim could have reached the
// public feed. Verified 0 rows of that type in prod before narrowing this.
// ⚠ The DATABASE CHECK on marketing_share_consents.artifact_type still permits
// the value; that is deliberate. A CHECK that permits a value nothing can
// produce is inert, whereas narrowing it is a live-data migration for no gain.
// ⛔ 'reel' was removed 2026-11-27 (content finalization S7): the reel booth
// (Patiktok) retired 2026-11-20, so a caption crediting a reel "made with
// Setnayan" claimed a product that no longer ships. Verified 0 rows of that
// type in prod before narrowing. Same DB CHECK note as 'led_design' above.
export const SHARE_ARTIFACT_TYPES = ['monogram', 'save_the_date', 'website'] as const;
export type ShareArtifactType = (typeof SHARE_ARTIFACT_TYPES)[number];

export type ShareCreditMode = 'first_names' | 'anonymous';

/** Customer-facing labels for the consent artifact types. */
export const SHARE_ARTIFACT_LABEL: Record<ShareArtifactType, string> = {
  monogram: 'Logo',
  save_the_date: 'Save the Date',
  website: 'Event Hub',
};

/** Days after the event before a consented couple creation may be posted (the publish gate below). */
export const SHARE_PUBLISH_GATE_DAYS = 7;

/** Hours a queued couple-creation post is held so the team or couple can pull it. */
export const SHARE_PULL_WINDOW_HOURS = 48;

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
  const gate = new Date(event.getTime() + SHARE_PUBLISH_GATE_DAYS * 86_400_000);
  return gate.getTime() < Date.now();
}

/** "posts after {event_date + 7d}" display date for the waiting list. */
export function shareConsentPostableFrom(eventDate: string | null): string | null {
  if (!eventDate) return null;
  const event = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(event.getTime())) return null;
  return new Date(event.getTime() + SHARE_PUBLISH_GATE_DAYS * 86_400_000).toISOString().slice(0, 10);
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
      : 'one of our Setnayan hosts';
  const lead: Record<ShareArtifactType, string> = {
    monogram: `This logo belongs to ${credit}, made with Logo Maker on Setnayan.`,
    save_the_date: `${credit} said "Save the Date" in style — made on Setnayan, straight to every feed.`,
    website: `An Event Hub made by ${credit} on Setnayan — every detail, one beautiful page.`,
  };
  return `${lead[artifactType]} Set na 'yan. ✨\n\n#Setnayan #SetNaYan`;
}

/**
 * Drafted Facebook caption for a newly verified supplier. The unnamed-vs-named
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
      `Welcome to Setnayan, ${businessName.trim()}! ` +
      `A newly verified ${categoryLabel.toLowerCase()} serving ${region}. ` +
      `Set na 'yan.\n\n#Setnayan #SetNaYan`
    );
  }
  return (
    `A new ${categoryLabel.toLowerCase()} in ${region} just got verified ✅ — ` +
    `the Setnayan supplier marketplace keeps growing.\n\n#Setnayan #SetNaYan`
  );
}
