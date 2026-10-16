import { use } from 'react';
import type { EventWords } from '../_lib/event-words';
import type { GiftPageContent } from '../pabuya/_lib/gift-cards';
import { GiftPageBody } from '../pabuya/_components/gift-page-body';
import { GiftDoorCard, giftDoorLine } from './guest-doorway-strip';

/**
 * 🏠 THE E-GIFTS CONTENT ON THE WELCOME PAGE (owner 2026-10-14, verbatim: *"on the invitation. the e-gifts is only a
 * button that opens the rest of egift. can't we just have it there instead of a button?"*).
 *
 * What the gift page shows below its title, drawn here by the SAME component (`GiftPageBody`) from the SAME reader
 * (`loadGiftPage`) — so the same people see exactly the same things, never more: a reader the event does not
 * recognise gets the ways to give without their numbers or QR codes, and the sentence that says why.
 *
 * `content` is started by the page (`site-body.tsx`) ONLY when the door would have been drawn —
 * `resolveGuestDoorways(...).pabuya`, the rule gated on what the gift page itself demands — so a guest whose event
 * has no E-Gifts sends nothing for it. It never rejects: a read that failed resolves to null, and the door stands
 * here instead — the page behind it says what went wrong. Never an empty block, never a guess.
 *
 * 🔪 THE CALM CUT: the ways to give in full (they are what a guest came for), the wish list at most
 * `WELCOME_WISH_LIMIT` long with "See all" opening the rest in place — the page stays light, and nothing leaves it.
 */
export const WELCOME_WISH_LIMIT = 3;

export function WelcomeGiftsContent({
  content,
  href,
  words,
  wishes = 0,
}: {
  content: Promise<GiftPageContent | null>;
  href: string;
  words: EventWords;
  wishes?: number;
}) {
  const read = use(content);
  if (!read) return <GiftDoorCard href={href} words={words} wishes={wishes} />;
  return (
    <>
      <p data-gift-lead="" className="text-sm text-ink/70">
        {giftDoorLine(words)}
      </p>
      <GiftPageBody content={read} wishLimit={WELCOME_WISH_LIMIT} />
    </>
  );
}
