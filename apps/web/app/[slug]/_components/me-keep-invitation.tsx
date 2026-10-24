import { InfoTip } from '@/app/_components/info-tip';
import type { GuestAccountState } from '@/lib/guest-one-path';
import { SaveToAccount } from './save-to-account';

/** Me's first offer — the words (owner 2026-10-24). Details go in the ⓘ. */
export const ME_KEEP_TITLE = 'Keep this invitation';
export const ME_KEEP_LINE = 'Save it to your Setnayan account so it’s on every device.';
export const ME_KEEP_TIP = 'Keeps the photos of you, and opens this invitation on any phone — signed in, it is always here.';
export const ME_KEEP_SAVED = 'Saved to your account';

/**
 * 🪪 "KEEP THIS INVITATION" — THE FIRST THING ME OFFERS (owner 2026-10-24: *"on the me part, we start offering the
 * linking of this event to their account"*). Drawn right under Me's greeting (name · role · date · venues): one quiet
 * block — a title, one short line, the shipped Save (`SaveToAccount`: its method, its button and its Terms tick) —
 * the reason inside the ⓘ. Every state is the shipped one's:
 *
 *   offer · sign_in · link_this_seat · held_elsewhere   the block, around `SaveToAccount`'s own control or words;
 *   linked                                               one line, "✓ Saved to your account" — nothing to press;
 *   host_viewing                                         nothing here: Me's slim host bar says "Only they can save it"
 *                                                         in its ⓘ (`HeldPassLine` bar).
 *
 * ONE PLACE (DECISION_LOG 2026-10-03, "Save lives once, on Me"): on the redrawn Me, `GuestMe plain` draws no Save of
 * its own — `lib/me-offers-save-first.test.ts` holds it. No box on what is not pressed; theme tokens only.
 */
export function MeKeepInvitation(props: {
  state: GuestAccountState;
  eventId: string;
  slug: string;
  personalLink: string | null;
  userAgent: string | null;
  termsCarried: boolean;
  termsMissing?: boolean;
}) {
  const { state } = props;
  if (state.kind === 'host_viewing') return null;
  if (state.kind === 'linked') {
    return (
      <p data-me-save="linked" className="text-center text-sm text-ink/80">
        <span aria-hidden className="text-gild">✓ </span>
        {ME_KEEP_SAVED}
      </p>
    );
  }
  return (
    <section data-me-save={state.kind} className="space-y-3 text-center">
      <InfoTip label={ME_KEEP_TITLE} labelAs="h3" className="justify-center" labelClassName="font-pahina text-xl text-ink" ariaLabel="About keeping this invitation">
        {ME_KEEP_TIP}
      </InfoTip>
      <p className="text-sm text-ink/70">{ME_KEEP_LINE}</p>
      <div className="mx-auto max-w-md text-left">
        <SaveToAccount {...props} whyInTip />
      </div>
    </section>
  );
}
