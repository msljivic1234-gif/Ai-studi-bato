import type { InboxItem, InboxPage, InboxPort, InboxRole, InboxTarget } from '../contracts/inbox';

export type InboxState = {
  page: InboxPage | null;
  loading: boolean;
  paging: boolean;
  acting: string | null;
  error: 'load' | 'page' | 'action' | null;
  unavailable: boolean;
};

// Request ownership lives outside rendering. A blurred screen, replaced role or
// signed-out account cannot publish an old response or navigate the new session.
export function createInboxModel(port: InboxPort, role: InboxRole | null, isCurrent: () => boolean,
  resolveMessage?: (eventId: string, signal: AbortSignal) => Promise<InboxTarget>,
  resolveApplication?: (eventId: string, needId: string, signal: AbortSignal) => Promise<InboxTarget>) {
  let state: InboxState = {page:null,loading:false,paging:false,acting:null,error:null,unavailable:false};
  let active = false;
  let epoch = 0;
  let messageRead: AbortController | null = null;
  const listeners = new Set<() => void>();
  const valid = (token: number) => active && token === epoch && isCurrent();
  function set(patch: Partial<InboxState>) {
    state = {...state,...patch};
    listeners.forEach(fn => fn());
  }
  async function refresh() {
    if (!active || !isCurrent() || state.acting) return;
    const token = ++epoch;
    set({loading:true,paging:false,error:null,unavailable:false});
    try {
      const page = await port.list(role);
      if (valid(token)) set({page,loading:false});
    } catch {
      if (valid(token)) set({loading:false,error:'load'});
    }
  }
  async function more() {
    if (!active || !isCurrent() || state.loading || state.paging || state.acting || !state.page?.hasMore) return;
    const token = epoch;
    const last = state.page.items.at(-1)!;
    set({paging:true,error:null});
    try {
      const next = await port.list(role,{at:last.occurredAt,id:last.id});
      if (!valid(token)) return;
      const ids = new Set(state.page!.items.map(item => item.id));
      set({paging:false,page:{...next,items:[...state.page!.items,...next.items.filter(item=>!ids.has(item.id))]}});
    } catch {
      if (valid(token)) set({paging:false,error:'page'});
    }
  }
  async function open(item: InboxItem): Promise<InboxTarget | null> {
    if (!active || !isCurrent() || state.acting || state.loading || state.paging) return null;
    // A memoised row can outlive its account/filter/page. Only an event still in this
    // read may start an acknowledgement; the server remains the destination authority.
    if (!state.page?.items.some(row => row.id === item.id && row.eventType === item.eventType
      && row.role === item.role && row.occurredAt === item.occurredAt)) return null;
    const token = ++epoch;
    set({acting:item.id,error:null,unavailable:false});
    const controller = item.eventType === 'MESSAGE_RECEIVED' || item.eventType === 'RESPONSE_RECEIVED' || item.eventType === 'RESPONSE_UPDATED'
      ? new AbortController() : null;
    if (controller) messageRead = controller;
    try {
      // Opening a message notification is only an attempt to reach its conversation.
      // The shown thread owns its read acknowledgement; a failed/unavailable landing
      // must not settle unseen content. Explicit read-all remains a separate intent.
      if (item.eventType !== 'MESSAGE_RECEIVED') {
        const readAt = await port.read(item.id);
        if (!valid(token)) return null;
        const previous = state.page!;
        const wasUnread = previous.items.some(row => row.id===item.id && row.readAt===null);
        set({page:{...previous,items:previous.items.map(row=>row.id===item.id?{...row,readAt}:row),
          unreadCount:Math.max(0,previous.unreadCount-(wasUnread?1:0))}});
      }
      // P4 resolves this recipient's event to its canonical message. Never downgrade a
      // failed/absent resolver to the legacy Agreement-only target or a newest-row guess.
      if (item.eventType === 'MESSAGE_RECEIVED' && !resolveMessage) throw new Error('INBOX_MESSAGE_TARGET_UNCONFIRMED');
      let target = item.eventType === 'MESSAGE_RECEIVED' ? await resolveMessage!(item.id, controller!.signal) : await port.resolve(item.id);
      if (!valid(token)) return null;
      if (item.eventType === 'MESSAGE_RECEIVED' && target.kind !== 'UNAVAILABLE' && ((target.kind !== 'AGREEMENT_MESSAGE' && target.kind !== 'GROUP_MESSAGE')
        || target.eventId.toLowerCase() !== item.id.toLowerCase() || target.role !== item.role)) {
        throw new Error('INBOX_MESSAGE_TARGET_INVALID');
      }
      if (controller && resolveApplication && item.role === 'REQUESTER' && target.kind === 'CANDIDATES' && target.role === 'REQUESTER') {
        const needId = target.id;
        target = await resolveApplication(item.id, needId, controller.signal);
        if (!valid(token)) return null;
        if (!(target.kind === 'CANDIDATES' && target.id === needId && target.role === 'REQUESTER')
          && !(target.kind === 'CANDIDATE' && target.id === needId && target.role === 'REQUESTER'))
          throw new Error('INBOX_APPLICATION_TARGET_INVALID');
      }
      set({acting:null,unavailable:target.kind==='UNAVAILABLE'});
      return target;
    } catch {
      if (valid(token)) set({acting:null,error:'action'});
      return null;
    } finally {
      controller?.abort();
      if (messageRead === controller) messageRead = null;
    }
  }
  async function readAll() {
    if (!active || !isCurrent() || state.acting || state.loading || state.paging || !state.page) return;
    const token = ++epoch;
    const through = state.page.asOf;
    set({acting:'all',error:null,unavailable:false});
    try {
      await port.readAll(through,role);
      if (!valid(token)) return;
      set({acting:null});
      await refresh(); // Server owns timestamps/count, including new arrivals.
    } catch {
      if (valid(token)) set({acting:null,error:'action'});
    }
  }
  return {
    canNavigate: () => active && isCurrent(),
    snapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    start() { if (active) return; active=true; set({acting:null}); void refresh(); },
    stop() { active=false; epoch++; messageRead?.abort(); messageRead=null; set({page:null,loading:false,paging:false,acting:null,error:null,unavailable:false}); },
    refresh,more,open,readAll,
  };
}
