import 'server-only';
import { PEOPLE_ERROR_WORDS, type AccPeopleStayDoor } from '@/lib/stay-doors/accPeople';
import { NOTHING_CHANGED, type StayWords } from '@/lib/save-in-place';
import {
  addDependent,
  addGodparent,
  createHandoverLink,
  deleteDependent,
  deleteGodparent,
  emailHandoverLink,
  revokeHandoverLink,
  setDependentSharing,
} from '@/app/dashboard/(account)/people/dependent-actions';
import { proposeSamahanConnection } from '@/app/dashboard/(account)/people/actions';
import { kind, type Door } from './_door';

/**
 * People's refusals in the page's own words (`PEOPLE_ERROR_WORDS`, what `people/page.tsx` shows for `?error=`); a raw
 * database sentence is said as given, an unknown code never raw. A save always lands with `?saved=1` / `?removed=1`; a
 * gate's bounce (switched off, a row that is not yours, a link already handed over) lands on the bare view with
 * neither — nothing was saved, so it is said as such, never "saved". Signed out → `/login`, an anonymous draft →
 * `/signup`: both navigate. An account screen — no event, no limited-helper area.
 */
const ACC_PEOPLE_WORDS: StayWords = {
  within: [/^\/dashboard\/people$/],
  refuse: (q) => {
    const e = q.get('error');
    if (e) return PEOPLE_ERROR_WORDS[e] ?? (/^[a-z_]+$/.test(e) ? NOTHING_CHANGED : e);
    return q.has('saved') || q.has('removed') ? null : NOTHING_CHANGED;
  },
};
const accPeople = kind(ACC_PEOPLE_WORDS, false);

export const ACC_PEOPLE: Readonly<Record<AccPeopleStayDoor, Door>> = {
  'accPeople.addDependent': accPeople(addDependent),
  'accPeople.deleteDependent': accPeople(deleteDependent),
  'accPeople.setDependentSharing': accPeople(setDependentSharing),
  'accPeople.addGodparent': accPeople(addGodparent),
  'accPeople.deleteGodparent': accPeople(deleteGodparent),
  'accPeople.createHandoverLink': accPeople(createHandoverLink),
  'accPeople.revokeHandoverLink': accPeople(revokeHandoverLink),
  'accPeople.emailHandoverLink': accPeople(emailHandoverLink),
  'accPeople.proposeSamahanConnection': accPeople(proposeSamahanConnection),
};
