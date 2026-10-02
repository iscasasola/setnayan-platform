import Link from 'next/link';
import type { ReactNode } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { envFlagEnabled } from '@/lib/env-flag';
import {
  saveMethodFor,
  saveMethodLine,
  saveMethodSignsIn,
  type GuestAccountState,
  type SaveMethod,
} from '@/lib/guest-one-path';
import { INVITE_RETURN } from '@/lib/invite-arrival';
import { TERMS_FIELD } from '@/lib/terms-agreement';
import { COUPLE_SEAT_REFUSED, SEAT_HELD_ELSEWHERE, seatConfirmLine } from '@/lib/seat-binding';
import { startAccountSaveAction, linkThisSeatAction } from '../actions';
import { CopyMyLink, OpenInBrowser } from './copy-my-link';

/**
 * "SAVE TO MY ACCOUNT" — ONE button; the method is chosen by the device and
 * never shown as a choice (owner 2026-09-26, "THE GUEST PATHWAY — ONE BUTTON AT
 * A TIME"; reachable from the thank-you, Me, and on the day — owner 2026-09-27).
 *
 *   offer          → the device's method (`saveMethodFor`):
 *                      iPhone → Apple · Android / desktop → Google — both
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
 *   held_elsewhere → said plainly, never re-bound.
 *
 * 📵 NO EMAIL, ANYWHERE ON IT (owner 2026-09-29, DECISION_LOG "NO EMAIL TO
 * GUESTS — THE QR AND THE LINK DO EVERYTHING"). The webview arm used to email a
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
}: {
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
  through?: { action: (formData: FormData) => Promise<void>; fields: ReactNode; after?: ReactNode };
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
        <SubmitButton className="button-primary min-h-[56px] w-full" pendingLabel="Saving…">
          Yes, save to my account
        </SubmitButton>
      </form>
    );
  }

  // offer
  const providers = {
    apple: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED),
    google: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED),
  };
  const method: SaveMethod = saveMethodFor(userAgent, providers);
  const signsIn = saveMethodSignsIn(method);
  const handOver =
    !signsIn && personalLink ? (
      method === 'browser' ? <OpenInBrowser link={personalLink} /> : <CopyMyLink link={personalLink} />
    ) : null;
  const termsTick = (
    <label className="flex min-h-[44px] items-start gap-3 text-sm text-ink/80">
      <input
        name={TERMS_FIELD}
        type="checkbox"
        required
        className="mt-0.5 h-5 w-5 shrink-0 accent-terracotta"
      />
      <span>
        I agree to the{' '}
        <Link href="/terms" className="font-medium text-link underline underline-offset-2">
          Terms
        </Link>{' '}
        and the{' '}
        <Link href="/privacy" className="font-medium text-link underline underline-offset-2">
          Privacy Notice
        </Link>
      </span>
    </label>
  );
  const button = (
    <SubmitButton
      name="then"
      value="keep"
      className="button-primary flex h-auto min-h-[56px] w-full flex-col items-center justify-center gap-0.5 py-2.5"
      pendingLabel={method === 'apple' ? 'Opening Apple…' : 'Opening Google…'}
    >
      <span className="text-base">Save to my account</span>
      <span className="text-xs font-normal opacity-80">
        {saveMethodLine(method)}
        {carries ? ` — ${carries}` : null}
      </span>
    </SubmitButton>
  );
  const refused = termsMissing ? (
    <p role="alert" className="text-sm text-terracotta-700">
      Tick the Terms first — saving makes a Setnayan account.
    </p>
  ) : null;
  // The reason, said once and only as wide as what ships: on the day this page
  // shows each guest the photos they are in, and the account — not the pass in
  // this browser — is what opens the event again later (`findGuestSeatForUser`).
  const why = (
    <p className="text-center text-xs text-ink/60">
      Keeps the photos of you, and opens this invitation on any phone.
    </p>
  );
  if (through) {
    return (
      <div className="space-y-2" data-save-method={method} data-save-through>
        {refused}
        <form action={through.action} className="space-y-4">
          {through.fields}
          {signsIn && !termsCarried ? termsTick : null}
          {signsIn ? (
            button
          ) : (
            <SubmitButton name="then" value="done" className="button-primary h-14 w-full text-base" pendingLabel="Saving…">
              Save
            </SubmitButton>
          )}
          {through.after}
        </form>
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
  return (
    <div className="space-y-2" data-save-method={method}>
      {refused}
      <form action={startAccountSaveAction.bind(null, eventId, slug)} className="space-y-3">
        <input type="hidden" name="return_to" value={INVITE_RETURN} />
        {termsCarried ? null : termsTick}
        {button}
      </form>
      {why}
    </div>
  );
}
