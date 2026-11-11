import type { InboxItem, InboxPage, InboxPort, InboxTarget } from '../contracts/inbox';
import { supabaseKlijent } from './supabaseClient';
type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
function invalid(): never { throw new Error('INBOX_INVALID_PROJECTION'); }
function item(v: unknown): InboxItem {
  if (!isObject(v) || !isId(v.id) || !isDate(v.occurredAt) || !(v.readAt === null || isDate(v.readAt))
    || !['REQUESTER','WORKER'].includes(String(v.role)) || typeof v.title !== 'string'
    || typeof v.body !== 'string' || typeof v.eventType !== 'string' || typeof v.family !== 'string'
    // The task's own title (INBOX-NASLOV): optional, null or absent when the read has none; anything else is not a projection we know.
    || !(v.taskTitle === undefined || v.taskTitle === null || typeof v.taskTitle === 'string')) return invalid();
  const taskTitle = typeof v.taskTitle === 'string' && v.taskTitle.trim() ? v.taskTitle : undefined;
  return { id:v.id, occurredAt:v.occurredAt, readAt:v.readAt, role:v.role as InboxItem['role'],
    title:v.title, body:v.body, eventType:v.eventType, family:v.family, ...(taskTitle ? { taskTitle } : {}) };
}
export function createInboxService(rpc: Rpc): InboxPort {
  async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { data,error }=await Promise.race([Promise.resolve(rpc(name,args)),
        new Promise<never>((_, reject) => { timer=setTimeout(() => reject(new Error('INBOX_REQUEST_UNCONFIRMED')),15_000); })]);
      if (error) throw new Error('INBOX_REQUEST_FAILED');
      return data;
    } finally { if (timer!==undefined) clearTimeout(timer); }
  }
  return {
    async list(role,cursor,limit=30): Promise<InboxPage> {
      const raw=await call('rpc_list_inbox',{p_role:role,p_limit:limit,
        p_before_at:cursor?.at??null,p_before_id:cursor?.id??null});
      if (!isObject(raw) || !Array.isArray(raw.items) || typeof raw.hasMore !== 'boolean'
        || !Number.isSafeInteger(raw.unreadCount) || Number(raw.unreadCount)<0 || !isDate(raw.asOf)) return invalid();
      const items=raw.items.map(item);
      if (new Set(items.map(x=>x.id)).size!==items.length || (raw.hasMore && items.length===0)) return invalid();
      return {items,hasMore:raw.hasMore,unreadCount:Number(raw.unreadCount),asOf:raw.asOf};
    },
    async read(id) {
      if (!isId(id)) return invalid();
      const date=await call('rpc_mark_activity_event_read',{p_event_id:id});
      if (!isDate(date)) return invalid();
      return date;
    },
    async readAll(through,role) {
      if (!isDate(through)) return invalid();
      const count=await call('rpc_mark_inbox_read',{p_through:through,p_role:role});
      if (!Number.isSafeInteger(count) || Number(count)<0) return invalid();
      return Number(count);
    },
    async resolve(id): Promise<InboxTarget> {
      if (!isId(id)) return invalid();
      const raw=await call('rpc_resolve_activity_event',{p_event_id:id});
      if (!isObject(raw)) return invalid();
      if (raw.kind==='UNAVAILABLE') return {kind:'UNAVAILABLE'};
      if (!['AGREEMENT','APPLICATIONS','CANDIDATES','OWN_NEED','OPPORTUNITY'].includes(String(raw.kind))
        || !isId(raw.id) || !['REQUESTER','WORKER'].includes(String(raw.role))) return invalid();
      return {kind:raw.kind,id:raw.id,role:raw.role} as InboxTarget;
    },
  };
}
// One production owner. No mock fallback, no raw table writes, no transport mutation.
export const inboxClientService=createInboxService((name,args)=>supabaseKlijent().rpc(name,args));
