import type { Ishod } from './ports';
import { failure, readReceipt, record } from './serverReceipt';

/**
 * Whether a draft can actually be published, asked of the one thing that decides it.
 *
 * The owner's own need projection carries no point information, so a screen that wanted to say
 * "this cannot be published yet" had nothing to go on and said "Sledeće: pregled i objava jednim
 * korakom" instead — to a draft that the publish gate would refuse. `rpc_get_need_publication_context`
 * is `SECURITY DEFINER` and granted to `authenticated`, so the screen can simply ask rather than
 * infer, and a new server field is not needed.
 *
 * This reports. It never publishes, and it never becomes the reason a publish is allowed: the
 * server decides that again at the moment of publishing.
 */
export type NeedPublicationReadiness =
  | Readonly<{ kind: 'READY' }>
  | Readonly<{ kind: 'NOT_READY'; code: string; missingSlots: readonly string[] }>
  | Readonly<{ kind: 'UNKNOWN' }>;

const COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da vidiš stanje zadatka.',
};

function decode(raw: unknown): NeedPublicationReadiness | null {
  const value = record(raw);
  if (!value) return null;
  const kind = value.kind;
  if (kind === 'NOT_READY') {
    const code = typeof value.code === 'string' && value.code.trim() ? value.code : null;
    if (!code) return null;
    const slots = Array.isArray(value.missingSlots)
      ? value.missingSlots.filter((slot): slot is string => typeof slot === 'string') : [];
    return { kind: 'NOT_READY', code, missingSlots: slots };
  }
  // Anything the gate answers that is not an explicit refusal is not a promise that publishing
  // will succeed, so it is reported as unknown rather than as readiness.
  return kind === 'READY' || kind === 'ALLOW' ? { kind: 'READY' } : { kind: 'UNKNOWN' };
}

export const needPublicationReadiness = {
  read(needId: string, expectedRevision: number): Promise<Ishod<NeedPublicationReadiness>> {
    if (typeof needId !== 'string' || !needId || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      return Promise.resolve(failure('NEED_PUBLICATION_READINESS_INPUT_INVALID', 'Zadatak nije prepoznat.'));
    }
    return readReceipt({
      rpc: 'rpc_get_need_publication_context',
      args: { p_need_id: needId, p_expected_revision: expectedRevision },
      errors: COPY,
      fallback: 'NEED_PUBLICATION_READINESS_READ_FAILED',
      invalid: 'NEED_PUBLICATION_READINESS_INVALID_RESPONSE',
      decode,
    });
  },
};

/** What the person should do about it, in their own words. */
export function readinessCopy(readiness: NeedPublicationReadiness): { title: string; detail: string } | null {
  if (readiness.kind !== 'NOT_READY') return null;
  if (readiness.code === 'LOCATION_INCOMPLETE') {
    return { title: 'Još nedostaje mesto na mapi',
      detail: readiness.missingSlots.length > 1
        ? 'Ime ulice nije dovoljno da neko dođe. Otvori razgovor i potvrdi obe tačke na mapi.'
        : 'Ime ulice nije dovoljno da neko dođe. Otvori razgovor i potvrdi tačku na mapi.' };
  }
  if (readiness.code === 'COUNTRY_NOT_READY') {
    return { title: 'Država zadatka nije spremna', detail: 'Otvori razgovor i reci u kojoj državi je zadatak.' };
  }
  if (readiness.code === 'PUBLIC_MEDIA_NOT_READY') {
    return { title: 'Fotografije se još obrađuju', detail: 'Sačekaj da se obrade pa pokušaj ponovo.' };
  }
  if (readiness.code === 'POLICY_NOT_READY' || readiness.code === 'POLICY_CONTENT_NOT_READY') {
    return { title: 'Pravila objave nisu spremna', detail: 'Nije do tebe. Nacrt je sačuvan, pokušaj kasnije.' };
  }
  if (readiness.code === 'EVALUATOR_UNAVAILABLE') {
    return { title: 'Provera objave trenutno ne radi', detail: 'Nije do tebe. Nacrt je sačuvan, pokušaj kasnije.' };
  }
  return { title: 'Zadatak još ne može da se objavi', detail: 'Otvori pregled da vidiš šta nedostaje.' };
}
