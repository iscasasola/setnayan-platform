import type { Event } from "@/lib/db/types";

export function InvitationFooter({ event }: { event: Event }) {
  const hashtag = `#${event.bride_first_name}And${event.groom_first_name}${event.event_date.slice(0, 4)}`;
  return (
    <footer className="mt-2 flex flex-col items-center gap-2 border-t border-rule pt-8 text-center">
      <p className="font-serif text-[18px] italic text-ink lg:text-[20px]">{hashtag}</p>
      <p className="meta-label">Powered by Tayo</p>
    </footer>
  );
}
