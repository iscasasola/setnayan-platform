import { notFound } from 'next/navigation';
import { ReplyAskLab } from './reply-ask-lab';

/**
 * 📱 THE REPLY-ASK LAB — the one-time "Get a notice on this phone when guests reply?" sheet
 * (`guests/_components/reply-push-ask.tsx`, owner 2026-10-31) drawn open with no database and no browser
 * permission, for screenshots. `?mode=ask|ios` · `&dark=1` the dark set. Dev only.
 */
export default async function ReplyAskLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  return <ReplyAskLab mode={sp.mode === 'ios' ? 'ios-home-screen' : 'ask'} dark={sp.dark === '1'} />;
}
