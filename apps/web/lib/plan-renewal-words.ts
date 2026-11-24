/**
 * plan-renewal-words.ts — 🔁 DOES A SUPPLIER PLAN RENEW BY ITSELF? THE ONE SOURCE OF THE WORDS (owner 2026-11-24,
 * "make it true").
 *
 * TODAY a plan paid on the web (GCash / BDO) does NOT renew: the shop pays each month, a reminder comes 7 days before
 * the month ends, and skipping a payment lands it on Free. (Maya card saving — web plans renewing by themselves — is
 * ruled but not built: DECISION_LOG 2026-11-22 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH", the "Also" clause. When it
 * ships, THIS file is the one to change.)
 *
 * IN THE APP a plan bought through Apple is an AUTO-RENEWABLE subscription (lib/iap/supplier-plans.ts, owner-locked
 * 22 Nov): it renews each month until it is cancelled in Settings › Apple ID. That path is open only when the request's
 * Apple gate is open — the store app, a StoreKit build, and the owner's switch `NEXT_PUBLIC_APPLE_IAP_ENABLED`
 * (`getIapGate().iap`, lib/iap/iap-gate.ts). So every IN-APP line takes that answer and asks here; with the switch off
 * (today) every surface still says "Nothing renews by itself", and the day the owner turns it on the app's lines change
 * with it — no copy hunt.
 *
 * Web-only public pages (/llms.txt, /features, /help — whose in-app answer is HELP_NOT_IN_THE_APP) describe buying on
 * the web, so they use the web words (`NOTHING_RENEWS`) from here too. PURE.
 * 🔒 lib/public-lines-match-the-rulings.test.ts
 */

/** The web's words: a plan paid on the web never renews by itself. */
export const NOTHING_RENEWS = 'Nothing renews by itself';

/** The Apple words: a plan bought in the app through Apple renews monthly until it is cancelled there. */
export const APPLE_RENEWS = 'Renews each month through Apple';

/** For a web-wide page (/llms.txt) while the Apple switch is on: the app's plans DO renew, said as one sentence. */
export const APPLE_PLANS_RENEW_SENTENCE =
  'A plan bought in the iPhone app is an Apple subscription: it renews each month until it is cancelled in Settings › Apple ID.';

export type PlanRenewal = {
  /** True when a plan bought here renews by itself (an Apple subscription in the app). */
  renews: boolean;
  /** "Nothing renews by itself" / "Renews each month through Apple" — a title or the head of a line. */
  title: string;
  /** The same, lower-cased, for the middle of a line ("… · nothing renews by itself"). */
  inline: string;
  /** How to stop paying, said to a shop on a paid plan — the date first (L-7). */
  howToStop: (expiresOn: string | null) => string;
};

/**
 * The renewal words for THIS request. `appleSells` is `getIapGate().iap` — true only in the store app with the
 * switch on; everywhere else (the web, the desktop app, the app with the switch off) the web words.
 */
export function planRenewal(appleSells: boolean): PlanRenewal {
  if (appleSells) {
    return {
      renews: true,
      title: APPLE_RENEWS,
      inline: 'renews each month through Apple',
      // Leads with the date, like the web line (L-7: a long line at 390 px loses its end).
      howToStop: (expiresOn) =>
        expiresOn ? `Renews ${expiresOn} · cancel in Settings › Apple ID` : 'Cancel any time in Settings › Apple ID',
    };
  }
  return {
    renews: false,
    title: NOTHING_RENEWS,
    inline: 'nothing renews by itself',
    howToStop: (expiresOn) =>
      expiresOn ? `Free after ${expiresOn} if you skip the next payment` : 'Free once your paid days end, if you skip the next payment',
  };
}
