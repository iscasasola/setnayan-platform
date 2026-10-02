
// Guest-row helpers — PURE (no 'server-only', no DB/email runtime imports), so
// unit-testable under `tsx --test`. Shared by the guest reminder emails
// (`guest-reminder-emails.ts`, switched off for guests).
//
// 📵 The Save-the-Date and Invitation guest EMAILS that used to live here — and
// their fan-out in `save-the-date-emails.ts` — are REMOVED (owner 2026-09-29
// "No email. Either use the qr and link only", extended to the save-the-date
// fan-out 2026-10-02). The shared link and QR are the whole delivery; no
// builder remains for anything to call.

export type StdGuestRow = {
  guest_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
};

/** A guest's first name for greeting, falling back gracefully. Pure. */
export function stdGuestGreetingName(g: StdGuestRow): string {
  const display = (g.display_name ?? '').trim();
  if (display) return display.split(/\s+/)[0] ?? display;
  return (g.first_name ?? '').trim();
}

/** Whether a guest email is shaped well enough to attempt a send. Pure. */
export function isSendableEmail(email: string | null | undefined): boolean {
  const e = (email ?? '').trim();
  // Minimal shape check — an @ with a dotted domain. The send provider does the
  // real validation; this just skips obvious junk + blanks.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Human wedding date line, e.g. "Saturday, December 12, 2026". Pure. */
export function formatWeddingDate(weddingDateIso: string | null): string | null {
  if (!weddingDateIso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(weddingDateIso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Resolve the couple's display name for the email from the event row, with the
 * same fallback chain used on the public page (display_name → bride & groom →
 * a neutral default). Pure.
 */
export function resolveCoupleName(ev: {
  display_name: string | null;
  bride_name: string | null;
  groom_name: string | null;
}): string {
  const display = (ev.display_name ?? '').trim();
  if (display) return display;
  const pair = [ev.bride_name, ev.groom_name]
    .map((n) => (n ?? '').trim())
    .filter(Boolean)
    .join(' & ');
  return pair || 'Our wedding';
}
