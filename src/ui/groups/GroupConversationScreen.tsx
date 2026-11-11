import { useCallback,useMemo,useRef,useState } from 'react';
import { AppState,type ViewToken } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router,useFocusEffect } from 'expo-router';
import { useSesija,sesijaSada } from '../../store/sesija';

import { groupBody,normalizeGroupBody,type GroupMessage } from '../../data/groupConversationService';
import { GroupConversationController,initialGroupState } from './GroupConversationController';
import { GroupConversationPresentation } from './GroupConversationPresentation';
import { privateConversationChoices } from './ConversationChannels';
import { ProfilePhoto } from '../media/ContextPhotos';
import { SupportContextEntry } from '../support/SupportContextEntry';
export function GroupConversationScreen({agreementId,fromInbox=false,initialTarget}:{agreementId:string;fromInbox?:boolean;initialTarget?:{groupId:string;messageId:string;sequence:string}}){
 const {user,accountRevision}=useSesija(),accountId=user?.id??'';
 const [state,setState]=useState(initialGroupState),[epoch,setEpoch]=useState(0),[generation,setGeneration]=useState(0),[draft,setDraft]=useState(''),[showPeople,setShowPeople]=useState(false);
 const owner=useRef<object|null>(null),engine=useRef<GroupConversationController|null>(null),input=useRef('');
 const heldDraft=useRef<{accountId:string;accountRevision:number;agreementId:string;groupId:string;text:string}|null>(null);
 if(heldDraft.current&&(heldDraft.current.accountId!==accountId||heldDraft.current.accountRevision!==accountRevision||heldDraft.current.agreementId!==agreementId))heldDraft.current=null;
 useFocusEffect(useCallback(()=>{
  const scope={};owner.current=scope;setGeneration(x=>x+1);setState(initialGroupState);input.current='';setDraft('');setShowPeople(false);
  const current=()=>owner.current===scope&&!['background','inactive'].includes(AppState.currentState)&&sesijaSada().user?.id===accountId
   &&sesijaSada().accountRevision===accountRevision;
  const controller=new GroupConversationController({agreementId,initialTarget,account:{accountId,accountRevision},current,storage:AsyncStorage});engine.current=controller;
  controller.subscribe(()=>{if(current()){
   const next=controller.snapshot();setState(next);
   if(next.journal||next.phase==='CONFIRMED')heldDraft.current=null;
   if(next.phase==='CONFIRMED'){input.current='';setDraft('');}
   const held=heldDraft.current,group=next.context?.group;
   if(held&&next.context?.authoritative&&(!group?.canSend||group.groupId!==held.groupId)){
    heldDraft.current=null;input.current='';setDraft('');
   }else if(held&&next.phase==='READY'&&!next.journal&&group?.canSend&&group.groupId===held.groupId){
    input.current=held.text;setDraft(held.text);
   }
  }});void controller.load();
  // Focus-scoped reads: no background traffic and no automatic write retries.
  const syncTimer=setInterval(()=>{if(current())void controller.syncLatest();},8000);
  const listener=AppState.addEventListener('change',next=>{if(next!=='active'){controller.dispose();owner.current=null;input.current='';setDraft('');setState(initialGroupState);}else setEpoch(x=>x+1);});
  return()=>{clearInterval(syncTimer);listener.remove();controller.dispose();if(owner.current===scope)owner.current=null;if(engine.current===controller)engine.current=null;input.current='';setDraft('');setShowPeople(false);setState(initialGroupState);};
 },[agreementId,accountId,accountRevision,epoch,initialTarget?.groupId,initialTarget?.messageId,initialTarget?.sequence]));
 const renderedOwner=owner.current,controller=engine.current;
 const current=()=>renderedOwner!==null&&owner.current===renderedOwner&&engine.current===controller&&controller?.snapshot()===state
  &&!['background','inactive'].includes(AppState.currentState)&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision;
 const invoke=(method:'refresh'|'older'|'acknowledge'|'managementNext')=>{if(current())void controller?.[method]();};
 const change=(value:string)=>{if(current()&&(state.phase==='READY'||state.phase==='UNKNOWN')){
  input.current=value;setDraft(value);
  const group=state.context?.group;
  heldDraft.current=state.phase==='READY'&&!state.journal&&group?.canSend&&value
   ?{accountId,accountRevision,agreementId,groupId:group.groupId,text:value}:null;
 }};
 const retry=state.phase==='UNKNOWN'&&state.canRetry;
 const onVisible=useMemo(()=>({viewableItems}:{viewableItems:ViewToken<GroupMessage>[]})=>{
  // The current controller owns the list; blur/background disposal suppresses
  // late callbacks. Only actually viewable message IDs enter the bounded RPC.
  if(renderedOwner!==null&&owner.current===renderedOwner&&engine.current===controller)void controller?.markVisible(viewableItems.filter(x=>x.isViewable).map(x=>x.item.messageId));
 },[renderedOwner,controller]);
 const viewability=useRef({viewAreaCoveragePercentThreshold:60,minimumViewTime:600}).current;
 const allowedPrivate=(id:string)=>current()&&!!state.context&&privateConversationChoices(state.context).some(choice=>choice.id===id);
 const openAgreement=(id:string)=>{if(allowedPrivate(id))router.push({pathname:'/dogovor/[id]',params:{id}});};
 const openPrivate=(id:string)=>{if(allowedPrivate(id))router.push({pathname:'/dogovor/[id]',params:{id,tab:'poruke'}});};
 // The conversation was opened from its Dogovor: back returns there, and only a cold start (no stack) opens it anew.
 const back=()=>{if(!current())return;if(router.canGoBack())router.back();else if(fromInbox)router.replace('/poruke');else router.replace({pathname:'/dogovor/[id]',params:{id:agreementId}});};
 const ready=state.phase==='READY',group=state.context?.group;
 const body=normalizeGroupBody(draft);
 return <GroupConversationPresentation state={state} draft={draft} draftLength={Array.from(body).length} draftSendable={!!groupBody(body)} showPeople={showPeople} listKey={generation} viewability={viewability} onVisible={onVisible}
  onBack={back} backLabel={fromInbox?'Nazad na Poruke':'Nazad na Dogovor'} onTogglePeople={()=>{if(current())setShowPeople(x=>!x);}} onRefresh={()=>invoke('refresh')} onOlder={()=>invoke('older')}
  onManagementNext={()=>invoke('managementNext')} onOpenAgreement={openAgreement} onPrivate={openPrivate} onDraft={change} onAcknowledge={()=>invoke('acknowledge')}
  onSend={()=>{if(current()){if(retry)void controller?.retry(input.current);else void controller?.send(input.current);}}}
  photo={(member,fallback)=><ProfilePhoto profileId={member.profileId} size={40} fallback={fallback}/>}
  support={group?item=><SupportContextEntry reference={{kind:'GROUP_MESSAGE',id:item.messageId,revision:null}} previewText={item.body}
   label="Izaberi ovu poruku za podršku" disabled={!ready}
   canAct={()=>current()&&ready&&state.messages.some(message=>message.messageId===item.messageId)}
   navigate={action=>{if(current()&&ready){owner.current=null;controller?.dispose();input.current='';setDraft('');setState(initialGroupState);action();}}}/>:undefined}/>;
}
