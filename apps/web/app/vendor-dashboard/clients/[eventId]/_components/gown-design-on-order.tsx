/**
 * 👗 HER GOWN DESIGN FROM THE CHAT — on the supplier's order (gown maker port step B7; the Cake Maker's
 * `cake-design-on-order.tsx` shape). Server: ONE read finds the newest design the bride sent in this shop's chat; the
 * panel then reads it through `gownAction({ op: 'design' })`, which prices the cost lines for the shop only.
 *
 * Nothing is drawn when she never sent a design. A refused read says so — never "no design".
 */
import { AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { GOWN_DESIGN_HEAD } from '@/lib/gown-maker';
import type { PickedPageContext } from '../_pages/context';

const GownOrderPanel = dynamic(() => import('./gown-order-panel').then((m) => m.GownOrderPanel), {
  loading: () => <div className="sn-frame skeleton h-64" aria-busy="true" />,
});

export async function GownDesignOnOrder({ ctx }: { ctx: PickedPageContext }) {
  if (!ctx.threadId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('message_id')
    .eq('thread_id', ctx.threadId)
    .eq('sender_role', 'couple')
    .like('body', `${GOWN_DESIGN_HEAD}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logQueryError('GownDesignOnOrder.message', error, { thread_id: ctx.threadId }, 'graceful_degrade');
    return (
      <section className="mb-5" data-gown-design-order="failed">
        <p className="home-k2 mb-2">Her gown design</p>
        <p className="flex items-start gap-2 text-sn-base text-ink/70">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Couldn’t check the chat for a gown design just now. Reload to try again.
        </p>
      </section>
    );
  }
  if (!data) return null;
  return (
    <section className="mb-5" data-gown-design-order="ok">
      <p className="home-k2 mb-2">Her gown design</p>
      <GownOrderPanel threadId={ctx.threadId} messageId={(data as { message_id: string }).message_id} who={ctx.eventName} />
    </section>
  );
}
