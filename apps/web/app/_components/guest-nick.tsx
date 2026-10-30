/**
 * 💬 A GUEST'S NICKNAME, BESIDE THEIR FULL NAME — muted, in quotes (owner, Guests prototype v24: "the full name … with
 * the nickname beside it"). `nick` comes from `guestNameWithNick` / `guestNickBeside` (lib/guests.ts); null draws
 * nothing. The quote moves to the next line whole when it can (inline-block), and wraps inside itself only when it is
 * longer than the line — never cut, never an ellipsis.
 */
import React from 'react';

export function GuestNick({ nick }: { nick: string | null | undefined }) {
  if (!nick) return null;
  return (
    <>
      {' '}
      <span data-guest-nick="" className="inline-block max-w-full font-normal text-ink/55 [overflow-wrap:anywhere]">
        “{nick}”
      </span>
    </>
  );
}
