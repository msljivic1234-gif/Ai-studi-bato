/**
 * One-use, account-scoped transfer of UNSENT user text between the two AI interviews.
 * Nothing is persisted, submitted to the provider, or interpreted as a signed review.
 * The route receives only a UUID token, never the text.
 */
export type AiRoleOwner = Readonly<{ accountId: string; accountRevision: number }>;
type RoleText = Readonly<AiRoleOwner & { token: string; text: string; createdAt: number; target: 'NEED' | 'WORKER' }>;
let pendingRoleText: RoleText | null = null;
const MAX_TEXT = 4000;
const MAX_AGE_MS = 5 * 60_000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CYRILLIC: Readonly<Record<string,string>> = {
  а:'a', б:'b', в:'v', г:'g', д:'d', ђ:'dj', е:'e', ж:'z', з:'z', и:'i', ј:'j',
  к:'k', л:'l', љ:'lj', м:'m', н:'n', њ:'nj', о:'o', п:'p', р:'r', с:'s', т:'t',
  ћ:'c', у:'u', ф:'f', х:'h', ц:'c', ч:'c', џ:'dz', ш:'s',
};
function normalized(text: string): string {
  const latin = Array.from(text.toLocaleLowerCase('sr'), char => CYRILLIC[char] ?? char).join('').replace(/đ/g, 'dj');
  return latin.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
// Reuse the same bounded predicates for an offer and its explicit withdrawal.
const OFFER_PREDICATE = 'nudim|pruzam|pozelim da ponudim|zelim da (?:nudim|ponudim|pruzam|radim|se bavim)|hocu da (?:nudim|ponudim|pruzam|radim|se bavim)|(?:hteo|htela|zeleo|zelela|voleo|volela) bih da (?:nudim|ponudim|radim)|ja mogu da (?:radim|pruzam|pomognem)|radim kao|bavim se|drzim (?:privatne |online |onlajn )?casove|dajem (?:privatne )?casove';
const POSITIVE_OFFER = new RegExp('(?:^| )(?:' + OFFER_PREDICATE + ')(?: |$)');
const NEGATED_OFFER = new RegExp('(?:^| )(?:ne|nisam|necu(?: da)?) (?:' + OFFER_PREDICATE + ')(?: |$)');
/** High-confidence only. Mixed/ambiguous messages remain with the AI for clarification.
 * This is an offer to SWITCH, not automatic routing or semantic classification.
 */
export function isExplicitWorkerOffer(text: string): boolean {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) return false;
  const t = normalized(text);
  if (!t) return false;
  // Questions stay in the conversation. Negating the offer itself also needs
  // clarification, while a separate limit (no loading/weekends) stays in its draft.
  if (/[?？]/.test(text) || /(?:^| )(?:da li|je li|jel|kako|gde|sta|zasto|mogu li|smem li)(?: |$)/.test(t)) return false;
  if (/(?:^| )(?:treba mi|potreban mi|potrebna mi|potrebni su mi|trebaju mi|trazim nekog|trazim nekoga|trazim radnika|trazim radnike|trazim majstora|trazim pomoc|neko da mi|da mi neko|ako mi neko|zelim da mi neko|hocu da mi neko)(?: |$)/.test(t)) return false;
  if (NEGATED_OFFER.test(t)) return false;
  return POSITIVE_OFFER.test(t);
}
/** Caller owns its authenticated session and explicit navigation gesture. */
export function stageWorkerText(input: AiRoleOwner & { token: string; text: string }, now = Date.now()): boolean {
  if (!isExplicitWorkerOffer(input.text)) return false;
  return stageAiRoleText({ ...input, target: 'WORKER' }, now);
}
/** The route may call this only after the person chooses a confirmed semantic suggestion. */
export function stageAiRoleText(input: AiRoleOwner & { token: string; text: string; target: 'NEED' | 'WORKER' }, now = Date.now()): boolean {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!ID.test(input.accountId) || !ID.test(input.token) || !Number.isSafeInteger(input.accountRevision)
    || input.accountRevision < 0 || !text || text.length > MAX_TEXT || !['NEED', 'WORKER'].includes(input.target)
    || !Number.isFinite(now)) return false;
  pendingRoleText = { accountId: input.accountId, accountRevision: input.accountRevision,
    token: input.token, text, target: input.target, createdAt: now };
  return true;
}
/** Consume exactly once for the SAME signed-in account generation and route token. */
function takeRoleText(input: AiRoleOwner & { token: string; target: 'NEED' | 'WORKER'; capacity?: number }, now: number): string | null {
  const saved = pendingRoleText;
  if (!saved) return null;
  if (!Number.isFinite(now) || now < saved.createdAt || now - saved.createdAt > MAX_AGE_MS) {
    pendingRoleText = null; return null;
  }
  if (saved.token !== input.token || saved.accountId !== input.accountId
    || saved.accountRevision !== input.accountRevision || saved.target !== input.target) return null;
  const capacity = input.capacity ?? MAX_TEXT;
  // An occupied composer must not consume and silently discard the transfer.
  if (!Number.isSafeInteger(capacity) || capacity < saved.text.length || capacity > MAX_TEXT) return null;
  pendingRoleText = null;
  return saved.text;
}
export function takeWorkerText(input: AiRoleOwner & { token: string; capacity?: number }, now = Date.now()): string | null {
  return takeRoleText({ ...input, target: 'WORKER' }, now);
}
export function takeNeedText(input: AiRoleOwner & { token: string; capacity?: number }, now = Date.now()): string | null {
  return takeRoleText({ ...input, target: 'NEED' }, now);
}
