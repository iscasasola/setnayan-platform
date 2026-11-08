## 2026-11-08 · feat(supplier): THE ONE BUILD — the six lanes joined on one branch (integration)

`claude/supplier-1build` joins the supplier dashboard ONE BUILD (owner-approved prototype v113) from its lanes, merged
in order with merge commits only: `-data` → `-forms-data` → `-foundation` → `-l1` → `-c1` → `-c2` → `-c3` → `-c4` → `-l2`,
then origin/main. Each lane's own fragment (`supplier-1build-<lane>.md`) describes its part; this entry is the wiring
between them:

- A date change or a removal request answered on a client's Details lands back on Details (`dayAnswerBack`, the
  shipped `lockAnswerReturnTo` allow-list); ONE mount for the two answers (C1's `ClientDayAnswers`; L2's duplicate deleted).
- The picked client stands on L1's foundation: the 520 ms rise (`lib/rise-motion.ts`), the layer tokens
  (`--sn-z-pop`), `--sn-pin-h`, the `sn-pin-hair` hairline, the word Clients; its ⚙ is the house `MenuSettingsButton`
  on the `client` key (now live).
- The brief's hosts (C2) feed the Hosts list; C2's thread body is the client's Chat page; the Payment page draws the money
  the client page already read; Today counts Portfolio photos through `getPortfolioCount` (C4).
- Today wears `CollapsingTop`; the next-events and Shop analytics carousels pass `dots={false} advanceMs={0}`.
- The Setnayan gift's "capped at N%" on Services and the service wizard reads `platform_settings.gift_limit_pct` (C2 → C4).
- The auto-reply card has one home, Clients settings (Shop and Your page no longer mount it).
- The Shop tour stops on the v113 Shop tab (How it is going · Your badges); the Hub's second door is the client's Hub page.
- The picked client over the list uses the shared modal contract (`useModalA11y`: Esc closes the topmost layer only) and
  its own null loading boundary, so opening it never paints the supplier-home skeleton over the list.
- Ugat joints J62 (shop → forms → the event's answers), J63 (category → suggested forms), J64 (shop → report → admin inbox).
- Regenerated on the merged tree: port baseline, Ugat screens, exposure baseline, admin jobs, migrations manifest,
  no-card baseline, user-FK map; server-action ceiling 1233 → 1237 (C2 +1, C3 +3, each imported by its caller).

SPEC IMPACT: None beyond the lanes' own fragments — the integration wires lanes to each other and adds no product
behaviour. Items the lanes asked for that ARE new behaviour are listed, not built, in
`build-notes/supplier-1build-integration.md`.
