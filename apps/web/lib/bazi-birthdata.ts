/**
 * BaZi birth-data capture flag (the Chinese-wedding date-check privacy capstone).
 *
 * BaZi (Four Pillars) date-checks need each partner's birth DATE and TIME OF
 * BIRTH. We capture them ONLY so the couple can hand them to a real date
 * specialist (the `date_fengshui_consultant` vendor leaf) and to derive a
 * harmless zodiac/element label — the app NEVER computes a compatibility/clash
 * verdict (Chinese_Wedding_Traditions_Reference_2026-06-28 §2.3, locked). Birth
 * time is sensitive personal data under RA 10173, so the whole capture is:
 *   - OPT-IN (an explicit consent checkbox per couple), and
 *   - flag-gated OFF by default so the live funnel is BYTE-IDENTICAL until the
 *     owner + DPO clear the flip.
 *
 * SHIPS DARK. Going live needs TWO actions the code can't take on its own:
 *   1. Apply migration <prefix>_events_partner_birth_data.sql
 *      (adds events.partner_a_birth_date / _time, partner_b_birth_date / _time,
 *      bazi_birthdata_consent_at).
 *   2. After DPO sign-off on the purpose notice + retention, set
 *      NEXT_PUBLIC_BAZI_BIRTHDATA_ENABLED=true.
 *
 * Triple gate to render OR write a birth field (all three required):
 *   baziBirthDataEnabled()  AND  isChineseWedding(event)  AND  consent ticked.
 *
 * With the flag OFF: no birth fields render, nothing new is written, and the
 * details form / export / deletion behave exactly as before.
 *
 * NEXT_PUBLIC_ so the details client form (which renders the section) and the
 * updateEventMatchCriteria server action (which guards the new columns) read the
 * SAME flag — one source of truth, no client/server drift. Inlined at build
 * time. Mirrors lib/experience-quiz.ts.
 *
 * Accept the canonical truthy spellings ('true' / '1' / 'on') so a deploy that
 * sets the var to '1' isn't silently a no-op; anything else (incl. unset) is OFF.
 */
export function baziBirthDataEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_BAZI_BIRTHDATA_ENABLED;
  return v === 'true' || v === '1' || v === 'on';
}
