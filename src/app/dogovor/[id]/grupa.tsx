import { useLocalSearchParams } from 'expo-router';
import { GroupConversationScreen } from '../../../ui/groups/GroupConversationScreen';
import { useSesija } from '../../../store/sesija';

export default function GroupConversationRoute(){
 const params=useLocalSearchParams<{id?:string|string[];from?:string|string[];groupId?:string;messageId?:string;sequence?:string}>(),session=useSesija();
 const id=typeof params.id==='string'?params.id:'';
 const target=params.messageId||params.groupId||params.sequence ? {groupId:params.groupId??'',messageId:params.messageId??'',sequence:params.sequence??''}:undefined;
 return <GroupConversationScreen key={`${session.user?.id??''}:${session.accountRevision}:${id}:${params.messageId??''}:${params.groupId??''}:${params.sequence??''}`} initialTarget={target} agreementId={id} fromInbox={params.from==='poruke'}/>;
}
