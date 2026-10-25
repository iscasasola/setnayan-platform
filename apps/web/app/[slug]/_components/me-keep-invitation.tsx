import { AppleIcon, GoogleGIcon, oauthOfficialClass } from '@/app/_components/oauth-icons';
import { envFlagEnabled } from '@/lib/env-flag';
import { saveMethodFor, saveProvidersInOrder, type GuestAccountState } from '@/lib/guest-one-path';
import { OAUTH_VERB } from '@/lib/oauth-words';
import { SaveToAccount, SaveOfferHead, SAVE_OFFER_TIP } from './save-to-account';

/** Me's first offer — the owner's title (2026-10-24); the line and the ⓘ as option A draws them (2026-10-25). */
export const ME_KEEP_TITLE = 'Keep this invitation';
export const ME_KEEP_LINE = 'Your ticket and the photos of you, on every phone.';
export const ME_KEEP_TIP = SAVE_OFFER_TIP;
export const ME_KEEP_SAVED = 'Saved to your account';
/** The host's labelled preview (owner 2026-10-25: "there is no Save my account on me" — he was looking as the host). */
export const ME_KEEP_PREVIEW_LABEL = 'What your guests see';
export const ME_KEEP_PREVIEW_LINE = 'A preview — only the guest can save their own invitation.';

/**
 * 🪪 "KEEP THIS INVITATION" — THE FIRST THING ME OFFERS (owner 2026-10-24: *"on the me part, we start offering the
 * linking of this event to their account"*). Drawn right under Me's greeting (name · role · date · venues): one quiet
 * block — a title, one short line, the shipped Save (`SaveToAccount`: its method, its button and its Terms tick) —
 * the reason inside the ⓘ. Every state is the shipped one's:
 *
 *   offer · sign_in · link_this_seat · held_elsewhere   the block, around `SaveToAccount`'s own control or words;
 *   linked                                               one line, "✓ Saved to your account" — nothing to press;
 *   host_viewing                                         a LABELLED PREVIEW, "What your guests see" (owner
 *                                                         2026-10-25, viewing his own event: "there is no Save my
 *                                                         account on me"): the same head and the same official
 *                                                         buttons, drawn as pictures — no form, no link, no button —
 *                                                         so the host can check it and can never link a guest's seat
 *                                                         (the server refuses it as well: `seatBindRefusal` 'manager').
 *
 * ONE PLACE (DECISION_LOG 2026-10-03, "Save lives once, on Me"): on the redrawn Me, `GuestMe plain` draws no Save of
 * its own — `lib/me-offers-save-first.test.ts` holds it. No box on what is not pressed; theme tokens only.
 *
 * 🎟 ONE HEADING (option A, owner 2026-10-25): the head is option A's — the little picture of their ticket beside the
 * title, the one line, the ⓘ (`SaveOfferHead`) — and "Keep this invitation" is the ONLY heading in the block:
 * `SaveToAccount` is drawn `headless`, so its own heading never stacks a second title over the same buttons.
 */
export function MeKeepInvitation(props: {
  state: GuestAccountState;
  eventId: string;
  slug: string;
  personalLink: string | null;
  userAgent: string | null;
  termsCarried: boolean;
  termsMissing?: boolean;
  /** The couple's names (`events.display_name`), written on the little ticket. */
  ticketNames?: string | null;
}) {
  const { state } = props;
  if (state.kind === 'host_viewing') return <HostSavePreview userAgent={props.userAgent} names={props.ticketNames ?? null} />;
  if (state.kind === 'linked') {
    return (
      <p data-me-save="linked" className="text-center text-sm text-ink/80">
        <span aria-hidden className="text-gild">✓ </span>
        {ME_KEEP_SAVED}
      </p>
    );
  }
  return (
    <section data-me-save={state.kind} className="mx-auto max-w-md space-y-3">
      <SaveOfferHead
        title={ME_KEEP_TITLE}
        line={ME_KEEP_LINE}
        tip={ME_KEEP_TIP}
        tipLabel="About keeping this invitation"
        as="h3"
        names={props.ticketNames}
      />
      <SaveToAccount {...props} headless />
    </section>
  );
}

/**
 * 👁 THE HOST'S PREVIEW — what a guest's Me shows, labelled, and INERT by construction: the provider "buttons" are
 * `<span>`s in the official styles (the device's own filled, as the guest would see it), "Use my email instead" is
 * plain text, and there is no `<form>`, no `<a>`, no `<button>` but the ⓘ. Guarded by `me-offers-save-first.test.ts`.
 */
function HostSavePreview({ userAgent, names }: { userAgent: string | null; names: string | null }) {
  const providers = {
    apple: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED),
    google: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED),
  };
  const method = saveMethodFor(userAgent, providers);
  // The preview shows the buttons a phone in a real browser gets (an in-app browser would show "Open in your browser").
  const own = method === 'apple' || method === 'google' ? method : providers.google ? 'google' : providers.apple ? 'apple' : null;
  const order = own ? saveProvidersInOrder(own, providers) : [];
  return (
    <section data-me-save="host_preview" className="mx-auto max-w-md space-y-3">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-gild">{ME_KEEP_PREVIEW_LABEL}</p>
      <div className="space-y-3" data-save-preview="">
        <SaveOfferHead title={ME_KEEP_TITLE} line={ME_KEEP_LINE} tip={ME_KEEP_TIP} tipLabel="About keeping this invitation" as="h3" names={names} />
        {order.length > 0 ? (
          <div className="space-y-2.5">
            {order.map((m) => (
              <span key={m} className={oauthOfficialClass(m, m === own)} data-save-preview-provider={m}>
                {m === 'apple' ? <AppleIcon fill="currentColor" /> : <GoogleGIcon />}
                {`${OAUTH_VERB} ${m === 'apple' ? 'Apple' : 'Google'}`}
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-center text-xs text-ink/70 underline underline-offset-2">Use my email instead</p>
      </div>
      <p className="text-center text-xs text-ink/70">{ME_KEEP_PREVIEW_LINE}</p>
    </section>
  );
}
