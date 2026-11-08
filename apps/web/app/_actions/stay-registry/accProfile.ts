import 'server-only';
import type { AccProfileStayDoor } from '@/lib/stay-doors/accProfile';
import { NOTHING_CHANGED, type StayWords } from '@/lib/save-in-place';
import {
  cancelAccountDeletionRequest,
  requestAccountDeletion,
  updateDiscoverableByName,
  updatePersonalInfo,
  updatePublicGreeting,
  updatePublicProfileEnabled,
  updateSharePhotoWithHosts,
  updateUserSlug,
} from '@/app/dashboard/(account)/profile/actions';
import { forgetMyFaceEverywhere, setAccountFaceProfileConsent } from '@/app/dashboard/(account)/profile/face-profile-actions';
import { kind, type Door } from './_door';

/**
 * Profile's refusals already carry the page's own sentence: `?error=` and `?slug_error=` (the profile page shows each
 * as given, `FormFlash tone="error"`). Signed out → `/login`, an anonymous draft → `/signup` — both navigate. An
 * account screen: no event, so no limited-helper area (`null`).
 */
const ACC_PROFILE_WORDS: StayWords = {
  within: [/^\/dashboard\/profile$/],
  refuse: (q) => q.get('error') ?? q.get('slug_error'),
};
const accProfile = kind(ACC_PROFILE_WORDS, false);

/** The face-profile switches: the same words, and their "switched off" bounce (`redirect('/dashboard/profile')` with no
 *  news at all, when the feature flag is off) is a refusal — nothing was saved — never "saved". */
const ACC_FACE_WORDS: StayWords = {
  within: [/^\/dashboard\/profile$/],
  refuse: (q) => q.get('error') ?? (q.toString() === '' ? NOTHING_CHANGED : null),
};
const accFace = kind(ACC_FACE_WORDS, false);

export const ACC_PROFILE: Readonly<Record<AccProfileStayDoor, Door>> = {
  'accProfile.updatePersonalInfo': accProfile(updatePersonalInfo),
  'accProfile.updateUserSlug': accProfile(updateUserSlug),
  'accProfile.updatePublicProfileEnabled': accProfile(updatePublicProfileEnabled),
  'accProfile.updatePublicGreeting': accProfile(updatePublicGreeting),
  'accProfile.updateDiscoverableByName': accProfile(updateDiscoverableByName),
  'accProfile.updateSharePhotoWithHosts': accProfile(updateSharePhotoWithHosts),
  'accProfile.requestAccountDeletion': accProfile(requestAccountDeletion),
  'accProfile.cancelAccountDeletionRequest': accProfile(cancelAccountDeletionRequest),
  'accProfile.setAccountFaceProfileConsent': accFace(setAccountFaceProfileConsent),
  'accProfile.forgetMyFaceEverywhere': accFace(forgetMyFaceEverywhere),
};
