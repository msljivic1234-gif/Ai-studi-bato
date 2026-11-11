import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { workerAiClientService as api, WORKER_AI_READ_TRANSPORT_UNAVAILABLE, type WorkerAiPatch, type WorkerAiSnapshot, type WorkerAiTurn, type WorkerAiTurnRecovery } from '../../../data/workerAiClientService';
import { workerAiTurnIntentJournal as journal, type WorkerAiTurnIntent } from '../../../data/workerAiTurnIntentJournal';
import { takeWorkerText, stageAiRoleText } from '../../../data/aiRoleHandoff';
import { oppositeInterviewDomain, type AiConversationIntent, type AiRoleSuggestion } from '../../../contracts/aiConversationIntent';
import type { Ishod } from '../../../data/ports';
import { uuid } from '../../../data/serverReceipt';
import { rememberAiCorrection, takeAiCorrection, type AiCorrectionIntent } from '../../../data/aiCorrectionIntent';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { inferWorkerExecutionModes, workerExecutionModeClientService } from '../../../data/workerExecutionModeClientService';

import { useHoldToTalk } from '../../../features/voice/useHoldToTalk';
import { AiConversationShell } from '../../../ui/aiFirst/AiConversationShell';
import { classificationPreparationMessage, workerReviewPresentable, workerReviewReady } from '../../../features/ai/intake/intakeReviewReadiness';
import { useReviewExpiry } from '../../../features/ai/intake/useReviewExpiry';
import { workerInterviewOpening } from '../../../features/ai/intake/aiInterviewWelcome';
import { useAccountName } from '../../../ui/profile/useAccountName';
import { ActionSheet } from '../../../ui/system/ActionSheet';
import { brandAction, sys } from '../../../ui/system/tokens';
import { WorkerProfileFrame, WorkerProfileStatus } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { WorkerAiActivation, WorkerAiNotificationsNote, WorkerAiReviewDetails } from '../../../ui/workerProfile/WorkerAiPresentation';
import { WORKER_PART_TITLE, type WorkerAiPart } from '../../../ui/workerProfile/workerProfileFacts';
import { T } from '../../../ui/Text';
import { V2Action } from '../../../ui/v2/V2Action';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';

type Panel='chat'|'review';
type ReviewActivity='preparing'|'saving'|null;
type SubmittedDraft={value:string;revision:number};
type Attempt={id:string;text:string|null;submittedDraft:SubmittedDraft|null};
const unavailable=():Ishod<never>=>({ok:false,kod:'WORKER_AI_UNAVAILABLE',poruka:'Ponovo učitajte svoj radni profil.'});
export default function WorkerConversationRoute(){
  const session=useSesija(),params=useLocalSearchParams<{conversationId?:string|string[];aiCorrection?:string|string[];entryKey?:string|string[];activationRequest?:string|string[];roleHandoff?:string|string[]}>();
  const cid=typeof params.conversationId==='string'?params.conversationId:undefined;
  const entryKey=typeof params.entryKey==='string'&&uuid(params.entryKey)?params.entryKey:undefined;
  const activationRequest=typeof params.activationRequest==='string'&&uuid(params.activationRequest)?params.activationRequest:undefined;
  const roleHandoff=typeof params.roleHandoff==='string'&&uuid(params.roleHandoff)?params.roleHandoff:undefined;
  const owner=`${session.user?.id}:${session.accountRevision}`;
  // A topic-only navigation can replace search params on a retained route. Keep
  // its owned conversation, including an unsent draft; an explicit new ID or
  // account generation still starts a separate boundary.
  const retained=useRef({owner,id:cid,entryKey});
  // Explicit restart must clear the retained ID on the same mounted tab. Merely
  // removing conversationId is also used by topic navigation, so it cannot reset.
  if(retained.current.owner!==owner||(entryKey!==undefined&&entryKey!==retained.current.entryKey))retained.current={owner,id:cid,entryKey};
  else if(cid!==undefined)retained.current.id=cid;
  const conversationId=cid??retained.current.id;
  const invalid=(params.conversationId!==undefined&&cid===undefined)
    ||(params.entryKey!==undefined&&entryKey===undefined)
    ||(params.activationRequest!==undefined&&activationRequest===undefined)
    ||(params.roleHandoff!==undefined&&roleHandoff===undefined)
    ||(conversationId!==undefined&&!uuid(conversationId));
  return <OwnedWorkerConversation key={`${owner}:${retained.current.entryKey??''}:${conversationId??''}`}
    initialId={conversationId} invalid={invalid} correctionToken={params.aiCorrection} activationRequest={activationRequest} roleHandoff={roleHandoff}/>;
}
function OwnedWorkerConversation({initialId,invalid,correctionToken,activationRequest,roleHandoff}:{initialId?:string;invalid:boolean;correctionToken?:unknown;activationRequest?:string;roleHandoff?:string}){
  const {user,accountRevision}=useSesija(),accountId=user?.id;
  // ONE NAME (owner, 8 Oct 2026): the profile is saved under the name of the ACCOUNT, whatever the assistant proposed or the profile carried.
  const account=useAccountName(),accountName=account.state==='ready'?account.name:null;
  const cid=useRef<string|null>(initialId??null),[openKey]=useState(noviUuidZahtevId);
  const activationEntryRead=useRef<string|null>(null),reviewedActivationRequest=useRef<string|null>(null);
  const focus=useRef<object|null>(null),active=useRef(!AppState.currentState||AppState.currentState==='active');
  const foregroundGeneration=useRef<object|null>(active.current?{}:null);
  const [foreground,setForeground]=useState(active.current),[resuming,setResuming]=useState(false);
  const abort=useRef<AbortController|null>(null),refreshRef=useRef<()=>Promise<void>>(async()=>{});
  const [panel,setPanel]=useState<Panel>('chat'),[input,setInput]=useState(''),[stream,setStream]=useState('');
  const [roleSuggestion,setRoleSuggestion]=useState<AiRoleSuggestion|null>(null);
  const [reviewActivity,setReviewActivity]=useState<ReviewActivity>(null);
  const [correction,setCorrection]=useState<AiCorrectionIntent|null>(null);
  const panelScope=useRef<object>({}),renderedPanel=panelScope.current,panelWrite=useRef(false);
  // Only the conversation and its signed review own a panel. Profile changes
  // come from an explicit AI turn; choosing a correction topic writes nothing.
  const showPanel=(next:Panel)=>{panelScope.current={};setPanel(next);};
  const [leaving,setLeaving]=useState(false);
  const [menu,setMenu]=useState(false),[adding,setAdding]=useState(false);
  const draftText=useRef(input);draftText.current=input;
  const draftRevision=useRef(0);
  const [recovery,setRecovery]=useState<WorkerAiTurnRecovery|null>(null),[corruptLocalIntent,setCorruptLocalIntent]=useState(false),[,intentChanged]=useState(0);
  const pending=useRef<Attempt|null>(null),saveKey=useRef<{reviewId:string;key:string}|null>(null);
  const [rejectedReviewId,setRejectedReviewId]=useState<string|null>(null);
  // A prepared review is authoritative. Retain its activation choice when a
  // later conversation turn retires the review; returning to review must not
  // silently turn a deliberate "keep draft" back into activation.
  const activationChoice=useRef<{conversationId:string;activate:boolean}|null>(null);
  const [preparationIssue,setPreparationIssue]=useState<{conversationId:string;revision:number;message:string}|null>(null);
  const [turnIssue,setTurnIssue]=useState<{conversationId:string;message:string}|null>(null);
  // Leaving, or the app going to the background, makes an open question stale (its answer checks canAct), so it goes too.
  const confirmSheet=useConfirmSheet(),retireConfirmation=confirmSheet.close;
  useFocusEffect(useCallback(()=>{const token={};focus.current=token;setLeaving(false);return()=>{
    if(focus.current===token)focus.current=null;retireConfirmation();abort.current?.abort();abort.current=null;setStream('');setRoleSuggestion(null);
  };},[retireConfirmation]));
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{
    // Duplicate native activity notifications are not a return from background.
    // Refreshing here would abort the current reply and unmount the voice composer.
    if(active.current===(state==='active'))return;
    active.current=state==='active';foregroundGeneration.current=active.current?{}:null;
    setForeground(active.current);abort.current?.abort();setStream('');
    if(!active.current){retireConfirmation();setRoleSuggestion(null);}
    if(active.current){setResuming(true);void refreshRef.current().finally(()=>{if(active.current)setResuming(false);});}
  });return()=>{subscription.remove();active.current=false;abort.current?.abort();};},[retireConfirmation]);
  const owns=useCallback(()=>!!accountId&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision,
    [accountId,accountRevision]);
  const read=useCallback(async(confirmedTurn?:WorkerAiTurn):Promise<Ishod<WorkerAiSnapshot>>=>{
    const scope=focus.current;if(invalid||!scope||!owns()||!active.current)return unavailable();
    // Restore before opening a conversation or sending anything. Storage holds
    // only three IDs; canonical history restores text after an accepted turn.
    let saved:WorkerAiTurnIntent|null;
    try{saved=await journal.load(accountId!);}catch(error){
      if(error instanceof Error&&error.message==='WORKER_AI_LOCAL_INTENT_INVALID'&&owns()){setCorruptLocalIntent(true);
        return {ok:false,kod:'WORKER_AI_LOCAL_INTENT_INVALID',poruka:'Lokalni zapis prethodnog slanja nije ispravan. Ne šaljemo novu poruku dok ne izaberete oporavak.'};}
      return unavailable();
    }
    if(focus.current!==scope||!owns()||!active.current)return unavailable();
    setCorruptLocalIntent(false);
    let shouldClearStream=false;
    let submittedDraftToClear:SubmittedDraft|null=null;
    let shouldClearCorrection=false;
    if(saved){
      if(cid.current!==saved.conversationId){cid.current=saved.conversationId;router.setParams({conversationId:saved.conversationId});}
      if(pending.current?.id!==saved.clientRequestId){pending.current={id:saved.clientRequestId,text:null,submittedDraft:null};intentChanged(n=>n+1);}
      // Reuse only the exact, decoded success returned to this live owner.
      // Unknown/lost replies and restarts still use the durable recovery RPC.
      const confirmed=confirmedTurn?.state==='SUCCEEDED'&&confirmedTurn.authoritative===true
        &&confirmedTurn.conversationId===saved.conversationId&&confirmedTurn.clientRequestId===saved.clientRequestId;
      let outcome:WorkerAiTurnRecovery|null=null;
      if(!confirmed){
        const recovered=await api.recoverTurn(saved.conversationId,saved.clientRequestId);
        if(focus.current!==scope||!owns()||!active.current)return unavailable();
        if(!recovered.ok)return recovered;
        outcome=recovered.podatak;
      }
      setRecovery(outcome);
      const succeeded=confirmed||outcome?.turn?.state==='SUCCEEDED';
      const terminal=succeeded||!!outcome&&(outcome.conversationStatus!=='OPEN'||outcome.cancelled||outcome.turn?.state==='FAILED');
      if(terminal){
        try{await journal.clear(saved);}catch{return {ok:false,kod:'WORKER_AI_LOCAL_INTENT_INVALID',poruka:'Ishod je potvrđen. Ponovite proveru da nastavite.'};}
        if(focus.current!==scope||!owns()||!active.current)return unavailable();
        // Text equality cannot establish ownership: spoken turns and restored IDs own no typed
        // draft. A typed Send owns only the raw value and edit revision captured at admission.
        const submittedDraft=pending.current?.submittedDraft;
        if(succeeded){
          shouldClearCorrection=true;
          submittedDraftToClear=submittedDraft??null;
        }
        pending.current=null;
        shouldClearStream=true;
      }
    }else if(pending.current){
      // A failed local save did not authorize network I/O. Keep the typed draft.
      pending.current=null;setRecovery(null);intentChanged(n=>n+1);
    }
    let result=cid.current?await api.read(cid.current):await api.open(activationRequest??openKey);
    if(focus.current!==scope||!owns()||!active.current)return unavailable();
    // Only the receipt layer's proved no-response read can retain a same-account last-good transcript.
    // Ownership/refusal, malformed server data and unknown results still go through the fail-closed editor path.
    if(!result.ok&&result.kod===WORKER_AI_READ_TRANSPORT_UNAVAILABLE)throw new Error(result.kod);
    // Activation is another explicit review, never a replay of a completed Save.
    // Open preserves a server-side unfinished conversation; the journal above must
    // reconcile first. An existing open conversation also keeps its local typed draft.
    if(result.ok&&activationRequest&&activationEntryRead.current!==activationRequest&&!pending.current){
      if(result.podatak.status==='COMPLETED'){
        result=await api.open(activationRequest);
        if(focus.current!==scope||!owns()||!active.current)return unavailable();
        if(result.ok&&result.podatak.conversationId!==cid.current){
          cid.current=result.podatak.conversationId;router.setParams({conversationId:cid.current});
        }
      }
      if(result.ok)activationEntryRead.current=activationRequest;
    }
    if(result.ok&&!cid.current){cid.current=result.podatak.conversationId;router.setParams({conversationId:cid.current});}
    if(result.ok){
      const snapshot=result.podatak;
      setTurnIssue(null);
      setPreparationIssue(null);
      if(snapshot.status==='OPEN'&&!snapshot.saved&&!snapshot.stale&&snapshot.safety==='ALLOW'
        &&snapshot.candidate.skills.length>0&&!pending.current
        &&snapshot.turn?.state!=='PROCESSING'&&snapshot.turn?.state!=='UNKNOWN_OUTCOME'){
        const activate=activationRequest&&reviewedActivationRequest.current!==activationRequest?true
          :snapshot.review?.activate??(activationChoice.current?.conversationId===snapshot.conversationId?activationChoice.current.activate:false);
        // Signed preparation has no provider call and cannot Save or Activate.
        // A failed prepare retains the confirmed conversation for correction/retry.
        if(!workerReviewReady(snapshot)||snapshot.review?.activate!==activate){
          try{
            const prepared=await api.prepare(snapshot.conversationId,snapshot.revision,activate);
            if(focus.current!==scope||!owns()||!active.current)return unavailable();
            if(prepared.ok){
              const reviewed={...snapshot,review:prepared.podatak};
              result={ok:true,podatak:reviewed};
              activationChoice.current={conversationId:snapshot.conversationId,activate:prepared.podatak.activate};
              if(activationRequest)reviewedActivationRequest.current=activationRequest;
              if(!workerReviewReady(reviewed))setPreparationIssue({conversationId:snapshot.conversationId,revision:snapshot.revision,
                message:classificationPreparationMessage(prepared.podatak.classificationState)
                  ??(prepared.podatak.missingRequired.length?'Dopunite podatke koji nedostaju u razgovoru.':'Pregled još nije spreman. Proverite podatke i područje rada u razgovoru.')});
            }else {
              result={ok:true,podatak:{...snapshot,review:null}};
              setPreparationIssue({conversationId:snapshot.conversationId,revision:snapshot.revision,
                message:'Priprema pregleda nije potvrđena. Proverite razgovor; nije potrebno da ponavljate opis svojih usluga.'});
            }
          }catch{
            if(focus.current!==scope||!owns()||!active.current)return unavailable();
            result={ok:true,podatak:{...snapshot,review:null}};
            setPreparationIssue({conversationId:snapshot.conversationId,revision:snapshot.revision,
              message:'Potvrda pregleda trenutno nije dostupna. Proverite vezu i stanje razgovora.'});
          }
        }
      }
    }
    if(shouldClearCorrection)setCorrection(null);
    if(submittedDraftToClear){
      const draft=submittedDraftToClear;
      setInput(value=>draftRevision.current===draft.revision&&value===draft.value?'':value);
    }
    if(shouldClearStream){intentChanged(n=>n+1);setStream('');}
    return result;
  },[invalid,owns,openKey,accountId,activationRequest]);
  const editor=useOwnedEditor(read);refreshRef.current=editor.refresh;
  const data=editor.data,renderedFocus=focus.current,renderedForeground=foregroundGeneration.current;
  useEffect(()=>{
    if(data?.review)activationChoice.current={conversationId:data.conversationId,activate:data.review.activate};
  },[data?.conversationId,data?.review]);
  const reviewNeedsRestart=!!rejectedReviewId&&data?.review?.reviewId===rejectedReviewId&&!data.saved;
  useEffect(()=>{if(data&&data.review?.reviewId!==rejectedReviewId)setRejectedReviewId(null);},[data?.review?.reviewId,rejectedReviewId]);
  const reviewHasExpired=useReviewExpiry(data?.review&&!data.saved?data.review.expiresAt:null);
  const current=()=>!!renderedFocus&&focus.current===renderedFocus&&owns()&&active.current;
  const canAct=()=>current()&&panelScope.current===renderedPanel&&!resuming&&!editor.busy&&!editor.loading&&editor.loaded&&!editor.uncertain&&!!data;
  const savePanel=async(activity:Exclude<ReviewActivity,null>,command:()=>Promise<Ishod<WorkerAiSnapshot>>)=>{
    setReviewActivity(activity);
    try{return await editor.save(async()=>{
      panelWrite.current=true;try{return await command();}finally{panelWrite.current=false;}
    });}finally{setReviewActivity(null);}
  };
  const turn=data?.turn,awaiting=turn?.state==='PROCESSING'||turn?.state==='UNKNOWN_OUTCOME';
  const writable=data?.status==='OPEN'&&!data.stale&&data.safety!=='BLOCK'&&data.safety!=='REVIEW';
  // An explicit NEED -> WORKER choice carries only a token in navigation.
  // The original words arrive as an editable, UNSENT draft: no AI turn, Save or activation.
  useEffect(() => {
    if (!roleHandoff || !data || !writable || !accountId || !owns() || !active.current
      || !focus.current || pending.current) return;
    const prefix = draftText.current.trimEnd();
    const transferred = takeWorkerText({ token: roleHandoff, accountId, accountRevision,
      capacity: 4000 - prefix.length - (prefix ? 1 : 0) });
    if (!transferred) return;
    const next = [prefix, transferred].filter(Boolean).join('\n');
    draftRevision.current += 1; draftText.current = next; setInput(next);
    showPanel('chat');
  }, [roleHandoff, accountId, accountRevision, data?.conversationId, data?.revision, writable, owns, input]);

  const rename=(snapshot:WorkerAiSnapshot):WorkerAiPatch|null=>accountName&&snapshot.candidate.displayName.trim()!==accountName?{displayName:accountName}:null;
  const send=async(body:string,submittedDraft:SubmittedDraft|null=null)=>{
    if(!canAct()||!writable||awaiting||!data||!body.trim()||(pending.current&&!recovery?.retryAllowed))return;
    setRoleSuggestion(null);setTurnIssue(null);
    await editor.save(async()=>{
      // Name alignment changes the signed candidate revision. Do it before a
      // new AI turn captures classification, never between that capture and review.
      // Recovery of an existing command must retain its original context/key.
      if(!pending.current){
        if(account.state!=='ready')return {ok:false,kod:'WORKER_ACCOUNT_NAME_UNAVAILABLE',
          poruka:'Ime naloga još nije učitano. Ponovo otvorite razgovor; poruka nije poslata.'};
        const name=rename(data);
        if(name){const named=await api.patch(data.conversationId,data.revision,name);
          if(!current())return unavailable();if(!named.ok)return named;}
      }
      const command=pending.current??{id:noviUuidZahtevId(),text:body,submittedDraft};
      if(!command.text)return unavailable();pending.current=command;intentChanged(n=>n+1);setRecovery(null);
      const controller=new AbortController();abort.current=controller;setStream('');
      const semanticHint:{value:AiConversationIntent|null}={value:null};
      try{
        await journal.save({accountId:accountId!,conversationId:data.conversationId,clientRequestId:command.id});
        if(!current()||controller.signal.aborted)return unavailable();
        const sent=await api.send(data.conversationId,command.text,command.id,{signal:controller.signal,
          onConversationIntent:intent=>{semanticHint.value=intent;},
          onText:delta=>{if(current()&&!controller.signal.aborted&&pending.current===command)setStream(value=>value+delta);}});
        if(!current())return unavailable();
        // Always read the canonical candidate. An exact success skips only
        // duplicate status recovery; lost responses never resend the model call.
        const result=await read(sent.ok?sent.podatak:undefined);
        if(current()&&!controller.signal.aborted&&result.ok&&sent.ok&&sent.podatak.state==='SUCCEEDED'
          &&semanticHint.value&&oppositeInterviewDomain(semanticHint.value,'WORKER')==='NEED'){
          const canonical=result.podatak,last=canonical.messages.at(-1),userMessage=canonical.messages.at(-2);
          if(canonical.conversationId===data.conversationId&&canonical.turn?.state==='SUCCEEDED'
            &&canonical.turn.turnId===sent.podatak.turnId&&canonical.turn.clientRequestId===command.id
            &&canonical.safety!=='BLOCK'&&canonical.safety!=='REVIEW'&&last?.role==='ASSISTANT'
            &&userMessage?.role==='USER'&&userMessage.body.trim()===command.text.trim()){
            setRoleSuggestion({text:command.text,conversationId:data.conversationId,clientRequestId:command.id,
              turnId:sent.podatak.turnId,assistantMessageId:last.id});
          }
        }
        if(current())setStream('');
        if(!current())return unavailable();
        // Reading the conversation may succeed after the AI refused this turn
        // (for example, the budget gate). Keep that readback AND its refusal.
        // Only this exact turn's canonical progress/success can supersede a lost reply.
        const recovered=result.ok?result.podatak.turn:null;
        const reconciled=recovered?.clientRequestId===command.id
          &&(recovered.state==='SUCCEEDED'||recovered.state==='PROCESSING');
        if(result.ok&&!sent.ok&&!reconciled)setTurnIssue({conversationId:result.podatak.conversationId,message:sent.poruka});
        return result.ok?result:sent.ok?result:sent;
      }finally{if(abort.current===controller)abort.current=null;}
    });
  };
  const keepTranscript=(text:string)=>{
    if(!canAct()||!writable||awaiting||pending.current)return false;
    const next=[draftText.current.trimEnd(),text.trim()].filter(Boolean).join('\n');
    if(!next||next.length>4000)return false;
    draftRevision.current+=1;draftText.current=next;setInput(next);return true;
  };
  const voice=useHoldToTalk({conversationId:!leaving&&writable&&data?data.conversationId:null,
    onTranscript:payload=>{
      if(!payload.isCurrent())return false;
      // Held microphone: what was said is the message, sent through `send` (the same journal, key and guards as the
      // send button) the moment the finger lifts, as in the task conversation (owner, 2026-09-23). The typed draft stays.
      // The accessible start/stop mode keeps the review: its text lands in the draft, and only Send writes the turn.
      if(payload.session?.mode!=='accessible'){
        const spoken=payload.text.trim();
        if(!spoken||spoken.length>4000||!canAct()||!writable||awaiting||pending.current)return false;
        void send(spoken);return true;
      }
      return keepTranscript(payload.text);
    }});
  const voiceBusy=voice.state.phase!=='IDLE';
  const enabled=canAct()&&!voiceBusy&&!awaiting&&!pending.current;
  useFocusEffect(useCallback(()=>{
    // A retained entry waits for readback instead of interrupting a signed save
    // or consuming its one-use topic while a previous turn is unresolved.
    if(!accountId||!data||data.saved||!writable||!foreground||!focus.current||!enabled)return;
    const next=takeAiCorrection(correctionToken,{accountId,accountRevision},'worker',data.conversationId);
    if(next){setCorrection(next);showPanel('chat');}
  },[correctionToken,accountId,accountRevision,data?.conversationId,data?.saved,writable,foreground,enabled]));
  const correctPart=(next:WorkerAiPart|'details')=>{
    if(!canAct()||!enabled||!writable||!data||data.saved||!accountId)return;
    const hint=rememberAiCorrection({accountId,accountRevision},`worker.${next}`,data.conversationId);
    if(!hint)return;
    const owned=takeAiCorrection(hint.token,{accountId,accountRevision},'worker',data.conversationId);
    if(!owned)return;
    setAdding(false);setMenu(false);setCorrection(owned);showPanel('chat');
  };
  const canRetry=canAct()&&!voiceBusy&&!awaiting&&!!writable&&!!pending.current?.text&&recovery?.retryAllowed===true;
  const leave=(navigate:()=>void)=>{
    if(!current()||panelScope.current!==renderedPanel)return;
    // Retire immediately, before navigation emits blur. Aborting the local stream is not a
    // server cancellation: the journal stays owned by this turn for readback on return.
    focus.current=null;setLeaving(true);setMenu(false);setAdding(false);retireConfirmation();
    voice.controller.cancel('navigation');abort.current?.abort();abort.current=null;setStream('');navigate();
  };
  const back=()=>{
    if(!current()||panelScope.current!==renderedPanel)return;
    if(panel==='review'){if(!editor.busy&&!panelWrite.current)showPanel('chat');return;}
    leave(()=>router.canGoBack()?router.back():router.replace('/profil/radnik'));
  };
  const currentRoleSuggestion=roleSuggestion&&data?.status==='OPEN'&&!data.saved&&data.safety!=='BLOCK'&&data.safety!=='REVIEW'
    &&roleSuggestion.conversationId===data.conversationId&&data.messages.at(-1)?.id===roleSuggestion.assistantMessageId
    ?roleSuggestion:null;
  const openSuggestedNeed=()=>{
    if(!canAct()||!enabled||!writable||!currentRoleSuggestion||!accountId||pending.current||draftText.current.trim()
      ||!renderedForeground||foregroundGeneration.current!==renderedForeground
      ||voice.controller.getSnapshot().phase!=='IDLE')return;
    const token=noviUuidZahtevId();
    if(!stageAiRoleText({token,text:currentRoleSuggestion.text,target:'NEED',accountId,accountRevision}))return;
    leave(()=>router.push({pathname:'/nova',params:{entryKey:noviUuidZahtevId(),roleHandoff:token}}));
  };
  const refresh=()=>{if(current()&&!editor.busy&&!editor.loading&&!voiceBusy)void editor.refresh();};
  const recoverCorruptLocal=()=>{
    if(!current()||!accountId||!corruptLocalIntent||editor.busy||editor.loading)return;
    const ownerId=accountId,entry=focus.current;
    confirmSheet.ask({
      title:'Oporaviti lokalni zapis?',
      message:'Oštećeni zapis na ovom telefonu nema proverljiv identitet prethodnog slanja. Briše se samo taj neispravan lokalni zapis, ne poruka na serveru. Ništa se ne šalje automatski; stari ishod može ostati nepoznat.',
      cancelLabel:'Odustanite',confirmLabel:'Oporavite zapis',
      onConfirm:async()=>{
        if(!entry||entry!==focus.current||!current())return;
        try{
          const removed=await journal.discardCorrupt(ownerId);
          if(entry!==focus.current||!current())return;
          if(removed)setCorruptLocalIntent(false);
          await editor.refresh(); // Valid races remain server-reconciled.
        }catch{if(entry===focus.current&&current())await editor.refresh();}
      },
    });
  };
  const cancelPending=async()=>{
    const command=pending.current;if(!canAct()||voiceBusy||!data||!command||!recovery?.canCancel)return;
    await editor.save(async()=>{const result=await api.cancelTurn(data.conversationId,command.id);
      if(!current())return unavailable();if(!result.ok)return result;
      // Cancellation may lose to completion. Only the canonical read
      // can retire the journal; an abort alone never means cancellation.
      return read();});
  };
  const reviewActivation=data?.review?.activate??(activationChoice.current?.conversationId===data?.conversationId
    ?activationChoice.current?.activate:false)??false;
  const review=async(activate=reviewActivation)=>{
    // Native speech can start before React replaces a retained review callback.
    if(!canAct()||!enabled||!writable||!data||voice.controller.getSnapshot().phase!=='IDLE')return;
    if(workerReviewReady(data)&&data.review?.activate===activate&&!rename(data)&&!reviewNeedsRestart){
      // A no-op choice must not retire the live panel's handlers. React does
      // not rerender when setPanel receives its current value.
      if(panel!=='review')showPanel('review');return;
    }
    await savePanel('preparing',async()=>{
      // The review is made of the proposal as it stands, so the name goes into the proposal first (one patch, then the same prepare).
      let at={conversationId:data.conversationId,revision:data.revision};
      const name=rename(data);
      if(name){const named=await api.patch(data.conversationId,data.revision,name);
        if(!current())return unavailable();if(!named.ok)return named;
        at={conversationId:named.podatak.conversationId,revision:named.podatak.revision};}
      const prepared=await api.prepare(at.conversationId,at.revision,activate);
      if(!current())return unavailable();if(!prepared.ok)return prepared;
      if(activationRequest)reviewedActivationRequest.current=activationRequest;
      activationChoice.current={conversationId:at.conversationId,activate:prepared.podatak.activate};
      const next=await read();if(next.ok&&current())showPanel(workerReviewReady(next.podatak)?'review':'chat');return next;
    });
  };
  const save=async()=>{
    const reviewed=data?.review;if(!canAct()||!enabled||!writable||reviewNeedsRestart||!data||!reviewed||!workerReviewReady(data))return;
    if(saveKey.current?.reviewId!==reviewed.reviewId)saveKey.current={reviewId:reviewed.reviewId,key:noviUuidZahtevId()};
    const key=saveKey.current.key;
    await savePanel('saving',async()=>{const saved=await api.save(reviewed,key);if(!current())return unavailable();
      const result=await read();if(!current())return unavailable();
      if(result.ok&&result.podatak.saved?.reviewId===reviewed.reviewId){
        // Legacy (unsigned) saves retain their historical global-mode bridge.
        // A SIGNED review — READY or PENDING — must not issue a second global
        // mode write here. The post-Save binder atomically persists both the
        // signed per-service modes and global choice after verifying the exact
        // Save receipt. An async client write after Save would set updated_at
        // after the Save timestamp and trigger WORKER_BINDER_NEWER_GLOBAL_MODE.
        if(accountId&&reviewed.classificationState===undefined&&reviewed.profile){
          const modes=inferWorkerExecutionModes(reviewed.profile.skills,reviewed.profile.location);
          if(modes.length)void workerExecutionModeClientService.save(accountId,accountRevision,modes).catch(()=>undefined);
        }
        return result;
      }
      // A retired-field review may be rejected although its older source hash
      // still matches. Keep that refusal scoped to this review through a read;
      // never silently alter its frozen content or relax uncertain-write guards.
      if(!saved.ok&&saved.kod==='WORKER_AI_STALE')setRejectedReviewId(reviewed.reviewId);
      return saved.ok?result:saved;});
  };
  const restart=()=>{
    if(!canAct()||voiceBusy||!data)return;
    confirmSheet.ask({title:'Pokrenuti nov razgovor?',message:'Novi razgovor kreće od sačuvanog profila. Ovaj više nećete moći da nastavite; podaci se ne brišu. Neposlati tekst neće biti sačuvan.',
      cancelLabel:'Nastavite ovaj razgovor',confirmLabel:'Novi razgovor',onConfirm:()=>{
        // Returned so the confirmation waits on the command it started instead of closing before it is sent.
        if(!canAct()||voiceBusy)return;return editor.save(async()=>{
          // Completed conversations stay completed on the server. Reconcile their
          // journal before leaving, without issuing another abandon command.
          const previousId=data.conversationId;
          if(data.status==='OPEN'){
            // A lost or rejected write receipt is not proof that abandonment failed.
            // Read the exact owned conversation before opening a new one; a failed
            // read or OPEN state retains this route and its unsent text.
            try{await api.abandon(previousId);}catch{/* Readback below decides the outcome. */}
            if(!current())return unavailable();
          }
          const confirmed=await read();if(!current())return unavailable();
          if(!confirmed.ok)return confirmed;
          if(confirmed.podatak.conversationId!==previousId||pending.current
            ||(confirmed.podatak.status!=='ABANDONED'&&confirmed.podatak.status!=='COMPLETED'))
            return {ok:false,kod:'WORKER_AI_ABANDON_UNCONFIRMED',poruka:'Ne znamo da li je prethodni razgovor završen. Proverite stanje.'};
          router.replace({pathname:'/profil/razgovor',params:{entryKey:noviUuidZahtevId()}});
          return confirmed;
        });
      }});
  };
  const abandon=()=>{
    if(!canAct()||voice.controller.getSnapshot().phase!=='IDLE'||!data||data.status!=='OPEN'||pending.current||awaiting)return;
    confirmSheet.ask({title:'Napustiti razgovor?',
      message:'Ovaj nacrt više nećete moći da nastavite. Sačuvani profil ostaje isti, a podaci razgovora se ne brišu trajno. Neposlati tekst neće biti sačuvan.',
      cancelLabel:'Nastavite razgovor',confirmLabel:'Napustite razgovor',tone:'danger',onConfirm:()=>{
        if(!canAct()||voice.controller.getSnapshot().phase!=='IDLE'||!data||data.status!=='OPEN'||pending.current||awaiting)return;
        return editor.save(async()=>{
          // A lost command response is not proof of failure. Read the same owned
          // conversation before leaving; an OPEN or unavailable read keeps this draft.
          try{await api.abandon(data.conversationId);}catch{/* Readback below decides whether the command took effect. */}
          if(!current())return unavailable();
          const confirmed=await read();if(!current())return unavailable();
          if(confirmed.ok&&confirmed.podatak.conversationId===data.conversationId
            &&confirmed.podatak.status==='ABANDONED'&&!pending.current){
            router.replace('/profil/radnik');return confirmed;
          }
          if(!confirmed.ok)return confirmed;
          return {ok:false,kod:'WORKER_AI_ABANDON_UNCONFIRMED',poruka:'Ne znamo da li je razgovor napušten. Proverite stanje.'};
        });
      }});
  };
  const statusCopy=data?.saved?'Profil je sačuvan.':data?.status!=='OPEN'?'Ovaj razgovor je završen.':data.stale?'Sačuvani profil je promenjen. Novi razgovor će početi od tih podataka.':
    data.safety==='BLOCK'||data.safety==='REVIEW'?'Ovaj predlog trenutno ne može da se sačuva.':awaiting?turn?.state==='UNKNOWN_OUTCOME'?
      'Ne znamo da li je prethodna poruka stigla. Proverite to; poruka se neće poslati dvaput.':'AI još obrađuje poruku. Proverite stanje.':pending.current?'Proverite prethodno slanje. Novi unos i pregled su dostupni kada potvrdimo ishod.':
      recovery?.cancelled&&recovery.providerDispatched?'Odgovor je zaustavljen. Poruka je ipak poslata jer je asistent već počeo da je obrađuje; profil je ostao isti.':null;
  const lastGoodUnverified=!!data&&!editor.loaded&&!editor.loading;
  const lastGoodCopy='Prikazan je poslednji učitan razgovor. Slanje i čuvanje su pauzirani dok ne proverimo stanje.';
  if(leaving||!data||!foreground||resuming)return <WorkerProfileFrame back={back} title="Radni profil" tone="conversation"><WorkerProfileStatus context="conversation" loading={leaving||editor.loading||!foreground||resuming}
    error={leaving?null:editor.error} retry={refresh}
    recoverCorrupt={!leaving&&foreground&&!resuming&&corruptLocalIntent?recoverCorruptLocal:undefined}/>{!leaving&&foreground&&!resuming?confirmSheet.sheet:null}</WorkerProfileFrame>;
  const reviewBusyLabel=reviewActivity==='preparing'?'Pripremamo pregled…':reviewActivity==='saving'?'Čuvamo profil…':'Proveravamo stanje…';
  const busyPanelCopy=editor.busy?<T testID="worker-review-progress" accessibilityRole="alert" variant="meta" tone="muted">
    {reviewActivity==='preparing'?'Pripremamo novi pregled. Profil još nije sačuvan.':reviewActivity==='saving'
      ?'Čuvamo profil. Sačekajte potvrdu pre povratka u razgovor.':'Proveravamo stanje razgovora. Sačekajte potvrdu.'}
  </T>:null;
  if(panel==='review'&&data.review&&(data.saved||workerReviewPresentable(data))){const frozen=data.review,
    // The account got its name (in "Lični podaci") while this review still says it is missing: a fresh review puts it in.
    nameAdded=frozen.missingRequired.includes('Ime')&&!!accountName,
    expired=reviewHasExpired||frozen.revision!==data.revision||nameAdded;
    // A correction returns to this conversation without sending or replacing its typed draft.
    const editConversation=()=>{
      if(!canAct()||!enabled||!writable||data.saved||expired||reviewNeedsRestart)return;
      correctPart('details');
    };
    return <WorkerProfileFrame back={back} title="Pregledajte profil" footer={data.saved?<V2Action label="Otvorite sačuvani profil" onPress={()=>leave(()=>router.replace('/profil/radnik'))} style={brandAction}/>:<>
      <V2Action label={editor.busy?reviewBusyLabel:frozen.activate?'Sačuvajte i aktivirajte profil':'Sačuvajte profil'}
        disabled={!enabled||!writable||reviewNeedsRestart||!frozen.canAccept||expired} onPress={()=>{void save();}} style={brandAction}/>
      {(expired||editor.uncertain||editor.error)?<V2Action tone="neutral" label="Proverite stanje" onPress={refresh} disabled={editor.busy||editor.loading}/>:null}
    </>}>
      {data.saved?<T accessibilityRole="alert" variant="title" style={{color:sys.color.green}}>Profil je sačuvan{data.saved.profileStatus==='ACTIVE'?' i aktivan':''}.</T>:null}
      {!data.saved&&input.trim()?<T testID="worker-review-unsent-note" variant="note" tone="muted">Neposlati tekst nije deo ovog pregleda. Ostaje u razgovoru.</T>:null}
      <WorkerAiReviewDetails review={frozen} onEdit={data.saved?undefined:editConversation} editDisabled={!enabled||!writable||expired||reviewNeedsRestart}
        onAddName={data.saved||expired||!enabled||!writable||reviewNeedsRestart?undefined:()=>leave(()=>router.push('/profil/podaci'))}/>
      {/* Describe notification readiness honestly: signed pending reviews grant no matching authority. */}
      {!data.saved?<WorkerAiNotificationsNote matchingReady={frozen.classificationState==='READY'}/>:null}
      {busyPanelCopy}
      {/* The save button below is grey for one of these reasons; the details above name a missing field themselves. */}
      {!data.saved&&(expired||!writable)?<T variant="meta" tone="muted">{expired?'Ovaj pregled više ne važi. Učitajte novi pregled pre čuvanja.':statusCopy??'Ovaj predlog trenutno ne može da se sačuva.'}</T>:null}
      {data.profileStatus==='DRAFT'&&!data.saved?<WorkerAiActivation activate={frozen.activate} disabled={!enabled} change={value=>{void review(value);}}/>:null}
      {expired&&!data.saved?<V2Action tone="neutral" label="Učitajte novi pregled" disabled={!enabled||reviewNeedsRestart} onPress={()=>{void review(frozen.activate);}}/>:null}
      {editor.error?<T accessibilityRole="alert" tone="danger">{editor.error}</T>:null}
      {lastGoodUnverified?<T accessibilityRole="alert" variant="note" tone="muted">{lastGoodCopy}</T>:null}
      {reviewNeedsRestart?<>
        <T variant="note" tone="muted">{editor.uncertain?'Proverite stanje, pa otvorite nov razgovor.':'Ovaj predlog više ne može da se sačuva. Novi razgovor kreće od Vašeg sačuvanog profila.'}</T>
        <V2Action tone="neutral" label="Novi razgovor" disabled={!enabled} onPress={restart}/>
      </>:null}
      {confirmSheet.sheet}
    </WorkerProfileFrame>;
  }
  // Extra menu actions choose a topic in the same conversation.
  // A grey row says its own reason (review r4 ra item 16): the wait for an answer was named for every cause.
  const unavailableNow=enabled?undefined:voiceBusy?'Dostupno kada završite govor.'
    :awaiting||pending.current?'Dostupno kad razgovor ne čeka odgovor.'
      :editor.uncertain?'Prvo proverite stanje razgovora.'
        :editor.loading||resuming?'Dostupno kad se razgovor učita.':'Dostupno kad se završi prethodna radnja.';
  // The worker side stores the person's message the moment its turn is claimed, and the read returns every stored
  // message, so a turn that is still processing (a lost answer, a return to the app, "Proveri razgovor") already
  // shows it in the thread. Drawing it again as "šalje se" said the same sentence twice (verify r4b ra item A); it is
  // "not yet read back" only until the thread's last message is that very sentence.
  const sent=pending.current?.text??null,lastMessage=data.messages[data.messages.length-1];
  const unread=sent&&!(lastMessage?.role==='USER'&&lastMessage.body.trim()===sent.trim())?sent:null;
  // Legacy equipment alone is not a configured MVP work profile. The V1 wire
  // still carries it for signed-review compatibility, but the conversation
  // introduces the service, area and availability that actually route tasks.
  // Signed territories need not populate the legacy city. They are content
  // worth reviewing, not proof of completion, consent or activation readiness.
  const hasProfileContent = data.candidate.skills.length > 0 || data.candidate.bio.trim().length > 0
    || data.candidate.location.city.trim().length > 0 || (data.candidate.workAreas?.length ?? 0) > 0
    || data.candidate.availability.availableNow
    || data.candidate.availability.rules.length > 0 || data.candidate.availability.windows.length > 0;
  const readyToReview=!reviewNeedsRestart&&workerReviewReady(data);
  const preparationProblem=preparationIssue?.conversationId===data.conversationId&&preparationIssue.revision===data.revision
    ?preparationIssue.message:!readyToReview&&data.review&&!data.saved&&Date.parse(data.review.expiresAt)<=Date.now()
      ?'Pregled više nije aktuelan. Proverite razgovor pre nastavka.':null;
  const conversationError=editor.error??(turnIssue?.conversationId===data.conversationId?turnIssue.message:null);
  // The "+" selects a topic for the same conversation. Only an explicit message changes the proposal.
  const openPart=(next:WorkerAiPart)=>{
    if(!canAct()||!enabled||!writable)return;
    correctPart(next);
  };
  return <><AiConversationShell conversationKey={data.conversationId} title="Radni profil" questionFocus initialInputMode="keyboard"
    correction={correction&&writable?{...correction,onDismiss:()=>{if(canAct()&&enabled)setCorrection(null);}}:undefined}
    cardPlacement="end"
    newConversation={{ onPress: restart, disabled: !canAct() || voiceBusy }}
    exitAction={data.status==='OPEN'?<V2Action kind="destructive" compact label="Napustite razgovor"
      disabled={!enabled} reason={enabled?null:unavailableNow} onPress={abandon}/>:undefined}
    closed={!!data.saved || data.status !== 'OPEN'}
    attach={writable?{label:'Šta želite da izmenite?',hint:'Izaberite temu i nastavite isti razgovor.',disabled:!enabled,
      onPress:()=>{if(current()&&panelScope.current===renderedPanel)setAdding(true);}}:undefined}
    // Review is a separate full screen, never a second profile card inside the chat.
    // The final affordance appears only after current signed readiness, not merely
    // because some profile content exists. Preparation already ran after readback.
    card={()=>null}
    footerAction={!currentRoleSuggestion&&readyToReview&&writable&&!data.saved?<V2Action label="Pregledajte radni profil"
      kind="primary" style={brandAction} disabled={!enabled}
      reason={!enabled?unavailableNow:undefined}
      onPress={()=>{if(workerReviewReady(data))void review();}}/>:undefined}
    messages={data.messages.map(m=>({id:m.id,fromAi:m.role==='ASSISTANT',body:m.body}))}
    // Immediate client introduction; no Gemini call, cost, fake persisted turn or automatic Save.
    // Removed when the real owned conversation begins; re-entry never invents old AI messages.
    introMessage={data.messages.length===0 && !unread ? workerInterviewOpening(hasProfileContent) : undefined}
    showWelcomeArt={!hasProfileContent}
    welcome={hasProfileContent?'Dobar dan! Šta želite da dopunite? 🧡':'Dobar dan! Čime se bavite? 🧡'}
    welcomeDetail=""
    placeholder="Opišite čime se bavite"
    value={input} onChange={value=>{if(canAct()&&enabled&&writable){draftRevision.current+=1;draftText.current=value;setInput(value);}}} canEdit={!!enabled&&!!writable&&!pending.current}
    canSend={canRetry||(!!enabled&&!!writable&&!!input.trim()&&!pending.current)} pending={!!pending.current} busy={editor.busy}
    busyLabel={editor.busy && !abort.current ? 'Proveravamo promenu…' : undefined} streamingText={stream}
    // What was just sent and is not yet read back stays on screen (review r4 ra item 2): without it, voice mode fell
    // back to the previous exchange and showed the old answer as the reply to what was just said. A recovered intent
    // has no text (storage holds only ids), and then nothing is shown. Once the read holds it, the thread shows it once.
    sentMessage={unread}
    onSend={()=>{if(voiceBusy)return;if(pending.current){if(canRetry&&pending.current.text)void send(pending.current.text);return;}
      void send(input.trim(),{value:input,revision:draftRevision.current});}} onBack={back} onOptions={writable?()=>{if(current()&&panelScope.current===renderedPanel)setMenu(true);}:undefined}
    // A fragment is truthy even when empty, which drew an empty recovery panel in the thread; the slot is filled only
    // when there is something to say.
    status={statusCopy||conversationError||activationRequest||lastGoodUnverified||(!editor.busy&&preparationProblem)?<>{pending.current&&!editor.busy?<T variant="bodyStrong">{canRetry?'Poruka čeka ponovni pokušaj':turn?.state==='PROCESSING'?'Poruka je u obradi':'Ishod nije potvrđen'}</T>:null}
      {statusCopy?<T variant="meta" tone="muted">{statusCopy}</T>:null}
      {!editor.busy&&preparationProblem?<T variant="meta" tone="muted">{preparationProblem}</T>:null}
      {pending.current&&!editor.busy?<T variant="note" tone="muted">Provera ne šalje novu poruku.</T>:null}
      {activationRequest&&writable&&!data.saved?<T variant="note" tone="muted">Pregledajte podatke pre aktivacije. Ako imate nezavršen predlog, i njegove izmene ulaze u pregled. Profil postaje aktivan tek kada potvrdite.</T>:null}
      {lastGoodUnverified?<T accessibilityRole="alert" variant="note" tone="muted">{lastGoodCopy}</T>:null}
      {conversationError?<T accessibilityRole="alert" variant="meta" tone="danger">{conversationError}</T>:null}</>:undefined}
    // The shell draws the microphone, its notice and voice mode from this one controller; every transcript comes back
    // through `onTranscript` above.
    voice={writable?{controller:voice.controller,state:voice.state,disabled:!enabled||!!pending.current,onKeepText:keepTranscript}:undefined}
    actions={<>
      {currentRoleSuggestion?<>
        <T variant="note" tone="muted">Vaša poruka može da Vas sačeka kod asistenta za zadatke kao neposlat nacrt.</T>
        <V2Action label="Otvorite razgovor o zadatku" kind="primary" style={brandAction}
          disabled={!enabled||!!input.trim()} onPress={openSuggestedNeed}/>
      </>:null}
      {/* After a save the only next step is the saved profile; a second "check" button beside it read as unfinished. */}
      {(pending.current||awaiting||editor.uncertain||conversationError||preparationProblem)&&!data.saved?<V2Action tone="neutral" label="Proverite razgovor" disabled={editor.busy||editor.loading||voiceBusy}
        onPress={()=>{
          // The ready-card gate hides the old name-alignment entry. After the
          // account name is supplied, explicit recovery uses the same guarded
          // name patch + signed preparation; it never sends another AI turn.
          if(!pending.current&&!awaiting&&!editor.uncertain&&data.review?.missingRequired.includes('Ime')&&rename(data))void review();
          else refresh();
        }}/>:null}
      {writable&&!data.saved&&data.review?.missingRequired.includes('Ime')?<V2Action label="Lični podaci" kind="quiet"
        disabled={!enabled} onPress={()=>leave(()=>router.push('/profil/podaci'))}/>:null}
      {pending.current&&recovery?.canCancel?<>
        <T variant="meta" tone="muted">Ako odustanete, odgovor asistenta neće promeniti profil. Ako je asistent već počeo da odgovara, poruka je ipak poslata.</T>
        <V2Action tone="neutral" label={recovery.providerDispatched?'Odustanite od odgovora':'Otkažite prethodno slanje'} kind="quiet"
          disabled={!canAct()||voiceBusy} onPress={()=>{void cancelPending();}}/>
      </>:null}
      {data.saved?<V2Action label="Otvorite sačuvani profil" onPress={()=>leave(()=>router.replace('/profil/radnik'))} style={brandAction}/>:null}
    </>}/>{confirmSheet.sheet}
    {menu?<ActionSheet label="Opcije razgovora" onClose={()=>setMenu(false)} actions={[
      {key:'identity',label:'O meni',icon:'document',disabled:!enabled||!writable,subtitle:unavailableNow,
        onPress:()=>correctPart('identity')},
      {key:'time',label:'Raspored i dostupnost',icon:'calendar',disabled:!enabled||!writable,subtitle:unavailableNow,
        onPress:()=>correctPart('time')},
      {key:'restart',label:'Novi razgovor',icon:'chat',disabled:!canAct()||voiceBusy,subtitle:unavailableNow,
        onPress:restart},
      ...(data.status==='OPEN'?[{key:'abandon',label:'Napustite razgovor',icon:'chat' as const,destructive:true,
        disabled:!enabled,subtitle:unavailableNow??'Povratak čuva razgovor. Napušten razgovor više ne možete da nastavite.',
        onPress:abandon}]:[]),
    ]}/>:null}
    {adding?<ActionSheet label="Dodajte podatke" onClose={()=>setAdding(false)} actions={([
      ['skills','tasks'],['area','pin'],['time','clock'],
    ] as const).map(([key,icon])=>({key,icon,label:key==='area'?'Područje rada':WORKER_PART_TITLE[key],disabled:!enabled||!writable,subtitle:unavailableNow,
      onPress:()=>openPart(key)}))}/>:null}</>;
}
