'use client';

/**
 * BROWSE TOPICS — the active account's topics as tiles (approved Help prototype v5, § 07: "a tile grows to full screen
 * into its topic page; questions are rows, one open at a time"). The tile opens through THE one full screen
 * (`RiseScreen`), which grows out of the tile pressed and plays back into it on ✕ / Back. The topic page's rows are
 * drawn on the server and handed in as `pages` — the answers never ship as script.
 */
import { useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  CalendarHeart,
  Camera,
  ClipboardList,
  Gavel,
  Images,
  Info,
  Mail,
  MessageCircle,
  Palette,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { RiseScreen } from '@/app/_components/rise/rise-screen';

const ICON: Record<string, LucideIcon> = {
  'getting-started': Sparkles,
  guests: ClipboardList,
  invitations: Send,
  'vendors-budget': Wallet,
  'mood-board': Palette,
  papic: Camera,
  'live-studio': Video,
  messaging: MessageCircle,
  'orders-payments': Receipt,
  'people-memories': Images,
  'guest-getting-started': Mail,
  'guest-day-of': CalendarHeart,
  'account-privacy': ShieldCheck,
  'about-setnayan': Info,
  'supplier-fees': Receipt,
  'getting-verified': BadgeCheck,
  'admin-console-basics': Search,
  'admin-approvals': Users,
  'admin-force-majeure': Gavel,
};

export type TileTopic = { key: string; name: string; line: string };

export function TopicTiles({ topics, pages }: { topics: ReadonlyArray<TileTopic>; pages: Record<string, ReactNode> }) {
  const [open, setOpen] = useState<string | null>(null);
  const risen = open ? topics.find((t) => t.key === open) : undefined;
  return (
    <>
      <ul className="grid grid-cols-2 gap-3" data-help-tiles="">
        {topics.map((t) => {
          const Icon = ICON[t.key] ?? Info;
          return (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => setOpen(t.key)}
                aria-haspopup="dialog"
                data-help-tile={t.key}
                className="sn-press flex h-full min-h-[104px] w-full flex-col items-start gap-1 sn-glass-bare rounded-2xl p-3 text-left"
              >
                <Icon aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
                <span className="mt-1 text-sm font-semibold text-ink">{t.name}</span>
                <span className="text-xs leading-snug text-ink/65">{t.line}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {risen ? (
        <RiseScreen title={risen.name} line={risen.line} onClose={() => setOpen(null)} data={`help-topic-${risen.key}`}>
          <div className="px-4 pb-10 pt-1" data-help-topic={risen.key}>
            {pages[risen.key]}
          </div>
        </RiseScreen>
      ) : null}
    </>
  );
}
