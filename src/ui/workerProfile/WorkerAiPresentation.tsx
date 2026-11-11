import type { ReactNode } from 'react';
import { workerAreasLabel } from '../../contracts/workerAreas';
import { serviceHandoffText } from '../../contracts/serviceHandoff';
import { StyleSheet, View } from 'react-native';
import type { WorkerAiProfile, WorkerAiReview } from '../../data/workerAiClientService';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt, type FactArtKind, type FactArtRole } from '../system/FactArt';
import { ClockArt } from '../system/ClockArt';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { useAiDraftDisclosure } from '../aiFirst/AiConversationShell';
import { classificationPreparationMessage } from '../../features/ai/intake/intakeReviewReadiness';
import { V2Action } from '../v2/V2Action';
import { FactChoiceEditor } from '../v2/FactChoiceEditor';
import { cityLabel } from '../profile/cityLabel';
import { ResolvedPinMap } from '../location/ResolvedPinMap';
import { displayedPinPosition } from '../location/ResolvedPinMap.types';
import { civilClock, civilDay, scheduleZone, weekdays } from '../calendar/calendarPresentation';
import { raspon } from '../../lib/vreme';
import { plural } from '../system/plural';
import { WORKER_PART_TITLE, toolsAndVehiclesNote, type WorkerAiPart } from './workerProfileFacts';

/** One word for nothing given (2026-09-24): three different empty words read as three different states. */
const EMPTY='Nije navedeno';
const list=(values:readonly string[])=>values.length?values.join(' · '):EMPTY;
const artRole=(kind:FactArtKind):FactArtRole => kind==='pin'||kind==='map'||kind==='remote'?'location'
  :kind==='clock'||kind==='calendar'?'time':kind==='tool'||kind==='vehicle'||kind==='tasks'?'skills'
    :kind==='person'||kind==='users'?'people':'ai';
/** Live card of the worker profile proposal beside the conversation. */
export function WorkerAiCard({profile,compact,review,disabled,reviewInFooter=false,showReview=true,reviewReason,resumed=false,
  verifiedReview=null,pending=false}:{
  profile:WorkerAiProfile;compact:boolean;review:()=>void;disabled:boolean;reviewInFooter?:boolean;
  showReview?:boolean;reviewReason?:string;resumed?:boolean;
  /** The route passes only an owned, current, unexpired review. Candidate prose is never scope evidence. */
  verifiedReview?:WorkerAiReview|null;pending?:boolean;
}){
  const { expanded, toggle } = useAiDraftDisclosure();
  const skills = profile.skills.length ? profile.skills.join(' · ') : 'Koje zadatke možete da preuzmete?';
  const place = profile.location.city.trim()
    ?`${cityLabel(profile.location.city)}${profile.location.operatingCountryCode ? ` · ${profile.location.operatingCountryCode}` : ''}`:null;
  const availability = profile.availability.availableNow ? 'Mogu odmah' : 'Mogu odmah: isključeno';
  const schedule = `${plural(profile.availability.rules.length, 'redovan termin', 'redovna termina', 'redovnih termina')} · ${plural(profile.availability.windows.length, 'poseban termin', 'posebna termina', 'posebnih termina')}`;
  const modes=verifiedReview?.classificationState==='READY'?verifiedReview.reviewedServiceModes??[]:[];
  const shownSkills=expanded?profile.skills:profile.skills.slice(0,2);
  const onSite=modes.some(item=>item.mode==='ON_SITE');
  return <Surface kind="panel" testID="worker-draft-summary"
    style={[s.card,compact&&s.cardCompact]}>
    <Press testID="worker-draft-disclosure" accessibilityRole="button"
      accessibilityLabel={expanded ? 'Sakrijte detalje nacrta radnog profila' : 'Prikažite detalje nacrta radnog profila'}
      accessibilityValue={{text:skills}} accessibilityState={{expanded}}
      accessibilityHint="Prikazuje sažetak unetih podataka u razgovoru."
      onPress={toggle} haptic="select" style={s.previewHead}>
      <FactArt kind="tasks" size={32} cut="art" />
      <View style={[s.grow,s.previewSummary]}>
        <T variant="bodyStrong">Razumeo sam</T>
        <T variant="note" tone="muted">Nacrt · nije sačuvan · {expanded?'Sakrijte detalje':'Detalji'}</T>
      </View>
      <Glyph name={expanded?'caret-up':'caret-down'} tone="muted"/>
    </Press>
    <View testID="worker-understood-services" style={s.previewFacts}>
      {shownSkills.map(service=>{
        const scopes=modes.filter(item=>item.service===service).map(item=>item.mode==='ON_SITE'?'Kod domaćina':'Bez dolaska kod domaćina');
        const handoff=scopes.length&&verifiedReview?.classificationState==='READY'
          ?serviceHandoffText(verifiedReview.classificationCandidates?.find(item=>item.service===service&&item.mode==='REMOTE')?.handoff):null;
        return <View key={service} style={s.service}>
          <T variant="bodyStrong">{service}</T>
          {scopes.length?<T testID="worker-understood-mode" variant="note" tone="muted">{scopes.join(' · ')}</T>:null}
          {handoff?<T testID="worker-understood-handoff" variant="note" tone="muted">{handoff}</T>:null}
        </View>;
      })}
      {!profile.skills.length?<T variant="note" tone="muted">Usluge još razjašnjavamo.</T>:null}
      {!expanded&&profile.skills.length>shownSkills.length?<T variant="note" tone="muted">{`Još ${profile.skills.length-shownSkills.length} u detaljima`}</T>:null}
      {(onSite||!modes.length)&&profile.workAreas?.length?<PreviewFact art="pin">{workerAreasLabel(profile.workAreas)}</PreviewFact>
        :place?<PreviewFact art="pin">{onSite
        ?`${place} · do ${profile.location.radiusKm} km${displayedPinPosition(profile.location.approximatePosition,true)?'':' (za okolna mesta potvrdite centar)'}`
        :`Grad profila: ${place}`}</PreviewFact>:null}
      {profile.availability.availableNow?<PreviewFact art="clock">{availability}</PreviewFact>:null}
      {!modes.length&&profile.skills.length?<T testID="worker-understood-pending" variant="note" tone="muted">Način rada i predaju proveravamo u pregledu.</T>:null}
    </View>
    {pending||resumed?<T testID="worker-draft-review-note" variant="note" tone="muted">{pending
      ?'Prethodno zabeleženo. Čekamo odgovor na poslednju poruku.'
      :'Nastavljen nacrt. Sačuvani profil ostaje isti do pregleda i čuvanja.'}</T>:null}
    {expanded?<View testID="worker-draft-details" style={s.previewFacts}>
        {!profile.availability.availableNow?<PreviewFact art="clock">{availability}</PreviewFact>:null}
        {profile.availability.rules.length||profile.availability.windows.length?<PreviewFact art="calendar">{schedule}</PreviewFact>:null}
      </View>:null}
    {showReview&&!reviewInFooter?<View style={s.reviewAction}>
      <Press testID="worker-draft-review" accessibilityRole="button" accessibilityLabel="Pregledajte profil"
        accessibilityHint={disabled&&reviewReason?reviewReason:'Otvara sve podatke pre završnog čuvanja.'}
        accessibilityState={{disabled}} disabled={disabled}
        onPress={() => { if (!disabled) review(); }} haptic={disabled?'none':'select'}
        style={[s.reviewButton, disabled && s.reviewButtonDisabled]}>
        <T variant="note" style={[s.reviewButtonText, disabled && s.muted]}>Pregledajte profil</T>
        <ReviewCue disabled={disabled}/>
      </Press>
      {disabled&&reviewReason?<T accessibilityLiveRegion="polite" variant="note" tone="muted">{reviewReason}</T>:null}
    </View>:null}
  </Surface>;
}
function ReviewCue({disabled}:{disabled:boolean}){
  return <View style={[s.reviewCue,disabled&&s.reviewCueDisabled]}>
    <Glyph name="caret-right" size={16} tone={disabled?'muted':'onGreen'}/>
  </View>;
}
function PreviewFact({art,children}:{art:FactArtKind;children:string}){
  return <View style={s.previewFact}>{art === 'clock' ? <ClockArt size={24} /> : <FactArt kind={art} size={24} cut="art" role={artRole(art)}/>}<T variant="note" style={[s.grow,s.ink]}>{children}</T></View>;
}
function Row({label,value,quiet=false}:{label:string;value:string;quiet?:boolean}){
  return <View style={s.row}><T variant="meta" tone="muted">{label}</T><T selectable variant="body" style={quiet?s.muted:s.ink}>{value}</T></View>;
}
/** A fact of the review beside its picture, at reading size. */
function Fact({art,children,quiet=false}:{art:FactArtKind;children:string;quiet?:boolean}){
  return <View style={s.fact}>{art==='clock'?<ClockArt size={24}/>:<FactArt kind={art} size={24} cut="art" role={artRole(art)}/>}
    <T selectable variant="body" style={[s.grow,quiet?s.muted:s.ink]}>{children}</T></View>;
}
/** Facts are read together; one correction action returns to their shared conversation. */
function ReviewGroup({part,children}:{part:WorkerAiPart;children:ReactNode}){
  const title=WORKER_PART_TITLE[part];
  return <View testID={`worker-review-${part}`} style={s.group}>
    <View style={s.groupHead}>
      <T accessibilityRole="header" variant="bodyStrong" style={[s.grow,s.ink]}>{title}</T>
    </View>
    <View style={s.groupBody}>{children}</View>
  </View>;
}

/** Owner 2026-10-07: the interview ends by saying what the profile is for — ink with the bell, not grey small print. */
// "novim i već otvorenim": publishing queues new tasks, and saving the profile re-queues the open ones (requeue_open_needs_for_worker_v5).
export const WORKER_PROFILE_NOTIFICATIONS_NOTE='Zadatke povezujemo sa potvrđenim uslugama, načinom rada, područjem i vremenom. Obaveštenja birate Vi.';
export const WORKER_PROFILE_PENDING_NOTIFICATIONS_NOTE='Automatska obaveštenja za ove usluge još nisu spremna. Čuvanje profila samo po sebi ne potvrđuje povezivanje sa zadacima.';
export function WorkerAiNotificationsNote({matchingReady=false}:{matchingReady?:boolean}={}){
  return <View style={s.noteBox}><FactArt kind="bell" size={24} cut="art"/>
    <T testID="worker-review-notifications-note" variant="note" style={[s.grow,s.ink]}>{matchingReady?WORKER_PROFILE_NOTIFICATIONS_NOTE:WORKER_PROFILE_PENDING_NOTIFICATIONS_NOTE}</T></View>;
}
/** The server names the missing name "Ime"; it is the name of the ACCOUNT now (owner, 8 Oct 2026), so that is what the person is told to add. */
const missingLabel=(label:string)=>label==='Ime'?'Ime naloga':label;
/**
 * Frozen personal-profile review: what the conversation understood, with one AI correction action. Legacy
 * equipment remains visible here while the V1 signed Save still writes it. Nothing here is a location editor: the
 * map is the frozen approximate centre, and every correction returns to the same conversation and a fresh review.
 *
 * There is no row for the name: the profile is saved under the name of the account (owner, 8 Oct 2026: one name for everything), which the route puts into
 * the proposal before the review is made. Only when the account has no name at all does the review say so, with `onAddName` leading to the one place
 * it is written ("Lični podaci").
 */
export function WorkerAiReviewDetails({review,onEdit,editDisabled=false,onAddName}:{review:WorkerAiReview;
  /** Returns to the same AI conversation without sending or changing a fact. */
  onEdit?:()=>void;editDisabled?:boolean;
  /** The way to "Lični podaci" when the account has no name; without it the missing name is only said. */ onAddName?:()=>void}){
  const p=review.profile;
  const point=displayedPinPosition(p.location.approximatePosition,true);
  // A country alone is not a profile city. REMOTE-only work can have no city.
  const city=p.location.city.trim();
  const place=city?[cityLabel(city),p.location.operatingCountryCode].filter(Boolean).join(' · '):'';
  const confirmedModes=review.classificationState==='READY'?review.reviewedServiceModes??[]:[];
  const onSite=confirmedModes.some(item=>item.mode==='ON_SITE'),remote=confirmedModes.some(item=>item.mode==='REMOTE');
  const hasSchedule=p.availability.rules.length>0||p.availability.windows.length>0;
  const pendingActivation=review.missingRequired.includes('Potvrda usluga za rad na daljinu');
  const missingFacts=review.missingRequired.filter(label=>label!=='Potvrda usluga za rad na daljinu');
  return <View style={s.review}>
    {missingFacts.length?<View style={s.reviewNotice}><FactArt kind="info" size={24} cut="art" role="waiting"/>
      <T accessibilityRole="alert" variant="body" style={[s.grow,s.ink]}>Dopunite: {missingFacts.map(missingLabel).join(', ')}.</T></View>:null}
    {pendingActivation?<View style={s.reviewNotice}><FactArt kind="info" size={24} cut="art" role="waiting"/>
      <T accessibilityRole="alert" variant="body" style={[s.grow,s.ink]}>Aktivacija čeka potvrdu usluga za rad na daljinu. Za čuvanje bez aktivacije izaberite „Nacrt“.</T></View>:null}
    {review.missingRequired.includes('Ime')&&onAddName?<V2Action label="Dodajte ime" kind="secondary" compact onPress={onAddName} style={s.addName}/>:null}
    <ReviewGroup part="skills">
      {p.skills.length?<View style={s.services}>{p.skills.map((skill,index)=>{
        // Scope shown here is part of the server-digested review, not a client
        // inference or a second approval form. Unclassified skills show no fake scope.
        const scopes=confirmedModes.filter(item=>item.service===skill).map(item=>item.mode==='ON_SITE'?'Na lokaciji':'Na daljinu');
        const handoff=review.classificationState==='READY'
          ?serviceHandoffText(review.classificationCandidates?.find(item=>item.service===skill&&item.mode==='REMOTE')?.handoff):null;
        return <View key={`${index}:${skill}`} testID="worker-review-service" style={s.service}>
          <T selectable variant="body" style={s.ink}>{skill}</T>
          {scopes.length?<T variant="note" tone="muted">{scopes.join(' · ')}</T>:null}
          {handoff?<T testID="worker-review-handoff" variant="note" tone="muted">Predaja: {handoff}</T>:null}
        </View>;
      })}</View>:<T variant="body" tone="muted">{EMPTY}</T>}
      {/* The person reviews offered work above. Catalog proposals/IDs/reasons
          remain in the signed receipt and do not become a second user choice. */}
      {review.classificationState&&review.classificationState!=='READY'
        ?<T testID="worker-classification-pending" variant="note" tone="muted">
          {classificationPreparationMessage(review.classificationState)}
        </T>:null}
    </ReviewGroup>
    <ReviewGroup part="area">
      {/* Legacy area facts cannot authorize an on-site visit without signed ON_SITE modes. */}
      {(onSite || !remote) && !!p.workAreas?.length?<>
        <Fact art="pin">{workerAreasLabel(p.workAreas)}</Fact>
        <T testID="worker-area-scope-note" variant="note" tone="muted">{p.workAreas.some(a=>a.kind==='RADIUS')
          ?'Domet se računa od centra navedenog mesta. Kućna adresa nije potrebna.'
          :'Područje dolaska za zadatke na lokaciji. Zadaci na daljinu se proveravaju zasebno.'}</T>
      </>:<>{place||onSite?<Fact art="pin" quiet={!place}>{place
        ?onSite
          ?`${place} · do ${p.location.radiusKm} km${point?'':' (za okolna mesta potvrdite centar)'}`
          :`${place} · grad profila`
        :EMPTY}</Fact>:null}
      {remote?<T variant="note" tone="muted">Zadatak radite bez dolaska kod domaćina: onlajn ili kod sebe.</T>:null}
      {onSite&&point?<ResolvedPinMap coarse disabled height={220} position={point}
        scopeKey={`worker-review:${review.accountId}:${review.profileId}:${review.reviewId}:${review.revision}`}
        onChoose={()=>{ /* Frozen review, never a location editor. */ }}/>:null}
      {onSite
        ?<T variant="note" tone="muted">{point?'Približan centar za terenske zadatke.':'Terenski zadaci van istog grada traže potvrđen približan centar; sada nije podešen.'}</T>:null}
      </>}
    </ReviewGroup>
    <ReviewGroup part="time">
      <Fact art="clock">{p.availability.availableNow?'Mogu odmah':'Mogu odmah: isključeno'}</Fact>
      {p.availability.rules.length?<View style={s.scheduleGroup}>
        <T variant="bodyStrong">Redovna nedelja</T>
        {p.availability.rules.map(rule=><Row key={rule.id} quiet={!rule.active}
          label={weekdays.filter(day=>rule.weekdays.includes(day.day)).map(day=>day.name).join(' · ')}
          value={`${civilClock(rule.startTime)}–${civilClock(rule.endTime)} · od ${civilDay(rule.startsOn)}${rule.endsOn?' do '+civilDay(rule.endsOn):''}${rule.active?'':' · pauzirano'}${rule.label?' · '+rule.label:''}`} />)}
      </View>:<T variant="note" tone="muted">Redovni termini nisu podešeni.</T>}
      {p.availability.windows.length?<View style={s.scheduleGroup}>
        <T variant="bodyStrong">Posebni datumi</T>
        {p.availability.windows.map(w=><Row key={w.id} label={w.state==='AVAILABLE'?'Slobodno za rad':'Zauzeto'}
          value={`${raspon(w.startsAt,w.endsAt,{zona:p.availability.timezone})}${w.label?' · '+w.label:''}`} />)}
      </View>:null}
      {hasSchedule?<T variant="note" tone="muted">{scheduleZone(p.availability.timezone)}. Dogovori ostaju obaveze.</T>:null}
    </ReviewGroup>
    {review.equipmentPolicy!=='PRESERVE_LEGACY_NO_WRITE_V1'&&(p.tools.length||p.vehicles.length)?<ReviewGroup part="tools">
      {p.tools.length?<Fact art="tool">{list(p.tools)}</Fact>:null}
      {p.vehicles.length?<Fact art="vehicle">{list(p.vehicles)}</Fact>:null}
      <T testID="worker-tools-note" variant="note" tone="muted">{toolsAndVehiclesNote()}</T>
    </ReviewGroup>:null}
    <ReviewGroup part="identity">
      <T selectable variant="body" style={p.bio?s.ink:s.muted}>{p.bio||EMPTY}</T>
      {p.bio?<T testID="worker-matching-explanation" variant="note" tone="muted">Vidljivo na Vašem profilu.</T>:null}
    </ReviewGroup>
    {onEdit?<Press accessibilityRole="button" accessibilityLabel="Izmenite kroz razgovor" accessibilityState={{disabled:editDisabled}}
      disabled={editDisabled} haptic={editDisabled?'none':'select'} onPress={()=>{if(!editDisabled)onEdit();}} style={s.edit}>
      <T variant="tab" style={editDisabled?s.muted:s.editText}>Izmenite kroz razgovor</T>
    </Press>:null}
  </View>;
}
export function WorkerAiActivation({activate,disabled,change}:{activate:boolean;disabled:boolean;change:(v:boolean)=>void}){
  return <View style={s.section}><T variant="bodyStrong" style={s.ink}>Posle čuvanja</T>
    <FactChoiceEditor label="Status profila posle čuvanja" value={activate?'active':'draft'} disabled={disabled}
      options={[{value:'active',label:'Aktivan profil'},{value:'draft',label:'Nacrt'}]} onChange={value=>change(value==='active')}/></View>;
}
const s=StyleSheet.create({
  ink:{color:sys.color.ink},
  muted:{color:sys.color.muted},
  grow:{flex:1,minWidth:0},
  card:{
    paddingHorizontal:sys.space.base,paddingVertical:sys.space.md,gap:sys.space.sm,minHeight:layout.touch,
    backgroundColor:sys.color.surface,borderRadius:18,borderWidth:1.5,borderColor:sys.color.cardLine,
    shadowColor:sys.color.ink,shadowOffset:{width:0,height:4},shadowOpacity:0.08,shadowRadius:12,elevation:3,
  },
  cardCompact:{paddingVertical:sys.space.sm,borderRadius:14},
  previewHead:{minHeight:48,flexDirection:'row',alignItems:'center',gap:sys.space.md},
  previewSummary:{gap:sys.space.xs},
  skillHeading:{color:sys.color.ink},
  previewFacts:{gap:sys.space.sm,paddingVertical:sys.space.xs},
  previewFact:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.sm},
  reviewAction:{gap:sys.space.xs,paddingTop:sys.space.xs},
  reviewButton:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:sys.space.sm,
    backgroundColor:sys.color.green,borderRadius:14,paddingHorizontal:sys.space.base},
  reviewButtonDisabled:{backgroundColor:sys.conversation.iconWell},
  reviewButtonText:{color:'#FFFFFF',fontWeight:'700',fontSize:15},
  reviewCue:{flexShrink:0,width:26,height:26,borderRadius:sys.radius.pill,backgroundColor:'rgba(255,255,255,0.22)',alignItems:'center',justifyContent:'center'},
  reviewCueDisabled:{backgroundColor:sys.conversation.iconWell},
  review:{gap:layout.section},
  addName:{alignSelf:'flex-start'},
  // Reading groups share a single correction action; sections have no field-level editors.
  group:{gap:sys.space.xs},
  groupHead:{flexDirection:'row',alignItems:'center',gap:sys.space.sm,minHeight:44},
  groupBody:{gap:sys.space.md},
  edit:{minWidth:44,minHeight:44,justifyContent:'center',alignItems:'center',paddingHorizontal:sys.space.md},
  editText:{color:sys.color.green},
  fact:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.md},
  services:{gap:sys.space.base},
  service:{gap:sys.space.xs,minWidth:0},
  // Supporting context stays in the reading flow; the route owns the main save action.
  noteBox:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.md},
  reviewNotice:{padding:sys.space.base,borderRadius:sys.radius.control,backgroundColor:sys.color.warnSoft,flexDirection:'row',alignItems:'flex-start',gap:sys.space.md,marginBottom:sys.space.sm},
  section:{gap:sys.space.base,paddingVertical:sys.space.base},
  scheduleGroup:{gap:sys.space.md},
  row:{gap:sys.space.xs,minWidth:0},
});
