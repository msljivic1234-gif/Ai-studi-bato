/**
 * The words the sign-in screens say in more than one place, so each is spelled once (TEKSTOVI, 2026-10-07, finding W2 #5: three
 * names for one function). "Oporavak lozinke" is the name of recovering a password, on the way in and on the link's own screen;
 * "Zaboravljena lozinka?" stays what the person taps to get there, because it is the question they are asking, not a name.
 * The test `auth-copy-one-name.test.ts` keeps the three old names out of every file of the sign-in screens.
 */
export const authCopy = {
  /** The first step names the selected way; the switch directly below can change it. */
  resume: 'Nastavite tamo gde ste stali.',
  recoveryName: 'Oporavak lozinke',
  forgot: 'Zaboravljena lozinka?',
  signIn: 'Prijavite se',
  signUp: 'Napravite nalog',
  /** The sign-in way of the switch (the other way is `signUp`). */
  signInWay: 'Prijava',
  backToSignIn: 'Nazad na prijavu',
  back: 'Nazad',
  retry: 'Pokušajte ponovo',
  /** The one sentence for a failure nobody can say more about. It names the next step. */
  failed: 'Nešto nije uspelo. Pokušajte ponovo.',
  oneAccount: 'Jedan nalog za sve: objavite zadatak ili uskočite.',
  /** Said instead of a tick that recorded nothing (owner rule PKG-031), while the legal documents are not published. */
  legal: 'Uslovi korišćenja i Politika privatnosti još nisu objavljeni.',
} as const;
