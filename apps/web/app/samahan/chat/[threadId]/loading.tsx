/**
 * /samahan/chat/[threadId] — one event group chat, while the server answers.
 *
 * WHY: the speed audit of 2026-11-27 (Group J) found a tap here showed nothing until the server answered —
 * 8 reads in 4 steps before paint (the group's head, then members, former members, messages, the event's groups
 * and its people).
 *
 * SHAPE: the thread's own full-screen takeover, as `ChatBox` draws it — the slim head (back ring, the group's round,
 * its name and line), the bubbles settling at the foot (theirs on the left past the avatar gutter, yours on the
 * right), then the composer row. The group's name is not known here, so it is a grey Ghost.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private page,
 * as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk, SkCircle } from '@/components/skeletons';

const BUBBLES = [
  { mine: false, w: 'w-3/5' },
  { mine: true, w: 'w-2/5' },
  { mine: false, w: 'w-2/3' },
  { mine: true, w: 'w-1/2' },
  { mine: false, w: 'w-2/5' },
] as const;

export default function GroupChatLoading() {
  return (
    <Screen className="flex min-h-dvh flex-col">
      {/* The head — back ring · the group's round · name over its line. */}
      <div className="flex items-center gap-2 border-b border-ink/10 py-2 pl-1 pr-2">
        <SkCircle size="h-10 w-10" className="mx-0.5" />
        <SkCircle size="h-9 w-9" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Ghost className="h-4 w-32 rounded" />
          <Sk className="h-3 w-24 rounded" />
        </div>
      </div>
      {/* The stream — bubbles settle at the foot, as a thread opens on its newest line. */}
      <ol className="flex flex-1 flex-col justify-end gap-1.5 px-2.5 py-3">
        {BUBBLES.map((b, i) => (
          <li key={i} className={`flex ${b.mine ? 'justify-end' : 'justify-start pl-9'}`}>
            <Sk className={`h-9 rounded-2xl ${b.w}`} />
          </li>
        ))}
      </ol>
      {/* The composer row. */}
      <div className="border-t border-ink/10 px-4 pb-3 pt-2">
        <Sk className="h-10 w-full rounded-2xl" />
      </div>
    </Screen>
  );
}
