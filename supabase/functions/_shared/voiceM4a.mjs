const MAX_BYTES = 4 * 1024 * 1024;
const MIN_DURATION_MS = 300;
const MAX_DURATION_MS = 300_000;
const MAX_SAMPLES = Math.ceil(MAX_DURATION_MS * 48_000 / 1000 / 1024);
const BRAND = new Set(['M4A ', 'isom', 'iso2', 'mp41', 'mp42']);
const SAMPLE_RATES = [96_000, 88_200, 64_000, 48_000, 44_100, 32_000, 24_000, 22_050, 16_000, 12_000, 11_025, 8_000];

export class VoiceM4aError extends Error {
  constructor(code) { super(code); this.name = 'VoiceM4aError'; this.code = code; }
}
const fail = code => { throw new VoiceM4aError(code); };
const invalid = () => fail('VOICE_CONTAINER_INVALID');
const unsupported = () => fail('VOICE_FORMAT_UNSUPPORTED');
const u16 = (b, o) => b[o] * 256 + b[o + 1];
const u32 = (b, o) => b[o] * 0x1000000 + b[o + 1] * 65536 + b[o + 2] * 256 + b[o + 3];
const u64 = (b, o) => {
  const hi = u32(b, o);
  if (hi > 0x1fffff) invalid();
  return hi * 0x100000000 + u32(b, o + 4);
};
const text4 = (b, o) => String.fromCharCode(...b.subarray(o, o + 4));
const zero = (b, start, end) => b.subarray(start, end).every(value => value === 0);
const length = box => box.end - box.data;
const requireLength = (box, expected) => { if (length(box) !== expected) invalid(); };
const identityMatrix = (bytes, at) => [65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824]
  .every((value, i) => u32(bytes, at + i * 4) === value);
const full = (b, box, flags = 0) => {
  if (length(box) < 4) invalid();
  if (u32(b, box.data) !== flags) unsupported();
};

function boxes(bytes, start, end, budget) {
  const out = [];
  for (let at = start; at < end;) {
    if (end - at < 8 || ++budget.boxes > 256) invalid();
    let size = u32(bytes, at), header = 8;
    const type = text4(bytes, at + 4);
    if (!/^[\x20-\x7e]{4}$/.test(type)) invalid();
    if (size === 1) {
      if (end - at < 16) invalid();
      size = u64(bytes, at + 8); header = 16;
    } else if (size === 0) size = end - at;
    if (size < header || !Number.isSafeInteger(size) || size > end - at) invalid();
    out.push({ type, start: at, data: at + header, end: at + size });
    at += size;
  }
  return out;
}
function group(items, required, optional = [], repeated = []) {
  const allowed = new Set([...required, ...optional, ...repeated]), byType = {};
  for (const item of items) {
    if (!allowed.has(item.type)) unsupported();
    if (byType[item.type] && !repeated.includes(item.type)) invalid();
    byType[item.type] = item;
  }
  if (required.some(type => !byType[type])) invalid();
  return byType;
}
function clock(bytes, box, movie) {
  if (length(box) < 4) invalid();
  const version = bytes[box.data];
  if (version > 1 || !zero(bytes, box.data + 1, box.data + 4)) unsupported();
  requireLength(box, (movie ? 100 : 24) + (version ? 12 : 0));
  const scale = u32(bytes, box.data + (version ? 20 : 12));
  const duration = version ? u64(bytes, box.data + 24) : u32(bytes, box.data + 16);
  if (!scale || !duration || duration * 1000 / scale < MIN_DURATION_MS || duration * 1000 / scale > MAX_DURATION_MS)
    fail('VOICE_DURATION_INVALID');
  if (movie && (u32(bytes, box.data + (version ? 32 : 20)) !== 65536
    || u16(bytes, box.data + (version ? 36 : 24)) !== 256
    || !identityMatrix(bytes, box.data + (version ? 48 : 36)))) unsupported();
  return { scale, duration };
}
function trackHeader(bytes, box, movie) {
  if (length(box) < 4) invalid();
  const version = bytes[box.data];
  if (version > 1 || bytes[box.data + 1] || bytes[box.data + 2]
    || !(bytes[box.data + 3] & 1) || (bytes[box.data + 3] & ~7)) unsupported();
  const shift = version ? 12 : 0;
  requireLength(box, 84 + shift);
  const id = u32(bytes, box.data + (version ? 20 : 12));
  const duration = version ? u64(bytes, box.data + 28) : u32(bytes, box.data + 20);
  if (!id || duration !== movie.duration) invalid();
  if (u16(bytes, box.data + 36 + shift) !== 256 || u32(bytes, box.data + 76 + shift)
    || u32(bytes, box.data + 80 + shift) || !identityMatrix(bytes, box.data + 40 + shift)) unsupported();
}

// ES descriptors use 1–4 base-128 length bytes, not ISO box lengths.
function descriptors(bytes, start, end) {
  const result = [];
  for (let at = start; at < end;) {
    if (result.length === 8 || end - at < 2) invalid();
    const tag = bytes[at++]; let size = 0, complete = false;
    for (let i = 0; i < 4; i++) {
      if (at >= end) invalid();
      const byte = bytes[at++]; size = size * 128 + (byte & 127);
      if (!(byte & 128)) { complete = true; break; }
    }
    if (!complete || size > end - at) invalid();
    result.push({ tag, data: at, end: at + size }); at += size;
  }
  return result;
}
function aacConfig(bytes, esds) {
  full(bytes, esds);
  const roots = descriptors(bytes, esds.data + 4, esds.end);
  if (roots.length !== 1 || roots[0].tag !== 3 || length(roots[0]) < 3) invalid();
  const es = roots[0];
  if (bytes[es.data + 2] !== 0) unsupported(); // No remote URL, dependency or OCR stream.
  const children = descriptors(bytes, es.data + 3, es.end);
  if (children.length !== 2 || children[0].tag !== 4 || children[1].tag !== 6) invalid();
  const decoder = children[0], sl = children[1];
  if (length(decoder) < 13 || length(sl) !== 1) invalid();
  if (bytes[decoder.data] !== 0x40 || bytes[decoder.data + 1] !== 0x15 || bytes[sl.data] !== 2) unsupported();
  const configs = descriptors(bytes, decoder.data + 13, decoder.end);
  if (configs.length !== 1 || configs[0].tag !== 5) invalid();
  const config = configs[0];
  if (length(config) !== 2) unsupported(); // No SBR/PS, explicit rate or trailing extensions.
  const bits = u16(bytes, config.data), rate = SAMPLE_RATES[(bits >>> 7) & 15];
  if ((bits >>> 11) !== 2 || ((bits >>> 3) & 15) !== 1 || (bits & 7)
    || !rate || rate > 48_000) unsupported(); // AAC-LC, mono, 1024-sample frames only.
  return rate;
}
function sampleDescription(bytes, box, budget) {
  full(bytes, box);
  if (length(box) < 8 || u32(bytes, box.data + 4) !== 1) invalid();
  const descriptions = boxes(bytes, box.data + 8, box.end, budget);
  if (descriptions.length !== 1) invalid();
  const entry = descriptions[0];
  if (entry.type !== 'mp4a') unsupported();
  if (length(entry) < 28) invalid();
  if (!zero(bytes, entry.data, entry.data + 6) || u16(bytes, entry.data + 6) !== 1
    || !zero(bytes, entry.data + 8, entry.data + 16) || u16(bytes, entry.data + 16) !== 1
    || u16(bytes, entry.data + 18) !== 16 || !zero(bytes, entry.data + 20, entry.data + 24)) unsupported();
  const children = group(boxes(bytes, entry.data + 28, entry.end, budget), ['esds'], ['btrt']);
  if (children.btrt) requireLength(children.btrt, 12);
  const rate = aacConfig(bytes, children.esds);
  if (u32(bytes, entry.data + 24) !== rate * 65536) invalid();
  return rate;
}
function table(bytes, box, stride) {
  full(bytes, box);
  if (length(box) < 8) invalid();
  const count = u32(bytes, box.data + 4);
  if (!count || count > MAX_SAMPLES || length(box) !== 8 + count * stride) invalid();
  return count;
}
function sampleTables(bytes, tables, media, mdat) {
  const stsz = tables.stsz; full(bytes, stsz);
  if (length(stsz) < 12) invalid();
  const fixedSize = u32(bytes, stsz.data + 4), count = u32(bytes, stsz.data + 8);
  if (!count || count > MAX_SAMPLES || length(stsz) !== 12 + (fixedSize ? 0 : count * 4)) invalid();
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const size = fixedSize || u32(bytes, stsz.data + 12 + i * 4);
    if (!size || size > MAX_BYTES) invalid();
    sizes.push(size);
  }
  const entries = table(bytes, tables.stts, 8); let timed = 0, duration = 0;
  for (let i = 0; i < entries; i++) {
    const at = tables.stts.data + 8 + i * 8, samples = u32(bytes, at), delta = u32(bytes, at + 4);
    if (!samples || timed + samples > count || !delta || delta > 1024
      || (delta !== 1024 && (i !== entries - 1 || samples !== 1))) invalid();
    timed += samples; duration += samples * delta;
  }
  if (timed !== count || duration !== media.duration) fail('VOICE_DURATION_INVALID');
  if (!!tables.stco === !!tables.co64) invalid();
  const offsets = tables.stco ?? tables.co64, stride = tables.stco ? 4 : 8;
  const chunks = table(bytes, offsets, stride), runs = table(bytes, tables.stsc, 12);
  if (chunks > count || runs > chunks) invalid();
  const mappings = [];
  for (let i = 0; i < runs; i++) {
    const at = tables.stsc.data + 8 + i * 12;
    const first = u32(bytes, at), samples = u32(bytes, at + 4), description = u32(bytes, at + 8);
    if (!first || first > chunks || !samples || samples > count || description !== 1
      || (i === 0 ? first !== 1 : first <= mappings[i - 1].first)) invalid();
    mappings.push({ first, samples });
  }
  let sample = 0, run = 0, nextByte = mdat.data;
  for (let chunk = 1; chunk <= chunks; chunk++) {
    if (run + 1 < runs && mappings[run + 1].first === chunk) run++;
    const offset = stride === 4 ? u32(bytes, offsets.data + 8 + (chunk - 1) * stride)
      : u64(bytes, offsets.data + 8 + (chunk - 1) * stride);
    if (offset !== nextByte || sample + mappings[run].samples > count) invalid();
    for (let n = 0; n < mappings[run].samples; n++) nextByte += sizes[sample++];
    if (nextByte > mdat.end) invalid();
  }
  if (sample !== count || nextByte !== mdat.end) invalid(); // No overlap, gap or unreferenced media bytes.
}

/**
 * Source-only admission for one self-contained, non-fragmented mono AAC-LC track.
 * Unknown layouts (including edits, metadata tracks and encrypted/fragmented media)
 * are rejected. Sample bytes are opaque: this is NOT decoding, playability proof,
 * sanitization or a claim that Android/iOS recorder output has been accepted.
 */
export function inspectVoiceM4a(input) {
  if (!(input instanceof Uint8Array) || input.byteLength < 32 || input.byteLength > MAX_BYTES) fail('VOICE_SIZE_INVALID');
  const budget = { boxes: 0 };
  const top = group(boxes(input, 0, input.byteLength, budget), ['ftyp', 'moov', 'mdat'], [], ['free', 'skip']);
  if (top.ftyp.start !== 0 || length(top.ftyp) < 8 || length(top.ftyp) % 4 || !length(top.mdat)) invalid();
  const brands = [text4(input, top.ftyp.data)];
  for (let at = top.ftyp.data + 8; at < top.ftyp.end; at += 4) brands.push(text4(input, at));
  if (!brands.some(brand => BRAND.has(brand))) unsupported();
  const moov = group(boxes(input, top.moov.data, top.moov.end, budget), ['mvhd', 'trak']);
  const movie = clock(input, moov.mvhd, true);
  const trak = group(boxes(input, moov.trak.data, moov.trak.end, budget), ['tkhd', 'mdia']);
  trackHeader(input, trak.tkhd, movie);
  const mdia = group(boxes(input, trak.mdia.data, trak.mdia.end, budget), ['mdhd', 'hdlr', 'minf']);
  const media = clock(input, mdia.mdhd, false), handler = mdia.hdlr;
  full(input, handler);
  if (length(handler) < 24 || length(handler) > 280) invalid();
  if (u32(input, handler.data + 4) || text4(input, handler.data + 8) !== 'soun'
    || !zero(input, handler.data + 12, handler.data + 24)) unsupported();
  const minf = group(boxes(input, mdia.minf.data, mdia.minf.end, budget), ['smhd', 'dinf', 'stbl']);
  full(input, minf.smhd); requireLength(minf.smhd, 8);
  if (!zero(input, minf.smhd.data + 4, minf.smhd.end)) unsupported();
  const dinf = group(boxes(input, minf.dinf.data, minf.dinf.end, budget), ['dref']);
  full(input, dinf.dref);
  if (length(dinf.dref) < 8 || u32(input, dinf.dref.data + 4) !== 1) invalid();
  const references = boxes(input, dinf.dref.data + 8, dinf.dref.end, budget);
  if (references.length !== 1 || references[0].type !== 'url ') unsupported();
  full(input, references[0], 1); requireLength(references[0], 4);
  const tables = group(boxes(input, minf.stbl.data, minf.stbl.end, budget), ['stsd', 'stts', 'stsc', 'stsz'], ['stco', 'co64']);
  const rate = sampleDescription(input, tables.stsd, budget);
  if (rate !== media.scale) invalid();
  const difference = BigInt(movie.duration) * BigInt(media.scale) - BigInt(media.duration) * BigInt(movie.scale);
  if ((difference < 0n ? -difference : difference) > BigInt(media.scale)) fail('VOICE_DURATION_INVALID');
  sampleTables(input, tables, media, top.mdat);
  return Object.freeze({ durationMs: Math.round(media.duration * 1000 / media.scale), byteSize: input.byteLength, contentType: 'audio/mp4' });
}
export const VOICE_M4A_LIMITS = Object.freeze({ maxBytes: MAX_BYTES, minDurationMs: MIN_DURATION_MS, maxDurationMs: MAX_DURATION_MS });
