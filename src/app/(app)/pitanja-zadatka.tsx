import {useLocalSearchParams,useRouter} from 'expo-router';
import {useSesija} from '../../store/sesija';
import {TaskQaScreen} from '../../ui/qa/TaskQaScreen';
import {uuid} from '../../data/serverReceipt';

export default function TaskQuestionsRoute() {
  const {needId,own:ownParam,questionId}=useLocalSearchParams<{needId:string|string[];own?:string|string[];questionId?:string|string[]}>();
  const router=useRouter(),s=useSesija();
  // Whose task this is comes with the link that opened it, never from a mode of the app. A link
  // that does not say (an older one) falls back to Početna rather than to a guess.
  const own=ownParam==='1'?true:ownParam==='0'?false:null;
  return <TaskQaScreen key={`${s.user?.id}:${s.accountRevision}:${String(needId)}:${uuid(questionId)?questionId:''}`}
    needId={uuid(needId)?needId:null}
    initialQuestionId={uuid(questionId)?questionId:undefined}
    // Questions belong to one task; leaving them used to land on the map. With no stack to go back
    // to — a notification opened from a cold start — the task they are about is the place to be, and
    // which screen that is depends on whose task it is.
    onBack={()=>router.canGoBack()?router.back()
      :uuid(needId)&&own!==null?router.replace(own?{pathname:'/potrebe/[id]/pregled',params:{id:String(needId)}}
        :{pathname:'/prilike/[id]',params:{id:String(needId)}})
      :router.replace('/')}
    // A missing Radni profil is not a dead end: the notice offers the same way there as an application does.
    onWorkerProfile={()=>router.push('/profil/radnik')}/>;
}
