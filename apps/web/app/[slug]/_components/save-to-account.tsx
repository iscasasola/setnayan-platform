import Link from 'next/link';
import type { ReactNode } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { ProviderButton } from './provider-button';
import { envFlagEnabled } from '@/lib/env-flag';
import {
  saveMethodFor,
  saveMethodLine,
  saveMethodSignsIn,
  saveProvidersInOrder,
  type GuestAccountState,
  type SaveMethod,
} from '@/lib/guest-one-path';
import { INVITE_RETURN } from '@/lib/invite-arrival';
import { COUPLE_SEAT_REFUSED, SEAT_HELD_ELSEWHERE, hostViewingLine, seatConfirmLine } from '@/lib/seat-binding';
import { startAccountSaveAction, linkThisSeatAction } from '../actions';
import { CopyMyLink, OpenInBrowser } from './copy-my-link';
import { ProviderStall } from './provider-stall';
import { NativeSaveForm } from './native-save-form';
import { AppleOnTouch } from './apple-on-touch';
import { mightBeIpadSafari } from '@/lib/apple-device';
import { TermsTick } from './terms-tick';
import { ConnectHostsTickFor } from './connect-hosts-tick';
import {
  NATIVE_SAVE_FIELD,
  saveSignsInNatively,
  type NativeSaveHandOff,
  type WebFormAction,
} from '@/lib/native-account-save';

/**
 * "SAVE TO MY ACCOUNT" — reachable from the thank-you, Me, and on the day (owner 2026-09-27).
 *
 * 🍏🤖 BOTH PROVIDERS, WHEN BOTH ARE ON (owner 2026-10-25 — asked "Do you want to keep it that way, or show both
 * Apple and Google buttons to everyone?", answered verbatim: "Show both"). This REVERSES "THE GUEST PATHWAY — ONE
 * BUTTON AT A TIME" (2026-09-26) FOR THIS OFFER ONLY. With Apple AND Google switched on, two buttons draw, same size:
 * the device's own (`saveMethodFor`) first as the primary, the other under it as the house secondary
 * (`saveProvidersInOrder`); each posts its own provider and the action opens the one PRESSED
 * (`saveMethodFromForm`, which refuses a provider that is off). One provider on → that one button. None → "Copy my
 * link". "Use my email instead" stays under them.
 *
 *   offer          → the device's method (`saveMethodFor`):
 *                      iPhone / iPad → Apple · Android / desktop → Google — both
 *                      posted to `startAccountSaveAction`, which takes the
 *                      Terms tick and returns through `/join/{eventId}/connect`
 *                      (binds this seat to the account and opens the event);
 *                      in-app webview → "Open in your browser" (`OpenInBrowser`,
 *                      prototype guest_ticket_flow_2026-09-29.html frame F);
 *                      no provider switched on → "Copy my link";
 *   link_this_seat → signed in already, seat free → one press binds it;
 *   sign_in        → the seat is kept in an account this browser is not signed
 *                    in to → one "Sign in" link;
 *   linked         → "Saved to your account ✓";
 *   held_elsewhere → said plainly, never re-bound;
 *   host_viewing   → a host / co-host / coordinator / helper on a guest's seat:
 *                    "You're viewing <name>'s invitation as the host." — no press.
 *
 * 📱 INSIDE THE PHONE APP (a build carrying `SetnayanSignIn/1`, 2026-10-04) the
 * same press — whichever provider was pressed — posts the same action, but through `NativeSaveForm`: the action
 * hands back `{ native, next }` instead of redirecting to the provider, and the
 * app's NATIVE sign-in runs (the Apple sheet · Google in the system browser) —
 * so the account lands in the app, not in Safari. Same `next`, same linking
 * path (lib/native-account-save.ts). The web and the desktop app are unchanged.
 *
 * 📵 NO EMAIL IS SENT FROM IT (owner 2026-09-29, DECISION_LOG "NO EMAIL TO
 * GUESTS — THE QR AND THE LINK DO EVERYTHING"). (The quiet "Use my email
 * instead" link of 2026-10-25 signs in WITH an email address; it sends none.)
 * The webview arm used to email a
 * sign-in link, and a guest without an address was asked for one here. Both
 * are gone: inside Messenger the button copies the guest's own link and says
 * how to paste it into Safari or Chrome, where Apple / Google is one tap.
 *
 * 🔒 THE TERMS. The guest ticked them on the RSVP page a screen earlier; that
 * agreement travels in a server-set cookie (`RSVP_TERMS_COOKIE`). When it is
 * NOT carried (a decliner, or a cookie that expired) the tick is asked here,
 * unticked, in the SAME form as the button — the action sets the cookie before
 * it hands over to the provider, so the tick survives the round trip.
 */
export function SaveToAccount({
  state,
  eventId,
  slug,
  personalLink,
  userAgent,
  termsCarried,
  termsMissing = false,
  carries = null,
  through,
  whyInTip = false,
}: {
  /** 🪪 Me's "Keep this invitation" (owner 2026-10-24): the reason is said in that block's ⓘ — not again under the button. */
  whyInTip?: boolean;
  state: GuestAccountState;
  eventId: string;
  slug: string;
  /** This guest's OWN invitation link (`buildInvitationUrl`) — what "Open in
   *  your browser" / "Copy my link" hands them. Null → those arms draw nothing. */
  personalLink: string | null;
  userAgent: string | null;
  termsCarried: boolean;
  /** The last press came back because the Terms were not ticked (`?keep=terms`). */
  termsMissing?: boolean;
  /** What comes along, said after the method (frame A: "your name, mobile, meal and your guests come along"). */
  carries?: string | null;
  /**
   * 👋 THE PLUS-ONE'S OWN DOOR (owner 2026-09-29, frame F: *"One button: Save
   * to my account; his answers save with it"*). In the `offer` state the ONE
   * button posts `action` instead — the door's own save, which writes the
   * answers in `fields` and the Terms tick, THEN takes the device's method
   * (the same `saveMethodFor`, re-decided on the server). With no provider to
   * take (an in-app browser), the door's button is a plain Save and the link
   * is handed over under it. `after` is drawn inside the same form, under the
   * button ("Not now"). Every other state renders exactly as without it.
   */
  through?: {
    action: (formData: FormData) => Promise<void | NativeSaveHandOff>;
    fields: ReactNode;
    after?: ReactNode;
  };
}) {
  if (state.kind === 'linked') {
    return (
      <p className="text-sm text-ink/80">
        <span aria-hidden className="text-gild">✓ </span>
        Saved to your account{state.accountEmail ? <> · {state.accountEmail}</> : null}
      </p>
    );
  }
  if (state.kind === 'held_elsewhere') {
    return (
      <div className="space-y-1" data-account-state="held_elsewhere">
        <p className="text-sm font-semibold text-ink">{SEAT_HELD_ELSEWHERE.heading}</p>
        <p className="text-sm text-ink/70">{SEAT_HELD_ELSEWHERE.line}</p>
      </div>
    );
  }
  if (state.kind === 'host_viewing') {
    // 🔒 A HOST LOOKING AT A GUEST'S INVITATION (owner 2026-10-21): one quiet line, nothing to press. The server
    // refuses the bind as well (`seatBindRefusal` → 'manager' in lib/link-guest-account.ts).
    return (
      <p className="text-sm text-ink/70" data-account-state="host_viewing">
        {hostViewingLine(state.seatName)}
      </p>
    );
  }
  if (state.kind === 'sign_in') {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/join/${eventId}/connect`)}`}
        className="button-primary flex min-h-[56px] w-full flex-col items-center justify-center"
      >
        Sign in to your account
      </Link>
    );
  }
  if (state.kind === 'link_this_seat') {
    // 🔒 A couple seat is kept only by the couple's own accounts — no press.
    if (state.coupleSeat) {
      return <p className="text-sm text-ink/70">{COUPLE_SEAT_REFUSED}</p>;
    }
    // 🔒 ASKED, NOT ASSUMED (2026-09-30): whose invitation, and which account.
    const line = seatConfirmLine({ seatName: state.seatName, accountEmail: state.accountEmail });
    return (
      <form action={linkThisSeatAction.bind(null, eventId)} className="space-y-2" data-seat-confirm="">
        <p className="text-sm text-ink/80">
          {line.whose} {line.where}
        </p>
        <ConnectHostsTickFor eventId={eventId} />
        <SubmitButton className="button-primary min-h-[56px] w-full" pendingLabel="Saving…">
          Yes, save to my account
        </SubmitButton>
      </form>
    );
  }

  // offer — the device's method decides the ORDER of the provider buttons (`offerFor`).
  const providers = {
    apple: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED),
    google: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED),
  };
  const method: SaveMethod = saveMethodFor(userAgent, providers);
  /* 🍎 iPAD SAFARI READS AS A MAC HERE (its user-agent says Macintosh — measured
     2026-10-19), so the server's pick for it is Google. The browser can tell:
     the Apple block is drawn too, and an Apple touch device swaps to it after
     mount (`AppleOnTouch`). The iPad APP is already Apple above — its marker
     reaches the server (lib/apple-device.ts). With both providers on (2026-10-25)
     the swap only changes the ORDER: both blocks hold both buttons. */
  if (method === 'google' && providers.apple && mightBeIpadSafari(userAgent)) {
    return <AppleOnTouch web={offerFor(method)} apple={offerFor('apple')} />;
  }
  return offerFor(method);

  function offerFor(method: SaveMethod) {
    const signsIn = saveMethodSignsIn(method);
    // 📱 The phone app's native sign-in — the one gate /login uses (oauthGate).
    const native = signsIn && saveSignsInNatively(userAgent, providers);
    const nativeField = native ? <input type="hidden" name={NATIVE_SAVE_FIELD} value="1" /> : null;
    const handOver =
      !signsIn && personalLink ? (
        method === 'browser' ? <OpenInBrowser link={personalLink} /> : <CopyMyLink link={personalLink} />
      ) : null;
    const termsTick = <TermsTick />;
    /* 🍏🤖 THE PROVIDER BUTTONS (owner 2026-10-25, "Show both"): the device's method first — the primary, exactly the
       shipped button — and, when the other provider is on too, the other one under it: same size, the house
       secondary. Each button posts its OWN provider (`ProviderButton` → `SAVE_METHOD_FIELD`), so the action opens
       the provider the guest pressed and no other (`saveMethodFromForm`, lib/guest-one-path.ts). */
    const order = saveProvidersInOrder(method, providers);
    const button = (
      <>
        {order.map((m, i) => (
          <ProviderButton
            key={m}
            method={m}
            /* Same size: the secondary's 1 px border is taken out of its padding (9 px, not 10), so both are 62 px. */
            className={`${i === 0 ? 'button-primary py-2.5' : 'button-secondary py-[9px]'} flex h-auto min-h-[56px] w-full flex-col items-center justify-center gap-0.5`}
            pendingLabel={m === 'apple' ? 'Opening Apple…' : 'Opening Google…'}
            /* No full-screen veil: the press leaves for the provider's site, whose page
               has no loader of ours to take the veil down — a stalled or abandoned
               sign-in left the whole screen covered (owner's live test 2026-10-02). */
            overlay={false}
            data-save-provider={m}
          >
            <span className="text-base">Save to my account</span>
            <span className="text-xs font-normal">
              {saveMethodLine(m)}
              {carries && i === 0 ? ` — ${carries}` : null}
            </span>
          </ProviderButton>
        ))}
      </>
    );
    // The way back when the provider does not open (`ProviderStall` names the one PRESSED).
    const stall = signsIn ? <ProviderStall provider={method === 'apple' ? 'Apple' : 'Google'} /> : null;
    const refused = termsMissing ? (
      <p role="alert" className="text-sm text-terracotta-700">
        Tick the Terms first — saving makes a Setnayan account.
      </p>
    ) : null;
    // The reason, said once and only as wide as what ships: on the day this page
    // shows each guest the photos they are in, and the account — not the pass in
    // this browser — is what opens the event again later (`findGuestSeatForUser`).
    const why = whyInTip ? null : (
      <p className="text-center text-xs text-ink/70">
        Keeps the photos of you, and opens this invitation on any phone.
      </p>
    );
    if (through) {
      return (
        <div className="space-y-2" data-save-method={method} data-save-through>
          {refused}
          {native ? (
            <NativeSaveForm action={through.action} className="space-y-4">
              {through.fields}
              {termsCarried ? null : termsTick}
              {nativeField}
              {button}
              {stall}
              {through.after}
            </NativeSaveForm>
          ) : (
            <form action={through.action as WebFormAction} className="space-y-4">
              {through.fields}
              {signsIn && !termsCarried ? termsTick : null}
              {signsIn ? (
                <>
                  {button}
                  {stall}
                </>
              ) : (
                <SubmitButton name="then" value="done" className="button-primary h-14 w-full text-base" pendingLabel="Saving…">
                  Save
                </SubmitButton>
              )}
              {through.after}
            </form>
          )}
          {handOver}
          {signsIn ? why : null}
        </div>
      );
    }
    if (!signsIn) {
      return handOver ? (
        <div className="space-y-2" data-save-method={method}>
          {handOver}
        </div>
      ) : null;
    }
    const returnTo = <input type="hidden" name="return_to" value={INVITE_RETURN} />;
    /* ✉️ "USE MY EMAIL INSTEAD" (owner 2026-10-25, "If you have recommendation that
       follow our design go for it"). One quiet text link under the provider button(s) for a
       guest without Apple / Google to hand: the SHIPPED email sign-in (/login, whose
       card links to /signup with the same `next`) returning to the SAME place the
       button does — `/join/{eventId}/connect`, the seat-binding door, exactly as the
       `sign_in` state above. No new auth, and 📵 no email is SENT by this: password
       sign-in sends nothing, and an event sign-up gets no welcome email
       (`welcomeEmailKind` → null for `isEventSignup`). A text link, not a frame —
       the provider buttons stay the main action. Guarded by `use-my-email-instead.test.ts`. */
    const emailInstead = (
      <p className="text-center">
        <Link
          href={`/login?next=${encodeURIComponent(`/join/${eventId}/connect`)}`}
          className="inline-flex min-h-[44px] items-center text-xs text-ink/70 underline underline-offset-2 hover:text-ink"
          data-save-email-instead=""
        >
          Use my email instead
        </Link>
      </p>
    );
    return (
      <div className="space-y-2" data-save-method={method}>
        {refused}
        {native ? (
          <NativeSaveForm action={startAccountSaveAction.bind(null, eventId, slug)} className="space-y-3">
            {returnTo}
            {termsCarried ? null : termsTick}
            {nativeField}
            {button}
            {stall}
          </NativeSaveForm>
        ) : (
          <form action={startAccountSaveAction.bind(null, eventId, slug) as WebFormAction} className="space-y-3">
            {returnTo}
            {termsCarried ? null : termsTick}
            {button}
            {stall}
          </form>
        )}
        {emailInstead}
        {why}
      </div>
    );
  }
}
