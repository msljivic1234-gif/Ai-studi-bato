import {
  ArrowClockwise, ArrowLeft, ArrowRight, ArrowSquareOut, ArrowUp, ArrowUpRight, ArrowsOutSimple, CalendarBlank, Camera, CaretDown, CaretLeft,
  CaretRight, CaretUp, Check, DotsThree, Eye, EyeSlash, Image, Info, MagnifyingGlass, MapTrifold, Microphone, Minus, PaperPlaneTilt, Plus,
  Bell, ChatText, GearSix, Handshake, House, Keyboard, PencilSimpleLine, MapPin, GlobeHemisphereWest, Users, Wrench, Truck,
  SlidersHorizontal, Trash, User, Waveform, X, Prohibit, ShieldCheck, SignOut, type Icon, type IconWeight,
} from 'phosphor-react-native';
import { sys } from './tokens';

/** Central functional icon registry. Keep icon meanings and semantic colors consistent.
 * Named optical defaults serve text, rows and chrome; a verified composition may use
 * another positive size. Small strokes remain legible; selected and strong variants
 * are resolved here. Callers supply a spoken label on the actual control.
 * Illustration and status artwork retain their separate roles, not separate palettes. */
export const GLYPH_NAMES = ['back', 'close', 'caret-right', 'caret-left', 'caret-down', 'caret-up', 'plus', 'minus', 'check', 'send',
  'search', 'filters', 'more', 'mic', 'wave', 'arrow-right', 'arrow-up', 'arrow-up-right', 'refresh', 'trash', 'camera', 'image', 'eye',
  'eye-off', 'external', 'expand', 'info', 'map', 'profile', 'calendar', 'home', 'agreements', 'messages', 'notifications', 'edit', 'settings', 'cancel', 'keyboard',
  'location', 'remote', 'people', 'tool', 'vehicle', 'shield', 'logout'] as const;
export type GlyphName = (typeof GLYPH_NAMES)[number];

/** In-text, row or beside a word, chrome. */
export const GLYPH_SIZES = Object.values(sys.icon.size);
export type GlyphSize = number;

export const GLYPH_TONES = ['ink', 'green', 'muted', 'onGreen', 'danger', 'orange', 'onOrange', 'success', 'info', 'warn', 'violet'] as const;
export type GlyphTone = (typeof GLYPH_TONES)[number];

/** The colour of each tone: tokens only. */
export const GLYPH_COLOUR: Record<GlyphTone, string> = {
  ink: sys.color.ink, green: sys.color.green, muted: sys.color.muted, onGreen: sys.color.onGreen, danger: sys.color.danger,
  orange: sys.color.orangeInk, onOrange: sys.color.onOrange, success: sys.color.success, info: sys.color.info, warn: sys.color.warn, violet: sys.color.violet,
};

/** A Phosphor icon component, for the callers that still pass one (`ChromeIconButton`'s `icon`). Only the type crosses this file. */
export type GlyphIcon = Icon;

const REGISTRY: Record<GlyphName, Icon> = {
  back: ArrowLeft, close: X, 'caret-right': CaretRight, 'caret-left': CaretLeft, 'caret-down': CaretDown, 'caret-up': CaretUp,
  plus: Plus, minus: Minus, check: Check, send: PaperPlaneTilt, search: MagnifyingGlass, filters: SlidersHorizontal, more: DotsThree,
  mic: Microphone, wave: Waveform, 'arrow-right': ArrowRight, 'arrow-up': ArrowUp, 'arrow-up-right': ArrowUpRight, refresh: ArrowClockwise,
  trash: Trash, camera: Camera, image: Image, eye: Eye, 'eye-off': EyeSlash, external: ArrowSquareOut, expand: ArrowsOutSimple, info: Info,
  map: MapTrifold, profile: User, calendar: CalendarBlank,
  home: House, agreements: Handshake, messages: ChatText, notifications: Bell, edit: PencilSimpleLine,
  // The cog of "Podesi obaveštenja" (the inbox bar) and of every settings control after it: the notification screens drew it with a Phosphor import of their own.
  settings: GearSix, cancel: Prohibit, keyboard: Keyboard,
  location: MapPin, remote: GlobeHemisphereWest, people: Users, tool: Wrench, vehicle: Truck,
  shield: ShieldCheck, logout: SignOut,
};

/** The short marks that read thin at any size. */
const SHORT_MARKS: ReadonlySet<GlyphName> = new Set<GlyphName>(['check', 'close', 'plus', 'minus']);

/** The weight a glyph is drawn in: the one rule, in one place (see the header). `on` wins over everything, then `strong`. */
export function glyphWeight(name: GlyphName, size: GlyphSize, on = false, strong = false): IconWeight {
  if (on) return 'fill';
  if (strong || size <= sys.icon.size.inline || SHORT_MARKS.has(name)) return 'bold';
  return 'regular';
}

type GlyphProps = {
  name: GlyphName;
  /** 20 by default: a row, or beside a word. */
  size?: GlyphSize;
  /** `ink` by default. */
  tone?: GlyphTone;
  /** The control is on (a toggle that is set): drawn filled. The only way to get a fill. */
  on?: boolean;
  /** Bold at any size: for a glyph that stands beside bold type in the chrome. */
  strong?: boolean;
};

/** A control glyph. Decorative, like the control's own label says what it does; the Phosphor icon draws as an SVG. */
export function Glyph({ name, size = sys.icon.size.row, tone = 'ink', on = false, strong = false }: GlyphProps) {
  const Drawing = REGISTRY[name];
  const opticalSize = Number.isFinite(size) && size > 0 ? size : sys.icon.size.row;
  return <Drawing size={opticalSize} color={GLYPH_COLOUR[tone]} weight={glyphWeight(name, opticalSize, on, strong)} />;
}
