import { StyleSheet, View } from 'react-native';
import { decodeSupportSnapshot } from '../../data/supportCaseReadDecoders';
import { factLabel } from '../../data/aiNeedV2Ui';
import { isNeedFactV2Key } from '../../contracts/needFactsV2';
import { record, uuid } from '../../data/serverReceipt';
import { BEZ_IZNOSA, novac } from '../../lib/novac';
import type { SupportSnapshot } from '../../data/supportCaseTypes';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';
import { SettingsText as T } from '../settings/SettingsPresentation';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { SupportNotice, supportTime } from './SupportPresentation';

export const supportReferenceNames: Record<SupportSnapshot['kind'], string> = { TASK: 'Zadatak', AGREEMENT: 'Dogovor',
  AGREEMENT_MESSAGE: 'Izabrana poruka iz Dogovora', GROUP_MESSAGE: 'Izabrana grupna poruka',
  TASK_REVIEW: 'Pregled odluke o zadatku', SAFETY_REPORT: 'Privatna bezbednosna prijava' };
const outcomes: Record<string, string> = { ALLOW: 'Provera je odobrila sadržaj', CLARIFY: 'Zatražena je dopuna',
  REVIEW: 'Zatražen je dodatni pregled', BLOCK: 'Sadržaj nije odobren' };
export function SupportReferenceView({ value, caseId }: { value: SupportSnapshot; caseId: string }) {
  const snapshot = decodeSupportSnapshot(value);
  if (!snapshot || !uuid(caseId)) return <SupportNotice error>Izabrani dokaz nije potvrđen za prikaz.</SupportNotice>;
  const content = snapshot.content;
  // These fields have already passed the fixed nested snapshot decoder. No
  // generic object, link, signed URL, storage path or policy digest is rendered.
  // Agreement photos are readable here only as an explicitly captured message
  // snapshot. The case gateway, not Agreement membership, authorizes each byte.
  const media = ['TASK', 'TASK_REVIEW', 'AGREEMENT_MESSAGE'].includes(snapshot.kind) && Array.isArray(content.media) ? content.media : [];
  const facts = snapshot.kind === 'TASK_REVIEW' && Array.isArray(content.publicFacts) ? content.publicFacts : [];
  const evaluation = record(content.evaluation);
  // A block on the quiet wash, as a quoted thing: its name, when it was, and only the decoded words. The revision is
  // machinery (it still travels with the reference); a person reads the name and the time.
  return <Surface kind="note" style={s.quote}><T variant="bodyStrong">{supportReferenceNames[snapshot.kind]}</T>
    {typeof content.createdAt === 'string' ? <T variant="meta" tone="muted">{supportTime(content.createdAt)}</T> : null}
    {['title', 'description', 'body'].map(key => typeof content[key] === 'string' && content[key]
      ? <T key={key}>{content[key] as string}</T> : null)}
    {facts.map(raw => { const f = record(raw); if (!f || typeof f.key !== 'string' || !isNeedFactV2Key(f.key)) return null;
      // Read the captured typed amount without rewriting the immutable snapshot.
      // A missing amount must not fall back to an old model-generated label.
      const shown = f.key === 'need.price_rsd'
        ? typeof f.value === 'number' ? novac(f.value, 'RSD') : BEZ_IZNOSA
        : f.key === 'need.price_basis' && f.value === 'HOURLY' ? 'Po osobi po satu'
        : typeof f.displayValue === 'string' ? f.displayValue : typeof f.value === 'string' || typeof f.value === 'number'
          ? String(f.value) : typeof f.value === 'boolean' ? f.value ? 'Da' : 'Ne'
            : Array.isArray(f.value) && f.value.every(x => typeof x === 'string') ? f.value.join(', ') : null;
      return shown ? <View key={f.key}><T variant="meta" tone="muted">{factLabel(f.key)}</T><T>{shown}</T></View> : null;
    })}
    {evaluation && typeof evaluation.outcome === 'string' && outcomes[evaluation.outcome]
      ? <T>{outcomes[evaluation.outcome]}</T> : null}
    {media.map((raw, index) => { const m = record(raw); return m && uuid(m.assetId)
      ? <AuthorizedPhoto key={m.assetId} assetId={m.assetId} caseId={caseId} label={`Izabrani fotografski dokaz ${index + 1}`} /> : null; })}
  </Surface>;
}

const s = StyleSheet.create({ quote: { gap: sys.space.sm } });
