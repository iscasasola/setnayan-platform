/**
 * Derives a compact 2–3 char monogram from the event's monogram_text (e.g.
 * "C&I") or, absent that, the initials of the event name ("Cale & Ice" → "C&I").
 * Purely presentational; never fabricates when there's nothing to show.
 *
 * Neutral module (no 'use client') on purpose: the event layout (a Server
 * Component) calls it to build the SwitcherPlaqueTrigger chip — exporting it
 * from a client module would hand the RSC a client-reference proxy, not a
 * function (the /admin/money `.find is not a function` class of crash, #3181).
 */
export function eventInitials(name: string, monogramText?: string | null): string {
  const m = (monogramText ?? '').trim();
  if (m) return m.slice(0, 3).toUpperCase();
  const parts = name
    .split(/\s*&\s*|\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const a = parts[0];
  const b = parts[1];
  if (a && b) return `${a[0]}&${b[0]}`.toUpperCase();
  return (a ?? name).slice(0, 2).toUpperCase();
}
