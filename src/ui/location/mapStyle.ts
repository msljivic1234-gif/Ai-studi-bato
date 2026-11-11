import { useEffect, useState, type ComponentProps } from 'react';
import type { Map } from '@maplibre/maplibre-react-native';
import { RESOLVED_PIN_MAP_STYLE } from './ResolvedPinMap.types';
import { uskociMapColors } from './mapAppearance';

/**
 * Map labels in Serbian Latin (Zadaci, 2026-09-24).
 *
 * The OpenFreeMap positron style labels a place with both of its scripts where it has a non-Latin name, so a Serbian
 * town read "Beograd Београд" on every map in the app. The style is read once, every symbol layer whose label is a
 * place name is rewritten to prefer `name:sr-Latn`, then `name:latin`, then `name` (the layer's own expression stays
 * behind them as the last fallback), and the rewritten style is handed to the map. Road numbers and other labels that
 * are not names are left as they are.
 *
 * Nothing about the person enters this request: it is the same public style address the maps loaded by themselves
 * before. When the style cannot be read (offline, slow, a changed format) the maps get the address as before, and the
 * next map tries again a minute later. A valid style arriving after the short display deadline also reaches maps
 * already on screen, by changing their style prop in place; neither the map nor its camera/selection is remounted.
 *
 * The maps get the rewritten style as its JSON text, made once (review r3 item 12). MapLibre's `Map` turns a style
 * object into that same text itself, but inside a memo keyed on all of its props, which change on every render of the
 * map: a whole style stringified again on every pan and every pill. Both platforms read a JSON string as a style and
 * any other string as its address, exactly as they do for the text MapLibre would have made.
 */
export type MapStyle = ComponentProps<typeof Map>['mapStyle'];
type StyleObject = Exclude<MapStyle, string>;

export const MAP_STYLE_URL = RESOLVED_PIN_MAP_STYLE;
/** The label a place gets: its Serbian Latin name, then any Latin name, then its own name. */
export const LATIN_PLACE_NAME = ['coalesce', ['get', 'name:sr-Latn'], ['get', 'name:latin'], ['get', 'name']] as const;

const NAME_KEY = /^name(?:[:_].+)?$/;
const NAME_TOKEN = /\{name(?:[:_][^}]*)?\}/;
/** Whether a label expression (or a legacy token string / zoom function) reads a place name. */
function readsName(value: unknown): boolean {
  if (typeof value === 'string') return NAME_TOKEN.test(value);
  if (Array.isArray(value)) {
    if (value[0] === 'get' && typeof value[1] === 'string' && NAME_KEY.test(value[1])) return true;
    return value.some(readsName);
  }
  return !!value && typeof value === 'object' && Object.values(value).some(readsName);
}

/**
 * The style with every place-name label in Serbian Latin. Pure: the input is not changed. A label that is an expression
 * stays behind the three names as the last fallback; a legacy token string cannot sit inside an expression (it would be
 * drawn as its literal braces), so it is replaced.
 */
export function latinLabels<S extends { layers?: unknown }>(style: S): S {
  if (!Array.isArray(style.layers)) return style;
  const layers = style.layers.map((layer: unknown) => {
    if (!layer || typeof layer !== 'object') return layer;
    const { type, layout } = layer as { type?: unknown; layout?: Record<string, unknown> };
    const field = layout?.['text-field'];
    if (type !== 'symbol' || field === undefined || !readsName(field)) return layer;
    return { ...layer, layout: { ...layout, 'text-field': Array.isArray(field) ? [...LATIN_PLACE_NAME, field] : [...LATIN_PLACE_NAME] } };
  });
  return { ...style, layers };
}

/** Every address a style points at must stand on its own: a relative one would lose the style's own base. */
function addresses(style: Record<string, unknown>): unknown[] {
  const found: unknown[] = [];
  const sprite = style.sprite;
  if (typeof sprite === 'string') found.push(sprite);
  else if (Array.isArray(sprite)) sprite.forEach(entry => found.push((entry as { url?: unknown } | null)?.url));
  if (style.glyphs !== undefined) found.push(style.glyphs);
  for (const source of Object.values(style.sources as Record<string, unknown>)) {
    const value = source as { url?: unknown; tiles?: unknown; data?: unknown } | null;
    if (value?.url !== undefined) found.push(value.url);
    if (Array.isArray(value?.tiles)) found.push(...value.tiles);
    if (typeof value?.data === 'string') found.push(value.data);
  }
  return found;
}
function usable(json: unknown): json is StyleObject {
  if (!json || typeof json !== 'object') return false;
  const style = json as Record<string, unknown>;
  return style.version === 8 && Array.isArray(style.layers) && !!style.sources && typeof style.sources === 'object'
    && addresses(style).every(address => typeof address === 'string' && /^https:\/\//.test(address));
}

type Fetcher = (url: string, options?: { signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
/** Jest never reaches the network: every suite sees the address, exactly as the maps had it before. */
const inTests = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
const network = (): Fetcher | null => inTests || typeof fetch !== 'function' ? null : (url, options) => fetch(url, options);
export const MAP_STYLE_DEADLINE_MS = 4_000;
/** Stop a stuck public read without allowing it to overlap or overwrite a later attempt. */
export const MAP_STYLE_READ_DEADLINE_MS = 15_000;
export const MAP_STYLE_RETRY_MS = 60_000;

/** The Latin style as JSON text, made once for the whole app. */
let ready: string | null = null;
let pending: Promise<MapStyle> | null = null;
let failedAt: number | null = null;
let retireRead: (() => void) | null = null;
const listeners = new Set<(style: string) => void>();

/** What a map can use right now: the Latin style once read, the address when it cannot be read, null while it is read. */
export function currentMapStyle(now = Date.now(), fetcher: Fetcher | null = network()): MapStyle | null {
  if (ready) return ready;
  if (!fetcher || (failedAt !== null && now - failedAt < MAP_STYLE_RETRY_MS)) return MAP_STYLE_URL;
  return null;
}

/** Reads once for the whole app; never rejects. Late success also updates the mounted, still subscribed maps. */
export function loadMapStyle(fetcher: Fetcher | null = network()): Promise<MapStyle> {
  if (ready) return Promise.resolve(ready);
  if (!fetcher) return Promise.resolve(MAP_STYLE_URL);
  if (failedAt !== null && Date.now() - failedAt < MAP_STYLE_RETRY_MS) return Promise.resolve(MAP_STYLE_URL);
  if (pending) return pending;
  failedAt = null;
  const controller = new AbortController();
  let live = true, answered = false;
  let resolve!: (style: MapStyle) => void;
  const read = new Promise<MapStyle>(answer => { resolve = answer; });
  const answer = (value: MapStyle) => { if (!answered) { answered = true; clearTimeout(displayTimer); resolve(value); } };
  const fallback = () => { if (!ready && failedAt === null) failedAt = Date.now(); answer(ready ?? MAP_STYLE_URL); };
  const finish = () => {
    if (!live) return;
    live = false; clearTimeout(displayTimer); clearTimeout(readTimer);
    if (pending === read) pending = null;
    if (retireRead === retire) retireRead = null;
  };
  const retire = () => { if (!live) return; fallback(); finish(); controller.abort(); };
  const displayTimer = setTimeout(fallback, MAP_STYLE_DEADLINE_MS);
  const readTimer = setTimeout(retire, MAP_STYLE_READ_DEADLINE_MS);
  pending = read; retireRead = retire;
  void Promise.resolve().then(() => live ? fetcher(MAP_STYLE_URL, { signal: controller.signal }) : null)
    .then(response => response?.ok ? response.json() : Promise.reject(new Error('MAP_STYLE_UNAVAILABLE')))
    .then(json => {
      if (!live) return;
      if (!usable(json)) { fallback(); finish(); return; }
      const colored = JSON.stringify(latinLabels(uskociMapColors(json)));
      ready = colored; failedAt = null;
      answer(colored);
      finish();
      listeners.forEach(listener => listener(colored));
    })
    .catch(() => { if (live) { fallback(); finish(); } });
  return read;
}

/** The style for a map about to mount; null while it is being read (the map shows its loading state meanwhile). */
export function useMapStyle(): MapStyle | null {
  const [style, setStyle] = useState<MapStyle | null>(() => currentMapStyle());
  useEffect(() => {
    let live = true;
    const accept = (value: MapStyle) => { if (live) setStyle(ready ?? value); };
    listeners.add(accept);
    void loadMapStyle().then(accept);
    return () => { live = false; listeners.delete(accept); };
  }, []);
  return style;
}

/** Tests only: forget what was read. */
export function forgetMapStyle(): void {
  retireRead?.();
  ready = null; pending = null; failedAt = null;
}
