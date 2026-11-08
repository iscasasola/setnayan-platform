/**
 * <ServiceInfo> — a service's NAME, with its one-line ⓘ definition when the owner has written one (plan Track D,
 * item D4; DECISION_LOG 2026-11-06 "EVERY CATEGORY AND SERVICE IN THE SIGN-UP PICKER GETS AN ⓘ WITH A ONE-LINE
 * DEFINITION").
 *
 *     <ServiceInfo name={leaf.label} line={leaf.definition} />
 *
 * The line is `canonical_service_schemas.hint_en`, written on Admin › Categories › a service › Name › "ⓘ text" and
 * read on the server with `getServiceDefinitions()` / `serviceDefinition(key)` (lib/service-definitions.server.ts).
 *
 * 🚫 NO DEFINITION → NO ⓘ. An empty, blank or missing line prints the name alone — never a circle with nothing in
 * it, never a placeholder. This is the one place that rule is written; every surface that shows a service's ⓘ
 * renders this instead of its own `InfoTip`, so the rule cannot drift between them.
 *
 * Same shape as the sign-up picker's category ⓘ (`opened.category.hint ? <InfoTip label=…>{hint}</InfoTip> : label`).
 */
import { InfoTip } from '@/app/_components/info-tip';
import { cleanServiceDefinition } from '@/lib/service-definitions';

export function ServiceInfo({
  name,
  line,
  labelClassName,
  align = 'start',
}: {
  /** The service's visible name — always printed. */
  name: string;
  /** Its one-line definition, as read; null / blank = no ⓘ. */
  line: string | null | undefined;
  labelClassName?: string;
  align?: 'center' | 'start' | 'end';
}) {
  const text = cleanServiceDefinition(line);
  if (!text) {
    return (
      <span className={labelClassName} data-service-info="none">
        {name}
      </span>
    );
  }
  return (
    <span data-service-info="written">
      <InfoTip label={name} labelClassName={labelClassName} ariaLabel={`What is ${name}?`} align={align}>
        {text}
      </InfoTip>
    </span>
  );
}
