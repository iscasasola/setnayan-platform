// Shared time-slot options + date-window helpers for scheduling a meeting from
// chat (negotiation Phase 1). Owner 2026-07-24: a meeting must fall between
// today and the day BEFORE the event, and the picker offers time OPTIONS (not a
// raw datetime). Pure module — safe on client + server.

/** 8:00 AM → 8:00 PM in 30-minute slots. value = "HH:MM" (24h), label = 12h. */
export const TIME_SLOTS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const ap = h < 12 ? 'AM' : 'PM';
      const h12 = ((h + 11) % 12) + 1;
      out.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${ap}` });
    }
  }
  return out;
})();

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd for a Date in LOCAL time (for the client date input default). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today (client local) as yyyy-mm-dd — the min a meeting date may be. */
export function todayIsoLocal(): string {
  return isoDate(new Date());
}

/** The day BEFORE the event (yyyy-mm-dd) — the max a meeting date may be. Null
 *  when the event has no date (then only the "not in the past" min applies). */
export function dayBeforeEventIso(eventDate: string | null | undefined): string | null {
  if (!eventDate) return null;
  const d = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 1);
  return isoDate(d);
}
