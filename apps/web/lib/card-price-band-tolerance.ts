/**
 * The owner's price tolerance for the service card check —
 * `platform_settings.card_price_band_tolerance` (migration 20271290013489).
 *
 * ⚖ Ruling (DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN", 2026-10-26):
 * "price BELOW the service's band only (admin-set tolerance in platform
 * settings, OFF until set — no guessed number)". So:
 *   · NULL in the database  → `{ ok: true, tolerance: null }` → the price check is OFF;
 *   · a fraction 0..1       → `{ ok: true, tolerance }`;
 *   · a refused read        → `{ ok: false }` — NEVER folded into "off". The
 *     check that asks treats it as "the check didn't finish" and HOLDS the card
 *     (fail-closed), because "we could not read the rule" is not "there is no
 *     rule".
 *
 * 🔑 READ ON ITS OWN, NOT THROUGH `fetchPlatformSettings`. That helper answers
 * a failed read with a FALLBACK row on purpose (checkout must not lose its
 * payment details); a fallback here would be a silent "off". Keeping the column
 * out of its shared SELECT also means a database that has not run the migration
 * yet fails only this read, never the checkout's.
 */

/** The narrow client shape this needs — any supabase-js client fits. */
type SettingsReader = {
  from: (table: 'platform_settings') => {
    select: (cols: 'card_price_band_tolerance') => {
      eq: (col: 'id', v: 1) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
};

export type ToleranceRead = { ok: true; tolerance: number | null } | { ok: false };

/** Parse the stored value. Out of range or not a number is a failed read, not "off". */
export function parseTolerance(raw: unknown): ToleranceRead {
  if (raw === null || raw === undefined) return { ok: true, tolerance: null };
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 1) return { ok: false };
  return { ok: true, tolerance: n };
}

export async function readCardPriceBandTolerance(client: unknown): Promise<ToleranceRead> {
  try {
    const { data, error } = await (client as SettingsReader)
      .from('platform_settings')
      .select('card_price_band_tolerance')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return { ok: false };
    return parseTolerance((data as { card_price_band_tolerance?: unknown }).card_price_band_tolerance);
  } catch {
    return { ok: false };
  }
}

/** The settings form's percent box → the stored fraction. Blank = OFF (null). */
export function percentToTolerance(raw: FormDataEntryValue | null): { ok: true; value: number | null } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  const t = raw.trim();
  if (t === '') return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false };
  return { ok: true, value: Math.round(n * 10) / 1000 };
}

/** The stored fraction → the percent the settings box shows. NULL shows blank. */
export function toleranceToPercent(t: number | null): string {
  if (t === null) return '';
  return String(Math.round(t * 1000) / 10);
}
