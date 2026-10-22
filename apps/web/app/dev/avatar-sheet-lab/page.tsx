import { notFound } from 'next/navigation';
import { SheetLab } from './sheet-lab';

/**
 * 🪪 THE AVATAR SHEET LAB — Direction 2 "Profile header" (owner 2026-10-22) drawn through the shipped
 * `SwitcherPanelBody`, with fixture people and no database. `?who=owner|supplier|helper|couple` · `&app=1` the store
 * shell (Plan is not drawn) · `&dark=1` the dark set · `&nocount=1` a refused count read (no row draws a count).
 */
export default async function AvatarSheetLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const who = typeof sp.who === 'string' ? sp.who : 'owner';
  return <SheetLab who={who} app={sp.app === '1'} dark={sp.dark === '1'} noCount={sp.nocount === '1'} />;
}
