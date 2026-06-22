import { CheckCircle2, MinusCircle } from 'lucide-react';

// Integration Activation Console — PR4d. READ-ONLY status for the integrations
// that genuinely CANNOT be DB-flipped without a redeploy:
//   • build-time-inlined values (R2_PUBLIC_URL → next/image remotePatterns;
//     NEXT_PUBLIC_VAPID_PUBLIC_KEY → client bundle), and
//   • bootstrap secrets that the DB read itself depends on (ENCRYPTION_KEY,
//     Supabase service-role, R2 S3 creds).
// These are env-only by nature; the console shows them present/absent so the
// owner can confirm prod config at a glance. NEVER renders a secret value.

export type BuildTimeItem = {
  label: string;
  present: boolean;
  /** Shown only for NON-secret values (host / subject). Never set for secrets. */
  value?: string;
  note?: string;
};

export function BuildTimeStatus({ items }: { items: BuildTimeItem[] }) {
  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
        These are <strong>build-time or bootstrap</strong> values — set them in Vercel and
        redeploy. They can&rsquo;t be flipped live (a host is inlined into the client bundle /
        the key is what reads the database itself).
      </p>
      <ul className="divide-y divide-ink/10">
        {items.map((item) => (
          <li key={item.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                item.present ? 'text-emerald-800' : 'text-ink/45'
              }`}
            >
              {item.present ? (
                <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <MinusCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {item.present ? 'Set' : 'Not set'}
            </span>
            <span className="text-sm text-ink/80">{item.label}</span>
            {item.value ? (
              <span className="font-mono text-xs text-ink/55 break-all">· {item.value}</span>
            ) : null}
            {item.note ? (
              <span className="w-full pl-[3.25rem] text-xs text-ink/45">{item.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
