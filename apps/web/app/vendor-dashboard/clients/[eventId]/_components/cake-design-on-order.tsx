/**
 * 🎂 THEIR DESIGN FROM THE CHAT — the couple's cake design on the supplier's order (Cake Maker drawing §03, "the same
 * card on the order"). Server: ONE read finds the newest design the couple sent in this shop's chat, and the order's
 * own making time; the card itself is the chat's card (lazy), which reads the design honestly.
 *
 * Nothing is drawn when the couple never sent a design. A refused read says so — never "no design".
 */
import { AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { CAKE_DESIGN_HEAD_WORDS } from '@/lib/chat-card-lines';
import { customerCardHref } from '@/lib/upcoming-schedule-door';
import { CakeDesignCard } from '@/app/_components/chat/cards/lazy-cards';
import type { PickedPageContext } from '../_pages/context';

const dayWords = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

function minusDays(iso: string, n: number): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - n);
  return d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export async function CakeDesignOnOrder({ ctx }: { ctx: PickedPageContext }) {
  if (!ctx.threadId) return null;
  const supabase = await createClient();
  const [msgRes, rowRes] = await Promise.all([
    supabase
      .from('chat_messages')
      .select('message_id, created_at')
      .eq('thread_id', ctx.threadId)
      .eq('sender_role', 'couple')
      .like('body', `%${CAKE_DESIGN_HEAD_WORDS}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    ctx.eventVendorId
      ? supabase.from('event_vendors').select('prep_days').eq('vendor_id', ctx.eventVendorId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (msgRes.error) {
    logQueryError('CakeDesignOnOrder.message', msgRes.error, { thread_id: ctx.threadId }, 'graceful_degrade');
    return (
      <section className="mb-5" data-cake-design-order="failed">
        <p className="home-k2 mb-2">Their design</p>
        <p className="flex items-start gap-2 text-[13px] text-ink/70">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn’t check the chat for a cake design just now. Reload to try again.
        </p>
      </section>
    );
  }
  const msg = msgRes.data as { message_id: string; created_at: string } | null;
  if (!msg) return null;
  if (rowRes.error) logQueryError('CakeDesignOnOrder.prep', rowRes.error, { event_id: ctx.eventId }, 'graceful_degrade');
  const prep = rowRes.error ? null : ((rowRes.data as { prep_days: number | null } | null)?.prep_days ?? null);
  const sent = new Date(msg.created_at).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
  const from = prep != null && prep > 0 && ctx.eventDate ? minusDays(ctx.eventDate, prep) : null;
  return (
    <section className="mb-5" data-cake-design-order="">
      <p className="home-k2 mb-2">
        Their design <span className="font-normal text-ink/55">from the chat · {sent}</span>
      </p>
      <CakeDesignCard
        threadId={ctx.threadId}
        messageId={msg.message_id}
        place="order"
        links={{ quoteHref: customerCardHref(ctx.eventId, 'quote'), chatHref: customerCardHref(ctx.eventId, 'chat') }}
      />
      <p className="home-k2 mb-2 mt-4">Making time</p>
      <p className="text-[14px] text-ink" data-cake-making-time="">
        {prep != null && prep > 0 ? (
          <>
            {dayWords(prep)} for this order
            <span className="text-ink/55"> · you set it on the quote{from ? ` · from ${from}` : ''}</span>
          </>
        ) : rowRes.error ? (
          <span className="text-ink/70">Couldn’t load the making time just now.</span>
        ) : (
          <span className="text-ink/70">Not set for this order yet — confirm it on the quote.</span>
        )}
      </p>
    </section>
  );
}
