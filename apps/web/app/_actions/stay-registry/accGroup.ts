import 'server-only';
import { GROUP_ERROR_WORDS, type AccGroupStayDoor } from '@/lib/stay-doors/accGroup';
import { NOTHING_CHANGED, type StayWords } from '@/lib/save-in-place';
import {
  deleteSamahanMessage,
  postSamahanMessage,
  removeMember,
  rotateInviteToken,
  updateCommunityIdentity,
} from '@/app/dashboard/(account)/samahan/actions';
import { kind, type Door } from './_door';

/** One group's page — never `/dashboard/samahan/new`. A missing group bounces to People › Groups and signed out to
 *  `/login`: both outside, both navigate. */
const GROUP_PAGE = /^\/dashboard\/samahan\/(?!new$)[^/]+$/;
/** `?error=` in the group page's own words; a raw database sentence as given, an unknown code never raw. */
const groupRefusal = (q: URLSearchParams): string | null => {
  const e = q.get('error');
  return e ? (GROUP_ERROR_WORDS[e] ?? (/^[a-z_]+$/.test(e) ? NOTHING_CHANGED : e)) : null;
};

/** The chat: a message lands back on the bare page (an empty box is a no-op that lands there too). */
const ACC_GROUP_CHAT_WORDS: StayWords = { within: [GROUP_PAGE], refuse: groupRefusal };
const accGroupChat = kind(ACC_GROUP_CHAT_WORDS, false);

/** Rename / photo · rotate the link · an organizer's Remove: each save lands with its own news (`?updated=1`,
 *  `?rotated=1`, `?removed=1`). A not-an-organizer bounce lands on the page with none — nothing saved, said so. */
const ACC_GROUP_WORDS: StayWords = {
  within: [GROUP_PAGE],
  refuse: (q) => groupRefusal(q) ?? (q.has('updated') || q.has('rotated') || q.has('removed') ? null : NOTHING_CHANGED),
};
const accGroup = kind(ACC_GROUP_WORDS, false);

export const ACC_GROUP: Readonly<Record<AccGroupStayDoor, Door>> = {
  'accGroup.postSamahanMessage': accGroupChat(postSamahanMessage),
  'accGroup.deleteSamahanMessage': accGroupChat(deleteSamahanMessage),
  'accGroup.updateCommunityIdentity': accGroup(updateCommunityIdentity),
  'accGroup.rotateInviteToken': accGroup(rotateInviteToken),
  'accGroup.removeMember': accGroup(removeMember),
};
