import {useCallback,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {sesijaSada,useSesija} from '../../store/sesija';
import {qaRecoveryClientService,type QaContext,type QaRecoveredCommand} from '../../data/qaRecoveryClientService';
import {qaSubmissionClientService as ai,type QaSubmissionStatus,type QaSubmissionIdentity} from '../../data/qaSubmissionClientService';
import {preselectionQaClientService as qa} from '../../data/preselectionQaClientService';
import type {OwnerPreselectionQuestion} from '../../contracts/preselectionQa';
import {noviUuidZahtevId} from '../../lib/idempotencija';
import {qaIntentJournal,matchesQaReceipt,type QaIntent} from './qaIntent';
import {qaTextHash} from './qaTextHash';
import {TaskQaPresentation,type Question} from './TaskQaPresentation';

// These are explicit transactional SQL rejections, never a transport/decoder
// failure. An absent read alone is not evidence that a write was rejected.
const rejected=new Set(['RU4B_BLOCK_AUTHORITY_NOT_READY','RU4B_RATE_POLICY_NOT_READY','PRESELECTION_QA_POLICY_NOT_READY','RU4B_MATERIALITY_NOT_READY','EMPTY_CONTENT','QUESTION_REQUIRED','ANSWER_REQUIRED','EMAIL_NOT_PUBLIC','PHONE_NOT_PUBLIC','OFF_PLATFORM_LINK_NOT_PUBLIC','SOCIAL_HANDLE_NOT_PUBLIC','STALE_NEED_REVISION','QUESTION_STALE_AFTER_NEED_REVISION','NEED_NOT_FOUND','NEED_NOT_PUBLIC','REQUESTER_CANNOT_ASK_OWN_TASK','ACTIVE_WORKER_REQUIRED','RU4B_MATERIAL_REQUIRES_RU4_EDIT','QUESTION_NOT_FOUND','QUESTION_NOT_ANSWERABLE','QUESTION_NOT_PENDING','NOT_NEED_OWNER','RU4B_DISPOSITION_INVALID']);

export function TaskQaScreen({needId,onBack,onWorkerProfile,initialQuestionId}:{needId:string|null;onBack:()=>void;initialQuestionId?:string;
  /** Where the route sends someone whose Radni profil is not active yet; without it the notice is a sentence alone. */
  onWorkerProfile?:()=>void}) {
  const session=useSesija(),accountId=session.user?.id,accountRevision=session.accountRevision;
  const account={accountId:accountId??'',accountRevision};
  const focus=useRef<object|null>(null),active=useRef(AppState.currentState==='active'),lock=useRef(false),leaving=useRef(false);
  const [visit,setVisit]=useState<object|null>(null);
  const viewGeneration=useRef(0),renderGeneration=viewGeneration.current;
  const [context,setContext]=useState<QaContext|null>(null),[rows,setRows]=useState<Question[]>([]);
  const [intent,setIntent]=useState<QaIntent|null>(null),[absent,setAbsent]=useState(false);
  const [classification,setClassification]=useState<QaSubmissionStatus|null>(null),[material,setMaterial]=useState(false);
  const [target,setTarget]=useState<OwnerPreselectionQuestion|null>(null),[text,setText]=useState('');
  const initialSelectionUsed=useRef(false);
  const [busy,setBusy]=useState(true),[message,setMessage]=useState(''),[messageTone,setMessageTone]=useState<'danger'|'info'>('danger'),[receipt,setReceipt]=useState('');
  // Only a real problem is red: a fact about the thread (a version filter, a checked text, a send still being checked) is said plainly.
  const say=(text:string,tone:'danger'|'info'='danger')=>{setMessage(text);setMessageTone(tone);};
  const ownsVisit=(token:object|null)=>!!token&&token===focus.current&&!leaving.current&&active.current&&sesijaSada().user?.id===accountId&&sesijaSada().accountRevision===accountRevision;
  const live=(token:object|null)=>ownsVisit(token)&&!!needId&&!!accountId;

  async function readFeed(token:object,allowInitialSelection=false) {
    viewGeneration.current++;
    const result=await qaRecoveryClientService.context(needId!,account);
    if(!live(token))return;
    if(!result.ok){setContext(null);setRows([]);say(result.poruka);return;}
    const c=result.podatak;
    const feed=c.mode==='OWNER'?await qa.ownerQuestions(needId!):await qa.publicQa(needId!);
    if(!live(token))return;
    if(!feed.ok){setContext(null);setRows([]);say(feed.poruka);return;}
    if(!initialSelectionUsed.current) {
      initialSelectionUsed.current=true;
      if(allowInitialSelection&&initialQuestionId&&c.mode==='OWNER'&&c.canComposeAnswer) {
        const selected=feed.podatak.find((q):q is OwnerPreselectionQuestion=>'status' in q&&q.questionId===initialQuestionId&&q.needRevision===c.needRevision
          &&(q.status==='PENDING_ANSWER'||q.status==='ANSWERED_PUBLIC'));
        if(selected){setTarget(selected);setText(selected.answerText??'');}
      }
    }
    if(c.mode==='PUBLIC'&&feed.podatak.some(q=>q.needRevision!==c.needRevision)) {
      // One answer belonging to an older revision used to blank the whole public feed: every
      // question and every answer vanished, including the asker's own, with a message offering no
      // way forward. An answer written for an older version of the task is still that person's
      // answer; it is the ones that do not match the version on screen that are set aside.
      const current=feed.podatak.filter(q=>q.needRevision===c.needRevision);
      setContext(c);setRows(current);
      say(current.length
        ?'Zadatak je izmenjen posle nekih pitanja. Prikazana su ona koja pripadaju važećoj verziji.'
        :'Zadatak je izmenjen. Ranija pitanja pripadaju starijoj verziji.','info');
      return;
    }
    setContext(c);setRows(feed.podatak);
  }
  async function finish(i:QaIntent,c:QaRecoveredCommand,token:object):Promise<'FOUND'|'UNKNOWN'> {
    if(!matchesQaReceipt(i,c)){setAbsent(false);say('Ova radnja se ne poklapa sa sačuvanom. Slanje je zaustavljeno.');return 'UNKNOWN';}
    await qaIntentJournal.clear(accountId!,i.needId,i.clientRequestId);
    if(!live(token))return 'UNKNOWN';
    setIntent(null);setAbsent(false);setClassification(null);setMaterial(false);setTarget(null);setText('');
    setReceipt(c.receipt.status==='PENDING_ANSWER'?'Pitanje je poslato. Javno se prikazuje kada stigne odgovor.':c.receipt.status==='ANSWERED_PUBLIC'?'Odgovor je objavljen.':c.receipt.status==='IGNORED'?'Pitanje je sklonjeno iz neodgovorenih.':'Prijava pitanja je zabeležena. To ne znači da je pregled već završen.');
    return 'FOUND';
  }
  async function consumeAi(i:Exclude<QaIntent,{type:'DISPOSITION'}>,s:QaSubmissionStatus,token:object):Promise<'FOUND'|'ABSENT'|'UNKNOWN'|'TERMINAL'> {
    if(!live(token))return 'UNKNOWN';
    if(s.state!=='ABSENT'&&(s.type!==i.type||s.needRevision!==i.needRevision||s.textSha256!==i.textSha256||s.questionId!==(i.type==='ANSWER'?i.questionId:null))){
      setClassification(null);setAbsent(false);say('Ne znamo da li je pitanje obrađeno. Osveži pa proveri.');return 'UNKNOWN';
    }
    setClassification(s);setAbsent(s.state==='ABSENT'||s.state==='READY');
    if(s.state==='COMMITTED')return finish(i,{type:i.type,needRevision:i.needRevision,textSha256:i.textSha256,receipt:s.receipt!},token);
    if(['CANCELLED','REJECTED','STALE'].includes(s.state)) {
      await qaIntentJournal.clear(accountId!,i.needId,i.clientRequestId);if(!live(token))return 'UNKNOWN';
      setIntent(null);setAbsent(false);setClassification(null);setMaterial(s.materiality==='MATERIAL');
      setReceipt(s.state==='CANCELLED'&&s.safeReasonCodes.includes('QA_PROCESSING_FAILED')?'Provera teksta nije uspela. Tekst nije poslat. Možete da ga pošaljete ponovo.'
        :s.state==='CANCELLED'?'Slanje je otkazano. Tekst neće biti objavljen naknadno.'
        :s.state==='STALE'?'Zadatak ili pravila su promenjeni. Pregledajte aktuelna pitanja pre novog slanja.'
         :s.materiality==='MATERIAL'?'Odgovor menja uslove zadatka. Izmenite zadatak kroz pregled i objavu.'
          :s.safeReasonCodes.some(c=>['QA_ACCOUNT_DAILY_LIMIT','QA_TASK_DAILY_LIMIT','QA_ASK_COOLDOWN'].includes(c))?'Dostignuto je ograničenje slanja pitanja. Pokušajte kasnije.'
           :s.safeReasonCodes.includes('QA_DUPLICATE_QUESTION')?'Isto pitanje je već postavljeno za ovu verziju zadatka.'
            :s.outcome==='CLARIFY'?'Tekst treba jasnije da opiše pitanje ili odgovor. Doradite ga pre novog slanja.'
             :s.outcome==='REVIEW'?'Predloženi tekst trenutno nije odobren za javnu objavu.'
              :'Predloženi tekst nije objavljen. Pregledajte ga pre novog slanja.');
      return 'TERMINAL';
    }
    if(s.state==='PROCESSING'){say('Prethodno slanje se još proverava. Sačekaj ishod ili odustani od ovog slanja.','info');return 'UNKNOWN';}
    if(s.state==='READY')say('Tekst je proveren, ali još nije objavljen. Upiši isti tekst pa pošalji ponovo.','info');
    return 'ABSENT';
  }
  async function readIntent(i:QaIntent,token:object):Promise<'FOUND'|'ABSENT'|'UNKNOWN'|'TERMINAL'> {
    setClassification(null);setAbsent(false);
    const result=await qaRecoveryClientService.read(i.needId,i.clientRequestId,account);
    if(!live(token))return 'UNKNOWN';
    if(!result.ok){say(result.poruka);return 'UNKNOWN';}
    if(result.podatak.found)return finish(i,result.podatak.command!,token);
    if(i.type==='DISPOSITION'){setAbsent(true);return 'ABSENT';}
    const status=await ai.recover(i.needId,i.clientRequestId,account);
    if(!live(token))return 'UNKNOWN';
    if(!status.ok){say(status.poruka);return 'UNKNOWN';}
    return consumeAi(i,status.podatak,token);
  }
  async function restore(token:object) {
    const saved=await qaIntentJournal.load(accountId!,needId!);
    if(!live(token))return;
    setIntent(saved);setAbsent(false);
    if(saved)await readIntent(saved,token);
    if(live(token))await readFeed(token,!saved);
  }
  async function run(work:(token:object)=>Promise<void>,token=visit) {
    if(!live(token)||lock.current)return;
    lock.current=true;setBusy(true);say('');
    try{await work(token!);}catch{if(live(token))say('Stanje radnje nije potvrđeno. Proveri ponovo pre slanja.');}
    finally{if(live(token)){lock.current=false;setBusy(false);}}
  }
  useFocusEffect(useCallback(()=>{
    const token={};focus.current=token;setVisit(token);leaving.current=false;active.current=AppState.currentState==='active';lock.current=false;
    if(needId&&accountId)void run(restore,token);else{setBusy(false);say('Ponovo otvori zadatak sa prijavljenog naloga.');}
    const subscription=AppState.addEventListener('change',next=>{
      active.current=next==='active';
      if(leaving.current)return;
      if(!active.current){focus.current=null;lock.current=false;}
      else if(focus.current===null){const foreground={};focus.current=foreground;setVisit(foreground);void run(restore,foreground);}
    });
    return()=>{focus.current=null;lock.current=false;subscription.remove();};
  // The screen is keyed by Task and account incarnation, and explicitly checks
  // that identity before every asynchronous boundary and network dispatch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[needId,accountId,accountRevision]));

  async function send(i:QaIntent,body:string,token:object) {
    if(!live(token))return;
    if(i.type!=='DISPOSITION') {
      const result=await ai.submit({type:i.type,needId:i.needId,needRevision:i.needRevision,clientRequestId:i.clientRequestId,
        ...(i.type==='ANSWER'?{questionId:i.questionId}:{}),text:body},account);
      if(!live(token))return;
      if(result.ok)await consumeAi(i,result.podatak,token);else{say(result.poruka);await readIntent(i,token);}
      if(live(token))await readFeed(token);return;
    }
    const result=await qa.dispositionQuestion(i.questionId,i.action,i.clientRequestId);
    if(!live(token))return;
    if(!result.ok)say(result.poruka);
    const outcome=await readIntent(i,token);
    if(!live(token))return;
    if(!result.ok&&rejected.has(result.kod)&&outcome==='ABSENT') {
      await qaIntentJournal.clear(accountId!,i.needId,i.clientRequestId);
      if(!live(token))return;setIntent(null);setAbsent(false);
    }
    if(live(token))await readFeed(token);
  }
  function submit(action?:'IGNORE'|'REPORT',question?:OwnerPreselectionQuestion) {
    if(renderGeneration!==viewGeneration.current)return;
    void run(async token=>{
      if(!context||intent)return;
      const q=question??target,body=text.trim();
      if(action?context.mode!=='OWNER'||q?.status!=='PENDING_ANSWER'
        :q?(!context.canComposeAnswer||q.needRevision!==context.needRevision||!body)
        :(!context.canAsk||!body))return;
      if(!action&&((q?context.answerMaxChars:context.questionMaxChars)??Infinity)<Array.from(body).length){say('Tekst je duži od dozvoljenog. Skrati ga pre slanja.');return;}
      const common={accountId:accountId!,needId:needId!,needRevision:q?.needRevision??context.needRevision,clientRequestId:noviUuidZahtevId()};
      const i:QaIntent=action?{...common,type:'DISPOSITION',questionId:q!.questionId,action,textSha256:null}
        :q?{...common,type:'ANSWER',questionId:q.questionId,textSha256:qaTextHash(body)}
        :{...common,type:'ASK',textSha256:qaTextHash(body)};
      await qaIntentJournal.save(i);if(!live(token))return;
      setIntent(i);setAbsent(false);setClassification(null);setMaterial(false);setReceipt('');await send(i,body,token);
    });
  }
  const retry=()=>run(async token=>{
    if(renderGeneration!==viewGeneration.current)return;
    if(!intent||!absent)return;
    const body=text.trim();
    if(intent.textSha256!==null&&qaTextHash(body)!==intent.textSha256){say('Za ponovno slanje upiši isti tekst. Prethodni tekst nije sačuvan na telefonu.');return;}
    if(await readIntent(intent,token)!=='ABSENT'||!live(token))return;
    await send(intent,body,token);
  });
  const cancel=()=>run(async token=>{
    if(renderGeneration!==viewGeneration.current||!intent||intent.type==='DISPOSITION'||!classification?.canCancel)return;
    const outcome=await readIntent(intent,token);if(!live(token)||outcome==='FOUND'||outcome==='TERMINAL')return;
    const identity:QaSubmissionIdentity={type:intent.type,needId:intent.needId,needRevision:intent.needRevision,clientRequestId:intent.clientRequestId,textSha256:intent.textSha256,
      ...(intent.type==='ANSWER'?{questionId:intent.questionId}:{})};
    const result=await ai.cancel(identity,account);if(!live(token))return;
    if(result.ok)await consumeAi(intent,result.podatak,token);else{say(result.poruka);await readIntent(intent,token);}
    if(live(token))await readFeed(token);
  });
  const canEdit=()=>renderGeneration===viewGeneration.current&&live(visit)&&!lock.current;
  const choose=(q:OwnerPreselectionQuestion)=>{if(canEdit()&&!intent){setTarget(q);setText(q.answerText??'');setReceipt('');}};
  // Navigation retires this visit synchronously: blur can arrive after a saved
  // intent finishes. Keep that intent for read-first recovery on a real return.
  // Back also works on an invalid-task error; data admission still requires live().
  const leave=(navigate:()=>void,idleOnly=false)=>{
    if(!ownsVisit(visit)||(idleOnly&&lock.current))return;
    leaving.current=true;focus.current=null;lock.current=false;viewGeneration.current++;navigate();
  };
  const current=rows.filter(q=>q.needRevision===context?.needRevision);
  const pending=current.filter((q):q is OwnerPreselectionQuestion=>'status'in q&&q.status==='PENDING_ANSWER');
  const answered=current.filter(q=>!('status'in q)||q.status==='ANSWERED_PUBLIC');
  const historical=rows.filter(q=>q.needRevision!==context?.needRevision);
  const set=current.filter(q=>'status'in q&&['IGNORED','REPORTED'].includes(q.status));
  return <TaskQaPresentation
    title={context?.title??null} mode={context?.mode??null} loaded={!!context} busy={busy} message={message} messageTone={messageTone} receipt={receipt}
    canRetryRead={!!needId&&!!accountId} material={material}
    recovery={intent?{kind:intent.type==='DISPOSITION'?'DISPOSITION':'TEXT',absent,canCancel:!!classification?.canCancel}:null}
    cannotAsk={context?.mode==='PUBLIC'&&!context.canAsk?(!context.activeWorker
      ?{text:'Za postavljanje pitanja potreban je aktivan profil za uskakanje.',
        ...(onWorkerProfile?{action:{label:'Dopunite profil za uskakanje',onPress:()=>leave(onWorkerProfile,true)}}:{})}
      :context.ratePolicyState==='NOT_READY'?{text:'Slanje novih pitanja trenutno nije dostupno. Objavljeni odgovori ostaju vidljivi.'}
        :{text:'Pitanja za ovu verziju zadatka trenutno nisu dostupna.'}):null}
    composer={!intent&&(target||context?.canAsk)?{answering:target?target.questionText:null,answeringId:target?.questionId??null,revisionChanged:!!target&&target.needRevision!==context?.needRevision,
      maxChars:(target?context?.answerMaxChars:context?.questionMaxChars)??null}:null}
    text={text} canAnswer={!!context?.canComposeAnswer} pending={pending} answered={answered} set={set} historical={historical}
    onBack={()=>leave(onBack)} onRefresh={()=>void run(restore)} onText={value=>{if(canEdit())setText(value);}} onSend={()=>submit()}
    onRetry={()=>void retry()} onCancel={()=>void cancel()} onChoose={choose} onDispose={(action,q)=>submit(action,q)}
    onCloseAnswer={()=>{if(canEdit()){setTarget(null);setText('');}}} onEditTask={()=>leave(onBack,true)}/>;
}
