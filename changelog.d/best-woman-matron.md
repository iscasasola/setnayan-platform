## 2026-09-30 · feat(guests): Best Woman beside Best Man, either-or role pairs, and the couple's own role words

Owner, 2026-09-30: *"Also on guestlist (We can pick either best man or best
woman and maid or matron of honor)"* — and, the same day: *"Bride'smaid can be
renamed as what - for us we picked Bride's Crew. Groomsmen can be renamed as
what - for us we picked Groom's Crew"*.

**Best Woman.** New guest role `best_woman` (enum value, migration
`guest_role_add_best_woman`), the alternative to `best_man`: same place in the
Wedding March (honour group, groom's column), same Mood Board colour slot
(palette key `best_man`, now labelled "Best Man / Best Woman"), same seating tier,
same invited-to defaults, same emcee billing, same host seat and permission
template (host role widened in `event_moderators_role_subtype_check`, migration
`host_roles_add_best_woman`). She dresses in a gown (the 3D avatar default). Not
exclusive — a couple may have both, as with maid AND matron.

**Either-or pairs.** The role pickers show "Best Man · or · Best Woman" and
"Maid of Honour · or · Matron of Honour" as ONE line with two choices
(`lib/role-alternatives.ts`): the Guest list role chip, the phone Assign sheet,
and the guest card's dropdown (an `<optgroup>` per pair).

**Rename a role.** "Rename this role" (ⓘ "Changes how this role is called
everywhere for your event") in the Guest list role picker writes
`events.role_names` (new jsonb column, migration `events_role_names`; SELECT to
`authenticated`, written through the admin client after
`requireHostMembership`; `events_host` rebuilt over it). DISPLAY ONLY — the role
key is untouched, so march order, colours, seating and permissions are unchanged.
One word (plus an optional word for several) drives the Guest list chips,
sections, lenses, search, bulk pickers, guest card, check-in desk, requests
page, tea-ceremony list, invitation admin list and print sheet, seating CSV, the
invitation's Wedding March headings and names, /everyone, the Maker's march, the
Entourage print and attire lines, the guest's own "You are …" line, the Event Hub
dress-code rows, the dress-code editor, the editorial column badges, the join
page and the emcee script. Blank = the usual word.

Guards: `lib/best-woman-stands-where-the-best-man-stands.test.ts` (vocabulary
keeps every old value; best_woman behaves as best_man everywhere the product keys
on a role; source sweep of every `best_man` file) and
`lib/role-names-reach-every-screen.test.ts` (sanitiser, fallback, headings, the
role does not move, source sweep of every `ROLE_LABELS[` / `roleLabel(` /
`ROLE_GROUP_LABELS[` call, provider mounted on every page that needs it).

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-30 "BEST WOMAN · EITHER-OR HONOUR
ATTENDANTS · THE COUPLE NAMES THEIR ROLES" (corpus).
