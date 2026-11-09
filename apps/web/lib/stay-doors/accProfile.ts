/** Account › Profile & settings — the switches and forms on `/dashboard/profile` (`profile/actions.ts`,
 *  `profile/face-profile-actions.ts`); `updateDiscoverableByName` is also the People page's ⚙ switch. */
export const ACC_PROFILE_STAY_DOORS = [
  'accProfile.updatePersonalInfo',
  'accProfile.updateUserSlug',
  'accProfile.updatePublicProfileEnabled',
  'accProfile.updatePublicGreeting',
  'accProfile.updateDiscoverableByName',
  'accProfile.updateSharePhotoWithHosts',
  'accProfile.requestAccountDeletion',
  'accProfile.cancelAccountDeletionRequest',
  'accProfile.setAccountFaceProfileConsent',
  'accProfile.forgetMyFaceEverywhere',
] as const;
export type AccProfileStayDoor = (typeof ACC_PROFILE_STAY_DOORS)[number];
