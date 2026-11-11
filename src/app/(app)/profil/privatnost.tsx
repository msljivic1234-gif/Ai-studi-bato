import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { retentionPolicyClientService } from '../../../data/retentionPolicyClientService';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { SettingsScreen } from '../../../ui/settings/SettingsPresentation';
import { hubWords } from '../../../ui/profile/hubStates';
import { useHubStates, type HubStateKey } from '../../../ui/profile/useHubStates';
import { ClosureEntry } from '../../../ui/closure/ClosureDialog';
import { PrivacyBody } from '../../../ui/privacy/PrivacyPresentation';

/** The rows of the hub that say their own state; read apart from the schedule, so none of them can hold it up. */
const STATE_ROWS: readonly HubStateKey[] = ['blocked', 'export', 'legal'];

export default function Privatnost() {
  const { user, accountRevision } = useSesija();
  return <OwnedPrivacy key={`${user?.id ?? ''}:${accountRevision}`} />;
}

function OwnedPrivacy() {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [visit, setVisit] = useState<object | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null), [retentionOpen, setRetentionOpen] = useState(false);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false; setVisit(scope); setExpandedRule(null); setRetentionOpen(false);
    return () => { if (focus.current === scope) focus.current = null; };
  }, [accountId, accountRevision]));
  const readPolicy = useCallback(async () => {
    const result = await retentionPolicyClientService.readStatus();
    if (!result.ok) throw new Error('RETENTION_READ_UNAVAILABLE');
    return result.podatak;
  }, []);
  const readExecution = useCallback(async () => {
    const result = await retentionPolicyClientService.readExecutionStatus();
    if (!result.ok) throw new Error('RETENTION_EXECUTION_UNAVAILABLE');
    return result.podatak;
  }, []);
  // A re-read the person asks for ("Osveži stanje") keeps the published rules on screen under the refresh at work, and says so
  // if it fails; the skeleton is only for the first read.
  const policy = useFocusedResource(readPolicy, { retainOnRefresh: true }), execution = useFocusedResource(readExecution, { retainOnRefresh: true });
  const words = hubWords(useHubStates(STATE_ROWS));
  const admitted = policy.data?.ready === true && execution.data?.executionAdmitted === true
    && execution.data.policyVersion === policy.data.policyVersion;
  // A focus event must render its own callbacks even if both reads have settled
  // and closing an already-collapsed rule produces no state change.
  const current = () => visit !== null && focus.current === visit && !navigating.current && !!accountId
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const navigate = (action: () => void) => { if (!current()) return; navigating.current = true; action(); };
  const refresh = () => { if (!current() || policy.loading || execution.loading || policy.refreshing || execution.refreshing) return;
    void policy.refresh(); void execution.refresh(); };
  // The screen is read again by pulling it; the spinner is the pull's own (`usePullRefresh`), never a read that started by itself.
  return <SettingsScreen title="Privatnost i podaci"
    refresh={{ onRefresh: refresh, busy: policy.loading || execution.loading || !!policy.refreshing || !!execution.refreshing }}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}>
    <PrivacyBody policy={policy} execution={execution} admitted={admitted} expandedRule={expandedRule}
      onToggle={(key, next) => { if (current()) setExpandedRule(next ? key : null); }} onRefresh={refresh}
      retentionOpen={retentionOpen} onToggleRetention={next => { if (current()) setRetentionOpen(next); }}
      words={words} onOpen={path => navigate(() => router.navigate(path))}
      // The closure flow opens over this screen, so it is fenced like a navigation but does not retire the screen.
      closure={<ClosureEntry canOpen={current} />} />
  </SettingsScreen>;
}
