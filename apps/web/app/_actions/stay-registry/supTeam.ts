import 'server-only';
import type { SupTeamStayDoor } from '@/lib/stay-doors/supTeam';
import { supplierScreen, type StayWords } from '@/lib/save-in-place';
import {
  cancelAdminMotion,
  inviteVendorTeamMember,
  proposeAdminMotion,
  removeVendorTeamMember,
  setVendorAgentServices,
  stepDownSelf,
  updateVendorTeamMember,
  voteAdminMotion,
} from '@/app/vendor-dashboard/team/actions';
import { kind, type Door } from './_door';

/**
 * The Helpers screen lives on `/vendor-dashboard/team` and inside the Shop ⚙ (`lib/gear-return.server.ts` sends a
 * save back to the page the ⚙ was open on — the Shop). A refusal is `?error=<the sentence>`, which `helpers-view.tsx`
 * prints as given. Not a shop admin → bare `/vendor-dashboard`, signed out → `/login`: both navigate.
 */
const SUP_TEAM_WORDS: StayWords = { within: [supplierScreen('team'), supplierScreen('shop')], refuse: (q) => q.get('error') };
const supTeam = kind(SUP_TEAM_WORDS, false);

export const SUP_TEAM: Readonly<Record<SupTeamStayDoor, Door>> = {
  'supTeam.inviteVendorTeamMember': supTeam(inviteVendorTeamMember),
  'supTeam.updateVendorTeamMember': supTeam(updateVendorTeamMember),
  'supTeam.removeVendorTeamMember': supTeam(removeVendorTeamMember),
  'supTeam.setVendorAgentServices': supTeam(setVendorAgentServices),
  'supTeam.proposeAdminMotion': supTeam(proposeAdminMotion),
  'supTeam.voteAdminMotion': supTeam(voteAdminMotion),
  'supTeam.cancelAdminMotion': supTeam(cancelAdminMotion),
  'supTeam.stepDownSelf': supTeam(stepDownSelf),
};
