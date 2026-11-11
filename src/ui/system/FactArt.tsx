import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { sys } from './tokens';
import { MATERIAL_SUBJECTS } from './materialSubjects';

/**
 * Decorative fact illustrations; adjacent text carries their meaning. Phosphor
 * line icons remain the controls. Small marks retain their contrast-controlled
 * solid silhouettes. Normal larger subjects share original bundled dimensional art;
 * explicit state colors retain the cached vector material and its contrast.
 * Explicit tone/muted states override subject color. Only check, agreements and
 * shield may draw a tick: no illustration invents a confirmed business state.
 * Owner direction 2026-10-02 supersedes the historical all-green art treatment.
 */
export const FACT_KINDS = ['home', 'pin', 'calendar', 'clock', 'users', 'person', 'money', 'remote', 'map', 'tasks', 'agreements',
  'offers', 'chat', 'bell', 'phone', 'star', 'check', 'info', 'shield', 'lock', 'eye', 'document', 'download', 'photo', 'support',
  'vehicle', 'tool', 'alert', 'publish', 'send', 'applications'] as const;
export type FactArtKind = (typeof FACT_KINDS)[number];

/** Explicit state treatment takes precedence over subject color. */
export type FactTone = 'brand' | 'accent' | 'quiet' | 'danger';
/** Semantic illustration colors; AI callers explicitly select the AI role. */
export type FactArtRole = keyof typeof sys.color.artRole;
/** `auto` picks the cut from the size; `mark` or `art` forces one (the design board does, to show both side by side). */
export type FactCut = 'auto' | 'mark' | 'art';
export type FactDrawnCut = Exclude<FactCut, 'auto'>;

/** The sizes a picture is meant to be drawn at. `size` stays any number so existing call sites keep compiling. */
export const FACT_SIZES = [16, 20, 24, 32, 48, 64] as const;
export type FactSize = (typeof FACT_SIZES)[number];
/** The largest size the flat `mark` cut serves. A size between the two cuts (26, a Profil row) keeps the sticker. */
export const MARK_MAX_SIZE = 24;
/** The thinnest line the `mark` cut may draw, in canvas units (half a dp per unit at 16 dp). */
export const MARK_MIN_STROKE = 2.4;

export function factCutFor(size: number, cut: FactCut = 'auto'): FactDrawnCut {
  return cut === 'auto' ? (size <= MARK_MAX_SIZE ? 'mark' : 'art') : cut;
}

/**
 * The face of a flat mark. It is the tone's `front` unless that is under 3:1 on white (the orange `accent`, 2.5:1), in
 * which case it is the tone's `edge`: a small mark must carry its own contrast, because no darker edge is drawn under it.
 */
const MARK_FACE: Record<FactTone, string> = {
  brand: sys.color.art.brand.front,
  accent: sys.color.art.accent.edge,
  quiet: sys.color.art.quiet.front,
  danger: sys.color.art.danger.front,
};
export const factMarkFace = (tone: FactTone): string => MARK_FACE[tone];

/** A kind that is orange without being asked: the bell and the rating star mean attention or a score everywhere. */
const DEFAULT_TONE: Partial<Record<FactArtKind, FactTone>> = { bell: 'accent', star: 'accent', alert: 'accent' };

// Normal illustrations have distinct material colors. Explicit state tones and
// the small contrast-controlled mark cut retain their existing meaning.
const ART_ROLE: Partial<Record<FactArtKind, FactArtRole>> = {
  home: 'location', pin: 'location', map: 'location', remote: 'location',
  calendar: 'time', clock: 'time', users: 'people', person: 'people',
  chat: 'people', support: 'people', tool: 'skills', vehicle: 'skills', tasks: 'location',
  applications: 'application',
};

/**
 * What each picture MEANS, one phrase per kind (audit ICO-04). The test keeps the table honest: no two kinds may share a
 * phrase, so a new picture has to say what it is that no other one already says. Words only; nothing reads this at run time.
 */
export const FACT_MEANING: Record<FactArtKind, string> = {
  home: 'the home screen',
  pin: 'a place on the map',
  calendar: 'a date or a term in the calendar',
  clock: 'a time of day or a duration',
  users: 'several people, the helpers a task needs',
  person: 'one person, a profile',
  money: 'cash, an amount that is paid',
  remote: 'work done from a distance',
  map: 'the map of tasks around you',
  tasks: 'your own list of tasks',
  agreements: 'an agreement (Dogovor) that two people made',
  offers: 'a price tag: what a task is priced at or offered for',
  chat: 'a conversation or a message',
  bell: 'a notification',
  phone: 'a phone number or a call',
  star: 'a rating',
  check: 'something confirmed or done',
  info: 'a note or an explanation',
  shield: 'protection, a verified or safe state',
  lock: 'something private or locked',
  eye: 'who can see it',
  document: 'a document or a written text',
  download: 'a file to save',
  photo: 'a photo or the camera',
  support: 'help from support',
  vehicle: 'a van or a vehicle a task needs',
  tool: 'a tool or equipment a task needs',
  alert: 'a warning: something needs you or went wrong',
  publish: 'publishing a new task',
  send: 'sending a message or request',
  applications: 'an application to help with a task',
};

/** The only kinds that may draw a tick: they say "confirmed". The test finds a tick by its shape, so this list cannot drift. */
export const FACT_TICK_KINDS: readonly FactArtKind[] = ['check', 'agreements', 'shield'];

type Tone = { front: string; edge: string; light: string; soft: string };
const WHITE = '#FFFFFF';
const INK = '#35463D';

const line = (d: string, color = INK, width = 1.9) =>
  <Path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />;
/** A polygon whose corners are rounded by its own stroke: three short numbers instead of a path of arcs. */
const rounded = (d: string, color: string, width: number) => <Path d={d} fill={color} stroke={color} strokeWidth={width} strokeLinejoin="round" />;

/* ------------------------------------------------------------------------------------------------------------------ */
/* The `mark` cut: flat, one fill `m` and white. Every stroke is >= MARK_MIN_STROKE, every shape lies inside the canvas. */
/* ------------------------------------------------------------------------------------------------------------------ */
function mark(kind: FactArtKind, m: string): ReactNode {
  const solid = (d: string, fill = m) => <Path d={d} fill={fill} />;
  const stroke = (d: string, width = 2.6, color = m) => line(d, color, width);
  // A white band that cuts clean through an edge of the shape: butt ends, so it stops where the shape stops and leaves no white
  // nub outside it (on a grey well a round cap past the edge would show).
  const knock = (d: string, width = MARK_MIN_STROKE) => <Path d={d} fill="none" stroke={WHITE} strokeWidth={width} strokeLinecap="butt" />;
  switch (kind) {
    case 'pin': return <>{solid('M16 29.5s10-9.7 10-17.1a10 10 0 0 0-20 0c0 7.4 10 17.1 10 17.1Z')}<Circle cx={16} cy={12.4} r={4} fill={WHITE} /></>;
    // A body with a filled header band, two binder rings above it and two lines of text: the date, with nothing to confirm.
    case 'calendar': return <>
      <Rect x={4.2} y={6.2} width={23.6} height={22.8} rx={4.6} fill="none" stroke={m} strokeWidth={2.6} />
      {solid('M4.2 13.2v-2.4a4.6 4.6 0 0 1 4.6-4.6h14.4a4.6 4.6 0 0 1 4.6 4.6v2.4Z')}
      {stroke('M10.6 3.4v5M21.4 3.4v5')}{stroke('M9.6 18.4h12.8M9.6 23.8h7.2', MARK_MIN_STROKE)}</>;
    case 'clock': return <><Circle cx={16} cy={16} r={12.4} fill="none" stroke={m} strokeWidth={2.8} />{stroke('M16 8.8V16l4.8 3.2', 2.8)}</>;
    // Two people side by side with a gap, never overlapping: the second is smaller and lower, both in the full tone.
    case 'users': return solid('M10.4 4.2a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2ZM2.4 27.6v-2.6a8 6.6 0 0 1 16 0v2.6ZM25.7 9.5a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8ZM21.4 27.6v-2.2a4.3 4.3 0 0 1 8.6 0v2.2Z');
    case 'person': return <>{solid('M16 3.2a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Z')}{solid('M5.4 29v-2.6c0-5.3 4.7-9 10.6-9s10.6 3.7 10.6 9V29Z')}</>;
    // Dinar coins: a tactile pair of overlapping coins with relief rings and central emblem.
    case 'money': return <>
      <Circle cx={20.2} cy={12} r={7.6} fill={m} />
      <Circle cx={20.2} cy={12} r={5.2} fill="none" stroke={WHITE} strokeWidth={1.4} />
      <Circle cx={13} cy={18} r={9.6} fill={WHITE} />
      <Circle cx={13} cy={18} r={8.4} fill={m} />
      <Circle cx={13} cy={18} r={6} fill="none" stroke={WHITE} strokeWidth={1.4} />
      <Circle cx={13} cy={18} r={2.8} fill={WHITE} />
    </>;
    // A screen with a person on it and a stand: a video call, work that happens somewhere else.
    case 'remote': return <>{solid('M6.8 4h18.4a3.6 3.6 0 0 1 3.6 3.6v11.6a3.6 3.6 0 0 1-3.6 3.6H6.8a3.6 3.6 0 0 1-3.6-3.6V7.6A3.6 3.6 0 0 1 6.8 4Z')}
      {solid('M16 7a2.6 2.6 0 1 0 0 5.2A2.6 2.6 0 0 0 16 7ZM10.4 19.8a5.6 4.6 0 0 1 11.2 0Z', WHITE)}{stroke('M16 22.8v4M10.6 28.2h10.8')}</>;
    case 'bell': return <>{solid('M6.1 24.7c-1.4 0-1.8-1.4-.8-2.5 1.8-1.9 2.2-3.5 2.2-8a8.5 8.5 0 0 1 17 0c0 4.5.4 6.1 2.2 8 1 1.1.6 2.5-.8 2.5Z')}{solid('M12.4 26.6a3.6 3.6 0 0 0 7.2 0Z')}</>;
    case 'phone': return <>{solid('M7.3 2.7h4.1l3.1 7-3.4 2.7a23.2 23.2 0 0 0 8 8l2.7-3.4 7 3.1v4.1c0 4.5-6.4 5.8-15.8-2.5S.8 5.1 5.1 3.4Z')}{stroke('M21.4 3.6a8.4 8.4 0 0 1 7 7')}</>;
    case 'map': return <>{solid('m3 6.4 8-3 10 3 8-3v22.2l-8 3-10-3-8 3Z')}{solid('M9.7 7.8a1.3 1.3 0 0 1 2.6 0V25.8H9.7ZM19.7 10.2a1.3 1.3 0 0 1 2.6 0V28.4H19.7Z', WHITE)}</>;
    // A clipboard: a filled board, a clip that is cut free of it by a white rim, two white lines of text, and no badge.
    case 'tasks': return <><Rect x={5.6} y={5} width={20.8} height={24.4} rx={4.2} fill={m} />
      <Rect x={10.2} y={2.4} width={11.6} height={5.8} rx={2.2} fill={m} stroke={WHITE} strokeWidth={MARK_MIN_STROKE} />{stroke('M10.6 15h10.8M10.6 21.4h6.4', 2.6, WHITE)}</>;
    case 'agreements': return <>{solid('M8.5 1.8h13A5.5 5.5 0 0 1 27 7.3v11a5.5 5.5 0 0 1-5.5 5.5H12l-8 5V7.3a5.5 5.5 0 0 1 4.5-5.5Z')}{stroke('m9.6 13.1 3.6 3.7 7.4-7.4', 2.8, WHITE)}</>;
    // A price tag: a pointed end with a punched hole and one line for the amount. Not a bubble.
    case 'offers': return <>{rounded('M4.6 16 12.2 8.4H27.4V23.6H12.2Z', m, 3.6)}<Circle cx={12.4} cy={16} r={2.3} fill={WHITE} />{stroke('M18.4 16h6.4', 2.6, WHITE)}</>;
    case 'chat': return <>{solid('M8.4 2.3h15.2A5.4 5.4 0 0 1 29 7.7v12.2a5.4 5.4 0 0 1-5.4 5.4H13l-8 4v-5.6A5.4 5.4 0 0 1 3 19.9V7.7a5.4 5.4 0 0 1 5.4-5.4Z')}
      {stroke('M10.6 13.6h.01M16 13.6h.01M21.4 13.6h.01', 4.2, WHITE)}</>;
    case 'star': return rounded('M16 4.2 19.35 12.59 28.36 13.18 21.42 18.96 23.64 27.72 16 22.9 8.36 27.72 10.58 18.96 3.64 13.18 12.65 12.59Z', m, MARK_MIN_STROKE);
    case 'check': return <><Circle cx={16} cy={16} r={13} fill={m} />{stroke('m10.4 16.2 4 4 7.4-7.6', 3, WHITE)}</>;
    case 'info': return <><Circle cx={16} cy={16} r={13} fill={m} />{stroke('M16 9.8h.01M16 14.6v7.4', 3.2, WHITE)}</>;
    case 'shield': return <>{solid('M16 2.8 26 6.4v7.8C26 21 21.7 25.8 16 28.2 10.3 25.8 6 21 6 14.2V6.4Z')}{stroke('m11.3 14.8 3.3 3.3 6.2-6.4', 2.8, WHITE)}</>;
    case 'lock': return <>{stroke('M10.6 13.4V9.6a5.4 5.4 0 0 1 10.8 0v3.8', 3)}<Rect x={5.4} y={12.8} width={21.2} height={16.4} rx={4.2} fill={m} />
      {solid('M16 17.6a2.6 2.6 0 0 1 1.4 4.8l.8 3h-4.4l.8-3A2.6 2.6 0 0 1 16 17.6Z', WHITE)}</>;
    case 'eye': return <>{solid('M2.6 16C5.9 10 10.6 7 16 7s10.1 3 13.4 9c-3.3 6-8 9-13.4 9S5.9 22 2.6 16Z')}<Circle cx={16} cy={16} r={5.6} fill={WHITE} /><Circle cx={16} cy={16} r={2.7} fill={m} /></>;
    // A sheet whose corner is folded over (cut away in white) and two lines of text.
    case 'document': return <>{solid('M9.8 2.6h9.4l6.4 6.4v15.9a4 4 0 0 1-4 4H9.8a4 4 0 0 1-4-4V6.6a4 4 0 0 1 4-4Z')}{solid('M19.2 2.6v4.4a2 2 0 0 0 2 2h4.4Z', WHITE)}{stroke('M10.6 17.4h10.8M10.6 22.8h6.4', 2.6, WHITE)}</>;
    case 'download': return <>{stroke('M16 3.8v10.8M10.6 9.2l5.4 5.4 5.4-5.4', 2.8)}<Rect x={3.6} y={20.2} width={24.8} height={8.4} rx={3.8} fill={m} /></>;
    case 'photo': return <>{solid('M11.2 8.4 12.9 5.8a2.2 2.2 0 0 1 2-1.2h2.2a2.2 2.2 0 0 1 2 1.2l1.7 2.6h5.2a4.6 4.6 0 0 1 4.6 4.6v10.9a4.6 4.6 0 0 1-4.6 4.6H6.4a4.6 4.6 0 0 1-4.6-4.6V13a4.6 4.6 0 0 1 4.6-4.6Z')}
      <Circle cx={16} cy={18.4} r={5.2} fill="none" stroke={WHITE} strokeWidth={2.6} /></>;
    // A life ring: a thick ring cut into four by white bands.
    case 'support': return <><Circle cx={16} cy={16} r={10.4} fill="none" stroke={m} strokeWidth={6} />{knock('M10.84 10.84 6.45 6.45M21.16 10.84 25.55 6.45M10.84 21.16 6.45 25.55M21.16 21.16 25.55 25.55', 3)}</>;
    case 'home': return <>{solid('M5.2 14.4 14.3 6.8a2.6 2.6 0 0 1 3.4 0l9.1 7.6v10.3a3.4 3.4 0 0 1-3.4 3.4H8.6a3.4 3.4 0 0 1-3.4-3.4Z')}{stroke('M3.4 14.3 16 4.4l12.6 9.9')}
      {solid('M13.3 28.1v-8.1a1.7 1.7 0 0 1 1.7-1.7h2a1.7 1.7 0 0 1 1.7 1.7v8.1Z', WHITE)}</>;
    // A van from the side, facing right: windows in white, and wheels that are cut free of the body by a white rim.
    case 'vehicle': return <>{solid('M3 11.2a3.6 3.6 0 0 1 3.6-3.6h12a3.6 3.6 0 0 1 3 1.6l3.4 5.1 2.4.8a2.7 2.7 0 0 1 1.8 2.5v3.8a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 21.4Z')}
      {solid('M7.6 10.8h7.2v4.6H7.6ZM17.2 10.8h2.4l3 4.6h-5.4Z', WHITE)}
      <Path d="M9.4 20.4a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6ZM23.6 20.4a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" fill={m} stroke={WHITE} strokeWidth={MARK_MIN_STROKE} /></>;
    // A toolbox: a handle, a box, a white seam and a latch that is cut free of the seam by a white rim.
    case 'tool': return <>{stroke('M11.4 10.2V7.6a2.2 2.2 0 0 1 2.2-2.2h4.8a2.2 2.2 0 0 1 2.2 2.2v2.6', 2.8)}<Rect x={3} y={9.8} width={26} height={18} rx={4.2} fill={m} />
      {knock('M3 17.6H29')}<Rect x={13} y={14.6} width={6} height={6} rx={1.6} fill={m} stroke={WHITE} strokeWidth={MARK_MIN_STROKE} /></>;
    // A warning triangle with rounded corners (its own stroke rounds them) and a white exclamation mark.
    case 'alert': return <>{rounded('M16 5.4 28 25.4H4Z', m, 4)}{stroke('M16 12.4v6M16 22h.01', 3.2, WHITE)}</>;
    // A sheet and a plus badge in its corner: a new task. The badge is what tells it from the clipboard.
    case 'publish': return <><Rect x={3.6} y={2.8} width={20.4} height={25.2} rx={4.2} fill={m} />{stroke('M8.4 9.6h10.8M8.4 15h6', 2.6, WHITE)}
      <Circle cx={23.2} cy={23} r={6.6} fill={m} stroke={WHITE} strokeWidth={MARK_MIN_STROKE} />{stroke('M23.2 19.6v6.8M19.8 23h6.8', 2.6, WHITE)}</>;
    // A paper plane flying up and to the right, with the fold in white.
    case 'applications':
    case 'send': return <>{rounded('M4 14.6 28 4 18.6 28 14 18.4Z', m, MARK_MIN_STROKE)}{stroke('M14.2 18.2 23.2 9.2', MARK_MIN_STROKE, WHITE)}</>;
  }
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The `art` cut: the approved sticker, a shadow, a darker edge 1.5 units under the face, a shine and white details.    */
/* ------------------------------------------------------------------------------------------------------------------ */
function art(kind: FactArtKind, c: Tone): ReactNode {
  const face = (d: string) => <Path d={d} fill={c.front} />;
  const edge = (d: string) => <Path d={d} fill={c.edge} />;
  const shine = (d: string) => line(d, c.light, 1.8);
  const shadow = <Ellipse cx={16} cy={29.4} rx={10.2} ry={1.6} fill="#163D2B" opacity={0.07} />;
  switch (kind) {
    case 'pin': return <>{shadow}{edge('M16 29.5s10-9.7 10-17.1a10 10 0 0 0-20 0c0 7.4 10 17.1 10 17.1Z')}
      {face('M16 27.5s9.3-9.1 9.3-16.1a9.3 9.3 0 0 0-18.6 0c0 7 9.3 16.1 9.3 16.1Z')}{shine('M10 10.4a6.2 6.2 0 0 1 6-5.2')}
      <Circle cx={16} cy={11.4} r={4} fill={c.edge} opacity={0.32} /><Circle cx={16} cy={10.9} r={3.35} fill={WHITE} /></>;
    // The date: a white body, a header band, two rings and two lines of text. No checkbox and no tick: a date is not a confirmation.
    case 'calendar': return <>{shadow}<Rect x={4.2} y={7.5} width={24.2} height={21.2} rx={5.2} fill="#D6DAD6" />
      <Rect x={3.6} y={5.6} width={24.2} height={21.2} rx={5.2} fill={WHITE} stroke="#D5DAD5" strokeWidth={1.1} />
      {edge('M3.6 12.6V11a5.4 5.4 0 0 1 5.4-5.4h13.4a5.4 5.4 0 0 1 5.4 5.4v1.6Z')}{face('M3.6 11.3V9.9a4.3 4.3 0 0 1 4.3-4.3h15.6a4.3 4.3 0 0 1 4.3 4.3v1.4Z')}
      {shine('M7.1 8h17.1')}{line('M10.1 3.4v4.3M21.3 3.4v4.3', INK, 2.1)}
      {line('M8.6 17.2h14.8M8.6 22h8.6', '#6A736C', 1.8)}</>;
    case 'clock': return <>{shadow}<Circle cx={16.5} cy={17.3} r={12} fill="#CFD6D0" />
      <Circle cx={16} cy={15.5} r={12} fill="#FAFCFA" stroke="#B8C4BB" strokeWidth={1.2} />
      <Path d="M16 3.5a12 12 0 0 1 11.9 10.7" fill="none" stroke={c.front} strokeWidth={2.9} strokeLinecap="round" />
      {line('M16 8.1v7.4l4.6 3.3', '#33463B', 2.3)}<Circle cx={16} cy={15.5} r={1.8} fill="#33463B" />
      {line('M7.7 15.5h.6M16 23.3v.6', '#9AA59D', 1.7)}{line('M8.2 10.1a9.2 9.2 0 0 1 4.2-3.3', WHITE, 1.9)}</>;
    case 'users': return <>{shadow}<Circle cx={23.1} cy={10.7} r={4.3} fill={c.soft} stroke={c.light} strokeWidth={1.1} />
      <Path d="M19.8 26.2h8a2 2 0 0 0 2-2v-2.7a7.1 7.1 0 0 0-12.4-4.7Z" fill={c.soft} stroke={c.light} strokeWidth={1.1} />
      <Circle cx={11.1} cy={10.1} r={5.3} fill={c.edge} /><Circle cx={11.1} cy={9.1} r={5.3} fill={c.front} />
      {shine('M8.2 7.7a3.2 3.2 0 0 1 2.9-1.8')}{edge('M2 25.8v-2.3a9.1 9.1 0 0 1 18.2 0v2.3a2.6 2.6 0 0 1-2.6 2.6h-13A2.6 2.6 0 0 1 2 25.8Z')}
      {face('M2 24.2v-2.1a9.1 9.1 0 0 1 18.2 0v2.1a2.6 2.6 0 0 1-2.6 2.6h-13A2.6 2.6 0 0 1 2 24.2Z')}{shine('M5.9 21.5a5.3 5.3 0 0 1 2.2-3.1')}</>;
    // Dinar coins: tactile pair of coins with 3D edge, shaded relief and metallic shine.
    case 'money': return <>{shadow}
      <Ellipse cx={20.2} cy={20.5} rx={6} ry={1.4} fill="#163D2B" opacity={0.06} />
      <Circle cx={20.2} cy={13.2} r={8} fill={c.edge} />
      <Circle cx={20.2} cy={11.8} r={8} fill={c.soft} stroke={c.light} strokeWidth={1.1} />
      <Circle cx={20.2} cy={11.8} r={5.4} fill="none" stroke={c.light} strokeWidth={1.2} />
      <Circle cx={13} cy={19.2} r={8.8} fill={c.edge} />
      <Circle cx={13} cy={17.6} r={8.8} fill={c.front} />
      {shine('M7.4 14.8a6.8 6.8 0 0 1 7.6-3.8')}
      <Circle cx={13} cy={17.6} r={6} fill="none" stroke={WHITE} strokeWidth={1.3} opacity={0.9} />
      <Circle cx={13} cy={17.6} r={2.6} fill={WHITE} opacity={0.95} />
    </>;
    // A screen with a person on it, a call: work from a distance. It used to carry a tick, which said "confirmed".
    case 'remote': return <>{shadow}<Rect x={2.6} y={4.8} width={26.8} height={19.7} rx={4.2} fill={c.edge} />
      <Rect x={2.6} y={3.4} width={26.8} height={19.7} rx={4.2} fill={c.front} /><Rect x={5.3} y={6.1} width={21.4} height={13.7} rx={1.8} fill={WHITE} />
      {line('M16 23.2v4.3M10.9 28h10.2', '#576A5D', 2)}<Circle cx={16} cy={10.6} r={2.7} fill={c.front} /><Path d="M10.4 18.4a5.6 4.6 0 0 1 11.2 0Z" fill={c.front} /></>;
    case 'bell': return <>{shadow}{edge('M6.1 24.7c-1.4 0-1.8-1.4-.8-2.5 1.8-1.9 2.2-3.5 2.2-8a8.5 8.5 0 0 1 17 0c0 4.5.4 6.1 2.2 8 1 1.1.6 2.5-.8 2.5Z')}
      {face('M6.1 22.9c-1.4 0-1.8-1.4-.8-2.5 1.8-1.9 2.2-3.5 2.2-7.6a8.5 8.5 0 0 1 17 0c0 4.1.4 5.7 2.2 7.6 1 1.1.6 2.5-.8 2.5Z')}
      {shine('M11 12.7a5 5 0 0 1 4.9-5')}<Path d="M13.2 26.3a2.8 2.8 0 0 0 5.6 0" fill="#364D40" />{line('M16 2.8v2', '#364D40', 2.1)}</>;
    case 'phone': return <>{shadow}{edge('M7.3 3.4h4.1l3.1 7-3.4 2.7a23.2 23.2 0 0 0 8 8l2.7-3.4 7 3.1v4.1c0 4.5-6.4 5.8-15.8-2.5S.8 5.8 5.1 4.1Z')}
      {face('M7.3 2.1h4.1l3.1 7-3.4 2.7a23.2 23.2 0 0 0 8 8l2.7-3.4 7 3.1v4.1c0 4.5-6.4 5.8-15.8-2.5S.8 4.5 5.1 2.8Z')}
      {shine('M7.4 5.4h1.7l1.1 2.5')}{line('M21.4 3.9a8.4 8.4 0 0 1 6.2 6.2M20.6 8.2a3.7 3.7 0 0 1 2.7 2.7', '#6E8576', 1.8)}</>;
    case 'map': return <>{shadow}<Path d="m3 8.1 8-3 10 3 8-3v22.2l-8 3-10-3-8 3Z" fill="#C3CFC6" />
      <Path d="m3 6.4 8-3 10 3 8-3v22.2l-8 3-10-3-8 3Z" fill="#F7FBF7" stroke="#C3CFC6" strokeWidth={1.1} />
      <Path d="m11 3.4 10 3v22.2l-10-3Z" fill={c.soft} />{line('M11 4.2v20.3M21 18.5v9', c.light, 1.1)}
      {edge('M20.6 21s7.1-6.6 7.1-12a7.1 7.1 0 1 0-14.2 0c0 5.4 7.1 12 7.1 12Z')}{face('M20.6 19.5s6.7-6.3 6.7-11.4a6.7 6.7 0 1 0-13.4 0c0 5.1 6.7 11.4 6.7 11.4Z')}
      <Circle cx={20.6} cy={8.1} r={2.5} fill={WHITE} />{shine('M16.4 7a4.2 4.2 0 0 1 3.3-2.8')}</>;
    // The clipboard: a sheet, a clip and three lines of text. It used to carry a badge with a tick, which said "done";
    // the badge now belongs to `publish`, which is what tells the two apart.
    case 'tasks': return <>{shadow}<Rect x={6.2} y={4.4} width={21.1} height={25.4} rx={4.2} fill="#C5CDC7" />
      <Rect x={4.7} y={2.7} width={21.1} height={25.4} rx={4.2} fill={WHITE} stroke="#CCD4CE" strokeWidth={1.1} />
      <Rect x={10.2} y={2.8} width={10.1} height={4.2} rx={1.8} fill={c.edge} /><Rect x={10.2} y={1.4} width={10.1} height={4.2} rx={1.8} fill={c.front} />
      {line('M9.8 12.4h10.9M9.8 17.4h10.9M9.8 22.4h6.8', '#7B887E', 1.7)}</>;
    case 'agreements': return <>{shadow}
      <Path d="M15.3 10.2h11a4.3 4.3 0 0 1 4.3 4.3v8.7a4.3 4.3 0 0 1-4.3 4.3h-1.5v3l-5-3h-4.5a4.3 4.3 0 0 1-4.3-4.3v-8.7a4.3 4.3 0 0 1 4.3-4.3Z" fill="#FF850F" opacity={0.88} stroke="#E8630A" strokeWidth={1.2} />
      {edge('M8.5 3.4h13A5.5 5.5 0 0 1 27 8.9v11a5.5 5.5 0 0 1-5.5 5.5H12l-8 5V8.9a5.5 5.5 0 0 1 4.5-5.5Z')}
      {face('M8.5 1.8h13A5.5 5.5 0 0 1 27 7.3v11a5.5 5.5 0 0 1-5.5 5.5H12l-8 5V7.3a5.5 5.5 0 0 1 4.5-5.5Z')}
      {shine('M8.2 6a2.5 2.5 0 0 1 2.1-1h10.2')}{line('m9.6 13.1 3.6 3.7 7.4-7.4', WHITE, 2.5)}</>;
    // A price tag: the pointed end with a punched hole, two lines for the amount. It used to be the chat bubble.
    case 'offers': return <>{shadow}{rounded('M4.6 17.5 12.2 9.9H27.4V25.1H12.2Z', c.edge, 3.6)}{rounded('M4.6 16 12.2 8.4H27.4V23.6H12.2Z', c.front, 3.6)}
      {shine('M14.2 6.9H26')}<Circle cx={12.4} cy={16} r={2.4} fill={WHITE} />{line('M18.2 14.2h6.8M18.2 18.6h4.2', WHITE, 2.1)}</>;
    case 'person': return <>{shadow}<Circle cx={16} cy={10.4} r={5.6} fill={c.edge} /><Circle cx={16} cy={9.2} r={5.6} fill={c.front} />{shine('M12.9 7.6a3.4 3.4 0 0 1 3.1-1.9')}<Path d="M5.6 26.6v-2.4a10.4 10.4 0 0 1 20.8 0v2.4a2.8 2.8 0 0 1-2.8 2.8H8.4a2.8 2.8 0 0 1-2.8-2.8Z" fill={c.edge} /><Path d="M5.6 24.9v-2.2a10.4 10.4 0 0 1 20.8 0v2.2a2.8 2.8 0 0 1-2.8 2.8H8.4a2.8 2.8 0 0 1-2.8-2.8Z" fill={c.front} />{shine('M9.9 21.9a6 6 0 0 1 2.5-3.4')}</>;
    case 'star': return <>{shadow}<Path d="M16 4.4 19.06 12.79 27.98 13.11 20.95 18.61 23.41 27.19 16 22.2 8.59 27.19 11.05 18.61 4.02 13.11 12.94 12.79Z" fill={c.edge} stroke={c.edge} strokeWidth={2.2} strokeLinejoin="round" /><Path d="M16 2.9 19.06 11.29 27.98 11.61 20.95 17.11 23.41 25.69 16 20.7 8.59 25.69 11.05 17.11 4.02 11.61 12.94 11.29Z" fill={c.front} stroke={c.front} strokeWidth={2.2} strokeLinejoin="round" />{shine('M13.8 11.1l1.5-4.2')}</>;
    case 'shield': return <>{shadow}<Path d="M16 3.8 26 7.4v7.8C26 22 21.7 26.8 16 29.2 10.3 26.8 6 22 6 15.2V7.4Z" fill={c.edge} /><Path d="M16 2.4 26 6v7.8C26 20.6 21.7 25.4 16 27.8 10.3 25.4 6 20.6 6 13.8V6Z" fill={c.front} />{shine('M9.3 8.2 13.6 6.6')}{line('m11.3 14.4 3.3 3.3 6.2-6.4', WHITE, 2.4)}</>;
    case 'lock': return <>{shadow}{line('M10.4 13.4V9.6a5.6 5.6 0 0 1 11.2 0v3.8', '#5C6B61', 2.6)}<Rect x={5.4} y={13.9} width={21.2} height={15.2} rx={4.2} fill={c.edge} /><Rect x={5.4} y={12.4} width={21.2} height={15.2} rx={4.2} fill={c.front} />{shine('M9 15.4h7.4')}<Circle cx={16} cy={19.2} r={2.3} fill={WHITE} /><Rect x={15} y={19.6} width={2} height={4.4} rx={1} fill={WHITE} /></>;
    case 'document': return <>{shadow}<Rect x={7.4} y={4.3} width={19.6} height={25.2} rx={4.2} fill="#C5CDC7" /><Path d="M9.8 2.6h9.4l6.4 6.4v15.9a4 4 0 0 1-4 4H9.8a4 4 0 0 1-4-4V6.6a4 4 0 0 1 4-4Z" fill={WHITE} stroke="#CCD4CE" strokeWidth={1.1} /><Path d="M19.2 2.6v4.4a2 2 0 0 0 2 2h4.4Z" fill={c.front} />{line('M10.2 13.8h10.8', c.front, 2.2)}{line('M10.2 18.3h10.8M10.2 22.8h6.6', '#7B887E', 1.7)}</>;
    case 'chat': return <>{shadow}<Path d="M8.4 4h15.2A5.4 5.4 0 0 1 29 9.4v12.2a5.4 5.4 0 0 1-5.4 5.4H13L5 31v-5.6A5.4 5.4 0 0 1 3 21.6V9.4A5.4 5.4 0 0 1 8.4 4Z" fill={c.edge} /><Path d="M8.4 2.3h15.2A5.4 5.4 0 0 1 29 7.7v12.2a5.4 5.4 0 0 1-5.4 5.4H13l-8 4v-5.6A5.4 5.4 0 0 1 3 19.9V7.7a5.4 5.4 0 0 1 5.4-5.4Z" fill={c.front} />{shine('M8 6h15.3')}<Circle cx={10.6} cy={14.2} r={2} fill={WHITE} /><Circle cx={16} cy={14.2} r={2} fill={WHITE} /><Circle cx={21.4} cy={14.2} r={2} fill={WHITE} /></>;
    case 'check': return <>{shadow}<Circle cx={16} cy={16.8} r={12.3} fill={c.edge} /><Circle cx={16} cy={15.3} r={12.3} fill={c.front} />{shine('M8.5 10.5a8.8 8.8 0 0 1 4.6-4.4')}{line('m10.4 15.6 3.9 4 7.4-7.6', WHITE, 2.8)}</>;
    case 'support': return <>{shadow}<Circle cx={16} cy={16.9} r={12.2} fill={c.edge} /><Circle cx={16} cy={15.4} r={12.2} fill={c.front} /><Path d="M27.06 20.56A12.2 12.2 0 0 1 21.16 26.46L18.28 20.29A5.4 5.4 0 0 0 20.89 17.68Z" fill={WHITE} /><Path d="M10.84 26.46A12.2 12.2 0 0 1 4.94 20.56L11.11 17.68A5.4 5.4 0 0 0 13.72 20.29Z" fill={WHITE} /><Path d="M4.94 10.24A12.2 12.2 0 0 1 10.84 4.34L13.72 10.51A5.4 5.4 0 0 0 11.11 13.12Z" fill={WHITE} /><Path d="M21.16 4.34A12.2 12.2 0 0 1 27.06 10.24L20.89 13.12A5.4 5.4 0 0 0 18.28 10.51Z" fill={WHITE} /><Circle cx={16} cy={15.4} r={5.4} fill={WHITE} stroke={c.edge} strokeWidth={1.2} />{shine('M13.3 4.6a11 11 0 0 1 5.4 0')}</>;
    case 'download': return <>{shadow}<Rect x={3.6} y={19.9} width={24.8} height={8.6} rx={3.8} fill={c.edge} /><Rect x={3.6} y={18.4} width={24.8} height={8.6} rx={3.8} fill={c.front} />{shine('M7.4 21h4.4')}<Rect x={10} y={22} width={12} height={2} rx={1} fill={c.edge} />{line('M16 3.4v11.4M10.9 10l5.1 5.1 5.1-5.1', INK, 2.6)}</>;
    case 'info': return <>{shadow}<Circle cx={16} cy={16.8} r={12.3} fill={c.edge} /><Circle cx={16} cy={15.3} r={12.3} fill={c.front} />{shine('M8.5 10.5a8.8 8.8 0 0 1 4.6-4.4')}<Circle cx={16} cy={9.8} r={1.9} fill={WHITE} /><Rect x={14.4} y={13.1} width={3.2} height={9.4} rx={1.6} fill={WHITE} /></>;
    case 'photo': return <>{shadow}<Path d="M11.2 9.2 12.9 5.8a2.2 2.2 0 0 1 2-1.2h2.2a2.2 2.2 0 0 1 2 1.2L20.8 9.2Z" fill={c.edge} /><Rect x={2.8} y={9.9} width={26.4} height={18.6} rx={4.6} fill={c.edge} /><Rect x={2.8} y={8.4} width={26.4} height={18.6} rx={4.6} fill={c.front} />{shine('M6.4 11.8h3.6')}<Circle cx={16} cy={17.6} r={5.8} fill={WHITE} /><Circle cx={16} cy={17.6} r={3.2} fill={c.soft} stroke={c.light} strokeWidth={1.1} /><Circle cx={24.6} cy={12.4} r={1.3} fill={c.light} /></>;
    // Početna's tab (2026-09-23): a house, its body lifted 1.5 units off a darker base, an overhanging roof in the
    // edge tone, a white door and one shine down the left slope. Nothing smaller than a door, so it holds at 30 px.
    case 'home': return <>{shadow}{edge('M5.2 15.9 14.3 8.3a2.6 2.6 0 0 1 3.4 0l9.1 7.6v10.3a3.4 3.4 0 0 1-3.4 3.4H8.6a3.4 3.4 0 0 1-3.4-3.4Z')}
      {face('M5.2 14.4 14.3 6.8a2.6 2.6 0 0 1 3.4 0l9.1 7.6v10.3a3.4 3.4 0 0 1-3.4 3.4H8.6a3.4 3.4 0 0 1-3.4-3.4Z')}
      {line('M3.4 14.3 16 4.4l12.6 9.9', c.edge, 2.6)}{shine('M8.4 15.2 12.9 11.4')}
      <Path d="M13.3 28.1v-8.1a1.7 1.7 0 0 1 1.7-1.7h2a1.7 1.7 0 0 1 1.7 1.7v8.1Z" fill={WHITE} /></>;
    // A van seen from the side, facing right: the body lifted 1.5 units off its edge, two white windows, a white lamp and
    // two ink wheels over the body's lower edge. Windows and wheels are the only details.
    case 'vehicle': return <>{shadow}{edge('M3 12.7a3.6 3.6 0 0 1 3.6-3.6h12a3.6 3.6 0 0 1 3 1.6l3.4 5.1 2.4.8a2.7 2.7 0 0 1 1.8 2.5v3.8a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 22.9Z')}
      {face('M3 11.2a3.6 3.6 0 0 1 3.6-3.6h12a3.6 3.6 0 0 1 3 1.6l3.4 5.1 2.4.8a2.7 2.7 0 0 1 1.8 2.5v3.8a2.4 2.4 0 0 1-2.4 2.4H5.4A2.4 2.4 0 0 1 3 21.4Z')}
      {shine('M7.2 8.9h8.6')}<Rect x={6.2} y={10.2} width={8.2} height={5.2} rx={1.6} fill={WHITE} />
      <Path d="M16.8 10.2h2.9a1.6 1.6 0 0 1 1.3.7l2.6 3.9a.4.4 0 0 1-.3.6h-6.5Z" fill={WHITE} />
      <Rect x={26.6} y={17.2} width={2.2} height={1.8} rx={0.9} fill={WHITE} />
      <Circle cx={9.4} cy={24.2} r={3.7} fill={INK} /><Circle cx={9.4} cy={24.2} r={1.4} fill={WHITE} />
      <Circle cx={23.6} cy={24.2} r={3.7} fill={INK} /><Circle cx={23.6} cy={24.2} r={1.4} fill={WHITE} /></>;
    // A toolbox: an ink handle over a box lifted off its edge, the lid seam in the edge tone and a white latch.
    case 'tool': return <>{shadow}{line('M11.4 10.2V7.6a2.2 2.2 0 0 1 2.2-2.2h4.8a2.2 2.2 0 0 1 2.2 2.2v2.6', '#5C6B61', 2.5)}
      <Rect x={3} y={11.4} width={26} height={16.4} rx={4.2} fill={c.edge} /><Rect x={3} y={9.9} width={26} height={16.4} rx={4.2} fill={c.front} />
      {shine('M6.6 12.6h4.4')}{line('M3.8 16.3h24.4', c.edge, 1.8)}
      <Rect x={13.4} y={13.8} width={5.2} height={5} rx={1.4} fill={WHITE} />{line('M16 15.5v1.6', INK, 1.4)}</>;
    case 'eye': return <>{shadow}<Path d="M2.6 17.5C5.9 11.5 10.6 8.5 16 8.5s10.1 3 13.4 9c-3.3 6-8 9-13.4 9s-10.1-3-13.4-9Z" fill={c.edge} /><Path d="M2.6 16C5.9 10 10.6 7 16 7s10.1 3 13.4 9c-3.3 6-8 9-13.4 9S5.9 22 2.6 16Z" fill={c.front} />{shine('M7.4 12.2a11.6 11.6 0 0 1 4.2-2.6')}<Circle cx={16} cy={16} r={5.4} fill={WHITE} /><Circle cx={16} cy={16} r={2.7} fill={INK} /><Circle cx={17.2} cy={14.8} r={0.9} fill={WHITE} /></>;
    // A warning triangle whose corners are rounded by its own stroke, lifted 1.5 units off its edge, with a white mark.
    case 'alert': return <>{shadow}{rounded('M16 6.9 28 26.9H4Z', c.edge, 4)}{rounded('M16 5.4 28 25.4H4Z', c.front, 4)}{shine('M9.4 20.4 13.2 13.8')}
      {line('M16 12.2v6.2M16 22.2h.01', WHITE, 3.2)}</>;
    // A sheet with a badge and a plus in its corner, the old Home door: a NEW task, not the clipboard of your own list.
    case 'publish': return <>{shadow}<Rect x={5.1} y={4.3} width={20.4} height={25.2} rx={4.2} fill="#C5CDC7" />
      <Rect x={3.6} y={2.6} width={20.4} height={25.2} rx={4.2} fill={WHITE} stroke="#CCD4CE" strokeWidth={1.1} />
      {line('M8.4 9.4h10.8M8.4 14.6h6.4', '#7B887E', 1.7)}<Circle cx={23.2} cy={24.3} r={6.6} fill={c.edge} /><Circle cx={23.2} cy={23} r={6.6} fill={c.front} />
      {line('M23.2 19.7v6.6M19.9 23h6.6', WHITE, 2.2)}{shine('M19.4 19.2a4.4 4.4 0 0 1 2.6-1.2')}</>;
    // A paper plane flying up and to the right, lifted 1.5 units off its edge, with the fold in white: an application sent.
    case 'applications':
    case 'send': return <>{shadow}{rounded('M4 16 28 5.4 18.6 29.4 14 19.8Z', c.edge, 2.4)}{rounded('M4 14.6 28 4 18.6 28 14 18.4Z', c.front, 2.4)}
      {line('M14.2 18.2 23.2 9.2', WHITE, 2)}</>;
  }
}

/** The finished drawing for one kind, tone and cut. A drawing is a plain element tree, so one is built once and shared. */
const drawings = new Map<string, ReactNode>();
function drawingFor(kind: FactArtKind, tone: FactTone, cut: FactDrawnCut, role?: FactArtRole): ReactNode {
  const key = `${kind}|${tone}|${cut}|${role ?? ''}`;
  let drawn = drawings.get(key);
  if (drawn === undefined) {
    const colors = role ? sys.color.artRole[role] : sys.color.art[tone];
    if (cut === 'mark') drawn = mark(kind, role ? colors.edge : MARK_FACE[tone]);
    else {
      const material = `fact-${kind}-${tone}-${role ?? 'base'}`;
      drawn = <><Defs><LinearGradient id={material} x1="0%" y1="0%" x2="80%" y2="100%">
        <Stop offset="0%" stopColor={colors.light} />
        <Stop offset="34%" stopColor={colors.front} />
        <Stop offset="100%" stopColor={colors.edge} />
      </LinearGradient></Defs>{art(kind, { ...colors, front: `url(#${material})` })}</>;
    }
    drawings.set(key, drawn);
  }
  return drawn;
}

type FactArtProps = {
  kind: FactArtKind;
  /** Any size; the ladder is `FACT_SIZES`. At 24 and below the flat `mark` cut is drawn, above it the `art` sticker. */
  size?: number;
  /** Explicit tone overrides the normal semantic illustration color. */
  tone?: FactTone;
  /** Semantic art color; explicit state tone or muted state takes precedence. */
  role?: FactArtRole;
  /** `auto` by default: the size decides. */
  cut?: FactCut;
  /** Deprecated alias of `tone="quiet"`, kept so the call sites that say "not active" keep working. */
  muted?: boolean;
};

function FactArtBase({ kind, size = 20, tone, role, cut = 'auto', muted = false }: FactArtProps) {
  const resolved: FactTone = muted ? 'quiet' : tone ?? DEFAULT_TONE[kind] ?? 'brand';
  const drawnCut = factCutFor(size, cut);
  const artRole = muted || tone ? undefined : role ?? (drawnCut === 'art' ? ART_ROLE[kind] : undefined);
  // Explicit warning/confirmed/AI role colors have meaning and must not disappear into an image.
  const subject = (drawnCut === 'art' || cut === 'art') && size >= 20 && !muted && !tone
    && role !== 'waiting' && role !== 'confirmed' && role !== 'ai' ? MATERIAL_SUBJECTS[kind] : undefined;
  if (subject !== undefined) return <View aria-hidden accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <Image source={subject} style={{ width: size, height: size }} accessible={false}
      contentFit="contain" cachePolicy="memory" transition={0} allowDownscaling />
  </View>;
  return <View aria-hidden style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 32 32">{drawingFor(kind, resolved, drawnCut, artRole)}</Svg>
  </View>;
}

export const FactArt = memo(FactArtBase);
