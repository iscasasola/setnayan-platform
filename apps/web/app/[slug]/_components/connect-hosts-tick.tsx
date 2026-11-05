import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { CONNECT_HOSTS_FIELD, CONNECT_HOSTS_SHOWN } from '@/lib/guest-connects-hosts';
import { hostsToAsk } from '@/lib/guest-connects-hosts.server';

/**
 * 🤝 "ALSO CONNECT WITH <THE HOSTS>" — the one tick inside the link step (owner 2026-10-21; ruling and rules in
 * `lib/guest-connects-hosts.ts`). Drawn ON; the guest can untick it. It rides the SAME form as the press that keeps
 * the invitation, so it is answered in the same moment — never a second screen, never a second button.
 *
 * The press is 44×44 around a 20px box, drawn exactly as the Terms tick (`terms-tick.tsx`) so the two ticks a guest
 * may meet read as one control. `CONNECT_HOSTS_SHOWN` rides with it: the action asks the hosts only when this tick
 * was drawn AND left on.
 */
export function ConnectHostsTick({ line }: { line: string }) {
  if (!line) return null;
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-left text-sm text-ink/80" data-connect-hosts="">
      <input type="hidden" name={CONNECT_HOSTS_SHOWN} value="1" />
      <span className="relative -mx-3 -my-3 flex h-11 w-11 shrink-0 items-center justify-center">
        <input
          name={CONNECT_HOSTS_FIELD}
          type="checkbox"
          value="1"
          defaultChecked
          className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none h-5 w-5 rounded-sm border-[1.5px] border-ink/50 bg-white peer-checked:border-terracotta peer-checked:bg-terracotta peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mulberry"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute inset-0 m-auto hidden h-5 w-5 text-white peer-checked:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5.5 10.5 3 3 6-6.5" />
        </svg>
      </span>
      <span>{line}</span>
    </label>
  );
}

/**
 * The tick for the signed-in viewer of `eventId`, decided on the server (`hostsToAsk`): nothing when connections
 * are off, the viewer is a host, or every host is already on a row with them.
 */
export async function ConnectHostsTickFor({ eventId }: { eventId: string }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const found = await hostsToAsk(createAdminClient(), eventId, user.id);
  return found ? <ConnectHostsTick line={found.line} /> : null;
}
