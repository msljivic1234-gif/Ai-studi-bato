import { Redirect, useLocalSearchParams } from 'expo-router';
import { uuid } from '../../data/serverReceipt';

/** Old links converge on the same review. This route must not keep a second location writer alive. */
export default function MestoZadatka() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const valid = typeof conversationId === 'string' && uuid(conversationId);
  return <Redirect href={valid ? { pathname: '/pregled-zadatka', params: { conversationId } } : '/nova'} />;
}
