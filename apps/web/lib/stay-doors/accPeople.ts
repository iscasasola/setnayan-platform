/** Account › People — Loved ones (`people/dependent-actions.ts`) and the Groups view's "Add" (`people/actions.ts`), all on
 *  `/dashboard/people`. */
export const ACC_PEOPLE_STAY_DOORS = [
  'accPeople.addDependent',
  'accPeople.deleteDependent',
  'accPeople.setDependentSharing',
  'accPeople.addGodparent',
  'accPeople.deleteGodparent',
  'accPeople.createHandoverLink',
  'accPeople.revokeHandoverLink',
  'accPeople.emailHandoverLink',
  'accPeople.proposeSamahanConnection',
] as const;
export type AccPeopleStayDoor = (typeof ACC_PEOPLE_STAY_DOORS)[number];

/** The People page's own sentence for each `?error=` code (moved here from `people/page.tsx`, which still shows them —
 *  one list, so the banner and the in-place refusal never say two different things). */
export const PEOPLE_ERROR_WORDS: Readonly<Record<string, string>> = {
  fence: 'You can only add a child (under 18) or an elder (over 50). For anyone else, invite them to Setnayan instead.',
  name: 'Please add a name.',
  birthdate: 'Please add a valid birthday.',
  email: 'Please enter a valid email address.',
  no_active_link: 'Create the hand-over link first, then email it.',
  email_not_configured:
    'Email isn’t set up yet — an admin needs to add the Resend key in Admin → Integrations. The copy-link button still works.',
  email_send_failed: 'The email didn’t send — try again, or copy the link instead.',
  not_of_age: 'They can claim their profile once they turn 18.',
};
