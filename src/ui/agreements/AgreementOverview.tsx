import type { ComponentProps, ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { T } from '../Text';
import { AgreementPeople, AgreementTerms, agreementTaskPlace, isGroupAgreement } from '../v2/AgreementPresentation';
import { AgreementContactPlace } from './AgreementContactPlace';
import { AgreementActions, AgreementDangerActions, AgreementHead, AgreementLinks, AgreementTermNote } from './AgreementOverviewParts';
import type { AgreementSteps } from './AgreementSteps';
import type { AgreementInfo, AgreementStep } from './AgreementWorkspace';

/**
 * The overview of a Dogovor (Pregled), composed ONCE for the route and for its gallery (composition spec 4.9, template T3): the head
 * with the work's name and where the Dogovor stands; the note for a Dogovor with no term (R02); a reported problem and the three
 * ways on after it (R04); the terms; the people of a group; the number and the place; the rows that lead elsewhere; and, last, what can
 * be done - "Izmeni uslove" and "Prijavi problem" (the form that reports one takes the place of its row), then, apart and in red,
 * "Otkaži Dogovor" and "Prijavi ili blokiraj osobu" (J15: the actions are on the page and in no menu). Sections are parted by the space of the
 * scroll it stands in (24) and by nothing else - no line, no box.
 *
 * It decides nothing: whether a row is drawn is whether the route handed it a command (`on`), and what each command does, behind which
 * guard, is the route's. It reads nothing and writes nothing. It is meant to be the children of the page's own scroll
 * (`overviewContent`), so its blocks become that scroll's children and the scroll's gap is the only space between them.
 */
export type AgreementOverviewProps = {
  agreement: DogovorProjekcija;
  /** Where the Dogovor stands and what comes next, and the step bar's own props (all of it computed in one place by the route). */
  step: AgreementStep; steps: ComponentProps<typeof AgreementSteps>;
  /** How the Dogovor goes, behind the "ⓘ" at the end of the state's line; given only to a side of a Dogovor that is still open. */
  info?: AgreementInfo | null;
  /** What the step is about: the lines of a proposal, the way to read the permissions again. Inside the step. */
  headExtra?: ReactNode;
  /** I am a side of the Dogovor, and which: the worker's own application is a row only for the worker. */
  party: boolean;
  /** The page can take a command now; every row is grey and cannot be pressed while it cannot. */
  enabled: boolean;
  /** Back from the background: the private part waits for the fresh read. */
  concealed?: boolean;
  /** A reported problem (or one whose details could not be read), the ways on after it, and the form that reports one. At most one of note and form. */
  problem?: { note?: ReactNode; exits?: ReactNode; form?: ReactNode };
  /** The entry to the conversation of a group Dogovor (it reads the group, so the route owns it). */
  group?: ReactNode;
  /** Fresh group roster follows the next action and explicitly individual accepted conditions. */
  groupReady?: boolean;
  privatePartyName?: string;
  /** Replaces the private location of the place section. For a gallery that must read nothing; the route leaves it out. */
  location?: ReactNode;
  /**
   * What can be done from the page, as the route allows it. A row, a word at the end of a title or a note is drawn only for a command
   * that is given. The contact section and the layout callbacks are always the route's.
   */
  on: {
    /** The note "Termin još nije dogovoren" and its "Predloži termin". Given only for an agreed Dogovor with no term and nothing else waiting. */
    proposeTerm?: () => void;
    openMessages: () => void; requestAddress?: () => void;
    /** Rows of the links. */
    openTask?: () => void; openApplication?: () => void;
    /** Rows of the actions: "Izmeni uslove" (the form of a proposal), "Prijavi problem", "Otkaži Dogovor" (the form of the cancelling) and "Prijavi ili blokiraj osobu". */
    openChange?: () => void; openProblem?: () => void; openCancel?: () => void; openSafety?: () => void;
    /** Where the place section and the problem form stand, to take a person to them. */
    placeLayout?: (event: LayoutChangeEvent) => void; problemLayout?: (event: LayoutChangeEvent) => void;
  };
};

export function AgreementOverview({ agreement, step, steps, info, headExtra, party, enabled, concealed = false, problem, group, groupReady = false, privatePartyName, location, on }: AgreementOverviewProps) {
  const title = readableTitle(agreement.naslov);
  const ownRole = agreement.ucesnici.find(person => person.viSte)?.uloga;
  const roleLabel = ownRole === 'narucilac' ? 'Vi objavljujete' : ownRole === 'uskocer' ? 'Vi uskačete' : undefined;
  // These seats belong to this accepted bilateral Dogovor. Other collaborations and whether applications remain open
  // cannot be inferred from this projection, even when its source task needs more people.
  const coverage = agreement.pokrivenost;
  const coverageLine = coverage.ukupno > 1 && coverage.popunjeno > 0 && coverage.ukupno >= coverage.popunjeno
    ? `Obuhvat ovog Dogovora: ${coverage.popunjeno} od ${coverage.ukupno} traženih mesta` : undefined;
  const link = (command: (() => void) | undefined) => command ? { disabled: !enabled, onPress: command } : undefined;
  return <>
    {groupReady ? <T variant="pageTitle" accessibilityRole="header">{title}</T> : null}
    {groupReady ? <T variant="heading" accessibilityRole="header">{privatePartyName ? `Vaš Dogovor: ${privatePartyName}` : 'Vaš pojedinačni Dogovor'}</T> : null}
    <AgreementHead title={title} roleLabel={roleLabel} coverageLine={coverageLine} showTitle={!groupReady}
      step={step} steps={steps} info={info}>{headExtra}</AgreementHead>
    {on.proposeTerm ? <AgreementTermNote disabled={!enabled} onPropose={on.proposeTerm} /> : null}
    {problem?.note}
    {problem?.exits}
    <AgreementTerms agreement={agreement} />
    {/* A 1:1 Dogovor names its one other person in the bar; the list of both sides is kept for a group (A13). */}
    {isGroupAgreement(agreement) && !groupReady ? <AgreementPeople agreement={agreement} /> : null}
    {/* The real next step and accepted personal terms stay ahead of a potentially long roster.
        The group is a separate channel, not a source of shared price/status permissions. */}
    {group}
    {/* Communication stays in-app; the private location keeps its separate grant. */}
    <AgreementContactPlace agreement={agreement} enabled={enabled} concealed={concealed}
      locationSlot={location} onLayout={on.placeLayout} onOpenMessages={on.openMessages} onRequestAddress={on.requestAddress} />
    <AgreementLinks
      task={on.openTask ? { title, place: agreementTaskPlace(agreement), ...link(on.openTask)! } : undefined}
      application={link(on.openApplication)} history={agreement.hronologija} />
    <AgreementActions change={link(on.openChange)} problem={link(on.openProblem)} />
    {/* The form that reports a problem takes the place of its row. It stands on its own as a child of the page's scroll, so the place it
        reports (`problemLayout`) is the scroll's own, and the red actions come after it. */}
    {problem?.form ? <View onLayout={on.problemLayout}>{problem.form}</View> : null}
    {/* While the ways on after a problem are drawn, "Otkaži Dogovor" is theirs: one place for one action (J1). */}
    <AgreementDangerActions cancel={problem?.exits ? undefined : link(on.openCancel)} safety={link(on.openSafety)} />
  </>;
}
