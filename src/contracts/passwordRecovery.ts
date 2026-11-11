/** Recovery credentials never become the marketplace session or a route parameter. */
export type RecoveryErrorCode =
  | 'UNCONFIGURED' | 'INVALID_EMAIL' | 'INVALID_LINK' | 'SIGNED_IN' | 'ACCOUNT_CHANGED'
  | 'BUSY' | 'VERIFY_UNAVAILABLE' | 'REQUEST_UNCONFIRMED' | 'RATE_LIMITED'
  | 'WEAK_PASSWORD' | 'SAME_PASSWORD' | 'UPDATE_UNKNOWN' | 'RESTRICTED_ACCOUNT';

const messages: Record<RecoveryErrorCode, string> = {
  UNCONFIGURED: 'Oporavak lozinke još nije podešen za ovu verziju aplikacije.',
  INVALID_EMAIL: 'Unesite ispravnu email adresu.',
  INVALID_LINK: 'Link je nevažeći ili je istekao. Zatražite novi link.',
  SIGNED_IN: 'Najpre se odjavite sa otvorenog naloga, pa ponovo otvorite link za oporavak.',
  ACCOUNT_CHANGED: 'Nalog je promenjen. Ponovo otvorite link za oporavak.',
  BUSY: 'Prethodni zahtev se još obrađuje.',
  VERIFY_UNAVAILABLE: 'Ne možemo da proverimo link. Proverite vezu i pokušajte ponovo.',
  REQUEST_UNCONFIRMED: 'Ne možemo da potvrdimo slanje zahteva. Proverite email pre ponovnog pokušaja.',
  RATE_LIMITED: 'Previše zahteva za kratko vreme. Sačekajte pre ponovnog pokušaja.',
  WEAK_PASSWORD: 'Nova lozinka ne ispunjava bezbednosne uslove. Izaberite dužu i manje predvidljivu lozinku.',
  SAME_PASSWORD: 'Nova lozinka mora da se razlikuje od prethodne.',
  UPDATE_UNKNOWN: 'Nije potvrđeno da li je lozinka promenjena. Pokušajte prijavu novom lozinkom ili zatražite novi link.',
  // Owner decision 2026-10-07: a restricted account is told so, not that its link expired. The screens draw it as the
  // restricted-account panel; this sentence is the same fact for anything that only reads the message.
  RESTRICTED_ACCOUNT: 'Pristup ovom nalogu je ograničen, pa oporavak lozinke trenutno nije moguć.',
};

export class PasswordRecoveryError extends Error {
  constructor(readonly code: RecoveryErrorCode) {
    super(messages[code]);
    this.name = 'PasswordRecoveryError';
  }
}

export interface RecoveryIdentity { email: string }
export interface PasswordRecoverySession {
  verify(link: string): Promise<RecoveryIdentity>;
  updatePassword(password: string): Promise<void>;
  dispose(): void;
}
