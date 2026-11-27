/*
 * Instant loading shell for /vendor-dashboard/messages — the Chats list (L6 · S4, walk 27 Nov 2026: the first load read
 * only "Loading…" for seconds under a feed of message cards this page never draws). 👻 Ghost, the page's own shape: the
 * full-screen column (`SupplierChats`), its known top bar "Chats" at once, then one row per event — avatar, the chat's
 * title, its last line — grey under the Sheen until the list lands.
 */
import { Screen, Sk, SkCircle } from '@/components/skeletons';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-2">
      <Screen label="Loading your chats" className="space-y-1">
        <div className="mb-1 flex min-h-11 items-center gap-1">
          <Sk className="h-6 w-6 rounded-full" />
          <span aria-hidden className="text-sn-xl font-semibold leading-tight text-ink">
            Chats
          </span>
        </div>
        <ul aria-hidden className="divide-y divide-[color:var(--m-line)]">
          {Array.from({ length: 7 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <SkCircle size="h-11 w-11" />
              <div className="min-w-0 flex-1 space-y-2">
                <Sk className="h-3.5 w-1/2 rounded" />
                <Sk className="h-3 w-4/5 rounded" />
              </div>
              <Sk className="h-3 w-10 rounded" />
            </li>
          ))}
        </ul>
      </Screen>
    </div>
  );
}
