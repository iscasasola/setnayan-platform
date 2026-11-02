## 2026-10-25 · feat(guest-save): the save offer redrawn as option A, with the ticket's keep actions — and a sign-in that works inside Messenger

Owner, 25 Oct, on the test render: *"No better presentation?"* · *"I thought your goal is to always make our app
seamless"* → option A of `prototypes/save_to_account_2026-10-25` → *"this was supposed to be built already"*; then,
while it was built: *"there is no Save my account on me"* · *"create a proper widget to link this event to your
account"* · *"there is already a save to my account"* · *"but we are supposed to have that with the save to wallet,
correct?"* · *"we already have the icon of the wallet"*.

- **The head (`SaveOfferHead`, in `save-to-account.tsx`)** says the benefit — "Keep your ticket on every phone", one
  line "Your ticket and the photos of you, in one place.", the rest in the ⓘ — beside a little picture of their ticket
  (the couple's names, a QR drawing, the gild rule) with two photo cards fanned behind it (`.sn-keep-art`). It replaces
  "Save to my account · Nothing to type" and the trailing "Keeps the photos of you…" line.
- **The buttons are each brand's own style; the device's provider is the filled one** (`oauthOfficialClass` beside
  `OAUTH_BUTTON_CLASS` in `oauth-icons.tsx`; colours in `globals.css` `.sn-oauth-*`): iPhone Apple black + Google
  light; Android Google dark + Apple white-outline; on a dark look (Candlelight, Velvet, Gatsby, Cyber) Apple white +
  Google dark. One box for both. `/login` and the app rows are unchanged.
- **Terms stay affirmative**: carried → no tick; not carried → the shipped unticked `TermsTick` between the line and
  the buttons. No "By continuing…" sentence anywhere.
- **Messenger / in-app browsers**: the branch drew only "Open in your browser" — a guest whose seat had been unlinked
  could not sign in at all. It now also draws **"Sign in with email"** (the shipped email sign-in → `/join/{id}/connect`),
  and the reason under "Open in your browser" now says the truth: **"Apple and Google need your browser"** (it said
  "Messenger can't sign you in here", false for email). The no-provider (`link`) branch gets the same sign-in.
- **ONE offer per page, with the ticket's keep actions**: on Me, `MeKeepInvitation` (owner's title "Keep this
  invitation" as the single heading — the offer is `headless`) sits directly under the ticket's Save · Add to Apple
  Wallet (`GuestTicket keep`), or under the greeting when no ticket is drawn; `GuestMe` draws none. On the thank-you the
  one `SaveToAccount` sits under Save my ticket · Wallet, before the +1 list, after a Yes (and still finishes a
  `?keep=terms` return). Once saved: "✓ Saved to your account" in the same spot.
- **The host** (viewing a guest's Me) now sees a labelled preview, "What your guests see" — pictures of the buttons, no
  form, no link — instead of nothing.
- Lab: `/dev/me-lab?save=1` (`&page=me|thanks`, `&ua=iphone|android|messenger`, `&state=offer|linked|host`, `&terms=0`,
  `&dark=1`).
- Guards: `the-save-offer-shows-both-providers` (filled = device's own; dark swap), `use-my-email-instead` (Messenger /
  Instagram "Sign in with email", true reason, no-provider branch), `me-offers-save-first` (one heading, host preview
  inert, one offer per page, under the ticket, every unlinked state draws the widget),
  `the-thank-you-hands-over-the-tickets` (one SaveToAccount, ticket → Save → Wallet → Keep → +1), and the re-aimed
  string pins in the guest-path guards.

⚠ Reverses, for the thank-you only, the 2026-10-03 "one place each" call (the offer was Me's alone) — on the
controller's relay of the owner's "proper widget … with the save to wallet". Supersedes the 2026-10-24 "first, under the
greeting" placement on Me.

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-25 "THE SAVE OFFER IS OPTION A, WITH THE TICKET'S KEEP ACTIONS" (corpus).
