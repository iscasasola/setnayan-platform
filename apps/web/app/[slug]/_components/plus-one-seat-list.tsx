/**
 * 🎟 THE +1 SEATS UNDER THE GUEST'S TICKET, AFTER SEND (owner 2026-10-25, RSVP seats-first: the after-Send pass step
 * of the approved prototype's scenarios B · C). Each seat the guest brings, in seat order: a named one with its own
 * ticket ("Ben Reyes · +1 — their own ticket"), a TBA one as "+2 · TBA — name them later". Words only — the tickets
 * themselves are saved by the one Save ABOVE it ("Save all tickets" — ticket → Save · Wallet → this list, the
 * owner-approved order, 2026-10-25), and a +1's Wallet pass comes from their own
 * link (decision 6). "+1 / +2" naming (decision 4). Drawn by `invite/enter` and by the lab's thank-you.
 */
export function PlusOneSeatList({
  seats,
  ticketed,
}: {
  /** The guest's +1 rows, oldest first (`plusOneSeatsFor`) — `name` null while TBA. */
  seats: readonly { guest_id: string; name: string | null }[];
  /** The seats that hold a ticket of their own (`plusOnePassCardIds`). */
  ticketed: ReadonlySet<string>;
}) {
  if (seats.length === 0) return null;
  return (
    <ul className="mx-auto w-[min(300px,100%)] text-left text-sm" aria-label="The seats you bring" data-landing-plus-one-seats="">
      {seats.map((s, i) => (
        <li key={s.guest_id} className="flex items-center justify-between gap-3 border-t border-ink/10 py-2.5 last:border-b">
          <span className={s.name ? 'truncate text-ink' : 'text-ink/70'}>{s.name ? `${s.name} · +${i + 1}` : `+${i + 1} · TBA`}</span>
          <span className="shrink-0 text-xs text-ink/70">{ticketed.has(s.guest_id) ? 'their own ticket' : 'name them later'}</span>
        </li>
      ))}
    </ul>
  );
}
