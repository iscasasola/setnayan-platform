/**
 * lib/stay-doors.ts — 📍 THE ONLY ACTIONS A `StayForm` MAY SAVE IN PLACE THROUGH (owner, 2026-10-26, DECISION_LOG
 * "A SAVE NEVER RESETS THE SCREEN — APP-WIDE").
 *
 * A door is a NAME, never a function: the browser sends `<area>.<action>` and the server door
 * (`app/_actions/save-in-place.ts`) looks it up in its own registry (`app/_actions/stay-registry/`) — typed
 * `Record<StayDoor, …>`, so a name here with no action there (or the reverse) does not compile, and a name the browser
 * invents is refused before anything runs. Each registered action re-runs its own sign-in, membership and gate checks
 * exactly as its plain `<form action>` does.
 *
 * Each area keeps its names in `lib/stay-doors/<area>.ts`. Pure (a client imports the TYPE from here, never the
 * registry). Held by `lib/a-save-never-resets-the-screen.test.ts`.
 */
import { ACC_CREATOR_STAY_DOORS } from './stay-doors/accCreator';
import { ACC_GROUP_STAY_DOORS } from './stay-doors/accGroup';
import { ACC_LAUNCHER_STAY_DOORS } from './stay-doors/accLauncher';
import { ACC_PEOPLE_STAY_DOORS } from './stay-doors/accPeople';
import { ACC_PROFILE_STAY_DOORS } from './stay-doors/accProfile';
import { DISPUTES_STAY_DOORS } from './stay-doors/disputes';
import { GUESTS_STAY_DOORS } from './stay-doors/guests';
import { HOSTS_STAY_DOORS } from './stay-doors/hosts';
import { INVITATION_STAY_DOORS } from './stay-doors/invitation';
import { MANPOWER_STAY_DOORS } from './stay-doors/manpower';
import { MEMORIES_STAY_DOORS } from './stay-doors/memories';
import { MONOGRAM_STAY_DOORS } from './stay-doors/monogram';
import { PANOOD_SETUP_STAY_DOORS } from './stay-doors/panoodSetup';
import { PAPIC_STAY_DOORS } from './stay-doors/papic';
import { PATIKTOK_STAY_DOORS } from './stay-doors/patiktok';
import { PHOTO_DELIVERY_STAY_DOORS } from './stay-doors/photoDelivery';
import { PUB_CHAT_STAY_DOORS } from './stay-doors/pubChat';
import { PUB_PANOOD_STAY_DOORS } from './stay-doors/pubPanood';
import { SCHEDULE_STAY_DOORS } from './stay-doors/schedule';
import { SPONSORS_STAY_DOORS } from './stay-doors/sponsors';
import { STD_STAMP_STAY_DOORS } from './stay-doors/stdStamp';
import { SUP_ACTIVITIES_STAY_DOORS } from './stay-doors/supActivities';
import { SUP_ATTRIBUTES_STAY_DOORS } from './stay-doors/supAttributes';
import { SUP_CALENDAR_STAY_DOORS } from './stay-doors/supCalendar';
import { SUP_CLIENTS_STAY_DOORS } from './stay-doors/supClients';
import { SUP_LINES_STAY_DOORS } from './stay-doors/supLines';
import { SUP_PAYMENTS_STAY_DOORS } from './stay-doors/supPayments';
import { SUP_TEAM_STAY_DOORS } from './stay-doors/supTeam';
import { SV_CONTRACTS_STAY_DOORS } from './stay-doors/svContracts';
import { SV_CREATORS_STAY_DOORS } from './stay-doors/svCreators';
import { SV_MESSAGES_STAY_DOORS } from './stay-doors/svMessages';
import { SV_PARTNERSHIPS_STAY_DOORS } from './stay-doors/svPartnerships';
import { SV_PROPOSALS_STAY_DOORS } from './stay-doors/svProposals';
import { SV_RECOMMENDATIONS_STAY_DOORS } from './stay-doors/svRecommendations';
import { SV_REPERTOIRE_STAY_DOORS } from './stay-doors/svRepertoire';
import { SV_SERVICES_STAY_DOORS } from './stay-doors/svServices';
import { SV_SUBSCRIPTION_STAY_DOORS } from './stay-doors/svSubscription';
import { VENDOR_REVIEW_STAY_DOORS } from './stay-doors/vendorReview';

export const STAY_DOORS = [...ACC_CREATOR_STAY_DOORS, ...ACC_GROUP_STAY_DOORS, ...ACC_LAUNCHER_STAY_DOORS, ...ACC_PEOPLE_STAY_DOORS, ...ACC_PROFILE_STAY_DOORS, ...DISPUTES_STAY_DOORS, ...GUESTS_STAY_DOORS, ...HOSTS_STAY_DOORS, ...INVITATION_STAY_DOORS, ...MANPOWER_STAY_DOORS, ...MEMORIES_STAY_DOORS, ...MONOGRAM_STAY_DOORS, ...PANOOD_SETUP_STAY_DOORS, ...PAPIC_STAY_DOORS, ...PATIKTOK_STAY_DOORS, ...PHOTO_DELIVERY_STAY_DOORS, ...PUB_CHAT_STAY_DOORS, ...PUB_PANOOD_STAY_DOORS, ...SCHEDULE_STAY_DOORS, ...SPONSORS_STAY_DOORS, ...STD_STAMP_STAY_DOORS, ...SUP_ACTIVITIES_STAY_DOORS, ...SUP_ATTRIBUTES_STAY_DOORS, ...SUP_CALENDAR_STAY_DOORS, ...SUP_CLIENTS_STAY_DOORS, ...SUP_LINES_STAY_DOORS, ...SUP_PAYMENTS_STAY_DOORS, ...SUP_TEAM_STAY_DOORS, ...SV_CONTRACTS_STAY_DOORS, ...SV_CREATORS_STAY_DOORS, ...SV_MESSAGES_STAY_DOORS, ...SV_PARTNERSHIPS_STAY_DOORS, ...SV_PROPOSALS_STAY_DOORS, ...SV_RECOMMENDATIONS_STAY_DOORS, ...SV_REPERTOIRE_STAY_DOORS, ...SV_SERVICES_STAY_DOORS, ...SV_SUBSCRIPTION_STAY_DOORS, ...VENDOR_REVIEW_STAY_DOORS] as const;

export type StayDoor = (typeof STAY_DOORS)[number];

export function isStayDoor(v: unknown): v is StayDoor {
  return typeof v === 'string' && (STAY_DOORS as readonly string[]).includes(v);
}
