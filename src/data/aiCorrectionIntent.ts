import { sesijaSada } from '../store/sesija';
import type { ReceiptAccount } from './serverReceipt';

const WORDS = {
  'task.details': ['Izmena zadatka', 'Napišite šta želite da promenite. Ostale podatke možete da ostavite iste.'],
  'task.title': ['Naslov zadatka', 'Napišite kakav naslov želite.'],
  'task.price': ['Cena i ponude', 'Napišite novi budžet ili da želite ponude. Navedite na šta se iznos odnosi.'],
  'task.time': ['Termin zadatka', 'Napišite novi termin ili da je vreme fleksibilno.'],
  'task.deadline': ['Rok za prijave', 'Napišite do kog datuma i sata se ljudi mogu prijaviti, ili izričito recite da nema posebnog roka. Termin rada ostaje odvojen.'],
  'task.people': ['Broj ljudi', 'Napišite koliko osoba Vam je potrebno.'],
  'task.description': ['Opis zadatka', 'Napišite šta u opisu dodajete, menjate ili uklanjate.'],
  'task.location': ['Mesto i način rada', 'Napišite koje mesto, tačku rute ili način rada želite da promenite. Ostale podatke zadržavamo u istom razgovoru.'],
  'task.handoff': ['Način predaje', 'Napišite kako se preuzima rezultat: samo onlajn, lično preuzimanje ili slanje.'],
  'task.requirements': ['Uslovi zadatka', 'Napišite koji uslov želite da promenite i kako treba da glasi.'],
  'worker.details': ['Izmena radnog profila', 'Napišite šta želite da promenite. Nastavljamo isti razgovor; sačuvani profil ostaje isti do potvrde.'],
  'worker.skills': ['Usluge koje nudite', 'Napišite koju uslugu dodajete, menjate ili više ne nudite.'],
  'worker.area': ['Područje rada', 'Napišite gde želite da radite i da li radite na lokaciji ili na daljinu.'],
  'worker.time': ['Kada imate vremena', 'Napišite dane i vreme kada možete da radite, ili šta menjate u dostupnosti.'],
  'worker.tools': ['Alat i vozilo', 'Ako želite, napišite šta od opreme dodajete ili uklanjate. Ovaj podatak nije obavezan.'],
  'worker.identity': ['O meni', 'Napišite kako želite da Vas predstavimo drugim ljudima.'],
} as const;
export type AiCorrectionTarget = keyof typeof WORDS;
export type AiCorrectionIntent = Readonly<{ token: string; target: AiCorrectionTarget; title: string; hint: string }>;
type Handoff = Readonly<ReceiptAccount & { conversationId?: string; intent: AiCorrectionIntent }>;
const pending = new Map<string, Handoff>();
let sequence = 0;
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const owns = (owner: ReceiptAccount) => {
  const current = sesijaSada();
  return current.user?.id === owner.accountId && current.accountRevision === owner.accountRevision;
};

/** A local navigation hint, never a user message, fact patch, provider instruction or permission to save. */
export function rememberAiCorrection(owner: ReceiptAccount, target: AiCorrectionTarget, conversationId?: string): AiCorrectionIntent | null {
  if (!owns(owner) || (conversationId !== undefined && !uuid(conversationId))
      || (target.startsWith('task.') && !conversationId)) return null;
  const [title, hint] = WORDS[target];
  const intent = Object.freeze({ token: `ai-correction-${++sequence}`, target, title, hint });
  pending.set(intent.token, { ...owner, conversationId, intent });
  if (pending.size > 20) pending.delete(pending.keys().next().value!);
  return intent;
}

/** One visit, for the same account generation and conversation. Worker entry may resume its server-owned open conversation. */
export function takeAiCorrection(token: unknown, owner: ReceiptAccount, kind: 'task' | 'worker', conversationId: string): AiCorrectionIntent | null {
  if (typeof token !== 'string') return null;
  const handoff = pending.get(token);
  if (!handoff || !owns(owner) || handoff.accountId !== owner.accountId || handoff.accountRevision !== owner.accountRevision
      || !uuid(conversationId) || !handoff.intent.target.startsWith(`${kind}.`)
      || (handoff.conversationId !== undefined && handoff.conversationId !== conversationId)) return null;
  pending.delete(token);
  return handoff.intent;
}

export function taskCorrectionTarget(key: string): AiCorrectionTarget {
  if (key === 'need.handoff') return 'task.handoff';
  if (key === 'need.response_deadline') return 'task.deadline';
  if (key === 'need.title') return 'task.title';
  if (key === 'need.description') return 'task.description';
  if (key === 'need.people_needed') return 'task.people';
  if (/geography|location|address|country|access_notes/.test(key)) return 'task.location';
  if (/price|budget|currency|amount/.test(key)) return 'task.price';
  if (/schedule|starts|ends|time|date/.test(key)) return 'task.time';
  return 'task.requirements';
}
