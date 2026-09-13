import { GuestCodeKeepers } from '../../_components/guest-code-keepers';

/**
 * THE LAST DOOR HANDS OVER THE QR.
 *
 * Owner, 2026-09-13: *"they get to see the QR Code so they can directly go to
 * the event hub with their custom QR. just to save the qr and of course they
 * have a button to proceed and see the event hub"* — and earlier the same day,
 * *"by the end, they get their custom QR specifically for their own event
 * HUB."*
 *
 * 🔑 NOT A NEW QR, AND NOT A NEW WAY TO SAVE ONE. The image is
 * `renderInvitationQrSvg` — the SAME renderer, the SAME url
 * (`buildInvitationUrl`) and the SAME level-H code the Event Hub's invitation
 * card has always drawn. The save is `GuestCodeKeepers`, the one component all
 * three existing guest QR surfaces already mount. This file exists so the
 * arrival's last door joins them rather than growing a fourth private copy.
 *
 * ⚠ WHY IT IS A COMPONENT AND NOT AN EXTRACTION FROM site-body.tsx. That file
 * draws this card inline and is 4,000+ lines with another session working in
 * it. Pulling its markup out would be a rewrite of a shipped screen for no
 * behaviour — RULE 0's "extend, never re-draw" cuts the other way here. The
 * shared thing that MATTERS (the renderer, the url builder, the keepers) was
 * already shared; only the wrapper is new.
 *
 * 🔒 THE PANEL KNOWS NOTHING. It receives a rendered SVG and a url and takes no
 * id, token, guest or search parameter of any kind — the caller does the
 * authorisation. A QR is a credential (`rotate-qr-actions.ts` exists so a
 * leaked one can be cut off), so the only page allowed to mount this is one
 * that has already matched a `readGuestSession()` to the event it is rendering.
 *
 * 🪤 THE CODE ON SCREEN IS AN INLINE SVG, WHICH A LONG-PRESS CANNOT SAVE. That
 * is the whole reason the keepers exist: "Save the code" is an anchor at
 * /api/guest/qr, which authenticates on the httpOnly cookie alone (no id in the
 * path) and answers with a PNG carrying `Content-Disposition: attachment` — so
 * the file lands even in a browser that ignores the `download` attribute.
 */
export function InviteQrPanel({
  qrSvg,
  invitationUrl,
  guestName,
  eventWord,
}: {
  /** Pre-rendered by the caller — `renderInvitationQrSvg`, never built here. */
  qrSvg: string;
  /** The same address the code encodes — shown as text so it can be read aloud,
   *  typed, or copied by hand when the clipboard is refused. */
  invitationUrl: string;
  guestName: string;
  /** "wedding" / "celebration" — the event's own word, from `eventWordsFor`. */
  eventWord: string;
}) {
  return (
    <section className="rounded-xl border border-ink/10 bg-ink/[0.03] p-5 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">Your QR</p>
      <h2 className="mt-2 text-lg font-medium text-ink">This is yours, and only yours</h2>
      {/* ⚠ WRITTEN AGAINST WHAT SHIPS, NOT AGAINST WHAT SOUNDS GOOD. Two claims,
          both checkable: the code opens the {eventWord} page as this guest
          (`?invite={qr_token}` — the same capability the link they arrived on
          carried), and photographers scan it on the day to tag them (the
          invitation card on the Hub has said exactly that for months, and
          `/papic/me/[token]` is the surface that does it). Nothing is said
          about what the SAVED file looks like — see the panel docblock. */}
      <p className="mx-auto mt-2 max-w-prose text-sm text-ink/70">
        Save it to your phone now. It opens this {eventWord} as you on any device, and the
        photographers scan it on the day so the photos of you find their way back to you.
      </p>
      <div
        aria-label={`Invitation QR code for ${guestName}`}
        className="mx-auto mt-5 inline-block rounded-xl bg-white p-3 shadow-sm"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <p className="mt-4 break-all font-mono text-xs tracking-[0.05em] text-ink/70">
        {invitationUrl}
      </p>
      <GuestCodeKeepers invitationUrl={invitationUrl} className="mt-4" />
    </section>
  );
}
