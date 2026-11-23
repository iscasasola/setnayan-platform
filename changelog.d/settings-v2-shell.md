## 2026-11-14 · feat(settings): Settings v2, step 1 — every ⚙ rises full screen; one section heading; supplier Today · Hub · Shop ported

Owner, 13 Nov 2026: *"one setting shell approved"* (prototype `prototypes/approved_2026-11-13/settings-shell-fable.html` v3; DECISION_LOG 2026-11-13 "Settings v2 approved"). Owner, 14 Nov: *"Send it to b2"*. Step 1 of the build notes (§ 13) — the shared shell and the supplier screens that need nothing else.

- **Every ⚙ rises full screen** out of the ⚙ you tapped (the shipped `RiseScreen`): the boxed sheet over a dimmed page is gone, and the `rise` switch with it (`menu-settings-button.tsx`). The head gets the ONE save seat (`state`) and the foot the ONE waiting bar (`thumb`), passed straight through. **One named exception:** the supplier's picked client is already a risen layer, so its ⚙ keeps the sheet (`inLayer`) until the prototype's in-place swap lands — a guard holds `inLayer` to that one caller.
- **NEW `app/_components/settings/settings-section.tsx`**: `SettingsSection` (the one heading — the shipped `home-k2`) and `SettingsSaveState` (nothing at rest · Saving… · Saved ✓ for 2 s · Not saved). No screen wires the save seat yet; that comes with the screens that save through an action.
- **Today ⚙** and **the supplier's Hub ⚙**: one section heading each, and they now END with "More settings" doors to Shop settings and Clients settings (the shipped `?gear=1` deep links, `SUPPLIER_SETTINGS_DOORS` in `lib/menu-settings.ts`) — no settings screen is a dead end.
- **Shop ⚙**: the same five things under four headings (Your page · Plan and team · Papers · Notifications), no icon tile in front of a row, and the push switch + email line out of their fold (one tap, not two). `#notifications` still lands.
- Help answer `how-settings-open-and-save` (new slot file `lib/help/settings-shell.ts`); a sentence on the Shop tour's ⚙ stop; ⓘ is the risen head's own.
- Guards: new `lib/settings-v2-one-shell.test.ts`; re-aimed `the-rise-screen-is-one-full-screen.test.ts` test 4 and 5 (the claim inverts: every ⚙ rises, the old sheet only `inLayer`).

**Not in this step** (the build notes' later items): the Undo · Apply bar wired to the couple's draft and the supplier's `usePageDraft`; Event settings, Event Hub, Guests, Memories, Suppliers, People, Prints, Portfolio and Clients bodies; the picked client's in-place swap; Account settings and the supplier Settings page as rises; the Sign out screen; the event-name default (needs a migration and the owner's word on the open decisions in the prototype's "Needs your decision").

SPEC IMPACT: None (implements the approved prototype).
