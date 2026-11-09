import 'server-only';
import type { StayDoor } from '@/lib/stay-doors';
import type { Door } from './_door';
import { ACC_CREATOR } from './accCreator';
import { ACC_GROUP } from './accGroup';
import { ACC_LAUNCHER } from './accLauncher';
import { ACC_PEOPLE } from './accPeople';
import { ACC_PROFILE } from './accProfile';
import { DISPUTES } from './disputes';
import { GUESTS } from './guests';
import { HOSTS } from './hosts';
import { INVITATION } from './invitation';
import { MANPOWER } from './manpower';
import { MEMORIES } from './memories';
import { MONOGRAM } from './monogram';
import { PANOOD_SETUP } from './panoodSetup';
import { PAPIC } from './papic';
import { PATIKTOK } from './patiktok';
import { PHOTO_DELIVERY } from './photoDelivery';
import { PUB_CHAT } from './pubChat';
import { PUB_PANOOD } from './pubPanood';
import { SCHEDULE } from './schedule';
import { SPONSORS } from './sponsors';
import { STD_STAMP } from './stdStamp';
import { SUP_ACTIVITIES } from './supActivities';
import { SUP_ATTRIBUTES } from './supAttributes';
import { SUP_CALENDAR } from './supCalendar';
import { SUP_CLIENTS } from './supClients';
import { SUP_LINES } from './supLines';
import { SUP_PAYMENTS } from './supPayments';
import { SUP_TEAM } from './supTeam';
import { SV_CONTRACTS } from './svContracts';
import { SV_CREATORS } from './svCreators';
import { SV_MESSAGES } from './svMessages';
import { SV_PARTNERSHIPS } from './svPartnerships';
import { SV_PROPOSALS } from './svProposals';
import { SV_RECOMMENDATIONS } from './svRecommendations';
import { SV_REPERTOIRE } from './svRepertoire';
import { SV_SERVICES } from './svServices';
import { SV_SUBSCRIPTION } from './svSubscription';
import { VENDOR_REVIEW } from './vendorReview';

/**
 * 📍 THE STAY-DOOR REGISTRY — the allow-list `app/_actions/save-in-place.ts` runs from. One file per area
 * (`./<area>.ts`, each a `Record<its names, Door>`); typed `Record<StayDoor, Door>` here, so a name in
 * `lib/stay-doors.ts` with no action (or an action with no name) does not compile.
 */
export const DOORS: Readonly<Record<StayDoor, Door>> = {
  ...ACC_CREATOR,
  ...ACC_GROUP,
  ...ACC_LAUNCHER,
  ...ACC_PEOPLE,
  ...ACC_PROFILE,
  ...DISPUTES,
  ...GUESTS,
  ...HOSTS,
  ...INVITATION,
  ...MANPOWER,
  ...MEMORIES,
  ...MONOGRAM,
  ...PANOOD_SETUP,
  ...PAPIC,
  ...PATIKTOK,
  ...PHOTO_DELIVERY,
  ...PUB_CHAT,
  ...PUB_PANOOD,
  ...SCHEDULE,
  ...SPONSORS,
  ...STD_STAMP,
  ...SUP_ACTIVITIES,
  ...SUP_ATTRIBUTES,
  ...SUP_CALENDAR,
  ...SUP_CLIENTS,
  ...SUP_LINES,
  ...SUP_PAYMENTS,
  ...SUP_TEAM,
  ...SV_CONTRACTS,
  ...SV_CREATORS,
  ...SV_MESSAGES,
  ...SV_PARTNERSHIPS,
  ...SV_PROPOSALS,
  ...SV_RECOMMENDATIONS,
  ...SV_REPERTOIRE,
  ...SV_SERVICES,
  ...SV_SUBSCRIPTION,
  ...VENDOR_REVIEW,
};
