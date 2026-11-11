import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Glyph } from '../system/Glyph';
import { sesijaSada, useSesija } from '../../store/sesija';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductHeader } from '../product/ProductDetails';
import { useReducedMotion } from '../system/motion';
import { brandAction, sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { LocationOverviewMap } from './LocationOverviewMap';
import type { LocationOverviewPoint } from './LocationOverviewMap.types';
import { pointMapUrl, routeMapUrl } from './locationMapLinks';

type Props = {
  points: readonly LocationOverviewPoint[]; scopeKey: string; coarse?: boolean;
  /** The caller owns private grant expiry/revocation, checked again at action time. */
  canUse?: () => boolean;
  /** True only for an actual ordered route supplied by the owning projection. */
  route?: boolean; height?: number;
};
type Owner = { active: boolean; identity: object };

/** Read-only preview → same points in an explorable full-screen map. No geocoder,
 * GPS, grant read/write or hidden export. A private caller still owns its lease. */
export function LocationMapPreview(props: Props) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const geometry = JSON.stringify(props.points);
  const identity = useMemo(() => ({}), [accountId, accountRevision, props.scopeKey, geometry, props.coarse, props.route]);
  const live = useRef<Owner | null>(null);
  const authority = useRef(props.canUse); authority.current = props.canUse;
  const [visit, setVisit] = useState<Owner | null>(null);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [active, setActive] = useState(foreground.current);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (!foreground.current && live.current) live.current.active = false;
      setActive(foreground.current);
    });
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    const owner = { active, identity };
    live.current = owner; setVisit(owner);
    return () => { owner.active = false; if (live.current === owner) live.current = null; setVisit(null); };
  }, [identity, active]));
  const owns = () => !!visit && visit.active && visit.identity === identity && live.current === visit && foreground.current
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision
    && (!authority.current || authority.current());
  if (!accountId || !active || !owns()) return null;
  return <PreviewSession key={`${accountId}:${accountRevision}:${props.scopeKey}:${geometry}:${props.coarse}:${props.route}`}
    {...props} owns={owns} />;
}

function PreviewSession({ points, scopeKey, coarse = false, route = false, height = 184, owns }: Props & { owns: () => boolean }) {
  const [expanded, setExpanded] = useState<object | null>(null);
  const modalVisit = useRef<object | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [cameraIntent, setCameraIntent] = useState(0);
  const [launch, setLaunch] = useState<'idle' | 'opening' | 'error'>('idle');
  const life = useRef({ alive: true, sequence: 0, busy: false, timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const currentOwns = useRef(owns); currentOwns.current = owns;
  const reduced = useReducedMotion();
  const selected = points.find(p => p.id === selectedId) ?? points[0];
  const routeUrl = route && !coarse ? routeMapUrl(points) : null;
  const own = () => life.current.alive && currentOwns.current();
  const ownsModal = () => own() && expanded !== null && modalVisit.current === expanded;
  useEffect(() => {
    const lifetime = life.current; lifetime.alive = true;
    return () => { lifetime.alive = false; lifetime.sequence++; modalVisit.current = null; clearTimeout(lifetime.timer); };
  }, []);
  const close = () => {
    // Dismissal remains available after a lease expires; only the current modal
    // can close itself. Expansion/selection/export still require fresh authority.
    if (!life.current.alive || expanded === null || modalVisit.current !== expanded) return;
    modalVisit.current = null;
    life.current.sequence++; life.current.busy = false; clearTimeout(life.current.timer);
    setLaunch('idle'); setExpanded(null);
  };
  const openLink = (url: string | null) => {
    if (!ownsModal() || !url || life.current.busy) return;
    const lifetime = life.current, sequence = ++lifetime.sequence;
    lifetime.busy = true; setLaunch('opening');
    const settle = (result: 'idle' | 'error') => {
      if (!ownsModal() || lifetime.sequence !== sequence || !lifetime.busy) return;
      lifetime.busy = false; clearTimeout(lifetime.timer); setLaunch(result);
    };
    lifetime.timer = setTimeout(() => settle('error'), 10000);
    try { void Promise.resolve(Linking.openURL(url)).then(() => settle('idle'), () => settle('error')); }
    catch { settle('error'); }
  };
  const choose = (id: string) => {
    if (!ownsModal() || !points.some(point => point.id === id)) return;
    setSelectedId(id); setCameraIntent(value => value + 1);
  };
  if (!points.length) return null;
  return <View>
    {!expanded ? <View>
      <LocationOverviewMap points={points} scopeKey={scopeKey} coarse={coarse} interactive={false} height={height} testID="location-preview-map" />
      {/* The way to the big map is a small round control in the corner (the owner, 8 Oct 2026: the word "Otvori mapu" covered the map); the
          words are for a screen reader, which hears what the drawing does. The touch is 48, the drawing 40. */}
      <Press accessibilityRole="button" accessibilityLabel="Otvori mapu" scaleTo={1}
        onPress={() => { if (own() && !modalVisit.current) { const visit = {}; modalVisit.current = visit; setExpanded(visit); } }} style={s.openTarget}>
        <View style={s.openDisc}><Glyph name="expand" size={20} tone="ink" /></View>
      </Press>
    </View> : null}
    {expanded ? <Modal visible transparent={false} presentationStyle="fullScreen" hardwareAccelerated
      animationType={reduced ? 'none' : 'fade'} onRequestClose={close}>
      <SafeAreaView style={s.screen} edges={['top', 'bottom', 'left', 'right']}>
        <ProductHeader title={coarse ? 'Približno mesto' : points.length > 1 ? 'Tačke zadatka' : 'Mesto zadatka'} back={close} backLabel="Zatvori mapu" />
        <View style={s.expandedContent}>
          <LocationOverviewMap points={points} scopeKey={`${scopeKey}:expanded`} coarse={coarse} interactive
            selectedId={selectedId} cameraIntent={cameraIntent} onSelectPoint={choose} height="fill" testID="location-expanded-map" />
          <ScrollView testID="location-map-actions" style={s.footer} contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never">
          <View style={s.details}>
            {coarse ? <T tone="muted" variant="meta">Prikazano je približno područje, ne tačna adresa.</T> : null}
            {points.length > 1 ? <View style={s.stops}>
              {points.map((point, index) => <Press key={point.id} accessibilityRole="button"
                accessibilityLabel={`Prikaži na mapi: ${point.label}`} accessibilityState={{ selected: selectedId === point.id }}
                onPress={() => choose(point.id)} style={[s.stop, selectedId === point.id && s.selected]}>
                <View style={s.number}><T variant="bodyStrong" style={{ color: sys.color.green }}>{index + 1}</T></View>
                <T variant="bodyStrong" style={s.stopLabel}>{point.label}</T>
              </Press>)}
              <V2Action label="Prikaži sve tačke" kind="quiet" onPress={() => {
                if (ownsModal()) { setSelectedId(undefined); setCameraIntent(value => value + 1); }
              }} />
            </View> : null}
            <V2Action label={coarse ? 'Otvori područje u Google mapama' : points.length > 1 ? `Navigacija: ${selected?.label}` : 'Otvori navigaciju'}
              style={brandAction}
              icon={<Glyph name="external" tone="onGreen" />} loading={launch === 'opening'}
              onPress={() => openLink(selected ? pointMapUrl(selected, coarse) : null)}
              error={launch === 'error' ? 'Ne znamo da li se mapa otvorila. Pokušaj ponovo.' : null} />
            {routeUrl ? <V2Action label="Cela putanja u Google mapama" kind="secondary" disabled={launch === 'opening'} onPress={() => openLink(routeUrl)} /> : null}
            {route && points.length > 2 ? <T variant="meta" tone="muted">{routeUrl
              ? 'Proveri redosled stanica u Google mapama pre polaska.'
              : 'Za ovu putanju otvori navigaciju do svake tačke posebno.'}</T> : null}
          </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal> : null}
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  expandedContent: { flex: 1, minHeight: 0 },
  // Short actions take their natural height. A long stop list can use at most
  // half of the space below the header and scrolls without displacing the map.
  footer: { flexGrow: 0, flexShrink: 1, minHeight: 0, maxHeight: '50%' },
  content: { paddingBottom: sys.space.lg },
  details: { paddingHorizontal: sys.space.lg, gap: sys.space.md },
  openTarget: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  openDisc: { width: 40, height: 40, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, ...sys.elevation.soft },
  stops: { gap: sys.space.xs },
  stop: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: sys.space.sm, padding: sys.space.sm,
    borderWidth: 1, borderColor: sys.color.surface, borderRadius: sys.radius.control },
  selected: { borderColor: sys.color.green, backgroundColor: sys.color.wash },
  number: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stopLabel: { flex: 1, flexShrink: 1 },
});
