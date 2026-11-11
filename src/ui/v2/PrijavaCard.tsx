import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { FactRow } from '../system/FactRow';
import { STATUS_CHIPS, StatusChip, type StatusKey } from '../system/StatusChip';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { MoneyLine } from './offer/RecordParts';

/** Worker application content: task, term, offer, people and message.
 * CandidateFace owns the requester's composition. Both use the price and status parts below.
 * The caller owns the press targets, actions and accessible description.
 */

/** The statuses an application can wear: the five words of the owner's decision. */
export type PrijavaStatus = Extract<StatusKey, `application.${string}`>;

/** What stands in the price row: the total and what it covers, or the quiet words for a price that was not stored. */
export type PrijavaPrice = { kind: 'amount'; amount: string; basis: string } | { kind: 'unpriced' };
export const PRICE_NOT_STORED = 'Cena nije navedena';

export type PrijavaModel = {
  status: PrijavaStatus;
  /** An exceptional line under the state, only when it says something the chip does not ("Zadatak je izmenjen."). */
  reason?: { text: string; tone: 'warn' | 'muted' } | null;
  who: { kind: 'task'; title: string };
  /** The term, written once by the app's one time format. */
  term: string;
  price: PrijavaPrice;
  /** "1 osoba", "2 osobe". */
  people: string;
  /** The message exactly as it is shown, or null when there is none. */
  message: string | null;
  /** The application is over (withdrawn or not chosen). The chip says so; the words stay as readable as ever. */
  quiet?: boolean;
  /** What the chip adds to its word, after a dot ("Poslata · upravo": the application that has just been sent). Never a second state. */
  detail?: string;
};

/** The word of the model's state, as the chip says it. */
export const prijavaStatusWord = (status: PrijavaStatus) => STATUS_CHIPS[status].word;

/** The price as it is heard. */
export const prijavaPriceSpoken = (price: PrijavaPrice) => price.kind === 'amount' ? `${price.amount} ${price.basis}` : PRICE_NOT_STORED;

/**
 * Everything the card shows, as one sentence after its command name, in the order it is drawn. Empty parts are left out. The
 * message is spoken as the card shows it unless the adapter hands the words to say (the worker says "tvoja poruka" over his own
 * words without their quotation marks; the requester's list reads a bounded preview).
 */
export function prijavaSpoken(model: PrijavaModel, options: { message?: string | null; messageLabel?: string } = {}): string {
  const message = options.message === undefined ? model.message : options.message;
  return [model.detail ? `${prijavaStatusWord(model.status)}, ${model.detail}` : prijavaStatusWord(model.status), model.reason?.text.replace(/\.$/, ''), model.term, `ponuda ${prijavaPriceSpoken(model.price)}`, model.people,
    message ? `${options.messageLabel ?? 'poruka'}: ${message}` : null].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', ');
}

/**
 * The price, drawn as the one money line: an amount keeps its whole width and wraps, what it buys is a quiet word beside it, the people
 * follow after a dot, and at large text the parts stand under each other. The words of a price that was not stored are a quiet label.
 */
export function PrijavaPriceText({ price, large, people }: { price: PrijavaPrice; large: boolean; people?: string }) {
  return price.kind === 'amount'
    ? <MoneyLine amount={price.amount} basis={price.basis} notes={[people]} stacked={large} />
    : <MoneyLine word={PRICE_NOT_STORED} notes={[people]} stacked={large} />;
}

/**
 * The state and the reason a prijava is not simply open, on one line when they fit: the chip is the state, the sentence beside it is
 * only what it cannot say ("Zadatak je izmenjen."). `silent` is for the state inside a card that is one press and is heard once, as one
 * sentence (`prijavaSpoken`): the chip and the line are then not stops of their own. On a sheet, where nothing else says the state,
 * they are read.
 */
export function PrijavaState({ status, reason, detail, silent = false }: Pick<PrijavaModel, 'status' | 'reason' | 'detail'> & { silent?: boolean }) {
  const state = <View style={s.state}>
    <StatusChip status={status} detail={detail} />
    {reason ? <T variant="note" style={[s.reason, reason.tone === 'warn' && s.reasonWarn]}>{reason.text}</T> : null}
  </View>;
  return silent ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{state}</View> : state;
}

/**
 * The card's content. Data to pixels only, memoised on the model's own fields by the adapters (they hand in a model built from
 * memoised inputs), so a re-render of the list touches only the rows whose application changed. `noteLines` clamps the message
 * (0 = all of it); `large` is the layout class of the window (`useLayoutClass`), which the adapter reads once.
 */
export const PrijavaCard = memo(function PrijavaCard({ model, large, noteLines = 0 }: {
  model: PrijavaModel; large: boolean; noteLines?: number;
  /** A card that is over or disabled keeps its words as they are; the argument stays so no caller breaks. */ disabled?: boolean;
}) {
  const { who } = model;
  const money = <PrijavaPriceText price={model.price} large={large} people={model.people} />;
  return <>
    <PrijavaState status={model.status} reason={model.reason} detail={model.detail} silent />
    <View style={s.head}><T variant="heading" style={[s.title, s.task]}>{who.title}</T></View>
    <FactRow art="calendar" value={model.term} />
    {money}
    {model.message ? <T variant="note" tone="muted" numberOfLines={noteLines || undefined}>{model.message}</T> : null}
  </>;
});

const s = StyleSheet.create({
  state: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm, rowGap: sys.space.xs },
  // A reason is a sentence of fact, never a second chip: ink-grey, warn only for what blocks a choice that would otherwise be open.
  reason: { color: sys.color.muted, flexShrink: 1 },
  reasonWarn: { color: sys.color.warn },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  task: { flex: 1, minWidth: 0 },
  title: { color: sys.color.ink },
});
