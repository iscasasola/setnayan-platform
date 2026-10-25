/**
 * guest-group-role-pick.ts — 👥 ONE GROUP DROPDOWN, ONE ROLE DROPDOWN, EACH MULTI (owner 2026-10-20, DECISION_LOG
 * "GUEST CARD: ONE GROUP DROPDOWN AND ONE ROLE DROPDOWN, EACH MULTI"; prototype `guest_group_and_fast_add_2026-10-20.html`
 * strip A). Owner, verbatim: *"there are 2 groups."* · *"Roles doesn't need also serves as. as an additional role. they can
 * have multiple row in that Role in Wedding"* · *"several group, several roles"*.
 *
 * What ONE tick does, as pure functions, so every drawing of the two dropdowns (the guest card on the Guests pages, the
 * Maker's hand-drawn card, /guests/new, Quick add) means the same thing and a guard can drive it without a DOM.
 *
 * 🔑 NO DATA CHANGE. The two lists only re-spell writes the card already made:
 *   · GROUP — the standard groups are ONE column (`guests.group_category`), so they are ONE OF: ticking another swaps it,
 *     and the ticked one cannot be unticked (the column is required). The couple's own groups are memberships
 *     (`guest_group_memberships`) and tick freely. Posted as `group_category` + `group_ids`, as before.
 *   · ROLE — the FIRST ticked is `guests.role` (the main one: it decides the guest's section on the entourage and the
 *     list); the rest are `extra_roles`. Unticking the main promotes the next. Posted as `role` + `extra_roles`.
 *
 * ⚖ BUILDER'S CALLS (logged in the PR body, not owner rulings):
 *   · "Guest" is the plain role — it is never an EXTRA role (`updateGuest` would store it as one). Ticking Guest leaves
 *     only Guest; ticking any role while only Guest is ticked replaces it; unticking everything is Guest again.
 *   · A one-per-event role (bride, groom, wali, imam, wakil) can only be the MAIN role — the
 *     `guests_extra_roles_no_singletons` CHECK refuses it as an extra — so ticking one makes it the main and the old main
 *     (when it may be an extra) follows it.
 */

/** The picked keys after one tap in the GROUP list. `standard` = the one-of keys (group_category values). */
export function tickGroup(picked: readonly string[], key: string, standard: readonly string[]): string[] {
  if (standard.includes(key)) return [key, ...picked.filter((k) => !standard.includes(k))];
  return picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key];
}

/**
 * The posted pair of the GROUP list: the one standard key, and the own groups in the LIST's order (never tap order) — then
 * any ticked group the list does not know yet (one just made here, before the list has re-read), so it is never dropped.
 */
export function splitGroup(picked: readonly string[], standard: readonly string[], ownOrder: readonly string[]): [string, string] {
  const std = picked.find((k) => standard.includes(k)) ?? '';
  const own = picked.filter((k) => !standard.includes(k));
  return [std, [...ownOrder.filter((k) => own.includes(k)), ...own.filter((k) => !ownOrder.includes(k))].join(',')];
}

/**
 * The pill's word for a role (prototype A1: "Ninang · Candle Sponsor"): the picker's "Principal Sponsor (Ninang)" is the long
 * word that groups them in a long list; on the closed pill — and the fold's summary — the bare word is what is read (the same
 * call the invitation makes, `lib/entourage.ts`). A couple's own word for the role is never touched.
 */
export function rolePillWord(label: string): string {
  return label.replace(/^Principal Sponsor \((Ninong|Ninang)\)$/, '$1');
}

/** The Role list's footer, beside "Done ✓" (prototype A7). */
export const ROLE_DONE_NOTE = 'Tick as many as apply. The first ticked is their main role.';

/** The headings of the Group list (prototype A2), for a list drawn by the shipped PickMenu (the Maker's card). */
export const GROUP_STANDARD_HEADING = 'Standard · one of these';
export const GROUP_OWN_HEADING = 'Your groups · as many as apply';

/** The plain role — on its own, never beside another. */
export const PLAIN_ROLE = 'guest';

/** The picked keys after one tap in the ROLE list; `[0]` is the main role. `solo` = the one-per-event roles. */
export function tickRole(picked: readonly string[], key: string, solo: readonly string[]): string[] {
  if (picked.includes(key)) {
    const rest = picked.filter((k) => k !== key);
    return rest.length ? rest : [PLAIN_ROLE];
  }
  if (key === PLAIN_ROLE) return [PLAIN_ROLE];
  const base = picked.filter((k) => k !== PLAIN_ROLE);
  return solo.includes(key) ? [key, ...base.filter((k) => !solo.includes(k))] : [...base, key];
}

/** The posted pair of the ROLE list: the main role, and the extra roles in TICK order (the first ticked leads). */
export function splitRoles(picked: readonly string[]): [string, string] {
  return [picked[0] ?? PLAIN_ROLE, picked.slice(1).join(',')];
}
