/**
 * Package authoring — launch flag.
 *
 * Vendors have never been able to build a package (prod: zero `vendor_packages`
 * rows). The authoring actions and route ship behind this flag so the surface
 * can land, be reviewed and be exercised on preview before any vendor can
 * create a package that the live couple-side configurator would then render.
 *
 * Strict `=== 'true'`, so unset / '1' / 'yes' all mean OFF. Default OFF.
 */
export function packageAuthoringEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PACKAGE_AUTHORING === 'true';
}
