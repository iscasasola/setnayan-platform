## 2026-09-21 · feat(profile): Profile & settings becomes six groups, one shown at a time

The owner-approved redesign (prototype, 2026-09-21). Twelve sections on one long
page are now six groups — **Profile · Guest details · Privacy · Sign-in &
security · Preferences** and, below a divider, **Account**. Desktop gets a left
rail with the chosen group on the right; a phone gets the list of groups (identity
card on top, Account doorways quiet at the bottom) and opens one behind a
"‹ Settings" back link. Nothing was removed — every control has a home.

- **All six groups are still rendered on the server**; the new client
  `_components/settings-shell.tsx` only chooses which one is not `hidden`. So
  every form and server action works as before. Switching groups rewrites the
  URL to `?tab=<group>` with `history.replaceState` — no server round trip.
- **Every existing link keeps landing.** Which group opens:
  `?tab=` → the group holding `#hash` → a flash param → the default
  (`lib/profile-settings-groups.ts`). Old anchors keep their ids in the group
  that now holds their content: `#url-slug`, `#slug`, `#privacy` → Privacy;
  `#settings` (where deletion lives) → Account. `?slug_saved`, `?discoverable_saved`,
  `?photo_sharing_saved`, `?face_forgotten` → Privacy; `?deletion_*`,
  `?tour_restarted` → Account; `?password_changed`, `?signed_out_others` →
  Security; `?saved` → Profile. `#privacy` had no element before — it does now.
- **The one-form problem, fixed at the action.** `updatePersonalInfo` wrote every
  personal column on every save, so splitting its form across groups would have
  nulled each group's fields whenever another saved. It now writes ONLY the
  fields the submitted form carried (`lib/profile-personal-info-patch.ts`, pure +
  unit-tested). Controls that post nothing in a legitimate state — the two opt-in
  switches and the cleared profile photo — carry a hidden presence marker.
  Consent stamps (`marketing_consent_at`, religion / civil status / sex / dietary
  `*_consent_at`) keep their exact transition rule, computed only for fields that
  were posted. The action returns to the group that saved (`&tab=`, whitelisted).
- The paired On/Off choice cards became switches (same switch drawn by
  PushToggle / HapticsToggle; each is still a plain form). Planner mode and
  Display language became two-option segmented controls. The greeting opt-in
  moved to Privacy and marketing emails to Preferences, both as switches.
- Face-profile consent saves now return to Privacy (`&tab=privacy`).
- Tests: `lib/profile-personal-info-patch.test.ts` (Guest-details save leaves
  display name + name parts alone; Profile save leaves meal / dietary / religion
  and their consents alone; unchecked marketing on the Preferences form → false;
  absent marketing on the Profile form → untouched) and
  `lib/profile-settings-groups.test.ts` (tab / flash resolution, and each old
  anchor id pinned to its pane).

SPEC IMPACT: None

The profile menu's "Settings" item now opens the Preferences group
(`?tab=preferences`) instead of `#settings`, which now anchors the Account group
where deletion lives.
