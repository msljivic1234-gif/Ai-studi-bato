import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { starost } from '../../lib/starost';
import { readinessCopy, type NeedPublicationReadiness } from '../../data/needPublicationReadiness';
import { needGeographyRows, needRequirementRows, readableTitle } from '../../data/needDetailPresentation';
import { DetailDescription, DetailRoute, routeAddsToArea, ProductHeader, useDetailMenu, useDetailScrollTitle } from '../product/ProductDetails';
import type { SheetAction } from '../system/ActionSheet';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { FlowFooter } from '../system/FlowFooter';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { OUTCOME_ACTION } from '../system/outcomeCopy';
import { Screen } from '../system/Screen';
import { ChromeIconButton } from '../system/ScreenChrome';
import { Section } from '../system/Section';
import { StateView } from '../system/StateView';
import { StatusChip } from '../system/StatusChip';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { QuietReadState } from './QuietReadState';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';
import { osoba, prijava as prijave } from '../system/plural';
import { TaskDecisionRequirements, TaskDecisionTitle, TaskPlacePrivacy } from './detail/TaskDecision';
import { TaskDetailSummary } from './detail/TaskDetailSummary';
import { TaskStateBlock, type StateAction } from './detail/TaskStateBlock';
import { NO_APPLICATIONS_HELP_LABEL, ownTaskOverview, type NoApplicationsHelp, type NoApplicationsHelpAction, type OverviewSearch } from './ownTaskOverview';

export type NeedPresentationProps = {
  need: PotrebaProjekcija | null; loading: boolean; error: string | null; busy: boolean;
  remainingClosed: boolean;
  onBack: () => void; onRefresh: () => void; onReview: () => void; onEdit: () => void; onCloseRemaining: () => void; onCandidates: () => void;
  /** Opens the existing personal Agreements list, not a task-filtered list. */
  onAgreements?: () => void;
  /** What the publish gate says about a draft, asked of the gate itself. Absent means not asked. */
  readiness?: NeedPublicationReadiness | null;
  photos?: ReactNode;
  /** Where the job is, as an approximate pin. The map owns a focus lifetime, so the route builds it. */
  map?: ReactNode;
  /** The real faces of the people who applied, when the route has read them; without them the block draws people, never names. */
  applicantFaces?: ReactNode;
  /**
   * When the task was published (an instant). The owner's read of a task does not carry it yet (TRAŽI SERVER: `publishedAt` in the owner-only read,
   * the same `published_at` the discovery pages already carry); the day it does, the route hands it in and the page says it, quietly, at its end:
   * "Objavljen pre 2 sata". Without it the page says nothing about when, and no age is ever invented. `now` is fixed only by tests.
   */
  publishedAt?: string | null; now?: Date;
  /** The lifecycle's recovery (NeedLifecycleActions in its "···" placement): drawn only while it has something to say. */
  lifecycleActions?: ReactNode;
  /**
   * Lifecycle actions remain visible rows at the end of the page, with destructive actions last.
   * Draft deletion has a dedicated header icon when onDeleteDraft is supplied; its duplicate row is omitted.
   */
  lifecycleMenu?: readonly SheetAction[];
  /** Deleting this draft: the header trash opens the lifecycle's existing centred confirmation. */
  onDeleteDraft?: () => void;
  /** One contextual action may temporarily outrank applications/Dogovori; it never adds a second primary button. */
  primaryOverride?: { label: string; accessibilityLabel?: string; disabled?: boolean; arrow?: boolean; onPress: () => void };
  qaAction?: ReactNode;
  /** The owner's publisher card ("Objavio"), matching the public task detail view. */
  publisher?: ReactNode;
  /** Hands the task to the system's share sheet from the "···" menu. */
  onShare?: () => void;
  /**
   * What the screen read about the search for the missing places, and whether its own section about it is on the screen. The
   * page says "Dogovor je otkazan" only from this (see `ownTaskOverview`); without it the page says what the task itself shows.
   */
  search?: { state: OverviewSearch | null; speaks: boolean };
  /**
   * UX needs R16: a published task that has had no application for a day. The words and the ways come from `noApplicationsHelp`
   * (`ownTaskOverview`), which says them only when it KNOWS the task has waited that long and nobody applied (it needs when the task was
   * published, which the owner's read of a task does not carry yet: behind its switch, OFF). Each way is one row of one section, and
   * `onWaitingHelp` is told which; without it the page says nothing about waiting.
   */
  waitingHelp?: NoApplicationsHelp | null;
  onWaitingHelp?: (action: NoApplicationsHelpAction) => void;
};

/** What each of the ways of R16 looks like as a row: a picture, and one grey line only where it says something the words do not. */
const HELP_ROW: Readonly<Record<NoApplicationsHelpAction, { art: FactArtKind; subtitle?: string }>> = {
  PHOTO: { art: 'photo', subtitle: 'Fotografija pokazuje šta treba uraditi.' },
  WIDEN_TERM: { art: 'calendar', subtitle: 'Širi termin ostavlja više ljudi koji mogu da stignu.' },
  SHARE: { art: 'send' },
  EDIT: { art: 'document' },
};

/** The applications row's quiet line: how many can be chosen, and the total when it says something more. It carries numbers only. */
function applicationsDetail(need: PotrebaProjekcija): { text: string; attention: boolean } {
  const selectable = need.brojPrijavaZaIzbor;
  if (typeof selectable === 'number' && selectable > 0) return { attention: true,
    text: need.brojPrijava > selectable ? `${prijave(selectable)} za izbor · ukupno ${prijave(need.brojPrijava)}` : `${prijave(selectable)} za izbor` };
  return { attention: false, text: need.brojPrijava ? `Ukupno ${prijave(need.brojPrijava)}` : 'Još nema prijava' };
}

/**
 * The same task identity and terms as the public detail, with owner-only application counts,
 * recovery and management. One primary action follows the actual state; ordinary editing stays
 * one AI entry in the header. Destructive lifecycle actions remain visible below the work.
 * All state, authority and commands still belong to the route/controller.
 */
export function NeedPresentation(props: NeedPresentationProps) {
  const { need, loading, error, busy, remainingClosed } = props;
  // This is the owner's view of their own Zadatak: the route reads it through the owner-only read,
  // so there is no "other side of the app" from which it could be seen without the right to act.
  const draft = need?.stanje === 'NACRT';
  const usable = !!need && !loading && !error;
  const requirements = need ? needRequirementRows(need) : [];
  // A draft the gate refuses says why, once. What the one action does follows the reason (see `ownTaskOverview`): the place is
  // fixed in the conversation, the rest is read in the review, and what only time or the server can mend is waited for.
  const blocked = draft ? readinessCopy(props.readiness ?? { kind: 'UNKNOWN' }) : null;
  // `busy` is true while anything on the screen is loading, including the first read, so the one
  // action announced work in progress before anything had been asked for.
  const working = busy && !loading;
  const primaryOverride = props.primaryOverride;
  const overview = need ? ownTaskOverview({ need, remainingClosed, readiness: props.readiness, search: props.search,
    overridden: !!primaryOverride, canOpenAgreements: !!props.onAgreements }) : null;
  const primary = overview?.primary ?? null;
  const primaryLabel = working ? 'Samo trenutak…' : primaryOverride ? primaryOverride.label : primary?.label ?? '';
  const primaryPress = primaryOverride ? primaryOverride.onPress
    : primary?.kind === 'REVIEW' ? props.onReview : primary?.kind === 'EDIT' ? props.onEdit
      : primary?.kind === 'AGREEMENTS' ? props.onAgreements! : props.onCandidates;
  const remote = need?.detalji?.geografija?.mode === 'REMOTE';
  const selectable = need?.brojPrijavaZaIzbor;
  const counted = need ? applicationsDetail(need) : null;
  // The stops of a route, only for a task that moves: a task done in one place has its place in the facts and on the map, and a line that
  // said "Na jednom mestu · Srbija" under it said nothing the person did not know (the owner's phone, 8 Oct 2026).
  const moves = !!need?.detalji?.geografija && need.detalji.geografija.mode !== 'STATIONARY' && !remote;
  const route = need && moves && routeAddsToArea(needGeographyRows(need), need.podrucjeTekst) ? needGeographyRows(need) : [];
  const canEdit = !!need && need.pokrivenost.popunjeno === 0 && !remainingClosed && need.stanje !== 'ZATVORENA';
  const canCloseRemaining = !!need && !remainingClosed && need.pokrivenost.popunjeno > 0 && need.pokrivenost.preostalo > 0;
  const help = props.waitingHelp && props.onWaitingHelp && props.waitingHelp.actions.length && !draft && usable ? props.waitingHelp : null;

  // How long ago it was published: only for a task that is live and only when the read had the instant.
  const age = need && !draft && need.stanje !== 'ZATVORENA' && props.publishedAt ? starost(props.publishedAt, props.now ? { sada: props.now } : {}) : null;
  // The one green action of the page, at the head of it where the state is; with nothing to do there is none and the line says what the task has.
  const green: StateAction | null = primaryOverride || (need && (working || primary)) ? {
    label: primaryLabel, accessibilityLabel: working ? undefined : primaryOverride?.accessibilityLabel ?? (primaryOverride ? primaryOverride.label : primary?.spoken),
    disabled: !!primaryOverride?.disabled || (!primaryOverride && !usable), arrow: !working && (primaryOverride?.arrow ?? true), onPress: primaryPress } : null;
  // The edit is the one thing about the task itself that is needed more than rarely, so it stands in the bar of the page, in sight (the approved
  // draft R3, rule J15), unless the green action already opens the conversation (a draft held back for its place): then it is that action and is not drawn twice.
  const editable = usable && (draft || canEdit) && primary?.kind !== 'EDIT' && !help?.actions.includes('EDIT');
  const editableDraftDeletion = usable && draft && !!props.onDeleteDraft;

  // Lifecycle actions, sharing, and closing remaining search sit cleanly in the header "···" menu.
  const agreementsOffered = !!overview && (overview.rows.agreements || overview.primary?.kind === 'AGREEMENTS');
  const entries = (props.lifecycleMenu ?? []).filter(entry => !(entry.key === 'agreements' && (agreementsOffered || !!props.onAgreements))
    && !(entry.key === 'delete-draft' && !!props.onDeleteDraft));
  const menuActions: SheetAction[] = usable && need ? [
    ...(props.onShare && !draft ? [{ key: 'share', label: 'Podeli zadatak', icon: 'send' as const, onPress: props.onShare }] : []),
    ...entries.map(entry => ({
      key: entry.key,
      label: entry.label,
      icon: entry.icon,
      subtitle: entry.subtitle,
      reason: entry.reason,
      hint: entry.hint,
      destructive: !!entry.destructive,
      disabled: !!entry.disabled,
      onPress: entry.onPress,
    })),
    ...(canCloseRemaining ? [{
      key: 'close-remaining',
      label: 'Ne traži više nikoga',
      icon: 'users' as const,
      destructive: true,
      disabled: false,
      onPress: props.onCloseRemaining,
    }] : []),
  ] : [];
  const menu = useDetailMenu(menuActions, { disabled: busy });

  const editControl = editable || editableDraftDeletion || menu.button ? <View style={s.headerActions}>
    {editable ? <ChromeIconButton label={draft ? 'Izmeni nacrt' : 'Izmeni zadatak'} glyph="edit"
      hint="Otvara izmenu kroz razgovor." disabled={busy} onPress={props.onEdit} /> : null}
    {editableDraftDeletion ? <ChromeIconButton label="Obriši nacrt" glyph="trash" tone="danger"
      hint="Otvara potvrdu brisanja nacrta." disabled={busy} onPress={props.onDeleteDraft!} /> : null}
    {menu.button}
  </View> : undefined;

  const hasFooterContent = usable && !!(overview?.notice || overview?.line || overview?.note || green);
  const foot = hasFooterContent ? <FlowFooter>
    <TaskStateBlock testID="own-task-state" notice={overview?.notice} line={overview?.line} applicants={overview?.applicants} faces={props.applicantFaces}
      note={overview?.note} primary={green} busy={busy} />
  </FlowFooter> : null;

  const scrollTitle = useDetailScrollTitle();
  return <>
    <Screen kind="detail" header={<ProductHeader back={props.onBack} title={need ? readableTitle(need.naslov) : undefined}
      titleVisible={scrollTitle.titleVisible} right={editControl} />} footer={foot} onScroll={scrollTitle.onScroll}>
      {/* The lifecycle's recovery stays on the screen whatever the read is doing: a retained command is checked, and its
          outcome shown, even while the task loads or cannot be read. */}
      {loading && !need ? <View style={s.state}>
        <QuietReadState art="tasks" title="Učitavamo zadatak…" body="Proveravamo stanje zadatka i sačuvane radnje." />
        {props.lifecycleActions}
      </View>
        : !need ? <>
          <StateView kind="error" art="tasks" title="Zadatak nije dostupan" body={error ?? 'Pokušaj ponovo.'}
            primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
          {props.lifecycleActions}
        </> : <>
          <View style={s.hero} onLayout={scrollTitle.onHeroLayout}>
            {/* ONE state, in the owner's eight words (the chip every list of tasks wears); then the name. People never see a category
                (owner decision 2026-09-21); the server reads kinds of work only to match. */}
            {overview?.chip || need.urgency ? <View style={s.badgeRow}>
              {overview?.chip ? <StatusChip status={overview.chip.status} detail={overview.chip.detail} /> : null}
              {need.urgency ? <NeedUrgencyBadge urgency={need.urgency} /> : null}
            </View> : null}
            <TaskDecisionTitle prominent onLayout={scrollTitle.onTitleLayout}>{readableTitle(need.naslov)}</TaskDecisionTitle>
          </View>
          {loading || error ? <Surface kind="note"><View accessibilityLiveRegion="polite" style={s.notice}>
            <T variant="note" tone="muted">{loading ? 'Osvežavamo podatke…' : 'Vidiš starije podatke.'}</T>
            {error && !loading ? <T variant="note" tone="danger" accessibilityRole="alert">{error}</T> : null}
            {error && !loading ? <V2Action label={OUTCOME_ACTION.refresh} accessibilityLabel="Osveži zadatak" kind="quiet" compact onPress={props.onRefresh} style={s.noticeAction} /> : null}
          </View></Surface> : null}
          {/* A draft the publish gate refuses says why, once, where the owner reads first. */}
          {blocked ? <Surface kind="note" tone="warn"><View accessibilityLiveRegion="polite" style={s.notice}>
            <T variant="bodyStrong" style={s.warnTitle}>{blocked.title}</T>
            <T variant="note" style={s.ink}>{blocked.detail}</T>
            {/* What only time or the server can mend has no green action: the owner can read again, and the page says why it waits. */}
            {overview?.waits ? <V2Action label={OUTCOME_ACTION.refresh} accessibilityLabel="Osveži zadatak" kind="quiet" compact disabled={busy} onPress={props.onRefresh} style={s.noticeAction} /> : null}
          </View></Surface> : null}
          {/* What happened to a cancel or a delete the owner sent is said where they read first: the check, the command running, its
              uncertain, confirmed or refused outcome. It draws nothing while there is nothing to say. */}
          {props.lifecycleActions}
          <TaskDetailSummary need={need} audience="owner" draft={draft} place={remote ? 'Na daljinu' : need.podrucjeTekst} remote={remote}
            people={draft ? `Treba ${osoba(need.pokrivenost.ukupno)}` : undefined} />
          {/* A published task nobody has applied to for a day: the real ways to change it, each one row of one section (R16). Never a
              sentence about how many people would have applied, only what is true of this task. */}
          {help ? <Section title={help.sentence.replace(/\.$/, '')}>
            {help.actions.map((action, index) => <ListRow key={action} leading={action === 'EDIT' ? <Glyph name="edit" size={24} /> : <FactArt kind={HELP_ROW[action].art} size={32} />}
              title={NO_APPLICATIONS_HELP_LABEL[action]} subtitle={HELP_ROW[action].subtitle} accessibilityLabel={NO_APPLICATIONS_HELP_LABEL[action]}
              disabled={busy} last={index === help.actions.length - 1} onPress={() => props.onWaitingHelp?.(action)} />)}
          </Section> : null}
          {/* Quiet ways in that the green action does not already offer. The applications row is not drawn for an empty list (it led
              nowhere), nor beside a green button that opens the same list. */}
          {overview && (overview.rows.applications || overview.rows.agreements) ? <Section>
            {overview.rows.applications && counted ? <ListRow leading={<FactArt kind="applications" size={32} />} title="Prijave" subtitle={counted.text}
              accessibilityLabel={`Otvori prijave. ${counted.text}`} disabled={busy || !usable} last={!overview.rows.agreements} onPress={props.onCandidates}
              trailing={counted.attention ? <View style={s.countPill}><T variant="label" style={s.countText}>{String(selectable)}</T></View> : undefined} /> : null}
            {overview.rows.agreements ? <ListRow leading={<FactArt kind="agreements" size={32} role="confirmed" />} title="Moji Dogovori"
              accessibilityLabel="Moji Dogovori" disabled={busy || !usable} last onPress={props.onAgreements!} /> : null}
          </Section> : null}
          {need.opis ? <Section title="O zadatku"><DetailDescription text={need.opis} /></Section> : null}
          {props.photos}
          <TaskDecisionRequirements rows={requirements} />
          {props.publisher}
          {/* The questions people asked about this task and what the owner answered, where the work itself is read, in the
              same place a stranger finds them (owner, 2026-10-07). The route builds the section: it owns the reads. */}
          {props.qaAction}
          {/* A stranger saw this Task on a map before its owner did: the public projection carried the point and the owner's own read never
              asked for it. Same coarse pair, same map, one section; the one line under the map is what is private, a fact with who sees what behind its ⓘ. */}
          {!remote && (props.map || route.length) ? <Section title="Mesto zadatka">
            <View style={s.place}>
              {props.map}
              <TaskPlacePrivacy />
              {route.length ? <DetailRoute rows={route} /> : null}
            </View>
          </Section> : null}
          {/* When it went live, quietly, after everything the page says about the task. */}
          {age ? <T testID="own-task-age" variant="note" tone="muted">{`Objavljen ${age.charAt(0).toLocaleLowerCase('sr-Latn-RS')}${age.slice(1)}`}</T> : null}
        </>}
    </Screen>
    {menu.sheet}
  </>;
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ink: { color: sys.color.ink },
  state: { gap: sys.space.base },
  // The title remains a direct child of this measured block; multi-line and enlarged titles keep the correct chrome handoff.
  hero: { gap: sys.space.md, paddingVertical: sys.space.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, flexWrap: 'wrap' },
  notice: { gap: sys.space.xs, alignItems: 'flex-start' },
  // A quiet action inside a note starts where the note's text starts (no padding of its own); the width keeps the 48 dp target and the label stays at the start of it.
  noticeAction: { alignSelf: 'flex-start', paddingHorizontal: 0, minWidth: layout.touch, justifyContent: 'flex-start' },
  warnTitle: { color: sys.color.warn },
  place: { gap: layout.group },
  countPill: { minWidth: sys.space.xl, height: sys.space.xl, borderRadius: sys.radius.pill, paddingHorizontal: sys.space.sm, backgroundColor: sys.color.orange,
    alignItems: 'center', justifyContent: 'center' },
  countText: { color: sys.color.onOrange, letterSpacing: 0, lineHeight: sys.space.base },
});
