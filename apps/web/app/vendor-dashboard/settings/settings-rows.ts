/**
 * Settings › More tools and Help — pure data (simpler supplier dashboard step 6; prototype SCREENS.settings "More
 * tools · 15" and SCREENS.help).
 *
 * MORE TOOLS IS THE SHOP'S OWN SHELVES, NOT A SECOND LIST. It reads `shopToolShelves` (the same grant gates: the
 * Moodboard library only with access, Repertoire only for music trades), drops "Team & Setnayan" (Helpers is its own
 * Settings row), and adds the two small pages the prototype lists that the shelves did not: Manpower and Deep Search
 * (web only — the store shell refuses it, lib/store-shell.ts). A new tool added to the shelves appears here with no
 * edit. Held by `app/vendor-dashboard/settings/settings-is-one-list.test.ts`.
 */
import { FREE_BOOKING_LIMIT } from '@/lib/booking-fee-lock';
import { shopToolShelves, type ShopTool, type ShopToolShelf } from '../shop/shop-tool-shelves';

export const SETTINGS_HELP_HREF = '/vendor-dashboard/help';

const TEAM_HREF = '/vendor-dashboard/team';
const MANPOWER: ShopTool = { href: '/vendor-dashboard/shop?open=manpower#shop-folds', label: 'Manpower', sub: 'Pick up paid crew gigs from events already booked.' };
const DEEP_SEARCH: ShopTool = { href: '/vendor-dashboard/deep-search', label: 'Deep Search', sub: 'We read the web about your business and fill your details.' };

export function settingsMoreTools(opts: {
  hasMoodboardLibraryAccess: boolean;
  hasMusicRepertoireAccess: boolean;
  storeShell: boolean;
}): ShopToolShelf[] {
  return shopToolShelves(opts.hasMoodboardLibraryAccess, opts.hasMusicRepertoireAccess).map((shelf) => {
    const tools = shelf.tools.filter((t) => t.href !== TEAM_HREF);
    if (shelf.key === 'with-others') return { ...shelf, tools: [...tools, MANPOWER] };
    if (shelf.key === 'protection') return { ...shelf, tools: opts.storeShell ? tools : [...tools, DEEP_SEARCH] };
    return { ...shelf, tools };
  });
}

/** Help — five doors, each to a page that exists. */
export const SUPPLIER_HELP_ROWS: readonly { key: string; title: string; line: string; href: string }[] = [
  {
    key: 'fees',
    title: 'How fees work',
    line: `Your first ${FREE_BOOKING_LIMIT} are free · a fee only on couples Setnayan brings · locked until settled`,
    href: '/help/what-do-suppliers-pay-setnayan',
  },
  {
    key: 'booking',
    title: 'How booking works',
    line: 'They ask · you agree · the fee · they are told',
    href: '/help',
  },
  {
    key: 'paid',
    title: 'Getting paid',
    line: 'Couples pay you directly — bank, GCash or QR',
    href: '/vendor-dashboard/shop?open=payments#shop-folds',
  },
  {
    key: 'report',
    title: 'Report a problem',
    line: 'A couple · a booking · a stolen photo',
    href: '/vendor-dashboard/disputes',
  },
  {
    key: 'talk',
    title: 'Talk to Setnayan',
    line: 'Send us a message — we answer within a business day',
    href: '/help#contact',
  },
];
