/**
 * lib/service-glance.ts — A PAID SERVICE AT A GLANCE: the one shape behind Home's
 * "Your services" row and a service page's top band (pure, no I/O).
 *
 * 🎨 Owner "approve all", 2026-10-14 (DECISION_LOG 🎨; prototype
 * `Setnayan/prototypes/papic_easy_home_and_band_2026-10-14_fable.html`): the
 * Home row and the Papic band are ONE object at two sizes — what is left and a
 * meter · Buy more · See N (the result) · one status line whose mood is in
 * WORDS and in a dot/meter colour (gold before the window, amber under 10%, red
 * at zero — never colour alone). The same shape, `{count, unit, mood, onFrom,
 * result}`, is the template for Setnayan AI, Live Watch, Music Maker and
 * Patiktok when each is mapped — ONLY Papic uses it today.
 */

/**
 * wait = before the window (gold) · ok = in it (green) · low = under 10% (amber) ·
 * gone = nothing left (red) · plain = no meter to draw (not measured / no pot).
 */
export type ServiceMood = 'wait' | 'ok' | 'low' | 'gone' | 'plain';

/** The status line, split so the count can be bold: `lead` + **strong** + `tail`. */
export type GlanceLine = { lead?: string; strong?: string; tail?: string };

export type ServiceGlance = {
  /** What is left (credits, minutes, …) — null when not measured. */
  count: number | null;
  /** What was bought in all — the meter's 100%. null when not measured. */
  total: number | null;
  /** The unit word, plural ("credits"). */
  unit: string;
  mood: ServiceMood;
  /** 0–100, what is left of what was bought (the meter's width). */
  pct: number;
  /** When the service switches on, in words — null when it has no date. */
  onFrom: string | null;
  /** What it has made so far (photos, …) — null when the count was refused. */
  result: number | null;
};
