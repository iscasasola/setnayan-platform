/*
  TEST TOOLING — a stand-in for the little of `document` the theme touches (the class list on <html>, the cookie jar,
  the theme-color tag). Used by lib/theme-switch.test.ts, lib/appearance-control.test.ts and
  lib/no-surface-ships-dark-by-accident.test.ts. No app file imports it.
*/
import { THEME_COLOR } from '../app/_components/theme-bootstrap-script';

/** A stand-in for the little of `document` the theme touches. */
export function fakeDocument(opts: { cookie?: string; startsDark?: boolean; noMeta?: boolean } = {}) {
  const classes = new Set<string>(opts.startsDark ? ['dark', 'font-var'] : ['font-var']);
  const meta = { content: THEME_COLOR.light as string };
  let jar = opts.cookie ?? '';
  const asked: string[] = [];
  const doc = {
    get cookie() {
      return jar;
    },
    /* Like the real one: an assignment sets or (max-age=0) removes ONE cookie; reading gives `name=value; …`. */
    set cookie(line: string) {
      const [pair, ...attrs] = line.split(';').map((s) => s.trim());
      const eq = pair!.indexOf('=');
      const name = pair!.slice(0, eq);
      const value = pair!.slice(eq + 1);
      const rest = jar.split('; ').filter((c) => c && !c.startsWith(`${name}=`));
      const gone = attrs.some((a) => /^max-age=0$/i.test(a));
      jar = (gone ? rest : [...rest, `${name}=${value}`]).join('; ');
    },
    documentElement: {
      classList: {
        toggle(name: string, force?: boolean) {
          const on = force ?? !classes.has(name);
          if (on) classes.add(name);
          else classes.delete(name);
          return on;
        },
        contains: (name: string) => classes.has(name),
      },
    },
    querySelector(sel: string) {
      asked.push(sel);
      if (opts.noMeta || sel !== 'meta[name="theme-color"]') return null;
      return {
        setAttribute(name: string, value: string) {
          if (name === 'content') meta.content = value;
        },
      };
    },
  };
  return { doc, isDark: () => classes.has('dark'), classes, meta, asked };
}
