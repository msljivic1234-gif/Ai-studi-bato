/**
 * Address copy for a Dogovor. Communication itself stays in Poruke.
 * The address. The requester owns it and shares it when ready; the worker cannot ask for it anywhere but in the conversation, so
 * the section offers "Zatraži adresu", which takes them to Poruke with the question already written (never sent for them).
 */

/** The question "Zatražite adresu" writes into the conversation's draft; the person reads it and sends it. */
export const ADDRESS_REQUEST_TEXT = 'Možete li da podelite tačnu adresu?';

/**
 * How the address is said to each side while the Dogovor is agreed, from what the grant says. The requester owns the address:
 * until it is shared they are told to share it when they are ready, afterwards how long it lasts. The worker is told the address is
 * not shared yet and where to ask for it.
 */
export type AddressWords = { title: string; ask: boolean };
export function addressWords({ requester, granted }: { requester: boolean; granted: boolean }): AddressWords {
  if (requester) return { title: granted ? 'Adresa je podeljena u ovom Dogovoru.' : 'Podelite adresu kada budete spremni.', ask: false };
  return granted ? { title: 'Adresa je podeljena. Možete da je pogledate.', ask: false }
    : { title: 'Adresa još nije podeljena.', ask: true };
}
