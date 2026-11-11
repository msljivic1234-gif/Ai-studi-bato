import {Fragment,type ReactNode} from 'react';
import {KeyboardAvoidingView,Platform,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {OwnerPreselectionQuestion,PublicPreselectionQa} from '../../contracts/preselectionQa';
import {T} from '../Text';
import {V2Action} from '../v2/V2Action';
import {ChromeIconButton,ScreenChrome} from '../system/ScreenChrome';
import {StateView} from '../system/StateView';
import {QuietReadState} from '../v2/QuietReadState';
import {PillComposer,PillNote} from '../system/PillComposer';
import {Surface} from '../system/Surface';
import {ruleWidth} from '../system/layout';
import {useConfirmSheet} from '../system/ConfirmSheet';
import {brandAction,field,sys} from '../system/tokens';

export type Question=OwnerPreselectionQuestion|PublicPreselectionQa;
type Recovery={kind:'TEXT'|'DISPOSITION';absent:boolean;canCancel:boolean};
/** `answeringId` is the question the text answers: its row says "Odgovaraš" instead of offering its actions. */
type Composer={answering:string|null;answeringId?:string|null;revisionChanged:boolean;maxChars:number|null};
/** Why the viewer cannot ask, with the way forward when the app has one ("Dopunite profil majstora"). */
export type CannotAsk={text:string;action?:{label:string;onPress:()=>void}};
export type TaskQaPresentationProps={
  title:string|null;mode:'OWNER'|'PUBLIC'|null;loaded:boolean;busy:boolean;message:string;
  /** Only a real problem is red and announced as an alert; a fact about the thread (a version filter, a checked text) is plain. */
  messageTone?:'danger'|'info';
  receipt:string;canRetryRead:boolean;material:boolean;
  recovery:Recovery|null;cannotAsk:CannotAsk|null;composer:Composer|null;text:string;canAnswer:boolean;
  pending:OwnerPreselectionQuestion[];answered:Question[];set:Question[];historical:Question[];
  onBack:()=>void;onRefresh:()=>void;onText:(value:string)=>void;onSend:()=>void;onRetry:()=>void;onCancel:()=>void;
  onChoose:(q:OwnerPreselectionQuestion)=>void;onDispose:(action:'IGNORE'|'REPORT',q:OwnerPreselectionQuestion)=>void;onCloseAnswer:()=>void;onEditTask:()=>void;
};

/**
 * The questions of one task as a calm public thread (round 6): the question, the owner's answer behind a green rule, and
 * the pill to write in docked above the keyboard, as in Poruke. Presentation only: the screen above owns every read,
 * guard, journal and command, and the gallery draws this with fixtures.
 */
export function TaskQaPresentation(p:TaskQaPresentationProps) {
  const confirm=useConfirmSheet();
  const owner=p.mode==='OWNER',locked=p.busy||!!p.recovery;
  const c=p.composer,length=Array.from(p.text.trim()).length,over=!!c&&c.maxChars!==null&&length>c.maxChars;
  const canSend=!!c&&!p.busy&&length>0&&!over&&!c.revisionChanged;
  // The saved text is not on the phone: until it is written again the retry is grey and says so.
  const sameTextMissing=p.recovery?.kind==='TEXT'&&length===0;
  const ask=(action:'IGNORE'|'REPORT',q:OwnerPreselectionQuestion)=>confirm.ask(action==='IGNORE'
    ?{title:'Preskočiti pitanje?',message:'Pitanje se sklanja iz neodgovorenih i ne objavljuje se. Ovo se ne može vratiti.',confirmLabel:'Preskoči',onConfirm:()=>p.onDispose(action,q)}
    :{title:'Prijaviti pitanje?',message:'Pitanje se označava kao prijavljeno i sklanja se iz neodgovorenih. Ovo se ne može vratiti.',confirmLabel:'Prijavi',tone:'danger',onConfirm:()=>p.onDispose(action,q)});
  const item=(q:Question,history=false)=>{
    const status='status'in q?q.status:null;
    return <View key={q.questionId} style={s.item}>
      {history?<T variant="label" tone="muted">Ranija verzija zadatka</T>:null}
      <T variant="bodyStrong">{q.questionText}</T>
      {q.answerText!==null?<View style={s.answer}><T variant="meta" tone="muted">{q.edited?'Odgovor · izmenjen':'Odgovor'}</T><T>{q.answerText}</T></View>:null}
      {status==='IGNORED'?<T variant="meta" tone="muted">Sklonjeno iz neodgovorenih</T>:null}
      {status==='REPORTED'?<T variant="meta" tone="muted">Prijava zabeležena</T>:null}
      {!history&&owner&&'status'in q&&(q.status==='PENDING_ANSWER'||q.status==='ANSWERED_PUBLIC')?c?.answeringId===q.questionId
        // The row whose answer is being written says so; its commands wait in the pill below, not beside it.
        ?<T variant="meta" tone="muted">Odgovaraš</T>
        :<View style={s.actions}>
          {p.canAnswer?<V2Action label={q.status==='ANSWERED_PUBLIC'?'Izmeni odgovor':'Odgovori'} compact disabled={locked} onPress={()=>p.onChoose(q)}/>:null}
          {q.status==='PENDING_ANSWER'?<>
            <V2Action label="Preskoči pitanje" kind="quiet" compact disabled={locked} onPress={()=>ask('IGNORE',q)}/>
            <V2Action label="Prijavi pitanje" kind="destructive" compact disabled={locked} onPress={()=>ask('REPORT',q)}/></>:null}
        </View>:null}
    </View>;
  };
  // The questions of one list stand one under the other, parted by a line of 1 dp, none above the first and none under the last.
  const parted=(rows:ReactNode[])=>rows.map((row,index)=><Fragment key={index}>{index?<View pointerEvents="none" style={s.rule}/>:null}{row}</Fragment>);
  // A failed read with nothing else to show; a saved action in doubt keeps its own panel, which carries the message.
  const trouble=!p.loaded&&!p.busy&&!!p.message&&!p.recovery;
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':'height'}>
    <SafeAreaView edges={['top','bottom']} style={s.screen}>
      {/* One title in every state, so the bar does not re-lay out once the task is known; the task's name is its quiet line. */}
      <ScreenChrome variant="detail" onBack={p.onBack} title="Pitanja o zadatku" subtitle={p.title??undefined}
        right={<ChromeIconButton label="Osveži pitanja i ishod radnje" glyph="refresh" disabled={p.busy} onPress={p.onRefresh}/>}/>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        {!p.loaded&&p.busy?<QuietReadState art="chat" title="Učitavamo pitanja…" body="Proveravamo pitanja i odgovore za ovaj zadatak." />
          :trouble?<StateView kind="error" art="chat" title="Pitanja nisu učitana" body={p.message}
            primary={p.canRetryRead?{label:'Pokušaj ponovo',onPress:p.onRefresh}:undefined}/>:null}
        {p.loaded||p.recovery?<>
          {/* The rule of the thread, said once: it holds for reading as much as for writing. */}
          <T variant="copy" tone="muted">Pitanja su anonimna. Javno se prikazuju samo pitanja na koja je odgovoreno. Ne unosiš kontakt, preciznu adresu ni podatke za pristup.</T>
          {p.busy?<T variant="meta" tone="muted" accessibilityLiveRegion="polite">Proveravamo pitanja…</T>:null}
          {p.message?p.messageTone==='info'
            ?<T accessibilityLiveRegion="polite">{p.message}</T>
            :<T tone="danger" accessibilityRole="alert">{p.message}</T>:null}
          {p.receipt?<T accessibilityLiveRegion="polite">{p.receipt}</T>:null}
          {p.material?<V2Action label="Nazad na zadatak radi izmene" onPress={p.onEditTask} disabled={p.busy}/>:null}
          {p.recovery?<Surface kind="note" style={s.notice}><T variant="bodyStrong">Provera prethodnog slanja</T>
            <T>Ne znamo da li je prethodno slanje uspelo. Ako izađeš, ništa se ne šalje ponovo.</T>
            {p.recovery.kind==='TEXT'?<><T>Za ponovno slanje upiši isti tekst; nije sačuvan na telefonu.</T>
              <View style={s.fieldBlock}><T variant="label" tone="muted">Isti tekst kao ranije</T>
                <TextInput accessibilityLabel="Isti tekst kao ranije" placeholder="Napiši isti tekst…" placeholderTextColor={sys.color.muted}
                  value={p.text} onChangeText={p.onText} editable={!p.busy} multiline style={s.field}/></View></>:null}
            {p.recovery.absent?<V2Action label="Pošalji ponovo" style={brandAction} disabled={p.busy||sameTextMissing}
              reason={sameTextMissing?'Upiši isti tekst pre ponavljanja.':null} onPress={p.onRetry}/>:null}
            {p.recovery.canCancel?<V2Action label="Odustani od ovog slanja" kind="quiet" disabled={p.busy} onPress={p.onCancel}/>:null}
          </Surface>:null}
          {p.cannotAsk?<Surface kind="note" style={s.notice}><T>{p.cannotAsk.text}</T>
            {p.cannotAsk.action?<V2Action label={p.cannotAsk.action.label} kind="quiet" disabled={p.busy} onPress={p.cannotAsk.action.onPress} style={s.noticeAction}/>:null}
          </Surface>:null}
        </>:null}
        {p.loaded&&owner&&p.pending.length?<View style={s.section}>
          <T variant="heading" accessibilityRole="header">Čekaju odgovor <T variant="heading" tone="muted">· {p.pending.length}</T></T>
          {parted(p.pending.map(q=>item(q)))}</View>:null}
        {p.loaded?<View style={s.section}>
          <T variant="heading" accessibilityRole="header">Pitanja i odgovori</T>
          {p.answered.length?parted(p.answered.map(q=>item(q)))
            :<StateView kind="empty" art="chat" title="Još nema objavljenih odgovora" body="Odgovoreno pitanje se ovde prikazuje javno."/>}
        </View>:null}
        {p.loaded&&owner&&p.set.length?<View style={s.section}><T variant="heading" accessibilityRole="header">Sklonjena pitanja</T>{parted(p.set.map(q=>item(q)))}</View>:null}
        {p.loaded&&owner&&p.historical.length?<View style={s.section}><T variant="heading" accessibilityRole="header">Prethodne verzije</T>
          <T variant="copy" tone="muted">Ovi odgovori ne opisuju trenutne uslove zadatka.</T>{parted(p.historical.map(q=>item(q,true)))}</View>:null}
      </ScrollView>
      {c?<PillComposer value={p.text} onChange={p.onText} label={c.answering!==null?'Tekst odgovora':'Tekst pitanja'}
        placeholder={c.answering!==null?'Napiši odgovor…':'Napiši pitanje…'} sendLabel={c.answering!==null?'Objavi odgovor':'Pošalji pitanje'}
        canSend={canSend} editable={!p.busy} onSend={p.onSend}
        reason={length===0?(c.answering!==null?'Upiši odgovor pre objave.':'Upiši pitanje pre slanja.'):over?'Tekst je duži od dozvoljenog.':c.revisionChanged?'Zadatak je izmenjen.':null}
        above={<>
          {c.answering!==null?<View style={s.answering}>
            <View style={s.answeringText}><T variant="meta" tone="muted">Odgovor na</T><T variant="bodyStrong" numberOfLines={3}>{c.answering}</T></View>
            <ChromeIconButton label="Zatvori odgovor" glyph="close" quiet disabled={p.busy} onPress={p.onCloseAnswer}/>
          </View>:null}
          {c.answering!==null?<PillNote>Odgovor razjašnjava postojeće uslove. Za promenu uslova vrati se na zadatak i izmeni ga kroz pregled i objavu.</PillNote>:null}
          {c.revisionChanged?<PillNote tone="danger" alert>Zadatak je izmenjen. Zatvori odgovor i pregledaj trenutna pitanja pre slanja.</PillNote>:null}
          {over?<PillNote tone="danger">{length.toLocaleString('sr-Latn-RS')} / {c.maxChars!.toLocaleString('sr-Latn-RS')} znakova — skrati tekst.</PillNote>:null}
        </>}/>:null}
      {confirm.sheet}
    </SafeAreaView>
  </KeyboardAvoidingView>;
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:sys.color.ground},
  content:{paddingHorizontal:sys.space.lg,paddingTop:sys.space.sm,paddingBottom:sys.space.xl,gap:sys.space.base},
  section:{gap:sys.space.md,paddingTop:sys.space.sm},
  // A question is a bare item on the page, parted from the next by a line of 1 dp (`rule`): the thread is one list, not a stack of cards.
  item:{gap:sys.space.sm,paddingVertical:sys.space.md},
  rule:{height:ruleWidth,backgroundColor:sys.color.line},
  // The answer stands behind the green rule, so the two voices of the thread differ at a glance.
  answer:{gap:sys.space.xs,paddingLeft:sys.space.md,borderLeftWidth:3,borderLeftColor:sys.color.green},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:sys.space.sm},
  notice:{gap:sys.space.sm},
  // The way out of a notice stands under its sentence, at the sentence's own left edge, sized to its words.
  noticeAction:{alignSelf:'flex-start',paddingHorizontal:0},
  fieldBlock:{gap:sys.space.xs},
  field:{...field,minHeight:96,textAlignVertical:'top'},
  // The pill area is 12 in from the edge; this row steps 8 further so "Odgovor na" lands on the page's 20 dp gutter.
  answering:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.sm,paddingHorizontal:sys.space.sm},
  answeringText:{flex:1,gap:2,paddingTop:sys.space.xs},
});
