'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { isClosedNow, type CloseRecord } from '@/lib/notices';
import { loadCloses } from '@/lib/notice-memory';
import { NoticeLine, type NoticeProps } from './notices';
import { getServerSnapshot, getSnapshot, subscribe, type NoticeEntry } from './notice-store';

/**
 * 🔔 A notice drawn WHERE IT STANDS — the one look (`NoticeLine`) and the one memory (`notice_closes` + this browser),
 * for the few notices the approved prototype keeps in place rather than in the page's top or end
 * (`prototypes/notices_system_2026-11-14_fable.html` §4): the payout to-do "on a client or quote page stays inline
 * where it is", the Event Pro line "used in three places" (inside the sheets it explains), a guest's reply-able
 * news, the booth review under the guest's number. Same kinds, same close words, same return rules; it simply does
 * not queue for the top. It is drawn on the server like the
 * line it replaced; a notice the memory says is closed leaves on the first client paint.
 */
/**
 * 📐 LAY OUT BY YOUR OWN WIDTH, NOT THE SCREEN'S (W1 tablet/desktop walk RW-351, 16 Nov 2026). The notice look
 * (`NoticeLine`) puts the line and its actions on one row from a 768px SCREEN. An in-place notice can stand in a
 * pane far narrower than the screen — the supplier's chat thread, beside its list — where that one row crushed the
 * sentence to a word per line under its own buttons. This wrapper makes the box a size container and, while IT is
 * under 600px, keeps the phone's stacked layout (sentence, then the actions on their own row) whatever the screen.
 * Wider than that it changes nothing; on a phone it restates what the phone already draws.
 */
export const BY_ITS_OWN_WIDTH =
  '[container-type:inline-size] [@container(max-width:599px)]:[&_[data-notice-key]]:block [@container(max-width:599px)]:[&_[data-notice-actions]]:mt-2';

export function InlineNotice(props: NoticeProps & { className?: string }) {
  const { className, ...n } = props;
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [loaded, setLoaded] = useState<{ key: string; rec: CloseRecord | null } | null>(null);
  useEffect(() => {
    let live = true;
    const legacy = n.legacy?.() ?? null;
    if (legacy) {
      setLoaded({ key: n.noticeKey, rec: legacy });
      return;
    }
    void loadCloses([n.noticeKey]).then((m) => {
      if (live) setLoaded({ key: n.noticeKey, rec: m.get(n.noticeKey) ?? null });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the memory is per key
  }, [n.noticeKey]);
  // Drawn on the server and the first paint (it stood here before it joined the system — no pop-in, no layout shift);
  // once the memory is read, a closed one leaves. A close made on this page lands in the store at once.
  const fromMemory = loaded && loaded.key === n.noticeKey ? loaded.rec : null;
  const rec = s.closes.has(n.noticeKey) ? s.closes.get(n.noticeKey) : fromMemory;
  if (isClosedNow({ key: n.noticeKey, kind: n.kind, ask: n.ask, closable: n.closable }, rec, Date.now())) return null;
  const entry: NoticeEntry = { ...n, id: n.noticeKey, key: n.noticeKey };
  return (
    <div className={className} data-inline-notice="">
      <NoticeLine entry={entry} />
    </div>
  );
}

