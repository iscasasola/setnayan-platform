/**
 * Reading a map pin off a form, once, correctly.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * Measured in production 2026-08-10. A test vendor walked the /open-shop wizard
 * without ever dropping a pin, and their shop was saved at:
 *
 *     hq_latitude = 0.0000000   hq_longitude = 0.0000000
 *
 * That is Null Island — open ocean in the Gulf of Guinea, about 500 km off
 * Ghana. Every distance filter in the app then measures from there: the shop is
 * ~10,000 km from any Philippine wedding, so it silently drops out of every
 * "near me" list while looking, on its own dashboard, completely fine.
 *
 * 🔑 THE CAUSE IS ONE LINE OF JAVASCRIPT, AND IT LOOKS CAREFUL:
 *
 *     const lat = Number(formData.get('hq_latitude'));
 *     if (Number.isFinite(lat) && Math.abs(lat) <= 90) { …write it… }
 *
 * `formData.get()` returns **null** for a field that was never submitted, and
 * `Number(null)` is **0**. Zero is finite. Zero is within ±90. So the guard
 * that exists precisely to reject bad coordinates waves the absent one through
 * and writes it to the database. `Number('')` is 0 as well, so an empty box does
 * the same thing.
 *
 * 🪤 AND THIS IS THE FOURTH COSTUME OF THE HOUSE DISEASE: nothing threw,
 * nothing logged, CI stayed green, and the only symptom was an absence — a shop
 * quietly missing from lists it should have been in. Same shape as the phantom
 * column, the phantom enum value, the phantom RPC argument and the blocked
 * iframe. The wrong value here is not garbage; it is a *plausible* number.
 *
 * ── WHY IT IS SHARED ────────────────────────────────────────────────────────
 * There were already THREE hand-written copies of this parser in the app. Two
 * were correct — they string-check and reject blanks — and the third was the one
 * the wizard used. Three copies of a rule, one of them wrong, is how a fix
 * reaches some screens and not others; a rule that lives in one tested place
 * cannot drift out of agreement with itself.
 */

/** One coordinate, or null when the field is absent, blank, or out of range. */
export function parseCoord(raw: unknown, absMax: number): number | null {
  // Deliberately NOT `Number(raw)`. The whole defect is that `Number` maps both
  // `null` and `''` onto a real, in-range 0 — so the string check has to happen
  // before any coercion, not inside the range test after it.
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || Math.abs(n) > absMax) return null;
  return n;
}

/**
 * A latitude/longitude PAIR from a form, or null when there is no usable pin.
 *
 * Prefer this over two `parseCoord` calls: a pin is one fact, and half of one is
 * not a location. Writing a latitude without its longitude puts a business on
 * the Greenwich meridian.
 */
export function parseCoordPair(
  latRaw: unknown,
  lngRaw: unknown,
): { lat: number; lng: number } | null {
  const lat = parseCoord(latRaw, 90);
  const lng = parseCoord(lngRaw, 180);
  if (lat === null || lng === null) return null;
  // ── THE NULL ISLAND BACKSTOP ──────────────────────────────────────────────
  // Rejected as a PAIR, never as single values: latitude 0 is the equator and
  // longitude 0 is the Greenwich meridian, and both are real places people
  // live. It is only the two together that is a tell — 0,0 is open water, so
  // any row holding it is the residue of an absent value, not a pin somebody
  // dropped.
  //
  // The string check above already stops the way we produced it. This stays
  // because it is not the only way to produce it: any future arithmetic slip
  // that yields 0 lands here too, and this is the layer that can still say no.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}
