import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, type FlatList, type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken } from 'react-native';
import type { GroupMessage } from '../../data/groupConversationService';

type Input = {
  initialTargetId?: string; messages: GroupMessage[]; ready: boolean; covered: boolean; minimumViewTime?: number;
  onVisible: (info: { viewableItems: ViewToken<GroupMessage>[] }) => void;
};
const atBottom = (event: NativeScrollEvent) => event.contentOffset.y + event.layoutMeasurement.height >= event.contentSize.height - 80;
export const GROUP_READING_POSITION = { minIndexForVisible: 0 };

/** Owned by one mounted account/group/list generation. Never marks a page read or retains server data. */
export function useGroupReading(input: Input) {
  const list = useRef<FlatList<GroupMessage>>(null), alive = useRef(true), following = useRef(!input.initialTargetId), dragging = useRef(false);
  const frame = useRef<number | null>(null), serial = useRef(0), visibilityEpoch = useRef(0);
  const geometry = useRef({ height: 0, content: 0, offset: 0, revision: 0 });
  const ackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observed = useRef<{ info: { viewableItems: ViewToken<GroupMessage>[] }; page: GroupMessage[]; geometry: number } | null>(null);
  const anchor = useRef<string | null>(null), previous = useRef<GroupMessage[]>([]);
  const targetPositioned=useRef(false),headerHeight=useRef<number|null>(null);
  const [showLatest, setShowLatest] = useState(!!input.initialTargetId), [readingLost, setReadingLost] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const now = useRef(input); now.current = input;
  const blocked = useRef(input.covered);
  const foreground = () => !['background', 'inactive'].includes(AppState.currentState);
  const cancelAck = () => { if (ackTimer.current !== null) clearTimeout(ackTimer.current); ackTimer.current = null; };
  const dwell = () => {
    cancelAck();
    const value = observed.current, ticket = visibilityEpoch.current;
    if (!value || !now.current.ready || value.page !== now.current.messages || value.geometry !== geometry.current.revision || blocked.current || !foreground()) return;
    ackTimer.current = setTimeout(() => {
      ackTimer.current = null;
      if (alive.current && now.current.ready && foreground() && !blocked.current && ticket === visibilityEpoch.current
        && observed.current === value && value.page === now.current.messages && value.geometry === geometry.current.revision) now.current.onVisible(value.info);
    }, now.current.minimumViewTime ?? 600);
  };
  const cancel = () => {
    serial.current++;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };
  const invalidateVisibility = () => { cancelAck(); visibilityEpoch.current++; setEpoch(visibilityEpoch.current); };
  const mayFollow = () => alive.current && foreground() && now.current.ready && !blocked.current
    && following.current && !dragging.current && geometry.current.height > 0 && geometry.current.content > 0;
  // FlatList.scrollToEnd uses an estimated last-cell frame, which may still be
  // short after contentSize fires (native large-font reproduction). The actual
  // measured content includes list header/footer/padding; the composer is outside.
  const measuredEnd = () => list.current?.scrollToOffset({
    offset: Math.max(0, geometry.current.content - geometry.current.height), animated: false,
  });
  const placeTarget = () => {
    if(targetPositioned.current||!now.current.initialTargetId||!now.current.ready||blocked.current||!foreground()
      ||now.current.messages[0]?.messageId!==now.current.initialTargetId||headerHeight.current===null
      ||geometry.current.height<=0||geometry.current.content<=0)return;
    targetPositioned.current=true;following.current=false;setShowLatest(true);cancel();
    list.current?.scrollToOffset({offset:headerHeight.current,animated:false});
  };
  const follow = () => {
    cancel();
    if (!mayFollow()) return;
    measuredEnd();
    const ticket = serial.current;
    frame.current = requestAnimationFrame(() => {
      if (ticket !== serial.current) return;
      frame.current = null;
      if (mayFollow()) measuredEnd();
    });
  };
  useEffect(() => {
    alive.current = true;
    const listener = AppState.addEventListener('change', value => {
      if (value !== 'active') { cancel(); cancelAck(); visibilityEpoch.current++; }
    });
    return () => { alive.current = false; cancel(); cancelAck(); visibilityEpoch.current++; listener.remove(); };
  }, []); // the mounted presentation is the account/group/generation scope
  useLayoutEffect(() => {
    blocked.current = input.covered;
    cancel(); invalidateVisibility();
    if (!input.covered) { follow(); dwell(); }
  }, [input.covered]); // opening people never changes the list's content or saved position
  useLayoutEffect(() => {
    cancelAck();
    if (!input.ready) { cancel(); return; }
    const old = previous.current, next = input.messages;
    if (old !== next && old.length && !following.current) {
      const ids = new Set(next.map(message => message.messageId));
      if (old.some(message => !ids.has(message.messageId)) && (!anchor.current || !ids.has(anchor.current))) {
        cancel(); setReadingLost(true); setShowLatest(true);
      }
    }
    previous.current = next;
    if(input.initialTargetId&&!targetPositioned.current&&next[0]?.messageId===input.initialTargetId){
      following.current=false;setShowLatest(true);cancel();placeTarget();
    }
    follow();
  }, [input.messages, input.ready]);
  // Native minimumViewTime is ZERO: FlatList's stable wrapper forwards an old native timer to the newest
  // props, so an epoch in that callback alone cannot guard a quick sheet open/close. Own the cancellable
  // dwell instead. Reuse geometric observations only while page AND measured geometry remain unchanged;
  // closing a cover starts a full new dwell, never sends a cached read receipt immediately.
  const onVisible = useMemo(() => {
    const page = input.messages, ticket = epoch;
    return (info: { viewableItems: ViewToken<GroupMessage>[] }) => {
      if (!alive.current || !foreground() || visibilityEpoch.current !== ticket || now.current.messages !== page) return;
      const visible = info.viewableItems.filter(item => item.isViewable);
      observed.current = { info: { viewableItems: visible }, page, geometry: geometry.current.revision };
      if (!blocked.current) anchor.current = visible[0]?.item.messageId ?? anchor.current;
      dwell();
    };
  }, [input.messages, epoch]);
  const chooseLatest = () => {
    if (!alive.current || !foreground() || blocked.current) return;
    following.current = true; dragging.current = false; setShowLatest(false); setReadingLost(false); follow();
  };
  const readOlder = () => {
    cancel(); following.current = false; dragging.current = false; setShowLatest(true);
  };
  const cover = () => { blocked.current = true; cancel(); invalidateVisibility(); };
  const startDrag = () => {
    if (!alive.current || !foreground() || blocked.current) return;
    cancel(); dragging.current = true; following.current = false;
  };
  const observe = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!alive.current || !foreground()) return;
    if (geometry.current.offset !== nativeEvent.contentOffset.y) {
      geometry.current.offset = nativeEvent.contentOffset.y; geometry.current.revision++; cancelAck();
    }
    if (blocked.current || !dragging.current) return;
    const next = atBottom(nativeEvent);
    following.current = next;
    setShowLatest(value => value === !next ? value : !next);
    if (next) setReadingLost(false);
  };
  const endDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    observe(event); dragging.current = false;
  };
  return { list, showLatest, readingLost, onVisible, chooseLatest, readOlder, cover,
    onHeaderLayout:(height:number)=>{headerHeight.current=height;placeTarget();},
    onLayout: (height: number) => {
      if (geometry.current.height !== height) { geometry.current.height = height; geometry.current.revision++; cancelAck(); }
      placeTarget();follow();
    },
    onContentSizeChange: (_width: number, height: number) => {
      if (geometry.current.content !== height) { geometry.current.content = height; geometry.current.revision++; cancelAck(); }
      placeTarget();follow();
    },
    onAccessibilityAction: (direction: 'scrollBackward' | 'scrollForward') => {
      if (!alive.current || !foreground() || blocked.current) return;
      readOlder();
      list.current?.scrollToOffset({ offset: Math.max(0, geometry.current.offset + (direction === 'scrollBackward' ? -1 : 1) * geometry.current.height * 0.8), animated: false });
    },
    onScroll: observe, onScrollBeginDrag: startDrag, onMomentumScrollBegin: startDrag,
    onScrollEndDrag: endDrag, onMomentumScrollEnd: endDrag,
  };
}
