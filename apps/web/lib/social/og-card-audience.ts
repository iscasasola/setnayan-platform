/**
 * ST-9 · MAY A STRANGER FETCH THIS CELEBRATION'S SHARE CARD?
 *
 * ── THE LEAK THIS CLOSES (measured on production 2026-09-13) ────────────────
 * `/api/og/realstory-slug/[slug]` selected the event by slug with the ADMIN
 * client and never read `landing_page_visibility` at all. Its only redirect was
 * "no such event". So, unauthenticated:
 *
 *     papic-pool-test-simple-event   PRIVATE   → 200 image/jpeg 29,941 b
 *     zelda-ben                      unlisted  → 200 image/jpeg 22,026 b
 *     cale-ice                       public    → 200            (correct)
 *     qqqq-definitely-not-real-9931  —         → 302
 *
 * The card draws the monogram, the couple's NAMES, the exact DATE and
 * "INVITATION". `private` is the strictest setting a couple can choose, and the
 * card was served anyway — to anyone who guessed a slug, and slugs are guessable
 * from two first names.
 *
 * ── WHY THE ANSWER IS A REDIRECT AND NOT A 403 ─────────────────────────────
 * 200-versus-302 is an EXISTENCE ORACLE: it tells a stranger which celebrations
 * are real, and the image then tells them whose. A 403 would close the first
 * harm and keep the second — it still says "this one exists". So a sealed
 * celebration must be INDISTINGUISHABLE from a slug that was never registered:
 * the same 302 to the same brand image. The callers fold both into ONE branch
 * for that reason; two branches returning "the same" response drift apart.
 *
 * ── THE THREE-WAY RULE, AND WHAT IS DELIBERATE IN IT ───────────────────────
 *   public            → card renders
 *   unlisted          → card renders  ⚖ OWNER RULING 2026-09-13
 *   invited_accounts  → sealed
 *   private           → sealed
 *
 * ⚖ UNLISTED KEEPS RENDERING, and that is a ruling, not an oversight — owner,
 * 2026-09-13: "unlisted should still render the card". Unlisted means "not
 * indexed, but shareable by link": a couple who posts their own link to Facebook
 * wants the card to appear, and sealing it would break a feature they chose.
 * DO NOT "tidy" this to seal everything non-public — that is a product change
 * wearing a security fix's clothes.
 *
 * 🔑 THE ACCEPTED CONSEQUENCE, stated rather than engineered around: because
 * unlisted returns 200 while a missing slug returns 302, UNLISTED CELEBRATIONS
 * REMAIN ENUMERABLE, and their card carries names and date. The owner accepted
 * that trade knowingly — shareability over non-enumerability, for unlisted only.
 * It does not apply to private or invited_accounts, and the test file asserts
 * all four so neither half can be quietly moved.
 *
 * ── WHY `openToStrangers` AND NOT `=== 'private'` ──────────────────────────
 * `lib/event-visibility.ts` exists because an exclusion test over a growing set
 * admits every future member by default — its own docblock records that
 * `!== 'private'` once made `invited_accounts` "completely public everywhere,
 * instantly" across 31 call sites. Sealing only `private` here would have
 * repeated that exactly: **`invited_accounts` was leaking too, and no report of
 * this bug mentioned it.** The allow-list closes it, and closes whatever value
 * is added next until somebody opens it deliberately.
 *
 * ── WHY `resolveEffectiveVisibility` AND NOT THE RAW COLUMN ────────────────
 * A couple can schedule their launch. When that moment passes the column still
 * reads 'private' until something writes it, and `resolveEffectiveVisibility`
 * is what reports 'public' in the meantime — the same helper `/[slug]/recap`
 * already asks. Reading the raw column here would have sealed the card of every
 * couple whose launch time had arrived but whose row had not yet been flipped.
 */
import { openToStrangers } from '@/lib/event-visibility';
import { resolveEffectiveVisibility, type LaunchState } from '@/lib/launch-save-the-date';

/** The columns a caller must SELECT for this to answer honestly. */
export type OgCardAudienceFacts = LaunchState;

/**
 * `true` — render the card. `false` — the caller must return the SAME response
 * it returns for a slug that does not exist.
 *
 * Fails closed: an event we could not read at all is sealed, and
 * `normalizeVisibility` (inside `resolveEffectiveVisibility`) turns an
 * unrecognised column value into 'private' rather than letting it through.
 */
export function ogCardVisibleToStrangers(
  event: OgCardAudienceFacts | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!event) return false;
  return openToStrangers(resolveEffectiveVisibility(event, now));
}
