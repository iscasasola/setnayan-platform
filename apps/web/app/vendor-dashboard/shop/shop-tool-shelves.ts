/**
 * Pure data for the shop-tools shelves — split out of `page.tsx` so this
 * logic unit-tests without dragging in that file's server-component import
 * chain (Supabase clients, other dashboard surfaces, etc).
 */

export type ShopTool = { href: string; label: string; sub: string };
export type ShopToolShelf = { key: string; label: string; tools: ShopTool[] };

export const TOOLS_COUPLES_SEE: ShopTool[] = [
  { href: '/vendor-dashboard/reviews', label: 'Reviews', sub: 'Ratings and written reviews from booked couples.' },
  { href: '/vendor-dashboard/track-record', label: 'Track record', sub: 'Completed events and the public proof they build.' },
  { href: '/vendor-dashboard/real-stories', label: 'Stories', sub: 'Editorial features starring your work.' },
  { href: '/vendor-dashboard/recaps', label: 'Recaps', sub: 'Living recaps from events you served.' },
  { href: '/vendor-dashboard/repertoire', label: 'Repertoire', sub: 'Your set list / portfolio pieces for couples to browse.' },
  { href: '/vendor-dashboard/attributes', label: 'Attributes', sub: 'Traits and tags that sharpen your matching.' },
  // 🔴 ADDED 2026-08-06 — /vendor-dashboard/activities shipped 2026-07-28 with
  // NO doorway anywhere in the repo: no <Link>, no router.push, no redirect, no
  // nav-config entry, no route-builder, no registry key. Its deliberately-
  // identical sibling /vendor-dashboard/repertoire (the line above) had five.
  // A host wrote his segments into a page he could only reach by typing the URL.
  { href: '/vendor-dashboard/activities', label: 'Your segments', sub: 'The parts of the night you run — couples tick these onto their timeline.' },
];

export const TOOLS_WITH_OTHERS: ShopTool[] = [
  { href: '/vendor-dashboard/recommendations', label: 'Recommend', sub: 'Vendors you vouch for, and who vouches for you.' },
  { href: '/vendor-dashboard/partnerships', label: 'Partnerships', sub: 'Preferred-partner ties with other vendors.' },
  { href: '/vendor-dashboard/creators', label: 'Creators', sub: 'Offer discounts to creators for a credited feature in their story.' },
  // Branches removed 2026-07-16 — the Branch tile above (ManageTiles, inline
  // BranchManager) is the canonical branch surface; the standalone /branches
  // route now redirects here. Team stays: /team hosts the extra-seat purchase
  // flow the inline Team tile doesn't.
  { href: '/vendor-dashboard/team', label: 'Team & Setnayan', sub: 'Seats, roles, and your Setnayan relationship.' },
];

export const TOOLS_PROTECTION: ShopTool[] = [
  { href: '/vendor-dashboard/disputes', label: 'Disputes', sub: 'Open cases and their timelines.' },
  { href: '/vendor-dashboard/theft-watch', label: 'Theft Watch', sub: 'Portfolio-theft reports and takedowns.' },
];

// Moodboard library card — MB10/MB11 widened this to every supplying trade
// (lib/moodboard-library-access.ts), not stylist/decorators alone. It sits on
// the couples-see shelf because that is what it feeds.
export const MOODBOARD_LIBRARY_TOOL: ShopTool = { href: '/vendor-dashboard/moodboard-library', label: 'Moodboard library', sub: 'Photos couples browse when picking their look — pulled from your own work.' };

export function shopToolShelves(hasMoodboardLibraryAccess: boolean): ShopToolShelf[] {
  return [
    {
      key: 'couples-see',
      label: 'What couples see',
      tools: hasMoodboardLibraryAccess ? [MOODBOARD_LIBRARY_TOOL, ...TOOLS_COUPLES_SEE] : TOOLS_COUPLES_SEE,
    },
    { key: 'with-others', label: 'Working with others', tools: TOOLS_WITH_OTHERS },
    { key: 'protection', label: 'Protection', tools: TOOLS_PROTECTION },
  ];
}
