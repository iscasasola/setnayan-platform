/**
 * front-door.tsx — the server half of the public front door at `/`.
 *
 * Loads the four rails, resolves who is looking, and hands the shell a set of
 * plain serializable props. The FEED is rendered here (a server component) and
 * passed through the client shell as `children`, so the writing that carries
 * this page never enters the JS bundle.
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { fetchUserRoleSummary } from '@/lib/roles';
import {
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_SLUG,
  type WeddingFolder,
} from '@/lib/taxonomy';
import {
  FOLDER_SERVICE_COUNT,
  FRONT_DOOR_VISIBLE_FOLDERS,
  FRONT_DOOR_MORE_FOLDERS,
} from '@/lib/taxonomy-folder-counts';

import { loadFrontDoorData } from './data';
import {
  FrontDoorShell,
  type FrontDoorAccount,
  type RailFolder,
  type RailTool,
} from './front-door-shell';
import { FrontDoorFeed, isChip, type ChipKey } from './front-door-feed';

/**
 * The Studio group.
 *
 * ⚠ SEVEN ROWS, EIGHT DOORWAYS. Alaala is the eighth public doorway but it
 * lives in the ACCOUNT SLOT ("What is Alaala?" signed out, "Alaala" signed
 * in), exactly as the prototype has it — so it is not repeated here.
 *
 * 🪤 PAKANTA IS DELIBERATELY ABSENT. It is sold, and it is reachable only from
 * inside the app — it has no public page. A row that goes nowhere is the one
 * thing this page forbids, so putting it here would be a fake door.
 * `doorway-invariants.test.ts` pins the eight that DO have public pages.
 */
const TOOLS: ReadonlyArray<RailTool> = [
  { href: '/setnayan-ai', name: 'Setnayan AI' },
  { href: '/pawebsite', name: 'Pawebsite' },
  { href: '/papic', name: 'Papic' },
  { href: '/panood', name: 'Live Studio' },
  { href: '/patiktok', name: 'Patiktok' },
  { href: '/pa3d', name: 'Pa3D' },
  { href: '/palogo', name: 'Palogo' },
];

function toRailFolder(f: WeddingFolder): RailFolder {
  return {
    slug: WEDDING_FOLDER_SLUG[f],
    label: WEDDING_FOLDER_LABEL[f],
    count: FOLDER_SERVICE_COUNT[f] ?? 0,
  };
}

function initialsFrom(email: string | null, name: string | null): string {
  const src = (name ?? '').trim() || (email ?? '').trim();
  if (!src) return '··';
  const parts = src.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  return (
    parts
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '··'
  );
}

/**
 * Who is looking, and what their account slot should say.
 *
 * Everything here is best-effort by design: a failed profile read must never
 * blank the front door for a stranger. It degrades to the signed-out slot,
 * which is a correct page rather than a broken one.
 */
async function resolveAccount(): Promise<FrontDoorAccount> {
  const signedOut: FrontDoorAccount = {
    signedIn: false,
    initials: '··',
    shopName: null,
    isAdmin: false,
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return signedOut;

    // ⚠ A REJECTED QUERY IS NOT A THROWN ERROR — `error` is checked, not
    // caught. A phantom column here would otherwise render a signed-in person
    // a signed-out rail with nothing said about it.
    const [
      { count: eventCount, error: eventErr },
      roles,
      { count: storyCount, error: storyErr },
    ] = await Promise.all([
        /*
          ⚠ THE SAME NARROWING /dashboard USES, or the two numbers disagree.
          `fetchUserEvents` filters `hidden_at IS NULL` (lib/events.ts) because
          a declined or left membership stamps that column — and the launcher
          then drops archived events too. Counting raw memberships made the
          rail promise "5 Events" and the board show 3, with no way for the
          person to find the missing two.

          `hidden_at` is matched here; archived is a property of the EVENT, not
          the membership, so it is excluded via the join rather than counted.
        */
        supabase
          .from('event_members')
          .select('event_id, events!inner(archived)', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('hidden_at', null)
          .eq('events.archived', false),
        /*
          ONE ROLE SUMMARY, NOT THREE HAND-ROLLED READS. fetchUserRoleSummary
          exists for exactly this question — "which consoles does this user
          have access to right now" — is cache()d, and uses THE admin predicate.

          ⚠ IT ALSO CLOSES A GAP THE HAND-ROLLED VERSION HAD. The rail gated the
          shop row on owning a `vendor_profiles` row, while /vendor-dashboard
          admits an OWNER **or** a `vendor_team_members` member. A shop's hired
          team member could open the console and get no row offering it. Latent
          today (prod: 0 team members who own nothing) — it bites the first hire.
        */
        fetchUserRoleSummary(supabase, user.id),
        // How many chapters this person has written — the same set the
        // destination lists as "Your chapters (N)", every status.
        supabase
          .from('creator_chapters')
          .select('chapter_id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

    return {
      signedIn: true,
      initials: initialsFrom(
        user.email ?? null,
        (user.user_metadata?.full_name as string | undefined) ?? null,
      ),
      // null ⇒ "couldn't load". Never 0 for a failed read.
      eventCount: eventErr ? null : (eventCount ?? 0),
      // ⚠ DELIBERATELY UNDEFINED — not null, not 0. The Alaala total is a
      // cross-event photo count this page does not compute, and a number we
      // have not measured is worse than no number. The row renders without a
      // count rather than claiming a failure that never happened.
      alaalaCount: undefined,
      // Named from the summary so a TEAM MEMBER gets the row too, matching what
      // /vendor-dashboard actually admits. Falls back to a neutral word rather
      // than hiding the row when access is real but no name came back.
      shopName: roles.hasVendorAccess
        ? (roles.vendorProfiles[0]?.business_name ?? 'Your shop')
        : null,
      // A FAILED READ MUST NOT GRANT THE ROW — a rejected query hides HQ rather
      // than offering a door that then refuses. The opposite direction from the
      // counts, and the right one: a missing row is a nuisance, an
      // offered-then-denied one is a lie.
      isAdmin: roles.hasAdminAccess,
      // null ⇒ "couldn't load". A real 0 is a real answer here — the desk is
      // open to everyone, so nothing is being hidden by showing zero.
      storyChapterCount: storyErr ? null : (storyCount ?? 0),
    };
  } catch {
    return signedOut;
  }
}

export async function FrontDoor({ chip }: { chip?: string }) {
  const [account, data] = await Promise.all([
    resolveAccount(),
    loadFrontDoorData(),
  ]);

  const activeChip: ChipKey = isChip(chip) ? chip : 'All';

  return (
    <FrontDoorShell
      account={account}
      visibleFolders={FRONT_DOOR_VISIBLE_FOLDERS.map(toRailFolder)}
      moreFolders={FRONT_DOOR_MORE_FOLDERS.map(toRailFolder)}
      tools={TOOLS}
    >
      <FrontDoorFeed data={data} chip={activeChip} />
    </FrontDoorShell>
  );
}
