/**
 * Package authoring — launch flag.
 *
 * Vendors have never been able to build a package (prod: zero `vendor_packages`
 * rows). The authoring actions and route ship behind this flag so the surface
 * can land, be reviewed and be exercised on preview before any vendor can
 * create a package that the live couple-side configurator would then render.
 *
 * Default OFF. Read through the shared lenient parser (lib/env-flag.ts), so
 * `true` / `TRUE` / `1` / `yes` / `on` all mean ON and everything else — unset,
 * empty, a typo — means OFF.
 */
import { envFlagEnabled } from '@/lib/env-flag';

export function packageAuthoringEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_PACKAGE_AUTHORING);
}
