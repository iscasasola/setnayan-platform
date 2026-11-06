import Link from 'next/link';
import type { ReactNode } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { InfoTip } from '@/app/_components/info-tip';
import { ProviderButton } from './provider-button';
import { AppleIcon, GoogleGIcon, oauthOfficialClass } from '@/app/_components/oauth-icons';
import { OAUTH_VERB } from '@/lib/oauth-words';
import { envFlagEnabled } from '@/lib/env-flag';
import {
  saveMethodFor,
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
 * BUTTON AT A TIME" (2026-09-26) FOR THIS OFFER ONLY. With Apple AND Google switched on, both draw with the login's
 * marks and words ("Continue with Apple" · "Continue with Google"), equal in size; the device's own (`saveMethodFor`)
 * first (`saveProvidersInOrder`); each posts its own provider and the action opens the one PRESSED
 * (`saveMethodFromForm`, which refuses a provider that is off). One provider on → that one button. None → "Copy my
 * link". "Use my email instead" stays under them.
 *
 * 🎟 OPTION A (owner 2026-10-25: *"No better presentation?"* · *"I thought your goal is to always make our app
 * seamless"* → option A of prototypes/save_to_account_2026-10-25 → *"this was supposed to be built already"*). The
 * head says the benefit — "Keep your ticket on every phone", one line, the details in the ⓘ, beside a little picture
 * of their ticket (`SaveOfferHead`); the buttons are each brand's OWN style and the device's own provider is the
 * FILLED one (`oauthOfficialClass`); on Me the owner's title is the one heading (`headless`).
 *
 *   offer          → the device's method (`saveMethodFor`):
 *                      iPhone / iPad → Apple · Android / desktop → Google — both
 *                      posted to `startAccountSaveAction`, which takes the
 *                      Terms tick and returns through `/join/{eventId}/connect`
 *                      (binds this seat to the account and opens the event);
 *                      in-app webview → "Open in your browser" (`OpenInBrowser`,
 *                      prototype guest_ticket_flow_2026-09-29.html frame F) for
 *                      Apple / Google, and "Sign in with email", which works there;
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
 * how to paste it into Safari or Chrome, where Apple / Google is one tap — and
 * "Sign in with email" (2026-10-25) signs in right there, sending nothing.
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
  headless = false,
  ticketNames = null,
}: {
  /** 🪪 Me's "Keep this invitation" (owner 2026-10-24) draws its OWN head — the title is the ONE heading there, so the
   *  offer draws none of its own (option A, 2026-10-25). */
  headless?: boolean;
  /** The couple's names (`events.display_name`), written on the little ticket in the head. */
  ticketNames?: string | null;
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
  /** What comes along (frame A: "your name, mobile, meal and your guests come along") — said in the head's ⓘ. */
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
    /* 🎟 OPTION A (owner 2026-10-25, "this was supposed to be built already"): the head says the BENEFIT — "Keep your
       ticket on every phone", one line, the rest in the ⓘ, beside a little picture of their ticket and the photos of
       them (`SaveOfferHead`). It replaces "Save to my account · Nothing to type" and the trailing "Keeps the photos of
       you…" line (now in the ⓘ). On Me the owner's "Keep this invitation" is the ONE heading (`headless`). What comes
       along (`carries`, the plus-one-less thank-you's Terms return) is a detail, so it is said in the ⓘ too. */
    const head = headless ? null : (
      <SaveOfferHead names={ticketNames} tip={carries ? `${SAVE_OFFER_TIP} ${capitalise(carries)}.` : undefined} />
    );
    /* 🍏🤖 THE PROVIDER BUTTONS (owner 2026-10-25, "Show both") — the login's marks (`AppleIcon` · `GoogleGIcon`) and
       words (`OAUTH_VERB`): "Continue with Apple" · "Continue with Google", in ONE box size. Option A: each brand's OWN
       sanctioned style, and the DEVICE'S OWN provider (`method`, drawn first by `saveProvidersInOrder`) is the FILLED
       one — Apple black on an iPhone, Google's dark theme on Android; the other takes its white official style
       (`oauthOfficialClass`; a dark look swaps Apple to white, see globals.css). Each posts its OWN provider
       (`ProviderButton` → `SAVE_METHOD_FIELD`), so the action opens the provider the guest pressed and no other
       (`saveMethodFromForm`, lib/guest-one-path.ts). */
    const order = saveProvidersInOrder(method, providers);
    const buttons = (
      <div className="space-y-2.5">
        {order.map((m) => (
          <ProviderButton
            key={m}
            method={m}
            className={oauthOfficialClass(m, m === method)}
            pendingLabel={m === 'apple' ? 'Opening Apple…' : 'Opening Google…'}
            /* No full-screen veil: the press leaves for the provider's site, whose page
               has no loader of ours to take the veil down — a stalled or abandoned
               sign-in left the whole screen covered (owner's live test 2026-10-02). */
            overlay={false}
            data-save-provider={m}
            data-save-filled={m === method ? '' : undefined}
          >
            {m === 'apple' ? <AppleIcon fill="currentColor" /> : <GoogleGIcon />}
            {`${OAUTH_VERB} ${m === 'apple' ? 'Apple' : 'Google'}`}
          </ProviderButton>
        ))}
      </div>
    );
    // The way back when the provider does not open (`ProviderStall` names the one PRESSED).
    const stall = signsIn ? <ProviderStall provider={method === 'apple' ? 'Apple' : 'Google'} /> : null;
    const refused = termsMissing ? (
      <p role="alert" className="text-sm text-terracotta-700">
        Tick the Terms first — saving makes a Setnayan account.
      </p>
    ) : null;
    /* ✉️ "USE MY EMAIL INSTEAD" (owner 2026-10-25, "If you have recommendation that
       follow our design go for it"). One quiet text link under the provider button(s) for a
       guest without Apple / Google to hand: the SHIPPED email sign-in (/login, whose
       card links to /signup with the same `next`) returning to the SAME place the
       button does — `/join/{eventId}/connect`, the seat-binding door, exactly as the
       `sign_in` state above. No new auth, and 📵 no email is SENT by this: password
       sign-in sends nothing, and an event sign-up gets no welcome email
       (`welcomeEmailKind` → null for `isEventSignup`). A text link, not a frame —
       the provider buttons stay the main action. Guarded by `use-my-email-instead.test.ts`. */
    const emailHref = `/login?next=${encodeURIComponent(`/join/${eventId}/connect`)}`;
    const emailInstead = (
      <p className="text-center">
        <Link
          href={emailHref}
          className="inline-flex min-h-[44px] items-center text-xs text-ink/70 underline underline-offset-2 hover:text-ink"
          data-save-email-instead=""
        >
          Use my email instead
        </Link>
      </p>
    );
    if (through) {
      return (
        <div className="space-y-2" data-save-method={method} data-save-through>
          {native ? (
            <NativeSaveForm action={through.action} className="space-y-4">
              {through.fields}
              {head}
              {refused}
              {termsCarried ? null : termsTick}
              {nativeField}
              {buttons}
              {stall}
              {through.after}
            </NativeSaveForm>
          ) : (
            <form action={through.action as WebFormAction} className="space-y-4">
              {through.fields}
              {signsIn ? head : null}
              {signsIn ? refused : null}
              {signsIn && !termsCarried ? termsTick : null}
              {signsIn ? (
                <>
                  {buttons}
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
        </div>
      );
    }
    if (!signsIn) {
      if (method === 'browser') {
        /* 💬 INSIDE MESSENGER / INSTAGRAM / FACEBOOK (`saveMethodFor` → 'browser'). Apple and Google refuse to sign
           anyone in inside a chat app's browser, so "Open in your browser" stays for them (`OpenInBrowser`). But the
           EMAIL sign-in works right here — it is a plain form — and before 2026-10-25 this branch drew nothing else:
           a guest whose seat had been unlinked, opening their link from Messenger, had no way to sign in at all
           (found live 2026-10-25). So the same email door as "Use my email instead" is drawn under it, worded
           "Sign in with email" so a guest looking for a sign-in finds it, returning to the seat-binding door
           (`/join/{eventId}/connect`). Guarded by `use-my-email-instead.test.ts`. */
        return (
          <div className="space-y-3" data-save-method={method}>
            {head}
            {handOver}
            <Link
              href={emailHref}
              className="button-secondary flex min-h-[48px] w-full items-center justify-center text-sm"
              data-save-email-signin=""
            >
              Sign in with email
            </Link>
          </div>
        );
      }
      /* 🔗 NO PROVIDER SWITCHED ON (`link`): the guest's own link to copy — and, since 2026-10-25, the email sign-in
         under it, so an unlinked guest is never left with nothing that links the event to an account (owner: "there
         is no Save my account on me"). */
      return (
        <div className="space-y-3" data-save-method={method}>
          {handOver}
          <p className="text-center">
            <Link
              href={emailHref}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink underline underline-offset-4"
              data-save-email-signin=""
            >
              Sign in with email
            </Link>
          </p>
        </div>
      );
    }
    const returnTo = <input type="hidden" name="return_to" value={INVITE_RETURN} />;
    /* The order (option A): the head · the Terms tick ONLY when it was not carried (unticked, between the benefit and
       the press, the same form and field — `consent-is-affirmative.test.ts`; never a "By continuing you agree…"
       sentence) · the two buttons · the quiet email link. */
    return (
      <div className="space-y-2" data-save-method={method}>
        {native ? (
          <NativeSaveForm action={startAccountSaveAction.bind(null, eventId, slug)} className="space-y-3">
            {returnTo}
            {head}
            {refused}
            {termsCarried ? null : termsTick}
            {nativeField}
            {buttons}
            {stall}
          </NativeSaveForm>
        ) : (
          <form action={startAccountSaveAction.bind(null, eventId, slug) as WebFormAction} className="space-y-3">
            {returnTo}
            {head}
            {refused}
            {termsCarried ? null : termsTick}
            {buttons}
            {stall}
          </form>
        )}
        {emailInstead}
      </div>
    );
  }
}

function capitalise(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/**
 * 🎟 THE SAVE OFFER'S HEAD — OPTION A of the redesign (owner 2026-10-25, on the test render: *"No better
 * presentation?"* · *"I thought your goal is to always make our app seamless"* → option A of
 * `prototypes/save_to_account_2026-10-25/index.html`, then *"this was supposed to be built already"*).
 *
 * The offer reads as the next line of the ticket moment, not a form: a small picture of THEIR ticket with two photo
 * cards fanned behind it, beside a heading that says the BENEFIT, one short line, and the rest inside the ⓘ
 * ("Details go inside the ⓘ" — title + one line visible). No frame: nothing here is pressed but the ⓘ.
 *
 * Drawn by `SaveToAccount` with these words (the thank-you, the plus-one's door), and by Me's
 * `MeKeepInvitation` with the owner's own title "Keep this invitation" — there it is the ONE heading and
 * `SaveToAccount` is drawn `headless` (no second "Save to my account" over the same buttons).
 */
export const SAVE_OFFER_TITLE = 'Keep your ticket on every phone';
export const SAVE_OFFER_LINE = 'Your ticket and the photos of you, in one place.';
/** The ⓘ — the prototype's caption, verbatim: what saving makes, what it keeps, and that nothing needs it. */
export const SAVE_OFFER_TIP =
  'Saving makes a free Setnayan account — nothing to type. It keeps this ticket and the photos you’re in, and opens this event on any phone. Your QR and link keep working without it.';

export function SaveOfferHead({
  title = SAVE_OFFER_TITLE,
  line = SAVE_OFFER_LINE,
  tip = SAVE_OFFER_TIP,
  tipLabel = 'About keeping your ticket',
  as = 'h2',
  names = null,
}: {
  title?: string;
  line?: string;
  tip?: string;
  tipLabel?: string;
  as?: 'h2' | 'h3';
  /** The couple's names as the event shows them (`events.display_name`) — written on the little ticket. */
  names?: string | null;
}) {
  return (
    <div className="flex items-center gap-3.5 text-left" data-save-heading="">
      <KeepTicketArt names={names} />
      <div className="min-w-0 flex-1">
        <InfoTip label={title} labelAs={as} align="end" labelClassName="font-pahina text-xl leading-tight text-ink" ariaLabel={tipLabel}>
          {tip}
        </InfoTip>
        <p className="mt-1 text-sm text-ink/70">{line}</p>
      </div>
    </div>
  );
}

/**
 * The little picture: their ticket (the ticket's own stock, its gild rule, the couple's names in the script face, a
 * QR) with two photo cards fanned behind it — "your ticket and the photos of you". Decorative: hidden from assistive
 * tech (the heading says it), drawn in CSS (`.sn-keep-art`, globals.css), no image request. The QR is a drawing, not
 * a code — 18px could never scan, and the real one is the ticket above.
 */
export function KeepTicketArt({ names = null }: { names?: string | null }) {
  const shown = names?.trim() || null;
  return (
    <div aria-hidden="true" className="sn-keep-art" data-keep-art="">
      <span className="sn-keep-photo sn-keep-photo-2">
        <span className="sn-keep-face" />
        <span className="sn-keep-body" />
      </span>
      <span className="sn-keep-photo sn-keep-photo-1">
        <span className="sn-keep-face" />
        <span className="sn-keep-body" />
      </span>
      <span className="sn-keep-ticket">
        <span className="sn-keep-ticket-in">
          {shown ? <span className="sn-keep-names font-script">{shown}</span> : null}
          <span className="sn-keep-qr">
            <svg viewBox="0 0 7 7" width="18" height="18" shapeRendering="crispEdges">
              <path
                fill="#111"
                d="M0 0h3v3H0zM4 0h3v3H4zM0 4h3v3H0zM4 4h1v1H4zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM6 6h1v1H6z"
              />
              <path fill="#fff" d="M.5.5h2v2h-2zM4.5.5h2v2h-2zM.5 4.5h2v2h-2z" />
              <path fill="#111" d="M1 1h1v1H1zM5 1h1v1H5zM1 5h1v1H1z" />
            </svg>
          </span>
          <span className="sn-keep-rule" />
        </span>
      </span>
    </div>
  );
}
