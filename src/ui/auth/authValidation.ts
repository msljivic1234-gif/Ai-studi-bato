import { tidyPlaceLabel } from '../location/placeText';

/**
 * What is wrong with the sign-in and sign-up fields BEFORE anything is sent: said under the field it is about, one sentence
 * each, in the order the fields stand (so the first one can be focused). Nothing here reaches the network; the server's own
 * answers are said by the screen under the form, never under a field.
 */
export type AuthFieldName = 'ime' | 'prezime' | 'email' | 'lozinka';
export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

/** The top-to-bottom order of the fields on the screen. */
export const AUTH_FIELD_ORDER: readonly AuthFieldName[] = ['ime', 'prezime', 'email', 'lozinka'];

export const MIN_PASSWORD_LENGTH = 6;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmailAddress = (value: string): boolean => EMAIL_ADDRESS.test(value.trim());

export const authFieldMessages = {
  ime: 'Unesite ime.',
  prezime: 'Unesite prezime.',
  emailMissing: 'Unesite email.',
  emailInvalid: 'Unesite ispravnu email adresu.',
  lozinkaMissing: 'Unesite lozinku.',
  lozinkaShort: `Lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.`,
  /** The quiet line under the password while a new one is being made, before it can be wrong. */
  lozinkaHint: `Najmanje ${MIN_PASSWORD_LENGTH} znakova.`,
} as const;

export type AuthFormValues = { ime: string; prezime: string; email: string; lozinka: string };

/**
 * Signing in needs an email and password; making an account needs a name, surname, email and a new password of at
 * least six characters. City belongs to work areas and task location, not signup. A length is only ever asked of a NEW password: an old one is whatever it was.
 */
export function validateAuthForm(way: 'LOGIN' | 'SIGNUP', values: AuthFormValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (way === 'SIGNUP') {
    if (!values.ime.trim()) errors.ime = authFieldMessages.ime;
    if (!values.prezime.trim()) errors.prezime = authFieldMessages.prezime;
  }
  if (!values.email.trim()) errors.email = authFieldMessages.emailMissing;
  else if (!isEmailAddress(values.email)) errors.email = authFieldMessages.emailInvalid;
  if (!values.lozinka) errors.lozinka = authFieldMessages.lozinkaMissing;
  else if (way === 'SIGNUP' && values.lozinka.length < MIN_PASSWORD_LENGTH) errors.lozinka = authFieldMessages.lozinkaShort;
  return errors;
}

/** The first field with something wrong, top to bottom, or null. */
export function firstInvalidField(errors: AuthFieldErrors): AuthFieldName | null {
  return AUTH_FIELD_ORDER.find(name => errors[name] !== undefined) ?? null;
}

/**
 * Legacy city formatter, retained for older direct callers; signup no longer asks for a city.
 * The city as it is KEPT: trimmed, and with a careless case put right ("NovI SAD", "NOVI SAD" and "novi sad" all become "Novi
 * Sad"; the owner's own profile had read "NovI SAD"). A city that is already well formed is returned as it is. The same helper
 * that tidies a place everywhere else in the app, so the sign-up never invents a second rule.
 */
export const tidyCity = (value: string): string => tidyPlaceLabel(value.trim());
