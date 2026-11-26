'use client';

import { GownDesignCard } from '@/app/_components/chat/cards/gown-design-card';
import { GownShareForm } from '@/app/vendor-dashboard/invite/_components/gown-share-form';
import type { GownCard } from '@/lib/gown-maker.server';

/** A sample design (the lab's own picture; the amount is a sample). */
const SAMPLE: GownCard = {
  designId: '00000000-0000-4000-8000-000000000001',
  which: 'female',
  summary: ['Mermaid silhouette', 'Ivory mikado, 2 m train', 'Sweetheart neckline, beaded bodice'],
  priceShownCentavos: 8_500_000,
  thumbDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAACgCAIAAABIaz/HAAABw0lEQVR42u3QuU0AQRAAMPovkAIQASERMT3cze58llyBP74+f7jgQ4Fo0YgWLdqCaNGIFi3agmjRiBYtGtGiES1adCV/v99RRIsWLVq0aNGiRYsWLVp0v+jA5WrXokWLFi1atGjRokWLFi06YbnUtWjRokWLFi1atGjRokWLzlmucy1atGjRokWLFi1atGjRotOWi1yLXhN9YbnCtegd0deW069FixbddDn3WvT06JTlxGvRo6MTl7OuRYsW3X055Vr00Ogiy/evRYsWPWP58rXocdEFl29ei54VXXb52rVo0aKHLd+5Fj0lusXyhWvRI6IbLZ++Fi1a9NTlo9eim0c3XT53LVq06NnLh65Ft40esHziWnTP6DHL4deiRYteshx7Lbpb9MjlwGvRokWvWo66Ft0nevxyyLXoJtFLlt9fixYteufyy2vR5aMXLr+5Fl07eu3y42vRokUvX352LbpqtOJn16JFb46W+/hadL1orW+uRReLFvryWrTohdEq31+LLhMtMeRadI1ofVHXokXviRYXeC06O1pZ7LVo0RuiZYVfi86L1nTiWnRStKBD16JFD45Wc+5a9PVoKUevRV+K/gf3u1VZiNVSAwAAAABJRU5ErkJggg==',
};

const EVENT_TYPES = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'debut', label: 'Debut' },
];

export default function Lab({ view, fail }: { view: string; fail: boolean }) {
  if (view === 'share') {
    return (
      <main className="sn-vt-page mx-auto w-full max-w-xl px-4 py-6">
        <h1 className="text-sn-xl font-semibold text-ink">Gown design</h1>
        <GownShareForm eventTypes={EVENT_TYPES} />
      </main>
    );
  }
  return (
    <main className="sn-vt-page mx-auto grid w-full max-w-xl gap-6 px-4 py-6">
      <section>
        <p className="pb-2 text-sn-md text-[color:var(--m-slate-2)]">The couple sees</p>
        <GownDesignCard threadId="lab" messageId="lab" viewer="couple" stamp="Atelier Lumière · from the Gown Maker · 10:24" seed={fail ? 'failed' : SAMPLE} />
      </section>
      <section>
        <p className="pb-2 text-sn-md text-[color:var(--m-slate-2)]">The shop sees</p>
        <GownDesignCard threadId="lab" messageId="lab" viewer="vendor" stamp="You · shared from the Gown Maker · 10:24" seed={fail ? 'failed' : { ...SAMPLE, priceShownCentavos: null }} />
      </section>
    </main>
  );
}
