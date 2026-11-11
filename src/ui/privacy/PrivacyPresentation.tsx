import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RetentionExecutionStatus, RetentionPolicyStatus, RetentionRule } from '../../contracts/retentionPolicy';
import { SettingsGroup, SettingsRow, SettingsText as T } from '../settings/SettingsPresentation';
import { Disclosure } from '../system/Disclosure';
import { InfoButton } from '../system/InfoButton';
import { ListRow } from '../system/ListRow';
import { ruleWidth } from '../system/layout';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import type { HubWords } from '../profile/hubStates';
import { InlineNote } from './InlineNote';

/** The person's names for the published data classes (owner's wording, kept verbatim). */
export const retentionLabels: Readonly<Record<string, string>> = {
  ACCOUNT_IDENTITY: 'Nalog i identitet', PROFILE_DATA: 'Podaci profila', NEED_PUBLIC: 'Javni podaci zadatka',
  NEED_SENSITIVE: 'Privatni podaci zadatka', RESPONSES_SELECTION: 'Prijave i izbor', PRESELECTION_QA: 'Pitanja pre Dogovora',
  AGREEMENT_CORE: 'Dogovori', AGREEMENT_MESSAGES: 'Poruke u Dogovoru', LEGAL_CONSENT: 'Prihvatanje uslova',
  NOTIFICATION_DELIVERY: 'Obaveštenja', AI_VOLATILE: 'AI razgovori i izdvojeni podaci', MEDIA_OBJECTS: 'Fotografije i datoteke',
  COMMAND_LEDGERS: 'Potvrde radnji', AUDIT_SECURITY_LOGS: 'Evidencija aktivnosti i bezbednosti',
};

/** The key a rule opens under: its policy version with it, so an opened rule never carries over to a new version. */
export const ruleKey = (policyVersion: string, rule: RetentionRule) => `${policyVersion}:${rule.dataClass}`;

/**
 * What a reader holds. `refreshing` is a re-read the person asked for while the last answer stays on screen (the retained
 * refresh of `useFocusedResource`); `refreshError` is such a re-read that failed, with the last answer still in `data`.
 */
export type PrivacyRead<T> = { loading: boolean; error: boolean; data: T | null; refreshing?: boolean; refreshError?: boolean };

/** The ONE sentence for "not available" when the published schedule is missing: the deletion rests on it, so it is not said twice. */
export const RETENTION_UNPUBLISHED = 'Rokovi čuvanja i automatsko brisanje napuštenih razgovora još nisu dostupni.';

/** Who sees what, in three short points: the owner's privacy wording, word for word, behind the "ⓘ" of the first row (approved draft, P5). */
export const WHO_SEES_WHAT: readonly string[] = [
  'Opis objavljenog zadatka i njegovo približno mesto vide druge osobe.',
  'Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup.',
  'Zadaci na daljinu nemaju adresu ni oznaku na mapi.',
];

/** Where the rows of the hub lead. */
export type PrivacyPath = '/profil/izvoz' | '/profil/blokirani' | '/profil/pravna';

/**
 * Privatnost i podaci, as the HUB of the approved draft of the product (8 Oct 2026, P5): one list of rows, each saying its own state when the app knows it, and
 * nothing else on the screen. "Ko šta vidi" with the small "ⓘ" that says the three points; "Rokovi čuvanja", which opens in place and holds how long each kind of
 * data is kept and whether abandoned conversations with the assistant are removed on their own; "Izvoz podataka" (where the copy is), "Blokirane osobe" (how many),
 * "Pravila i saglasnosti" (published, and accepted) and "Zatvaranje naloga" (the route's own row). Every fact the screen had is still here: the three points
 * behind their mark, the schedule inside its row, the rest one tap away. It has no primary action: nothing here is done every day.
 *
 * The rows have no pictures, as the rows of what is needed once in a long while never had (owner rule, 2026-09-23). "Not available" is said ONCE: while the schedule
 * is not published, one calm sentence stands inside "Rokovi čuvanja", and the deletion (which rests on that schedule) says nothing of its own; a state of a row that
 * could not be read is not said at all. The screen is read again by pulling it (the route gives `SettingsScreen` the pull); the only standing word is the retry of
 * a schedule that FAILED to read, inside the row it belongs to.
 *
 * Presentation only. The route owns the reads, the focus fence and every navigation; `closure` is its own row.
 */
export function PrivacyBody({ policy, execution, admitted, expandedRule, onToggle, onRefresh, retentionOpen, onToggleRetention, words = {}, onOpen, closure }: {
  policy: PrivacyRead<RetentionPolicyStatus>; execution: PrivacyRead<RetentionExecutionStatus>;
  /** Automatic deletion is admitted for the one published version both readers name. */ admitted: boolean;
  expandedRule: string | null; onToggle: (key: string, next: boolean) => void;
  onRefresh: () => void;
  /** "Rokovi čuvanja" is open. */ retentionOpen: boolean; onToggleRetention: (next: boolean) => void;
  /** The state of the rows that have one. */ words?: HubWords;
  onOpen: (path: PrivacyPath) => void;
  /** The route's row "Zatvaranje naloga". */ closure: ReactNode;
}) {
  return <SettingsGroup>
    {/* A row that tells, with its mark: the three points are the owner's privacy wording and stand behind it. */}
    <ListRow title="Ko šta vidi" trailing={<InfoButton testID="who-sees-info" title="Ko šta vidi" lines={WHO_SEES_WHAT} />} />
    <View>
      <Disclosure label="Rokovi čuvanja" expanded={retentionOpen} onToggle={onToggleRetention}>
        <RetentionBody policy={policy} execution={execution} admitted={admitted} expandedRule={expandedRule} onToggle={onToggle} onRefresh={onRefresh} />
      </Disclosure>
      <View pointerEvents="none" style={s.rule} />
    </View>
    <SettingsRow compact valuePlacement="below" label="Izvoz podataka" value={words.export} onPress={() => onOpen('/profil/izvoz')} />
    <SettingsRow compact valuePlacement="below" label="Blokirane osobe" value={words.blocked} onPress={() => onOpen('/profil/blokirani')} />
    <SettingsRow compact valuePlacement="below" label="Pravila i saglasnosti" value={words.legal} onPress={() => onOpen('/profil/pravna')} />
    {closure}
  </SettingsGroup>;
}

/** What "Rokovi čuvanja" opens: the schedule, or why there is none. */
function RetentionBody({ policy, execution, admitted, expandedRule, onToggle, onRefresh }: {
  policy: PrivacyRead<RetentionPolicyStatus>; execution: PrivacyRead<RetentionExecutionStatus>; admitted: boolean;
  expandedRule: string | null; onToggle: (key: string, next: boolean) => void; onRefresh: () => void;
}) {
  const published = policy.data?.ready ? policy.data : null;
  const refreshing = !!policy.refreshing || !!execution.refreshing;
  const reading = policy.loading || execution.loading || refreshing;
  // A re-read that failed leaves the last answer in `data`, but the claim it makes is no longer confirmed: it is said as not confirmed.
  const executionFailed = execution.error || !!execution.refreshError;
  if (policy.loading) return <T variant="note" tone="muted" accessibilityLiveRegion="polite">Učitavamo rokove čuvanja…</T>;
  // The retry stands as a word only where a read FAILED and there is nothing else to touch; every other re-read is the pull of the screen.
  if (policy.error) return <View style={s.stack}>
    <InlineNote tone="danger">Rokovi čuvanja trenutno nisu dostupni. Pokušaj ponovo.</InlineNote>
    <V2Action label="Osveži" accessibilityLabel="Osveži rokove čuvanja" kind="quiet" compact onPress={() => { if (!reading) onRefresh(); }} style={s.retry} />
  </View>;
  if (!published) return <InlineNote tone="quiet" art={null}>{RETENTION_UNPUBLISHED}</InlineNote>;
  return <View style={s.stack}>
    {/* The last answer stays on screen; this says it could not be renewed, and the pull of the screen is the retry. */}
    {policy.refreshError ? <InlineNote tone="danger">Rokovi čuvanja nisu osveženi. Prikazano je ono što je poslednji put učitano.</InlineNote> : null}
    <View>
      {published.rules.map((rule, index) => {
        const key = ruleKey(published.policyVersion, rule);
        return <Disclosure key={key} label={retentionLabels[rule.dataClass] ?? rule.purpose} divider={index > 0}
          expanded={expandedRule === key} onToggle={next => onToggle(key, next)}>
          <Fact label="Svrha" value={rule.purpose} />
          <Fact label="Rok" value={rule.retentionPeriod} />
          <Fact label="Kada se briše" value={rule.deletionTrigger} />
          <Fact label="Izuzeci" value={rule.exceptionRule} />
          <Fact label="Pravni osnov" value={rule.legalBasis} />
        </Disclosure>;
      })}
    </View>
    {/* Not green: the line under it may say the feature is off or not confirmed, and green would read "all good". A read
        that failed takes the one look for "failed", the danger note (round 5 review); every other state is plain words.
        "AI" is not written here: the letters I and l are one stroke in the screen's type, and "AI" read as "Al". */}
    <View style={s.deletion}>
      <T variant="bodyStrong">Automatsko brisanje napuštenih razgovora</T>
      {execution.loading ? <T variant="copy" tone="muted">Proveravamo dostupnost…</T>
        : executionFailed || (execution.data?.executionAdmitted && !admitted)
          ? <InlineNote tone={executionFailed ? 'danger' : 'neutral'} art={null} alert>Dostupnost automatskog brisanja nije potvrđena.</InlineNote>
          : admitted ? <T variant="copy" tone="muted">Automatsko brisanje je omogućeno samo za napuštene razgovore sa asistentom, bez zadatka i sačuvanih podataka. Primenjuju se objavljena pravila i izuzeci. Ovo nije potvrda da je određeni razgovor obrisan.</T>
            : <T variant="copy" tone="muted">Trenutno nije dostupno.</T>}
    </View>
  </View>;
}

/** One published fact of a rule: the name above, the owner's text under it, in reading size (it was 13 px meta). */
function Fact({ label, value }: { label: string; value: string }) {
  return <View style={s.fact}>
    <T variant="note" tone="muted">{label}</T>
    <T selectable>{value}</T>
  </View>;
}

const s = StyleSheet.create({
  stack: { gap: sys.space.md },
  fact: { gap: sys.space.xs },
  deletion: { gap: sys.space.sm },
  retry: { alignSelf: 'flex-start' },
  // The divider under the schedule's row (or its opened part): a drawn view of `ruleWidth`, as a row's, and not an edge border.
  rule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
});
