/** Privacy-safe system-push copy. No user-authored text or entity data enters this function. */
const GENERIC = Object.freeze({ title: 'USKOČI', body: 'Imate novo obaveštenje. Otvorite aplikaciju.' });

const COPY = Object.freeze({
  OPPORTUNITY_AVAILABLE: ['Novi zadatak za Vas', 'Pojavila se nova prilika koja može da Vam odgovara.'],
  RESPONSE_RECEIVED: ['Nova prijava', 'Stigla je nova prijava na Vaš zadatak.'],
  RESPONSE_UPDATED: ['Prijava je izmenjena', 'Jedna prijava na Vaš zadatak je ažurirana.'],
  RESPONSE_VIEWED: ['Prijava je pregledana', 'Vaša prijava je pregledana.'],
  RESPONSE_SHORTLISTED: ['U užem ste izboru', 'Vaša prijava je izdvojena za dalji izbor.'],
  RESPONSE_SELECTED: ['Vaša prijava je izabrana', 'Otvorite Dogovor.'],
  RESPONSE_NOT_SELECTED: ['Prijava je završena', 'Za ovaj zadatak je izabrana druga osoba.'],
  RESPONSE_STALE: ['Proverite prijavu', 'Zadatak je promenjen nakon Vaše prijave.'],
  RESPONSE_WITHDRAWN: ['Prijava je povučena', 'Jedna prijava više nije aktivna.'],
  RESPONSE_EXPIRED: ['Prijava je istekla', 'Ova prijava više nije aktivna.'],
  NEED_REVISED: ['Zadatak je izmenjen', 'Promenjeni su podaci zadatka koji pratite.'],
  NEED_CANCELLED: ['Zadatak je otkazan', 'Zadatak više nije aktivan.'],
  AGREEMENT_VERSION_CHANGED: ['Dogovor je ažuriran', 'Promenjeni su uslovi Dogovora.'],
  AGREEMENT_CHANGE_PROPOSED: ['Predložena je izmena Dogovora', 'Proverite predložene uslove.'],
  AGREEMENT_CHANGE_REJECTED: ['Izmena nije prihvaćena', 'Predlog izmene Dogovora nije prihvaćen.'],
  AGREEMENT_CANCELLED: ['Dogovor je otkazan', 'Otvorite Dogovor da vidite trenutno stanje.'],
  EXECUTION_STATE_CHANGED: ['Status Dogovora je promenjen', 'Otvorite Dogovor da vidite sledeći korak.'],
  COMPLETION_REQUIRED: ['Potvrdite završetak', 'Zadatak je označen kao gotov.'],
  MESSAGE_RECEIVED: ['Nova poruka u Dogovoru', 'Imate novu poruku.'],
  PRIVATE_ACCESS_GRANTED: ['Podaci Dogovora su dostupni', 'Otvorite Dogovor da vidite podatke kojima sada imate pristup.'],
  RECOVERY_OPENED: ['Prijavljen je problem u Dogovoru', 'Otvorite Dogovor da vidite prijavljeni problem.'],
  REVIEW_RECEIVED: ['Stigla Vam je nova ocena', 'Pogledajte novu ocenu saradnje.'],
  CLARIFICATION_CREATED: ['Novo pitanje za zadatak', 'Stiglo je novo pitanje.'],
  CLARIFICATION_ANSWERED: ['Stigao je odgovor', 'Na pitanje za zadatak je odgovoreno.'],
});

export const PUSH_EVENT_TYPES = Object.freeze(Object.keys(COPY));

export function notificationPushCopy(eventType, urgency = 'NORMAL') {
  if (typeof eventType !== 'string' || !Object.hasOwn(COPY, eventType)) return GENERIC;
  const [baseTitle, body] = COPY[eventType];
  const urgentOpportunity = urgency === 'HITNO' && eventType === 'OPPORTUNITY_AVAILABLE';
  return Object.freeze({ title: urgentOpportunity ? 'HITNO — nova prilika' : baseTitle, body });
}
