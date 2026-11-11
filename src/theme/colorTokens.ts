/** Pure color owner. Screen roles, semantic pairs and named illustration shades live here.
 * No React Native dependency: compatibility exports and runtime sys read the same values. */
const WHITE = '#FFFFFF', BLACK = '#000000';
/** The one divider colour: `sys.color.line` and `sys.rule.color` are this value. */
const LINE = '#E2E8E3';
/** The four colours the fact-picture tones in `sys.color.art` are derived from; `sys.color` spells the same values by name. */
const GREEN = '#006B4F', ORANGE = '#FF7A1A', MUTED = '#52605A', DANGER = '#A43832';
const hexChannels = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
/** Shared palette interpolation in upper-case #RRGGBB; illustration families may also define reviewed semantic pairs. */
function mix(from: string, toward: string, amount: number): string {
  const a = hexChannels(from), b = hexChannels(toward);
  return `#${a.map((value, at) => Math.round(value + (b[at] - value) * amount).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
/** One tone of a fact picture: the face, the darker edge it stands on, a light detail and a soft fill. */
function artTone(front: string, edge = mix(front, BLACK, 0.3)) {
  return { front, edge, light: mix(front, WHITE, 0.5), soft: mix(front, WHITE, 0.9) };
}
export const colorTokens = {
  color: {
    surface: '#FFFFFF',
    /** Screens and reading groups are white; `wash` is a neutral control/recessed-state surface. */
    ground: '#FFFFFF',
    wash: '#F5F7F4',
    /** Segmented track and icon wells. */
    control: '#E5EBE6',
    iconWell: '#F5F5F5',
    ink: '#17221D',
    muted: MUTED,
    green: GREEN,
    /** Quiet brand tint; selection is also communicated by text/icon/state. */
    greenSoft: '#E8F4ED',
    orange: ORANGE,
    orangeSoft: '#FFF5E9',
    onOrange: '#30200F',
    /** Readable label on a filled brand-green material. */
    onGreen: '#FFFFFF',
    line: LINE,
    lineStrong: '#849087',
    cardLine: '#DEDEDE',
    danger: DANGER,
    dangerSoft: '#FCEEEB',
    warn: '#8A5100',
    warnSoft: '#FFF4DF',
    success: '#1B6E45',
    successSoft: '#EAF5ED',
    info: '#245B93',
    infoSoft: '#EDF4FF',
    violet: '#654898',
    violetSoft: '#F3EFFA',
    /** Owner 2026-10-02: prices are ink; color and depth belong to artwork and meaningful actions. */
    money: '#17221D',
    /** Waiting shapes sit in the same softly tinted family as cards and controls. */
    skeleton: '#E6ECE7',
    scrim: '#00000066',
    /** The dim behind a centred dialog (plan 2.20: 0.35; a bottom sheet's own backdrop is 0.3 and lives in the sheet engine). */
    dim: '#00000059',
    /**
     * The white veil a full-screen step panel lies on over the map (the Zadaci search, Discovery V47): the map still shows
     * through it, and the white cards on it remain readable.
     */
    veil: '#FFFFFFE6',
    /** Hairlines on a filled control, and the ring that appears only while listening. */
    greenEdge: '#226B52',
    orangeEdge: '#E57917',
    orangeHalo: '#FFD2A8',
    /** Branded map marker gradients; the destination stays warm, the start green. */
    mapPin: {
      start: { top: '#079C77', base: '#0E4D3C', stroke: '#063D2E' },
      end: { top: '#F57C00', base: '#D84315', stroke: '#BF360C' },
      shadow: '#0E2D2247',
      shine: '#FFFFFF73',
    },
    /** A fact beside its icon on a card (where, when): a step darker than muted, so a scanned list reads. */
    fact: '#404040',
    /** A count that asks for attention, on white: few places left. */
    attentionInk: '#985223',
    /** The words on a waiting chip, which sits on orangeSoft. */
    waitingInk: '#874515',
    /** Orange as words. The action orange fails as text (2.5:1), so a word that must read orange uses this. */
    orangeInk: '#C23C00',
    /**
     * Readable words on dark material. Any additional muted role must be measured
     * against its actual surface; a historical token name is not a contrast guarantee.
     */
    onDark: '#FFFFFF',
    /** Material tones derive from the actual brand tokens. FactArt caches each static drawing;
     * small functional marks remain flat, with contrast-safe state colors. */
    art: {
      brand: artTone(GREEN),
      accent: artTone(ORANGE, mix(ORANGE, BLACK, 0.2)),
      quiet: artTone(mix(MUTED, WHITE, 0.3), MUTED),
      danger: artTone(DANGER),
    },
    /** Semantic artwork roles: restrained color for place, communication, people and time; never a status inferred from art. */
    artRole: {
      // Owner, 8 Oct 2026 (picking board): the blue drawings became emerald, one family with the others; this is the recoloured pin.
      location: artTone('#0F8C61'),
      ai: artTone('#3979C4'),
      application: artTone('#2473C8', '#185294'),
      skills: artTone('#168579'),
      people: artTone('#D76B5C'),
      time: artTone('#DBAC35', '#8D6B12'),
      confirmed: artTone(GREEN),
      waiting: artTone(ORANGE, mix(ORANGE, BLACK, 0.2)),
    },
  },
  status: {
    neutral: { foreground: '#52605A', background: '#F5F7F4' },
    brand: { foreground: GREEN, background: '#E8F4ED' },
    accent: { foreground: '#A8430A', background: '#FFF5E9' },
    success: { foreground: '#1B6E45', background: '#EAF5ED' },
    info: { foreground: '#245B93', background: '#EDF4FF' },
    warning: { foreground: '#8A5100', background: '#FFF4DF' },
    danger: { foreground: DANGER, background: '#FCEEEB' },
    violet: { foreground: '#654898', background: '#F3EFFA' },
  },
  /** Quiet navigation chrome; stronger colour belongs to the selected destination and useful actions. */
  navigation: {
    background: WHITE, foreground: GREEN, muted: MUTED,
    selected: '#E8F4ED', line: LINE,
  },
  conversation: {
    ground: '#FFFFFF',
    surface: '#FFFFFF',
    summary: '#FFFFFF',
    edge: '#DEDEDE',
    user: GREEN,
    onUser: '#FFFFFF',
    /** Softer own-message treatment for the AI thread. All colours live here, never in a screen. */
    userSoft: '#E8F5E9',
    userSoftSending: '#EDF7EE',
    userSoftEdge: '#C8E6C9',
    userSoftSendingEdge: '#A5D6A7',
    userSoftInk: '#143D35',
    userSoftShadow: '#143D35',
    iconWell: '#F5F5F5',
  },
  map: {
    ground: '#EFEDE8',
    residential: '#E9E7E1',
    park: '#BEE09F',
    woodland: '#A5D387',
    water: '#8DCAEE',
    waterLine: '#5FAED6',
    waterLabel: '#2B5A72',
    building: '#DCDAD4',
    buildingEdge: '#C9C6BF',
    road: '#FFFFFF',
    roadEdge: '#C2C6CA',
    roadMajor: '#FFE9A6',
    roadMajorEdge: '#E1BD5C',
    path: '#AFC498',
    transit: '#A8B1B7',
    boundary: '#98A2A7',
    label: '#2E393F',
    roadLabel: '#46525A',
  },
  illustration: {
    /** Existing picker artwork shades. Illustration-only, not a second screen palette. */
    pictogram: {
      green: { front: '#079C77', edge: '#077958', light: '#6FD0AB', soft: '#E1F4EC', top: '#34C39A' },
      orange: { front: '#F78028', edge: '#CF5B12', light: '#FFBE85', soft: '#FFF0E2', top: '#FFA24D' },
      muted: { front: '#8A938E', edge: '#5C6860', light: '#D6DDD8', soft: '#EAEEEB', top: '#A7AFAA' },
    },
    home: {
    /** The two ends of the green disc's gradient. */
    leafLight: '#21A879',
    leafDeep: GREEN,
    paperEdge: '#D8E7DF',
    /** The title line on the paper, and the two quieter lines under it. */
    paperTitle: '#327960',
    paperRule: '#C8DBD0',
    spark: '#FFAD60',
    dot: '#AECDBB',
  }, legacy: { forest900: '#0A2C28', forest800: '#0E3D37', forest700: '#1B574C', forest600: '#276D5F', teal500: '#2E7A6A', teal400: '#5D9387', sage300: '#9BB1A0', sage200: '#C9C7B2', line100: '#E7D6BE', cream050: '#F8EBD7' } },
  shadow: BLACK,
} as const;
